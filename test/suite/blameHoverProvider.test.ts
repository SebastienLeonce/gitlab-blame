import * as assert from "assert";
import * as sinon from "sinon";
import * as vscode from "vscode";
import { BlameHoverProvider } from "../../src/providers/BlameHoverProvider";
import { GitService } from "../../src/services/GitService";
import { GitLabService } from "../../src/services/GitLabService";
import { CacheService } from "../../src/services/CacheService";
import { MergeRequest } from "../../src/types";

suite("BlameHoverProvider", () => {
  let blameHoverProvider: BlameHoverProvider;
  let mockGitService: sinon.SinonStubbedInstance<GitService>;
  let mockGitLabService: sinon.SinonStubbedInstance<GitLabService>;
  let mockCacheService: sinon.SinonStubbedInstance<CacheService>;
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
    mockGitLabService = sinon.createStubInstance(GitLabService);
    mockCacheService = sinon.createStubInstance(CacheService);

    // Create provider with mocked dependencies
    blameHoverProvider = new BlameHoverProvider(
      mockGitService as unknown as GitService,
      mockGitLabService as unknown as GitLabService,
      mockCacheService as unknown as CacheService,
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
      mockCacheService.get.returns(sampleMR);
      const token = createMockCancellationToken();

      const result = await getMergeRequestInfo(testUri, testSha, token);

      assert.deepStrictEqual(result, {
        mr: sampleMR,
        loading: false,
        checked: true,
      });
      assert.strictEqual(mockCacheService.get.calledOnceWith(testSha), true);
      // Should not call any other services
      assert.strictEqual(mockGitLabService.hasToken.called, false);
    });

    test("returns cached null on cache hit with no MR", async () => {
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
      mockCacheService.get.returns(undefined);
      const token = createMockCancellationToken();

      // Simulate pending request
      const pendingRequests = getPendingRequests();
      pendingRequests.set(testSha, Promise.resolve(sampleMR));

      const result = await getMergeRequestInfo(testUri, testSha, token);

      assert.deepStrictEqual(result, {
        mr: null,
        loading: true,
        checked: false,
      });

      // Cleanup
      pendingRequests.delete(testSha);
    });

    test("returns unchecked when no token configured", async () => {
      mockCacheService.get.returns(undefined);
      mockGitLabService.hasToken.returns(false);
      const token = createMockCancellationToken();

      const result = await getMergeRequestInfo(testUri, testSha, token);

      assert.deepStrictEqual(result, {
        mr: null,
        loading: false,
        checked: false,
      });
      assert.strictEqual(mockGitLabService.hasToken.calledOnce, true);
      // Should not proceed to get remote URL
      assert.strictEqual(mockGitService.getRemoteUrl.called, false);
    });

    test("returns unchecked when no remote URL found", async () => {
      mockCacheService.get.returns(undefined);
      mockGitLabService.hasToken.returns(true);
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

    test("returns unchecked when remote URL is not GitLab", async () => {
      mockCacheService.get.returns(undefined);
      mockGitLabService.hasToken.returns(true);
      mockGitService.getRemoteUrl.returns("https://github.com/user/repo.git");
      mockGitLabService.parseRemoteUrl.returns(null);
      const token = createMockCancellationToken();

      const result = await getMergeRequestInfo(testUri, testSha, token);

      assert.deepStrictEqual(result, {
        mr: null,
        loading: false,
        checked: false,
      });
      assert.strictEqual(
        mockGitLabService.parseRemoteUrl.calledOnceWith(
          "https://github.com/user/repo.git",
        ),
        true,
      );
    });

    test("fetches MR from API and returns it on success", async () => {
      mockCacheService.get.returns(undefined);
      mockGitLabService.hasToken.returns(true);
      mockGitService.getRemoteUrl.returns("git@gitlab.com:group/project.git");
      mockGitLabService.parseRemoteUrl.returns({
        projectPath: "group/project",
        host: "gitlab.com",
      });
      mockGitLabService.getMergeRequestForCommit.resolves(sampleMR);
      const token = createMockCancellationToken();

      const result = await getMergeRequestInfo(testUri, testSha, token);

      assert.deepStrictEqual(result, {
        mr: sampleMR,
        loading: false,
        checked: true,
      });
      assert.strictEqual(
        mockGitLabService.getMergeRequestForCommit.calledOnceWith(
          "group/project",
          testSha,
          "gitlab.com",
        ),
        true,
      );
    });

    test("caches MR result after successful fetch", async () => {
      mockCacheService.get.returns(undefined);
      mockGitLabService.hasToken.returns(true);
      mockGitService.getRemoteUrl.returns("git@gitlab.com:group/project.git");
      mockGitLabService.parseRemoteUrl.returns({
        projectPath: "group/project",
        host: "gitlab.com",
      });
      mockGitLabService.getMergeRequestForCommit.resolves(sampleMR);
      const token = createMockCancellationToken();

      await getMergeRequestInfo(testUri, testSha, token);

      assert.strictEqual(
        mockCacheService.set.calledOnceWith(testSha, sampleMR),
        true,
      );
    });

    test("caches null result when API returns no MR", async () => {
      mockCacheService.get.returns(undefined);
      mockGitLabService.hasToken.returns(true);
      mockGitService.getRemoteUrl.returns("git@gitlab.com:group/project.git");
      mockGitLabService.parseRemoteUrl.returns({
        projectPath: "group/project",
        host: "gitlab.com",
      });
      mockGitLabService.getMergeRequestForCommit.resolves(null);
      const token = createMockCancellationToken();

      const result = await getMergeRequestInfo(testUri, testSha, token);

      assert.deepStrictEqual(result, {
        mr: null,
        loading: false,
        checked: true,
      });
      assert.strictEqual(
        mockCacheService.set.calledOnceWith(testSha, null),
        true,
      );
    });

    test("cleans up pending request after completion", async () => {
      mockCacheService.get.returns(undefined);
      mockGitLabService.hasToken.returns(true);
      mockGitService.getRemoteUrl.returns("git@gitlab.com:group/project.git");
      mockGitLabService.parseRemoteUrl.returns({
        projectPath: "group/project",
        host: "gitlab.com",
      });
      mockGitLabService.getMergeRequestForCommit.resolves(sampleMR);
      const token = createMockCancellationToken();

      const pendingRequests = getPendingRequests();
      assert.strictEqual(pendingRequests.size, 0);

      await getMergeRequestInfo(testUri, testSha, token);

      // After completion, pending request should be cleaned up
      assert.strictEqual(pendingRequests.size, 0);
      assert.strictEqual(pendingRequests.has(testSha), false);
    });

    test("adds pending request during API call", async () => {
      mockCacheService.get.returns(undefined);
      mockGitLabService.hasToken.returns(true);
      mockGitService.getRemoteUrl.returns("git@gitlab.com:group/project.git");
      mockGitLabService.parseRemoteUrl.returns({
        projectPath: "group/project",
        host: "gitlab.com",
      });

      // Use a deferred promise to control timing
      let resolveApiCall: (mr: MergeRequest) => void;
      const apiPromise = new Promise<MergeRequest>((resolve) => {
        resolveApiCall = resolve;
      });
      mockGitLabService.getMergeRequestForCommit.returns(apiPromise);
      const token = createMockCancellationToken();

      const pendingRequests = getPendingRequests();

      // Start the request but don't await it yet
      const resultPromise = getMergeRequestInfo(testUri, testSha, token);

      // Check that pending request was added
      // We need a small delay to let the async code run
      await new Promise((resolve) => setTimeout(resolve, 0));
      assert.strictEqual(pendingRequests.has(testSha), true);

      // Resolve the API call
      resolveApiCall!(sampleMR);
      await resultPromise;

      // Pending request should be cleaned up
      assert.strictEqual(pendingRequests.has(testSha), false);
    });

    test("returns unchecked when request is cancelled during fetch", async () => {
      mockCacheService.get.returns(undefined);
      mockGitLabService.hasToken.returns(true);
      mockGitService.getRemoteUrl.returns("git@gitlab.com:group/project.git");
      mockGitLabService.parseRemoteUrl.returns({
        projectPath: "group/project",
        host: "gitlab.com",
      });

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
      mockGitLabService.getMergeRequestForCommit.callsFake(async () => {
        // Trigger cancellation
        isCancelled = true;
        onCancellationRequestedEmitter.fire();
        // Return after cancellation
        return sampleMR;
      });

      const result = await getMergeRequestInfo(testUri, testSha, token);

      // Should return unchecked due to cancellation
      assert.deepStrictEqual(result, {
        mr: null,
        loading: false,
        checked: false,
      });
    });
  });
});
