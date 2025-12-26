import * as assert from "assert";
import * as sinon from "sinon";
import * as vscode from "vscode";
import { BlameHoverProvider } from "@providers/BlameHoverProvider";
import { CacheService } from "@services/CacheService";
import { GitService } from "@services/GitService";
import { HoverContentService } from "@services/HoverContentService";
import { VcsProviderFactory } from "@services/VcsProviderFactory";
import { IHoverContentService } from "@interfaces/IHoverContentService";
import { IVcsProvider } from "@interfaces/IVcsProvider";
import {
  MergeRequest,
  RemoteInfo,
  VcsError,
  VcsErrorType,
  VcsResult,
} from "@types";

suite("BlameHoverProvider", () => {
  let blameHoverProvider: BlameHoverProvider;
  let mockGitService: sinon.SinonStubbedInstance<GitService>;
  let mockVcsProviderFactory: sinon.SinonStubbedInstance<VcsProviderFactory>;
  let mockCacheService: sinon.SinonStubbedInstance<CacheService>;
  let hoverContentService: IHoverContentService;
  let mockVcsProvider: {
    id: string;
    name: string;
    setToken: sinon.SinonStub;
    hasToken: sinon.SinonStub;
    getHostUrl: sinon.SinonStub;
    setHostUrl: sinon.SinonStub;
    parseRemoteUrl: sinon.SinonStub;
    isProviderUrl: sinon.SinonStub;
    getMergeRequestForCommit: sinon.SinonStub;
    resetErrorState: sinon.SinonStub;
  };
  let vcsErrorCallback: sinon.SinonSpy;
  let getConfigurationStub: sinon.SinonStub;
  let clock: sinon.SinonFakeTimers | undefined;

  setup(() => {
    // Stub vscode.workspace.getConfiguration for CacheService constructor
    getConfigurationStub = sinon.stub(vscode.workspace, "getConfiguration");
    getConfigurationStub.returns({
      get: sinon.stub().returns(3600),
    } as unknown as vscode.WorkspaceConfiguration);

    // Create mock services
    mockGitService = sinon.createStubInstance(GitService);
    mockVcsProviderFactory = sinon.createStubInstance(VcsProviderFactory);
    mockCacheService = sinon.createStubInstance(CacheService);

    // Use real HoverContentService (stateless, no mocking needed)
    hoverContentService = new HoverContentService();

    // Create mock VCS provider
    mockVcsProvider = {
      id: "gitlab",
      name: "GitLab",
      setToken: sinon.stub(),
      hasToken: sinon.stub().returns(true),
      getHostUrl: sinon.stub().returns("https://gitlab.com"),
      setHostUrl: sinon.stub(),
      parseRemoteUrl: sinon.stub(),
      isProviderUrl: sinon.stub().returns(true),
      getMergeRequestForCommit: sinon.stub(),
      resetErrorState: sinon.stub(),
    };

    // Setup factory to return mock provider
    mockVcsProviderFactory.detectProvider.returns(
      mockVcsProvider as unknown as IVcsProvider,
    );

    // Create error callback spy
    vcsErrorCallback = sinon.spy();

    // Create provider with mocked dependencies
    blameHoverProvider = new BlameHoverProvider(
      mockGitService as unknown as GitService,
      mockVcsProviderFactory as unknown as VcsProviderFactory,
      mockCacheService as unknown as CacheService,
      hoverContentService,
      vcsErrorCallback,
    );
  });

  teardown(() => {
    getConfigurationStub.restore();
    if (clock) {
      clock.restore();
    }
  });

  suite("getMergeRequestInfo", () => {
    // Type for accessing private method
    type GetMergeRequestInfoFn = (
      uri: vscode.Uri,
      sha: string,
      token: vscode.CancellationToken,
    ) => Promise<{
      mr: MergeRequest | null;
      loading: boolean;
      checked: boolean;
    }>;

    // Access private method for testing
    function getMergeRequestInfo(
      uri: vscode.Uri,
      sha: string,
      token: vscode.CancellationToken,
    ): Promise<{
      mr: MergeRequest | null;
      loading: boolean;
      checked: boolean;
    }> {
      return (
        blameHoverProvider as unknown as {
          getMergeRequestInfo: GetMergeRequestInfoFn;
        }
      ).getMergeRequestInfo(uri, sha, token);
    }

    // Access private pendingRequests map
    function getPendingRequests(): Map<string, Promise<MergeRequest | null>> {
      return (
        blameHoverProvider as unknown as {
          pendingRequests: Map<string, Promise<MergeRequest | null>>;
        }
      ).pendingRequests;
    }

    const testUri = vscode.Uri.file("/test/file.ts");
    const testSha = "abc123def456";
    const sampleMR: MergeRequest = {
      iid: 42,
      title: "Test MR",
      webUrl: "https://gitlab.com/group/project/-/merge_requests/42",
      mergedAt: "2025-01-15T12:00:00Z",
      state: "merged",
    };
    const sampleRemoteInfo: RemoteInfo = {
      projectPath: "group/project",
      host: "https://gitlab.com",
      provider: "gitlab",
    };

    function createMockCancellationToken(
      isCancelled = false,
    ): vscode.CancellationToken {
      const onCancellationRequestedEmitter = new vscode.EventEmitter<void>();
      return {
        isCancellationRequested: isCancelled,
        onCancellationRequested: onCancellationRequestedEmitter.event,
      };
    }

    test("returns cached MR on cache hit", async () => {
      mockGitService.getRemoteUrl.returns("git@gitlab.com:group/project.git");
      mockCacheService.get.returns(sampleMR);
      const token = createMockCancellationToken();

      const result = await getMergeRequestInfo(testUri, testSha, token);

      assert.deepStrictEqual(result, {
        mr: sampleMR,
        loading: false,
        checked: true,
      });
      assert.strictEqual(
        mockCacheService.get.calledOnceWith("gitlab", testSha),
        true,
      );
      // Provider should be detected but API not called
      assert.strictEqual(mockVcsProviderFactory.detectProvider.called, true);
      assert.strictEqual(
        mockVcsProvider.getMergeRequestForCommit.called,
        false,
      );
    });

    test("returns cached null on cache hit with no MR", async () => {
      mockGitService.getRemoteUrl.returns("git@gitlab.com:group/project.git");
      mockCacheService.get.returns(null);
      const token = createMockCancellationToken();

      const result = await getMergeRequestInfo(testUri, testSha, token);

      assert.deepStrictEqual(result, {
        mr: null,
        loading: false,
        checked: true,
      });
    });

    test("returns loading state when pending request exists", async () => {
      mockGitService.getRemoteUrl.returns("git@gitlab.com:group/project.git");
      mockCacheService.get.returns(undefined);
      const token = createMockCancellationToken();

      // Simulate pending request with provider-specific key
      const pendingRequests = getPendingRequests();
      const pendingKey = `gitlab:${testSha}`;
      pendingRequests.set(pendingKey, Promise.resolve(sampleMR));

      const result = await getMergeRequestInfo(testUri, testSha, token);

      assert.deepStrictEqual(result, {
        mr: null,
        loading: true,
        checked: false,
      });

      // Cleanup
      pendingRequests.delete(pendingKey);
    });

    test("returns unchecked when no remote URL found", async () => {
      mockCacheService.get.returns(undefined);
      mockGitService.getRemoteUrl.returns(undefined);
      const token = createMockCancellationToken();

      const result = await getMergeRequestInfo(testUri, testSha, token);

      assert.deepStrictEqual(result, {
        mr: null,
        loading: false,
        checked: false,
      });
      assert.strictEqual(
        mockGitService.getRemoteUrl.calledOnceWith(testUri),
        true,
      );
    });

    test("returns unchecked when no provider detected", async () => {
      mockCacheService.get.returns(undefined);
      mockGitService.getRemoteUrl.returns("https://unknown.com/user/repo.git");
      mockVcsProviderFactory.detectProvider.returns(undefined);
      const token = createMockCancellationToken();

      const result = await getMergeRequestInfo(testUri, testSha, token);

      assert.deepStrictEqual(result, {
        mr: null,
        loading: false,
        checked: false,
      });
      assert.strictEqual(
        mockVcsProviderFactory.detectProvider.calledOnceWith(
          "https://unknown.com/user/repo.git",
        ),
        true,
      );
    });

    test("returns unchecked when no token configured", async () => {
      mockCacheService.get.returns(undefined);
      mockGitService.getRemoteUrl.returns("git@gitlab.com:group/project.git");
      mockVcsProvider.hasToken.returns(false);
      const token = createMockCancellationToken();

      const result = await getMergeRequestInfo(testUri, testSha, token);

      assert.deepStrictEqual(result, {
        mr: null,
        loading: false,
        checked: false,
      });
      assert.strictEqual(mockVcsProvider.hasToken.calledOnce, true);
    });

    test("returns unchecked when remote URL cannot be parsed", async () => {
      mockCacheService.get.returns(undefined);
      mockGitService.getRemoteUrl.returns("git@gitlab.com:group/project.git");
      mockVcsProvider.hasToken.returns(true);
      mockVcsProvider.parseRemoteUrl.returns(null);
      const token = createMockCancellationToken();

      const result = await getMergeRequestInfo(testUri, testSha, token);

      assert.deepStrictEqual(result, {
        mr: null,
        loading: false,
        checked: false,
      });
      assert.strictEqual(
        mockVcsProvider.parseRemoteUrl.calledOnceWith(
          "git@gitlab.com:group/project.git",
        ),
        true,
      );
    });

    test("fetches MR from API and returns it on success", async () => {
      mockCacheService.get.returns(undefined);
      mockGitService.getRemoteUrl.returns("git@gitlab.com:group/project.git");
      mockVcsProvider.hasToken.returns(true);
      mockVcsProvider.parseRemoteUrl.returns(sampleRemoteInfo);
      const successResult: VcsResult<MergeRequest | null> = {
        success: true,
        data: sampleMR,
      };
      mockVcsProvider.getMergeRequestForCommit.resolves(successResult);
      const token = createMockCancellationToken();

      const result = await getMergeRequestInfo(testUri, testSha, token);

      assert.deepStrictEqual(result, {
        mr: sampleMR,
        loading: false,
        checked: true,
      });
      assert.strictEqual(
        mockVcsProvider.getMergeRequestForCommit.calledOnceWith(
          "group/project",
          testSha,
          "https://gitlab.com",
        ),
        true,
      );
    });

    test("caches MR result after successful fetch", async () => {
      mockCacheService.get.returns(undefined);
      mockGitService.getRemoteUrl.returns("git@gitlab.com:group/project.git");
      mockVcsProvider.hasToken.returns(true);
      mockVcsProvider.parseRemoteUrl.returns(sampleRemoteInfo);
      const successResult: VcsResult<MergeRequest | null> = {
        success: true,
        data: sampleMR,
      };
      mockVcsProvider.getMergeRequestForCommit.resolves(successResult);
      const token = createMockCancellationToken();

      await getMergeRequestInfo(testUri, testSha, token);

      assert.strictEqual(
        mockCacheService.set.calledOnceWith("gitlab", testSha, sampleMR),
        true,
      );
    });

    test("caches null result when API returns no MR", async () => {
      mockCacheService.get.returns(undefined);
      mockGitService.getRemoteUrl.returns("git@gitlab.com:group/project.git");
      mockVcsProvider.hasToken.returns(true);
      mockVcsProvider.parseRemoteUrl.returns(sampleRemoteInfo);
      const successResult: VcsResult<MergeRequest | null> = {
        success: true,
        data: null,
      };
      mockVcsProvider.getMergeRequestForCommit.resolves(successResult);
      const token = createMockCancellationToken();

      const result = await getMergeRequestInfo(testUri, testSha, token);

      assert.deepStrictEqual(result, {
        mr: null,
        loading: false,
        checked: true,
      });
      assert.strictEqual(
        mockCacheService.set.calledOnceWith("gitlab", testSha, null),
        true,
      );
    });

    test("cleans up pending request after completion", async () => {
      mockCacheService.get.returns(undefined);
      mockGitService.getRemoteUrl.returns("git@gitlab.com:group/project.git");
      mockVcsProvider.hasToken.returns(true);
      mockVcsProvider.parseRemoteUrl.returns(sampleRemoteInfo);
      const successResult: VcsResult<MergeRequest | null> = {
        success: true,
        data: sampleMR,
      };
      mockVcsProvider.getMergeRequestForCommit.resolves(successResult);
      const token = createMockCancellationToken();

      const pendingRequests = getPendingRequests();
      const pendingKey = `gitlab:${testSha}`;
      assert.strictEqual(pendingRequests.size, 0);

      await getMergeRequestInfo(testUri, testSha, token);

      // After completion, pending request should be cleaned up
      assert.strictEqual(pendingRequests.size, 0);
      assert.strictEqual(pendingRequests.has(pendingKey), false);
    });

    test("adds pending request during API call", async () => {
      mockCacheService.get.returns(undefined);
      mockGitService.getRemoteUrl.returns("git@gitlab.com:group/project.git");
      mockVcsProvider.hasToken.returns(true);
      mockVcsProvider.parseRemoteUrl.returns(sampleRemoteInfo);

      // Use a deferred promise to control timing
      let resolveApiCall: (result: VcsResult<MergeRequest | null>) => void;
      const apiPromise = new Promise<VcsResult<MergeRequest | null>>(
        (resolve) => {
          resolveApiCall = resolve;
        },
      );
      mockVcsProvider.getMergeRequestForCommit.returns(apiPromise);
      const token = createMockCancellationToken();

      const pendingRequests = getPendingRequests();
      const pendingKey = `gitlab:${testSha}`;

      // Start the request but don't await it yet
      const resultPromise = getMergeRequestInfo(testUri, testSha, token);

      // Check that pending request was added
      // We need a small delay to let the async code run
      await new Promise((resolve) => setTimeout(resolve, 0));
      assert.strictEqual(pendingRequests.has(pendingKey), true);

      // Resolve the API call
      resolveApiCall!({ success: true, data: sampleMR });
      await resultPromise;

      // Pending request should be cleaned up
      assert.strictEqual(pendingRequests.has(pendingKey), false);
    });

    test("returns unchecked when request is cancelled during fetch", async () => {
      mockCacheService.get.returns(undefined);
      mockGitService.getRemoteUrl.returns("git@gitlab.com:group/project.git");
      mockVcsProvider.hasToken.returns(true);
      mockVcsProvider.parseRemoteUrl.returns(sampleRemoteInfo);

      // Create a cancellation token that we can trigger
      const onCancellationRequestedEmitter = new vscode.EventEmitter<void>();
      let isCancelled = false;
      const token: vscode.CancellationToken = {
        get isCancellationRequested() {
          return isCancelled;
        },
        onCancellationRequested: onCancellationRequestedEmitter.event,
      };

      // API call that triggers cancellation before resolving
      mockVcsProvider.getMergeRequestForCommit.callsFake(async () => {
        // Trigger cancellation
        isCancelled = true;
        onCancellationRequestedEmitter.fire();
        // Return after cancellation
        return { success: true, data: sampleMR };
      });

      const result = await getMergeRequestInfo(testUri, testSha, token);

      // Should return unchecked due to cancellation
      assert.deepStrictEqual(result, {
        mr: null,
        loading: false,
        checked: false,
      });
    });

    test("calls error callback on VCS error", async () => {
      mockCacheService.get.returns(undefined);
      mockGitService.getRemoteUrl.returns("git@gitlab.com:group/project.git");
      mockVcsProvider.hasToken.returns(true);
      mockVcsProvider.parseRemoteUrl.returns(sampleRemoteInfo);
      const vcsError: VcsError = {
        type: VcsErrorType.InvalidToken,
        message: "Invalid token",
        shouldShowUI: true,
      };
      const errorResult: VcsResult<MergeRequest | null> = {
        success: false,
        error: vcsError,
      };
      mockVcsProvider.getMergeRequestForCommit.resolves(errorResult);
      const token = createMockCancellationToken();

      await getMergeRequestInfo(testUri, testSha, token);

      assert.strictEqual(vcsErrorCallback.calledOnce, true);
      assert.deepStrictEqual(vcsErrorCallback.firstCall.args[0], vcsError);
      assert.strictEqual(
        vcsErrorCallback.firstCall.args[1],
        mockVcsProvider as unknown as IVcsProvider,
      );
    });

    test("caches null on VCS error to avoid repeated errors", async () => {
      mockCacheService.get.returns(undefined);
      mockGitService.getRemoteUrl.returns("git@gitlab.com:group/project.git");
      mockVcsProvider.hasToken.returns(true);
      mockVcsProvider.parseRemoteUrl.returns(sampleRemoteInfo);
      const errorResult: VcsResult<MergeRequest | null> = {
        success: false,
        error: {
          type: VcsErrorType.NetworkError,
          message: "Network error",
          shouldShowUI: false,
        },
      };
      mockVcsProvider.getMergeRequestForCommit.resolves(errorResult);
      const token = createMockCancellationToken();

      await getMergeRequestInfo(testUri, testSha, token);

      assert.strictEqual(
        mockCacheService.set.calledOnceWith("gitlab", testSha, null),
        true,
      );
    });
  });

  suite("provideHover - PUBLIC API", () => {
    const testUri = vscode.Uri.file("/test/file.ts");
    const testPosition = new vscode.Position(10, 5);
    const testBlameInfo = {
      sha: "abc123def456",
      author: "John Doe",
      authorEmail: "john@example.com",
      date: new Date("2024-01-15T12:00:00Z"),
      summary: "Fix bug in authentication",
      line: 11,
    };
    const sampleMR: MergeRequest = {
      iid: 42,
      title: "Test MR",
      webUrl: "https://gitlab.com/group/project/-/merge_requests/42",
      mergedAt: "2025-01-15T12:00:00Z",
      state: "merged",
    };

    function createMockCancellationToken(
      isCancelled = false,
    ): vscode.CancellationToken {
      const onCancellationRequestedEmitter = new vscode.EventEmitter<void>();
      return {
        isCancellationRequested: isCancelled,
        onCancellationRequested: onCancellationRequestedEmitter.event,
      };
    }

    test("returns hover with MR link when commit has MR", async () => {
      mockGitService.getBlameForLine.resolves(testBlameInfo);
      mockGitService.getRemoteUrl.returns("git@gitlab.com:group/project.git");
      mockCacheService.get.returns(sampleMR);
      const token = createMockCancellationToken();

      const result = await blameHoverProvider.provideHover(
        { uri: testUri } as vscode.TextDocument,
        testPosition,
        token,
      );

      assert.ok(result);
      assert.ok(result instanceof vscode.Hover);
      const markdown = result.contents[0] as vscode.MarkdownString;
      assert.ok(markdown.value.includes("**Merge Request**"));
      assert.ok(markdown.value.includes("!42"));
      assert.ok(markdown.value.includes("Test MR"));
      assert.ok(markdown.value.includes("abc123d")); // Short SHA
      assert.ok(markdown.value.includes("John Doe"));
      assert.ok(markdown.value.includes("Fix bug in authentication"));
    });

    test("returns hover without MR link when commit has no MR", async () => {
      mockGitService.getBlameForLine.resolves(testBlameInfo);
      mockGitService.getRemoteUrl.returns("git@gitlab.com:group/project.git");
      mockCacheService.get.returns(null); // Cached as "no MR"
      const token = createMockCancellationToken();

      const result = await blameHoverProvider.provideHover(
        { uri: testUri } as vscode.TextDocument,
        testPosition,
        token,
      );

      assert.ok(result);
      const markdown = result.contents[0] as vscode.MarkdownString;
      assert.ok(!markdown.value.includes("**Merge Request**"));
      assert.ok(markdown.value.includes("*No associated merge request*"));
      assert.ok(markdown.value.includes("abc123d"));
      assert.ok(markdown.value.includes("John Doe"));
    });

    test("returns null when no blame info available", async () => {
      mockGitService.getBlameForLine.resolves(undefined);
      const token = createMockCancellationToken();

      const result = await blameHoverProvider.provideHover(
        { uri: testUri } as vscode.TextDocument,
        testPosition,
        token,
      );

      assert.strictEqual(result, null);
    });

    test("returns null when cancellation requested before hover build", async () => {
      mockGitService.getBlameForLine.resolves(testBlameInfo);
      const token = createMockCancellationToken(true); // Already cancelled

      const result = await blameHoverProvider.provideHover(
        { uri: testUri } as vscode.TextDocument,
        testPosition,
        token,
      );

      assert.strictEqual(result, null);
    });

    test("includes loading state when MR fetch is pending", async () => {
      mockGitService.getBlameForLine.resolves(testBlameInfo);
      mockCacheService.get.returns(undefined); // Not cached
      mockGitService.getRemoteUrl.returns("git@gitlab.com:group/project.git");
      mockVcsProvider.hasToken.returns(true);
      mockVcsProvider.parseRemoteUrl.returns({
        projectPath: "group/project",
        host: "https://gitlab.com",
        provider: "gitlab",
      });

      // Simulate pending request by adding to pendingRequests map
      const pendingRequests = (
        blameHoverProvider as unknown as {
          pendingRequests: Map<string, Promise<MergeRequest | null>>;
        }
      ).pendingRequests;
      const pendingKey = `gitlab:${testBlameInfo.sha}`;
      pendingRequests.set(pendingKey, Promise.resolve(sampleMR));

      const token = createMockCancellationToken();

      const result = await blameHoverProvider.provideHover(
        { uri: testUri } as vscode.TextDocument,
        testPosition,
        token,
      );

      assert.ok(result);
      const markdown = result.contents[0] as vscode.MarkdownString;
      assert.ok(markdown.value.includes("*Loading merge request...*"));

      // Cleanup
      pendingRequests.delete(pendingKey);
    });

    test("formats MR link with truncation for long titles", async () => {
      const longTitleMR: MergeRequest = {
        iid: 123,
        title:
          "This is a very long merge request title that exceeds fifty characters",
        webUrl: "https://gitlab.com/group/project/-/merge_requests/123",
        mergedAt: "2025-01-15T12:00:00Z",
        state: "merged",
      };

      mockGitService.getBlameForLine.resolves(testBlameInfo);
      mockGitService.getRemoteUrl.returns("git@gitlab.com:group/project.git");
      mockCacheService.get.returns(longTitleMR);
      const token = createMockCancellationToken();

      const result = await blameHoverProvider.provideHover(
        { uri: testUri } as vscode.TextDocument,
        testPosition,
        token,
      );

      assert.ok(result);
      const markdown = result.contents[0] as vscode.MarkdownString;
      assert.ok(markdown.value.includes("!123"));
      // Should include ellipsis in the display text (escaped as \\.\\.\\.)
      // The title is truncated in the link display, not the tooltip
      assert.ok(
        markdown.value.includes("\\.\\.\\.") || markdown.value.includes("..."),
      );
      // Link should still be present with webUrl
      assert.ok(
        markdown.value.includes(
          "https://gitlab.com/group/project/-/merge_requests/123",
        ),
      );
    });

    test("escapes markdown in author name via provideHover", async () => {
      const blameWithMarkdown = {
        ...testBlameInfo,
        author: "**Evil Author**", // Contains markdown
        summary: "_Sneaky_ commit [link](url)",
      };

      mockGitService.getBlameForLine.resolves(blameWithMarkdown);
      mockCacheService.get.returns(null);
      const token = createMockCancellationToken();

      const result = await blameHoverProvider.provideHover(
        { uri: testUri } as vscode.TextDocument,
        testPosition,
        token,
      );

      assert.ok(result);
      const markdown = result.contents[0] as vscode.MarkdownString;
      // Markdown should be escaped
      assert.ok(markdown.value.includes("\\*\\*Evil Author\\*\\*"));
      assert.ok(markdown.value.includes("\\_Sneaky\\_"));
      assert.ok(markdown.value.includes("\\[link\\]"));
    });

    test("handles VCS error by calling error callback", async () => {
      const sampleRemoteInfo = {
        projectPath: "group/project",
        host: "https://gitlab.com",
        provider: "gitlab" as const,
      };

      mockGitService.getBlameForLine.resolves(testBlameInfo);
      mockCacheService.get.returns(undefined); // Not cached
      mockGitService.getRemoteUrl.returns("git@gitlab.com:group/project.git");
      mockVcsProvider.hasToken.returns(true);
      mockVcsProvider.parseRemoteUrl.returns(sampleRemoteInfo);

      const vcsError: VcsError = {
        type: VcsErrorType.InvalidToken,
        message: "Invalid token",
        shouldShowUI: true,
      };
      const errorResult: VcsResult<MergeRequest | null> = {
        success: false,
        error: vcsError,
      };
      mockVcsProvider.getMergeRequestForCommit.resolves(errorResult);

      const token = createMockCancellationToken();

      await blameHoverProvider.provideHover(
        { uri: testUri } as vscode.TextDocument,
        testPosition,
        token,
      );

      // Error callback should have been invoked
      assert.strictEqual(vcsErrorCallback.calledOnce, true);
      assert.deepStrictEqual(vcsErrorCallback.firstCall.args[0], vcsError);
    });
  });
});
