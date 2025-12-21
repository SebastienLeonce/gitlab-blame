import * as assert from "assert";
import * as sinon from "sinon";
import * as vscode from "vscode";
import { BlameHoverProvider } from "../../src/providers/BlameHoverProvider";
import { GitService } from "../../src/services/GitService";
import { VcsProviderFactory } from "../../src/services/VcsProviderFactory";
import { CacheService } from "../../src/services/CacheService";
import { IVcsProvider } from "../../src/interfaces/IVcsProvider";
import {
  MergeRequest,
  VcsResult,
  VcsError,
  VcsErrorType,
  RemoteInfo,
} from "../../src/interfaces/types";

suite("BlameHoverProvider", () => {
  let blameHoverProvider: BlameHoverProvider;
  let mockGitService: sinon.SinonStubbedInstance<GitService>;
  let mockVcsProviderFactory: sinon.SinonStubbedInstance<VcsProviderFactory>;
  let mockCacheService: sinon.SinonStubbedInstance<CacheService>;
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
  let clock: sinon.SinonFakeTimers;

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
      vcsErrorCallback,
    );
  });

  teardown(() => {
    getConfigurationStub.restore();
    if (clock) {
      clock.restore();
    }
  });

  suite("escapeMarkdown", () => {
    // Access private method for testing
    function escapeMarkdown(text: string): string {
      return (
        blameHoverProvider as unknown as {
          escapeMarkdown: (s: string) => string;
        }
      ).escapeMarkdown(text);
    }

    test("escapes backslashes", () => {
      assert.strictEqual(
        escapeMarkdown("path\\to\\file"),
        "path\\\\to\\\\file",
      );
    });

    test("escapes backticks", () => {
      assert.strictEqual(
        escapeMarkdown("use `code` here"),
        "use \\`code\\` here",
      );
    });

    test("escapes asterisks", () => {
      assert.strictEqual(escapeMarkdown("*bold* text"), "\\*bold\\* text");
    });

    test("escapes underscores", () => {
      assert.strictEqual(escapeMarkdown("_italic_ text"), "\\_italic\\_ text");
    });

    test("escapes curly braces", () => {
      assert.strictEqual(escapeMarkdown("{object}"), "\\{object\\}");
    });

    test("escapes square brackets", () => {
      assert.strictEqual(escapeMarkdown("[link]"), "\\[link\\]");
    });

    test("escapes parentheses", () => {
      assert.strictEqual(escapeMarkdown("(note)"), "\\(note\\)");
    });

    test("escapes hash symbol", () => {
      assert.strictEqual(escapeMarkdown("# heading"), "\\# heading");
    });

    test("escapes plus symbol", () => {
      assert.strictEqual(escapeMarkdown("a + b"), "a \\+ b");
    });

    test("escapes hyphen/minus", () => {
      assert.strictEqual(escapeMarkdown("- item"), "\\- item");
    });

    test("escapes period/dot", () => {
      assert.strictEqual(escapeMarkdown("1. list"), "1\\. list");
    });

    test("escapes exclamation mark", () => {
      assert.strictEqual(escapeMarkdown("!important"), "\\!important");
    });

    test("handles empty string", () => {
      assert.strictEqual(escapeMarkdown(""), "");
    });

    test("handles string with no special characters", () => {
      assert.strictEqual(escapeMarkdown("normal text"), "normal text");
    });

    test("escapes multiple special characters in sequence", () => {
      assert.strictEqual(escapeMarkdown("**bold**"), "\\*\\*bold\\*\\*");
    });

    test("escapes markdown link syntax", () => {
      const input = "[Click here](https://example.com)";
      const expected = "\\[Click here\\]\\(https://example\\.com\\)";
      assert.strictEqual(escapeMarkdown(input), expected);
    });

    test("escapes markdown image syntax", () => {
      const input = "![alt](image.png)";
      const expected = "\\!\\[alt\\]\\(image\\.png\\)";
      assert.strictEqual(escapeMarkdown(input), expected);
    });

    test("prevents markdown bold injection in author name", () => {
      const maliciousAuthor = "**Evil Author**";
      const escaped = escapeMarkdown(maliciousAuthor);
      assert.strictEqual(escaped, "\\*\\*Evil Author\\*\\*");
    });

    test("prevents markdown italic injection", () => {
      const maliciousText = "_sneaky italic_";
      const escaped = escapeMarkdown(maliciousText);
      assert.strictEqual(escaped, "\\_sneaky italic\\_");
    });

    test("handles mixed content with Unicode", () => {
      const input = "Fix bug #123 - 田中太郎";
      const expected = "Fix bug \\#123 \\- 田中太郎";
      assert.strictEqual(escapeMarkdown(input), expected);
    });

    test("escapes all special characters in realistic commit message", () => {
      const input =
        "fix(api): resolve issue #42 - handle `null` values [BREAKING]";
      const expected =
        "fix\\(api\\): resolve issue \\#42 \\- handle \\`null\\` values \\[BREAKING\\]";
      assert.strictEqual(escapeMarkdown(input), expected);
    });
  });

  suite("formatRelativeDate", () => {
    // Access private method for testing
    function formatRelativeDate(date: Date): string {
      return (
        blameHoverProvider as unknown as {
          formatRelativeDate: (d: Date) => string;
        }
      ).formatRelativeDate(date);
    }

    setup(() => {
      // Fix time to a known point: 2024-01-15 12:00:00 UTC
      clock = sinon.useFakeTimers(new Date("2024-01-15T12:00:00Z").getTime());
    });

    teardown(() => {
      clock.restore();
    });

    test("returns 'just now' for current time", () => {
      const now = new Date();
      assert.strictEqual(formatRelativeDate(now), "just now");
    });

    test("returns 'just now' for 30 seconds ago", () => {
      const date = new Date(Date.now() - 30 * 1000);
      assert.strictEqual(formatRelativeDate(date), "just now");
    });

    test("returns 'just now' for 59 seconds ago", () => {
      const date = new Date(Date.now() - 59 * 1000);
      assert.strictEqual(formatRelativeDate(date), "just now");
    });

    test("returns '1 minute ago' for 60 seconds ago", () => {
      const date = new Date(Date.now() - 60 * 1000);
      assert.strictEqual(formatRelativeDate(date), "1 minute ago");
    });

    test("returns '1 minute ago' for 90 seconds ago", () => {
      const date = new Date(Date.now() - 90 * 1000);
      assert.strictEqual(formatRelativeDate(date), "1 minute ago");
    });

    test("returns '2 minutes ago' for 2 minutes", () => {
      const date = new Date(Date.now() - 2 * 60 * 1000);
      assert.strictEqual(formatRelativeDate(date), "2 minutes ago");
    });

    test("returns '59 minutes ago' for 59 minutes", () => {
      const date = new Date(Date.now() - 59 * 60 * 1000);
      assert.strictEqual(formatRelativeDate(date), "59 minutes ago");
    });

    test("returns '1 hour ago' for 60 minutes", () => {
      const date = new Date(Date.now() - 60 * 60 * 1000);
      assert.strictEqual(formatRelativeDate(date), "1 hour ago");
    });

    test("returns '1 hour ago' for 90 minutes", () => {
      const date = new Date(Date.now() - 90 * 60 * 1000);
      assert.strictEqual(formatRelativeDate(date), "1 hour ago");
    });

    test("returns '2 hours ago' for 2 hours", () => {
      const date = new Date(Date.now() - 2 * 60 * 60 * 1000);
      assert.strictEqual(formatRelativeDate(date), "2 hours ago");
    });

    test("returns '23 hours ago' for 23 hours", () => {
      const date = new Date(Date.now() - 23 * 60 * 60 * 1000);
      assert.strictEqual(formatRelativeDate(date), "23 hours ago");
    });

    test("returns '1 day ago' for 24 hours", () => {
      const date = new Date(Date.now() - 24 * 60 * 60 * 1000);
      assert.strictEqual(formatRelativeDate(date), "1 day ago");
    });

    test("returns '1 day ago' for 36 hours", () => {
      const date = new Date(Date.now() - 36 * 60 * 60 * 1000);
      assert.strictEqual(formatRelativeDate(date), "1 day ago");
    });

    test("returns '2 days ago' for 48 hours", () => {
      const date = new Date(Date.now() - 48 * 60 * 60 * 1000);
      assert.strictEqual(formatRelativeDate(date), "2 days ago");
    });

    test("returns '6 days ago' for 6 days", () => {
      const date = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
      assert.strictEqual(formatRelativeDate(date), "6 days ago");
    });

    test("returns '1 week ago' for 7 days", () => {
      const date = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      assert.strictEqual(formatRelativeDate(date), "1 week ago");
    });

    test("returns '2 weeks ago' for 14 days", () => {
      const date = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
      assert.strictEqual(formatRelativeDate(date), "2 weeks ago");
    });

    test("returns '3 weeks ago' for 21 days", () => {
      const date = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000);
      assert.strictEqual(formatRelativeDate(date), "3 weeks ago");
    });

    test("returns '1 month ago' for 30 days", () => {
      const date = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      assert.strictEqual(formatRelativeDate(date), "1 month ago");
    });

    test("returns '2 months ago' for 60 days", () => {
      const date = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
      assert.strictEqual(formatRelativeDate(date), "2 months ago");
    });

    test("returns '11 months ago' for 330 days", () => {
      const date = new Date(Date.now() - 330 * 24 * 60 * 60 * 1000);
      assert.strictEqual(formatRelativeDate(date), "11 months ago");
    });

    test("returns '1 year ago' for 365 days", () => {
      const date = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
      assert.strictEqual(formatRelativeDate(date), "1 year ago");
    });

    test("returns '2 years ago' for 730 days", () => {
      const date = new Date(Date.now() - 730 * 24 * 60 * 60 * 1000);
      assert.strictEqual(formatRelativeDate(date), "2 years ago");
    });

    test("returns '5 years ago' for 5 years", () => {
      const date = new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000);
      assert.strictEqual(formatRelativeDate(date), "5 years ago");
    });

    test("handles singular vs plural for minutes", () => {
      const oneMin = new Date(Date.now() - 1 * 60 * 1000);
      const twoMin = new Date(Date.now() - 2 * 60 * 1000);
      assert.strictEqual(formatRelativeDate(oneMin), "1 minute ago");
      assert.strictEqual(formatRelativeDate(twoMin), "2 minutes ago");
    });

    test("handles singular vs plural for hours", () => {
      const oneHour = new Date(Date.now() - 1 * 60 * 60 * 1000);
      const twoHours = new Date(Date.now() - 2 * 60 * 60 * 1000);
      assert.strictEqual(formatRelativeDate(oneHour), "1 hour ago");
      assert.strictEqual(formatRelativeDate(twoHours), "2 hours ago");
    });

    test("handles singular vs plural for days", () => {
      const oneDay = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
      const twoDays = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      assert.strictEqual(formatRelativeDate(oneDay), "1 day ago");
      assert.strictEqual(formatRelativeDate(twoDays), "2 days ago");
    });

    test("handles singular vs plural for weeks", () => {
      const oneWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const twoWeeks = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
      assert.strictEqual(formatRelativeDate(oneWeek), "1 week ago");
      assert.strictEqual(formatRelativeDate(twoWeeks), "2 weeks ago");
    });

    test("handles singular vs plural for months", () => {
      const oneMonth = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const twoMonths = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
      assert.strictEqual(formatRelativeDate(oneMonth), "1 month ago");
      assert.strictEqual(formatRelativeDate(twoMonths), "2 months ago");
    });

    test("handles singular vs plural for years", () => {
      const oneYear = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
      const twoYears = new Date(Date.now() - 730 * 24 * 60 * 60 * 1000);
      assert.strictEqual(formatRelativeDate(oneYear), "1 year ago");
      assert.strictEqual(formatRelativeDate(twoYears), "2 years ago");
    });
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
