import * as assert from "assert";
import * as sinon from "sinon";
import { GitHubProvider } from "../../../src/providers/vcs/GitHubProvider";
import { VcsErrorType } from "../../../src/interfaces/types";
import { VCS_PROVIDERS } from "../../../src/constants";

suite("GitHubProvider", () => {
  let gitHubProvider: GitHubProvider;
  let fetchStub: sinon.SinonStub;

  const sampleGitHubPRs = [
    {
      id: 1,
      number: 123,
      title: "First PR",
      html_url: "https://github.com/owner/repo/pull/123",
      state: "closed",
      merged_at: "2025-01-01T00:00:00Z",
      user: {
        login: "testuser",
      },
    },
  ];

  setup(() => {
    fetchStub = sinon.stub(global, "fetch");
    gitHubProvider = new GitHubProvider();
  });

  teardown(() => {
    fetchStub.restore();
  });

  suite("Interface Compliance", () => {
    test("has correct id", () => {
      assert.strictEqual(gitHubProvider.id, VCS_PROVIDERS.GITHUB);
    });

    test("has correct name", () => {
      assert.strictEqual(gitHubProvider.name, "GitHub");
    });
  });

  suite("Token Management", () => {
    test("hasToken returns false when no token set", () => {
      assert.strictEqual(gitHubProvider.hasToken(), false);
    });

    test("hasToken returns true when token is set", () => {
      gitHubProvider.setToken("ghp_test-token");
      assert.strictEqual(gitHubProvider.hasToken(), true);
    });

    test("hasToken returns false when token is empty string", () => {
      gitHubProvider.setToken("");
      assert.strictEqual(gitHubProvider.hasToken(), false);
    });

    test("hasToken returns false when token is undefined", () => {
      gitHubProvider.setToken(undefined);
      assert.strictEqual(gitHubProvider.hasToken(), false);
    });
  });

  suite("URL Management", () => {
    test("getHostUrl returns default git URL", () => {
      assert.strictEqual(gitHubProvider.getHostUrl(), "https://github.com");
    });

    test("setHostUrl updates the URL", () => {
      gitHubProvider.setHostUrl("https://github.enterprise.com");
      assert.strictEqual(
        gitHubProvider.getHostUrl(),
        "https://github.enterprise.com",
      );
    });

    test("constructor accepts custom host URL", () => {
      const provider = new GitHubProvider("https://custom.github.com");
      assert.strictEqual(provider.getHostUrl(), "https://custom.github.com");
    });
  });

  suite("parseRemoteUrl", () => {
    test("parses SSH URL correctly", () => {
      const result = gitHubProvider.parseRemoteUrl(
        "git@github.com:owner/repo.git",
      );
      assert.deepStrictEqual(result, {
        host: "https://github.com",
        projectPath: "owner/repo",
        provider: VCS_PROVIDERS.GITHUB,
      });
    });

    test("parses HTTPS URL correctly", () => {
      const result = gitHubProvider.parseRemoteUrl(
        "https://github.com/owner/repo.git",
      );
      assert.deepStrictEqual(result, {
        host: "https://github.com",
        projectPath: "owner/repo",
        provider: VCS_PROVIDERS.GITHUB,
      });
    });

    test("parses nested organization URL correctly", () => {
      const result = gitHubProvider.parseRemoteUrl(
        "git@github.com:org/team/repo.git",
      );
      assert.deepStrictEqual(result, {
        host: "https://github.com",
        projectPath: "org/team/repo",
        provider: VCS_PROVIDERS.GITHUB,
      });
    });

    test("returns null for invalid URL", () => {
      const result = gitHubProvider.parseRemoteUrl("invalid-url");
      assert.strictEqual(result, null);
    });

    test("returns null for non-GitHub URL", () => {
      const result = gitHubProvider.parseRemoteUrl(
        "git@gitlab.com:group/project.git",
      );
      assert.strictEqual(result, null);
    });
  });

  suite("isProviderUrl", () => {
    test("returns true for GitHub SSH URLs", () => {
      assert.strictEqual(
        gitHubProvider.isProviderUrl("git@github.com:owner/repo.git"),
        true,
      );
    });

    test("returns true for GitHub HTTPS URLs", () => {
      assert.strictEqual(
        gitHubProvider.isProviderUrl("https://github.com/owner/repo.git"),
        true,
      );
    });

    test("returns true for GitHub Enterprise URLs with 'github' in hostname", () => {
      assert.strictEqual(
        gitHubProvider.isProviderUrl(
          "git@github.enterprise.com:owner/repo.git",
        ),
        true,
      );
    });

    test("returns false for GitLab URLs", () => {
      assert.strictEqual(
        gitHubProvider.isProviderUrl("git@gitlab.com:group/project.git"),
        false,
      );
    });

    test("returns false for Bitbucket URLs", () => {
      assert.strictEqual(
        gitHubProvider.isProviderUrl("git@bitbucket.org:team/repo.git"),
        false,
      );
    });
  });

  suite("GitHub Enterprise Detection", () => {
    test("detects github.com URLs", () => {
      const provider = new GitHubProvider();
      assert.strictEqual(
        provider.isProviderUrl("git@github.com:owner/repo.git"),
        true,
      );
    });

    test("detects GitHub Enterprise with 'github' in hostname", () => {
      const provider = new GitHubProvider();
      assert.strictEqual(
        provider.isProviderUrl("git@github.enterprise.com:owner/repo.git"),
        true,
      );
    });

    test("detects GitHub Enterprise via config matching", () => {
      const provider = new GitHubProvider("https://git.company.com");
      // Should match git.company.com based on config
      assert.strictEqual(
        provider.isProviderUrl("git@git.company.com:owner/repo.git"),
        true,
      );
    });

    test("rejects GitLab URLs", () => {
      const provider = new GitHubProvider();
      assert.strictEqual(
        provider.isProviderUrl("git@gitlab.com:owner/repo.git"),
        false,
      );
    });

    test("handles API URL to git hostname mapping", () => {
      const provider = new GitHubProvider("https://api.github.enterprise.com");
      // api.github.enterprise.com -> github.enterprise.com
      assert.strictEqual(
        provider.isProviderUrl("git@github.enterprise.com:owner/repo.git"),
        true,
      );
    });
  });

  suite("getMergeRequestForCommit", () => {
    test("returns error result when no token", async () => {
      const result = await gitHubProvider.getMergeRequestForCommit(
        "owner/repo",
        "abc123",
      );

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error?.type, VcsErrorType.NoToken);
      assert.strictEqual(result.error?.shouldShowUI, true);
    });

    test("shows no token error only once", async () => {
      // First call - should show UI
      const result1 = await gitHubProvider.getMergeRequestForCommit(
        "owner/repo",
        "abc123",
      );
      assert.strictEqual(result1.error?.shouldShowUI, true);

      // Second call - should NOT show UI
      const result2 = await gitHubProvider.getMergeRequestForCommit(
        "owner/repo",
        "abc123",
      );
      assert.strictEqual(result2.error?.shouldShowUI, false);
    });

    test("resetErrorState allows error UI to show again", async () => {
      // First call
      await gitHubProvider.getMergeRequestForCommit("owner/repo", "abc123");

      // Reset error state
      gitHubProvider.resetErrorState();

      // Should show UI again
      const result = await gitHubProvider.getMergeRequestForCommit(
        "owner/repo",
        "abc123",
      );
      assert.strictEqual(result.error?.shouldShowUI, true);
    });

    test("makes correct API call with token", async () => {
      gitHubProvider.setToken("ghp_test-token");
      fetchStub.resolves({
        ok: true,
        json: async () => sampleGitHubPRs,
      });

      await gitHubProvider.getMergeRequestForCommit("owner/repo", "abc123");

      assert.strictEqual(fetchStub.calledOnce, true);
      const [url, options] = fetchStub.firstCall.args;
      assert.strictEqual(
        url,
        "https://api.github.com/repos/owner/repo/commits/abc123/pulls",
      );
      assert.strictEqual(options.headers.Authorization, "token ghp_test-token");
      assert.strictEqual(options.headers.Accept, "application/vnd.github+json");
    });

    test("encodes project path correctly", async () => {
      gitHubProvider.setToken("ghp_test-token");
      fetchStub.resolves({
        ok: true,
        json: async () => [],
      });

      await gitHubProvider.getMergeRequestForCommit("owner/my-repo", "abc123");

      const [url] = fetchStub.firstCall.args;
      assert.strictEqual(
        url,
        "https://api.github.com/repos/owner/my-repo/commits/abc123/pulls",
      );
    });

    test("uses custom host URL when provided", async () => {
      gitHubProvider.setToken("ghp_test-token");
      fetchStub.resolves({
        ok: true,
        json: async () => [],
      });

      await gitHubProvider.getMergeRequestForCommit(
        "owner/repo",
        "abc123",
        "https://github.enterprise.com",
      );

      const [url] = fetchStub.firstCall.args;
      assert.strictEqual(
        url,
        "https://api.github.enterprise.com/repos/owner/repo/commits/abc123/pulls",
      );
    });

    test("returns success result with PR", async () => {
      gitHubProvider.setToken("ghp_test-token");
      fetchStub.resolves({
        ok: true,
        json: async () => sampleGitHubPRs,
      });

      const result = await gitHubProvider.getMergeRequestForCommit(
        "owner/repo",
        "abc123",
      );

      assert.strictEqual(result.success, true);
      assert.deepStrictEqual(result.data, {
        iid: 123,
        title: "First PR",
        webUrl: "https://github.com/owner/repo/pull/123",
        mergedAt: "2025-01-01T00:00:00Z",
        state: "closed",
      });
    });

    test("returns success with null when no PRs found and no commit message pattern", async () => {
      gitHubProvider.setToken("ghp_test-token");
      // First call: /commits/{sha}/pulls returns empty
      fetchStub.onFirstCall().resolves({
        ok: true,
        json: async () => [],
      });
      // Second call: /commits/{sha} returns commit without PR pattern
      fetchStub.onSecondCall().resolves({
        ok: true,
        json: async () => ({
          commit: { message: "Regular commit message without PR" },
        }),
      });

      const result = await gitHubProvider.getMergeRequestForCommit(
        "owner/repo",
        "abc123",
      );

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.data, null);
      assert.strictEqual(fetchStub.callCount, 2);
    });

    test("uses fallback to find PR from commit message (#123)", async () => {
      gitHubProvider.setToken("ghp_test-token");
      // First call: /commits/{sha}/pulls returns empty
      fetchStub.onFirstCall().resolves({
        ok: true,
        json: async () => [],
      });
      // Second call: /commits/{sha} returns commit with PR pattern
      fetchStub.onSecondCall().resolves({
        ok: true,
        json: async () => ({
          commit: { message: "Add feature (#456)" },
        }),
      });
      // Third call: /pulls/456 returns the PR
      fetchStub.onThirdCall().resolves({
        ok: true,
        json: async () => ({
          number: 456,
          title: "Add feature",
          html_url: "https://github.com/owner/repo/pull/456",
          state: "closed",
          merged_at: "2025-01-15T12:00:00Z",
        }),
      });

      const result = await gitHubProvider.getMergeRequestForCommit(
        "owner/repo",
        "abc123",
      );

      assert.strictEqual(result.success, true);
      assert.deepStrictEqual(result.data, {
        iid: 456,
        title: "Add feature",
        webUrl: "https://github.com/owner/repo/pull/456",
        mergedAt: "2025-01-15T12:00:00Z",
        state: "closed",
      });
      assert.strictEqual(fetchStub.callCount, 3);
    });

    test("uses fallback to find PR from Merge pull request message", async () => {
      gitHubProvider.setToken("ghp_test-token");
      // First call: /commits/{sha}/pulls returns empty
      fetchStub.onFirstCall().resolves({
        ok: true,
        json: async () => [],
      });
      // Second call: /commits/{sha} returns merge commit message
      fetchStub.onSecondCall().resolves({
        ok: true,
        json: async () => ({
          commit: { message: "Merge pull request #789 from branch" },
        }),
      });
      // Third call: /pulls/789 returns the PR
      fetchStub.onThirdCall().resolves({
        ok: true,
        json: async () => ({
          number: 789,
          title: "Feature branch",
          html_url: "https://github.com/owner/repo/pull/789",
          state: "closed",
          merged_at: "2025-01-20T10:00:00Z",
        }),
      });

      const result = await gitHubProvider.getMergeRequestForCommit(
        "owner/repo",
        "abc123",
      );

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.data?.iid, 789);
      assert.strictEqual(fetchStub.callCount, 3);
    });

    test("returns null when fallback PR fetch fails", async () => {
      gitHubProvider.setToken("ghp_test-token");
      // First call: /commits/{sha}/pulls returns empty
      fetchStub.onFirstCall().resolves({
        ok: true,
        json: async () => [],
      });
      // Second call: /commits/{sha} returns commit with PR pattern
      fetchStub.onSecondCall().resolves({
        ok: true,
        json: async () => ({
          commit: { message: "Fix bug (#999)" },
        }),
      });
      // Third call: /pulls/999 returns 404
      fetchStub.onThirdCall().resolves({
        ok: false,
        status: 404,
      });

      const result = await gitHubProvider.getMergeRequestForCommit(
        "owner/repo",
        "abc123",
      );

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.data, null);
      assert.strictEqual(fetchStub.callCount, 3);
    });

    test("returns error result for 401 status", async () => {
      gitHubProvider.setToken("ghp_invalid-token");
      fetchStub.resolves({
        ok: false,
        status: 401,
      });

      const result = await gitHubProvider.getMergeRequestForCommit(
        "owner/repo",
        "abc123",
      );

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error?.type, VcsErrorType.InvalidToken);
      assert.strictEqual(result.error?.statusCode, 401);
      assert.strictEqual(result.error?.shouldShowUI, true);
    });

    test("returns error result for 403 status", async () => {
      gitHubProvider.setToken("ghp_test-token");
      fetchStub.resolves({
        ok: false,
        status: 403,
      });

      const result = await gitHubProvider.getMergeRequestForCommit(
        "owner/repo",
        "abc123",
      );

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error?.type, VcsErrorType.InvalidToken);
      assert.strictEqual(result.error?.statusCode, 403);
    });

    test("returns error result for 404 status", async () => {
      gitHubProvider.setToken("ghp_test-token");
      fetchStub.resolves({
        ok: false,
        status: 404,
      });

      const result = await gitHubProvider.getMergeRequestForCommit(
        "owner/repo",
        "abc123",
      );

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error?.type, VcsErrorType.NotFound);
      assert.strictEqual(result.error?.statusCode, 404);
      assert.strictEqual(result.error?.shouldShowUI, false);
    });

    test("returns error result for 429 status", async () => {
      gitHubProvider.setToken("ghp_test-token");
      fetchStub.resolves({
        ok: false,
        status: 429,
      });

      const result = await gitHubProvider.getMergeRequestForCommit(
        "owner/repo",
        "abc123",
      );

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error?.type, VcsErrorType.RateLimited);
      assert.strictEqual(result.error?.statusCode, 429);
      assert.strictEqual(result.error?.shouldShowUI, false);
    });

    test("returns error result for unknown status", async () => {
      gitHubProvider.setToken("ghp_test-token");
      fetchStub.resolves({
        ok: false,
        status: 500,
      });

      const result = await gitHubProvider.getMergeRequestForCommit(
        "owner/repo",
        "abc123",
      );

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error?.type, VcsErrorType.Unknown);
      assert.strictEqual(result.error?.statusCode, 500);
    });

    test("returns error result for network error", async () => {
      gitHubProvider.setToken("ghp_test-token");
      fetchStub.rejects(new Error("Network error"));

      const result = await gitHubProvider.getMergeRequestForCommit(
        "owner/repo",
        "abc123",
      );

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error?.type, VcsErrorType.NetworkError);
      assert.strictEqual(result.error?.shouldShowUI, false);
    });
  });

  suite("PR Selection Logic", () => {
    test("selects first merged PR by date", async () => {
      const prs = [
        {
          id: 1,
          number: 100,
          title: "Second merged",
          html_url: "https://github.com/owner/repo/pull/100",
          state: "closed",
          merged_at: "2025-01-02T00:00:00Z",
        },
        {
          id: 2,
          number: 101,
          title: "First merged",
          html_url: "https://github.com/owner/repo/pull/101",
          state: "closed",
          merged_at: "2025-01-01T00:00:00Z",
        },
      ];

      gitHubProvider.setToken("ghp_test-token");
      fetchStub.resolves({
        ok: true,
        json: async () => prs,
      });

      const result = await gitHubProvider.getMergeRequestForCommit(
        "owner/repo",
        "abc123",
      );

      assert.strictEqual(result.data?.iid, 101);
      assert.strictEqual(result.data?.title, "First merged");
    });

    test("returns open PR as fallback when no merged PRs", async () => {
      const prs = [
        {
          id: 1,
          number: 100,
          title: "Open PR",
          html_url: "https://github.com/owner/repo/pull/100",
          state: "open",
          merged_at: null,
        },
      ];

      gitHubProvider.setToken("ghp_test-token");
      fetchStub.resolves({
        ok: true,
        json: async () => prs,
      });

      const result = await gitHubProvider.getMergeRequestForCommit(
        "owner/repo",
        "abc123",
      );

      assert.strictEqual(result.data?.iid, 100);
      assert.strictEqual(result.data?.title, "Open PR");
    });

    test("returns first PR when multiple open PRs and no merged", async () => {
      const prs = [
        {
          id: 1,
          number: 100,
          title: "First open",
          html_url: "https://github.com/owner/repo/pull/100",
          state: "open",
          merged_at: null,
        },
        {
          id: 2,
          number: 101,
          title: "Second open",
          html_url: "https://github.com/owner/repo/pull/101",
          state: "open",
          merged_at: null,
        },
      ];

      gitHubProvider.setToken("ghp_test-token");
      fetchStub.resolves({
        ok: true,
        json: async () => prs,
      });

      const result = await gitHubProvider.getMergeRequestForCommit(
        "owner/repo",
        "abc123",
      );

      assert.strictEqual(result.data?.iid, 100);
    });

    test("prefers merged PR over open PR", async () => {
      const prs = [
        {
          id: 1,
          number: 100,
          title: "Open PR",
          html_url: "https://github.com/owner/repo/pull/100",
          state: "open",
          merged_at: null,
        },
        {
          id: 2,
          number: 101,
          title: "Merged PR",
          html_url: "https://github.com/owner/repo/pull/101",
          state: "closed",
          merged_at: "2025-01-01T00:00:00Z",
        },
      ];

      gitHubProvider.setToken("ghp_test-token");
      fetchStub.resolves({
        ok: true,
        json: async () => prs,
      });

      const result = await gitHubProvider.getMergeRequestForCommit(
        "owner/repo",
        "abc123",
      );

      assert.strictEqual(result.data?.iid, 101);
      assert.strictEqual(result.data?.title, "Merged PR");
    });
  });

  suite("Error State Management", () => {
    test("setToken resets error state", async () => {
      // Trigger error (no token)
      await gitHubProvider.getMergeRequestForCommit("owner/repo", "abc123");

      // Set new token
      gitHubProvider.setToken("ghp_new-token");

      // Stub fetch to return 401 to trigger another error
      fetchStub.resolves({
        ok: false,
        status: 401,
      });

      // Should show UI again because error state was reset
      const result = await gitHubProvider.getMergeRequestForCommit(
        "owner/repo",
        "abc123",
      );
      assert.strictEqual(result.error?.shouldShowUI, true);
    });
  });
});
