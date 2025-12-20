import * as assert from "assert";
import * as sinon from "sinon";
import { GitLabProvider } from "../../src/providers/vcs/GitLabProvider";
import { VcsErrorType } from "../../src/interfaces/types";
import { VCS_PROVIDERS } from "../../src/constants";

suite("GitLabProvider", () => {
  let gitLabProvider: GitLabProvider;
  let fetchStub: sinon.SinonStub;

  const sampleGitLabMRs = [
    {
      id: 1,
      iid: 123,
      title: "First MR",
      web_url: "https://gitlab.com/group/project/-/merge_requests/123",
      state: "merged",
      merged_at: "2025-01-01T00:00:00Z",
    },
  ];

  setup(() => {
    fetchStub = sinon.stub(global, "fetch");
    gitLabProvider = new GitLabProvider();
  });

  teardown(() => {
    fetchStub.restore();
  });

  suite("Interface Compliance", () => {
    test("has correct id", () => {
      assert.strictEqual(gitLabProvider.id, VCS_PROVIDERS.GITLAB);
    });

    test("has correct name", () => {
      assert.strictEqual(gitLabProvider.name, "GitLab");
    });
  });

  suite("Token Management", () => {
    test("hasToken returns false when no token set", () => {
      assert.strictEqual(gitLabProvider.hasToken(), false);
    });

    test("hasToken returns true when token is set", () => {
      gitLabProvider.setToken("glpat-test-token");
      assert.strictEqual(gitLabProvider.hasToken(), true);
    });

    test("hasToken returns false when token is empty string", () => {
      gitLabProvider.setToken("");
      assert.strictEqual(gitLabProvider.hasToken(), false);
    });

    test("hasToken returns false when token is undefined", () => {
      gitLabProvider.setToken(undefined);
      assert.strictEqual(gitLabProvider.hasToken(), false);
    });
  });

  suite("URL Management", () => {
    test("getHostUrl returns default URL", () => {
      assert.strictEqual(gitLabProvider.getHostUrl(), "https://gitlab.com");
    });

    test("setHostUrl updates the URL", () => {
      gitLabProvider.setHostUrl("https://gitlab.example.com");
      assert.strictEqual(
        gitLabProvider.getHostUrl(),
        "https://gitlab.example.com",
      );
    });

    test("constructor accepts custom host URL", () => {
      const provider = new GitLabProvider("https://custom.gitlab.com");
      assert.strictEqual(provider.getHostUrl(), "https://custom.gitlab.com");
    });
  });

  suite("parseRemoteUrl", () => {
    test("parses SSH URL correctly", () => {
      const result = gitLabProvider.parseRemoteUrl(
        "git@gitlab.com:group/project.git",
      );
      assert.deepStrictEqual(result, {
        host: "https://gitlab.com",
        projectPath: "group/project",
        provider: VCS_PROVIDERS.GITLAB,
      });
    });

    test("parses HTTPS URL correctly", () => {
      const result = gitLabProvider.parseRemoteUrl(
        "https://gitlab.com/group/project.git",
      );
      assert.deepStrictEqual(result, {
        host: "https://gitlab.com",
        projectPath: "group/project",
        provider: VCS_PROVIDERS.GITLAB,
      });
    });

    test("parses nested group URL correctly", () => {
      const result = gitLabProvider.parseRemoteUrl(
        "git@gitlab.com:group/subgroup/project.git",
      );
      assert.deepStrictEqual(result, {
        host: "https://gitlab.com",
        projectPath: "group/subgroup/project",
        provider: VCS_PROVIDERS.GITLAB,
      });
    });

    test("returns null for invalid URL", () => {
      const result = gitLabProvider.parseRemoteUrl("invalid-url");
      assert.strictEqual(result, null);
    });

    test("returns null for non-GitLab URL", () => {
      const result = gitLabProvider.parseRemoteUrl(
        "git@github.com:user/repo.git",
      );
      assert.strictEqual(result, null);
    });
  });

  suite("isProviderUrl", () => {
    test("returns true for GitLab SSH URLs", () => {
      assert.strictEqual(
        gitLabProvider.isProviderUrl("git@gitlab.com:group/project.git"),
        true,
      );
    });

    test("returns true for GitLab HTTPS URLs", () => {
      assert.strictEqual(
        gitLabProvider.isProviderUrl("https://gitlab.com/group/project.git"),
        true,
      );
    });

    test("returns true for self-hosted GitLab URLs", () => {
      assert.strictEqual(
        gitLabProvider.isProviderUrl(
          "git@gitlab.example.com:group/project.git",
        ),
        true,
      );
    });

    test("returns false for non-GitLab URLs", () => {
      assert.strictEqual(gitLabProvider.isProviderUrl("invalid"), false);
    });

    test("returns false for GitHub URLs", () => {
      assert.strictEqual(
        gitLabProvider.isProviderUrl("git@github.com:user/repo.git"),
        false,
      );
    });
  });

  suite("getMergeRequestForCommit", () => {
    test("returns error result when no token", async () => {
      const result = await gitLabProvider.getMergeRequestForCommit(
        "group/project",
        "abc123",
      );

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error?.type, VcsErrorType.NoToken);
      assert.strictEqual(result.error?.shouldShowUI, true);
    });

    test("shows no token error only once", async () => {
      await gitLabProvider.getMergeRequestForCommit("group/project", "abc123");
      const result2 = await gitLabProvider.getMergeRequestForCommit(
        "group/project",
        "def456",
      );

      assert.strictEqual(result2.error?.shouldShowUI, false);
    });

    test("resetErrorState allows error UI to show again", async () => {
      await gitLabProvider.getMergeRequestForCommit("group/project", "abc123");
      gitLabProvider.resetErrorState();
      const result2 = await gitLabProvider.getMergeRequestForCommit(
        "group/project",
        "def456",
      );

      assert.strictEqual(result2.error?.shouldShowUI, true);
    });

    test("makes correct API call with token", async () => {
      gitLabProvider.setToken("glpat-test-token");
      fetchStub.resolves({
        ok: true,
        json: async () => sampleGitLabMRs,
      } as Response);

      await gitLabProvider.getMergeRequestForCommit("group/project", "abc123");

      assert.strictEqual(fetchStub.calledOnce, true);
      const [url, options] = fetchStub.firstCall.args;
      assert.strictEqual(
        url,
        "https://gitlab.com/api/v4/projects/group%2Fproject/repository/commits/abc123/merge_requests",
      );
      assert.strictEqual(options.headers["PRIVATE-TOKEN"], "glpat-test-token");
    });

    test("encodes project path correctly", async () => {
      gitLabProvider.setToken("glpat-test-token");
      fetchStub.resolves({
        ok: true,
        json: async () => [],
      } as Response);

      await gitLabProvider.getMergeRequestForCommit(
        "group/subgroup/project",
        "abc123",
      );

      const [url] = fetchStub.firstCall.args;
      assert.ok(
        url.includes("group%2Fsubgroup%2Fproject"),
        "Project path should be URL encoded",
      );
    });

    test("uses custom host URL when provided", async () => {
      gitLabProvider.setToken("glpat-test-token");
      fetchStub.resolves({
        ok: true,
        json: async () => [],
      } as Response);

      await gitLabProvider.getMergeRequestForCommit(
        "group/project",
        "abc123",
        "https://custom.gitlab.com",
      );

      const [url] = fetchStub.firstCall.args;
      assert.ok(
        url.startsWith("https://custom.gitlab.com/api/v4/"),
        "Should use custom host URL",
      );
    });

    test("returns success result with MR", async () => {
      gitLabProvider.setToken("glpat-test-token");
      fetchStub.resolves({
        ok: true,
        json: async () => sampleGitLabMRs,
      } as Response);

      const result = await gitLabProvider.getMergeRequestForCommit(
        "group/project",
        "abc123",
      );

      assert.strictEqual(result.success, true);
      assert.deepStrictEqual(result.data, {
        iid: 123,
        title: "First MR",
        webUrl: "https://gitlab.com/group/project/-/merge_requests/123",
        mergedAt: "2025-01-01T00:00:00Z",
        state: "merged",
      });
    });

    test("returns success with null when no MRs found", async () => {
      gitLabProvider.setToken("glpat-test-token");
      fetchStub.resolves({
        ok: true,
        json: async () => [],
      } as Response);

      const result = await gitLabProvider.getMergeRequestForCommit(
        "group/project",
        "abc123",
      );

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.data, null);
    });

    test("returns error result for 401 status", async () => {
      gitLabProvider.setToken("glpat-test-token");
      fetchStub.resolves({
        ok: false,
        status: 401,
      } as Response);

      const result = await gitLabProvider.getMergeRequestForCommit(
        "group/project",
        "abc123",
      );

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error?.type, VcsErrorType.InvalidToken);
      assert.strictEqual(result.error?.shouldShowUI, true);
      assert.strictEqual(result.error?.statusCode, 401);
    });

    test("returns error result for 403 status", async () => {
      gitLabProvider.setToken("glpat-test-token");
      fetchStub.resolves({
        ok: false,
        status: 403,
      } as Response);

      const result = await gitLabProvider.getMergeRequestForCommit(
        "group/project",
        "abc123",
      );

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error?.type, VcsErrorType.InvalidToken);
      assert.strictEqual(result.error?.statusCode, 403);
    });

    test("returns error result for 404 status", async () => {
      gitLabProvider.setToken("glpat-test-token");
      fetchStub.resolves({
        ok: false,
        status: 404,
      } as Response);

      const result = await gitLabProvider.getMergeRequestForCommit(
        "group/project",
        "abc123",
      );

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error?.type, VcsErrorType.NotFound);
      assert.strictEqual(result.error?.shouldShowUI, false);
    });

    test("returns error result for 429 status", async () => {
      gitLabProvider.setToken("glpat-test-token");
      fetchStub.resolves({
        ok: false,
        status: 429,
      } as Response);

      const result = await gitLabProvider.getMergeRequestForCommit(
        "group/project",
        "abc123",
      );

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error?.type, VcsErrorType.RateLimited);
      assert.strictEqual(result.error?.shouldShowUI, false);
    });

    test("returns error result for unknown status", async () => {
      gitLabProvider.setToken("glpat-test-token");
      fetchStub.resolves({
        ok: false,
        status: 500,
      } as Response);

      const result = await gitLabProvider.getMergeRequestForCommit(
        "group/project",
        "abc123",
      );

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error?.type, VcsErrorType.Unknown);
      assert.strictEqual(result.error?.statusCode, 500);
    });

    test("returns error result for network error", async () => {
      gitLabProvider.setToken("glpat-test-token");
      fetchStub.rejects(new Error("Network error"));

      const result = await gitLabProvider.getMergeRequestForCommit(
        "group/project",
        "abc123",
      );

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error?.type, VcsErrorType.NetworkError);
      assert.strictEqual(result.error?.shouldShowUI, false);
      assert.ok(result.error?.message.includes("Network error"));
    });
  });

  suite("MR Selection Logic", () => {
    test("selects first merged MR by date", async () => {
      gitLabProvider.setToken("glpat-test-token");
      fetchStub.resolves({
        ok: true,
        json: async () => [
          {
            id: 2,
            iid: 456,
            title: "Second MR",
            web_url: "https://gitlab.com/group/project/-/merge_requests/456",
            state: "merged",
            merged_at: "2025-01-02T00:00:00Z",
          },
          {
            id: 1,
            iid: 123,
            title: "First MR",
            web_url: "https://gitlab.com/group/project/-/merge_requests/123",
            state: "merged",
            merged_at: "2025-01-01T00:00:00Z",
          },
        ],
      } as Response);

      const result = await gitLabProvider.getMergeRequestForCommit(
        "group/project",
        "abc123",
      );

      assert.strictEqual(result.data?.iid, 123);
      assert.strictEqual(result.data?.title, "First MR");
    });

    test("returns open MR as fallback when no merged MRs", async () => {
      gitLabProvider.setToken("glpat-test-token");
      fetchStub.resolves({
        ok: true,
        json: async () => [
          {
            id: 1,
            iid: 123,
            title: "Open MR",
            web_url: "https://gitlab.com/group/project/-/merge_requests/123",
            state: "opened",
            merged_at: null,
          },
        ],
      } as Response);

      const result = await gitLabProvider.getMergeRequestForCommit(
        "group/project",
        "abc123",
      );

      assert.strictEqual(result.data?.iid, 123);
      assert.strictEqual(result.data?.state, "opened");
    });

    test("returns first MR when multiple open MRs and no merged", async () => {
      gitLabProvider.setToken("glpat-test-token");
      fetchStub.resolves({
        ok: true,
        json: async () => [
          {
            id: 1,
            iid: 123,
            title: "First Open MR",
            web_url: "https://gitlab.com/group/project/-/merge_requests/123",
            state: "opened",
            merged_at: null,
          },
          {
            id: 2,
            iid: 456,
            title: "Second Open MR",
            web_url: "https://gitlab.com/group/project/-/merge_requests/456",
            state: "opened",
            merged_at: null,
          },
        ],
      } as Response);

      const result = await gitLabProvider.getMergeRequestForCommit(
        "group/project",
        "abc123",
      );

      assert.strictEqual(result.data?.iid, 123);
    });

    test("prefers merged MR over open MR", async () => {
      gitLabProvider.setToken("glpat-test-token");
      fetchStub.resolves({
        ok: true,
        json: async () => [
          {
            id: 1,
            iid: 123,
            title: "Open MR",
            web_url: "https://gitlab.com/group/project/-/merge_requests/123",
            state: "opened",
            merged_at: null,
          },
          {
            id: 2,
            iid: 456,
            title: "Merged MR",
            web_url: "https://gitlab.com/group/project/-/merge_requests/456",
            state: "merged",
            merged_at: "2025-01-01T00:00:00Z",
          },
        ],
      } as Response);

      const result = await gitLabProvider.getMergeRequestForCommit(
        "group/project",
        "abc123",
      );

      assert.strictEqual(result.data?.iid, 456);
      assert.strictEqual(result.data?.state, "merged");
    });
  });

  suite("Error State Management", () => {
    test("setToken resets error state", async () => {
      // First call with invalid token
      gitLabProvider.setToken("invalid-token");
      fetchStub.resolves({
        ok: false,
        status: 401,
      } as Response);

      const result1 = await gitLabProvider.getMergeRequestForCommit(
        "group/project",
        "abc123",
      );
      assert.strictEqual(
        result1.error?.shouldShowUI,
        true,
        "First error should show UI",
      );

      // Second call with same token should NOT show UI
      const result2 = await gitLabProvider.getMergeRequestForCommit(
        "group/project",
        "abc123",
      );
      assert.strictEqual(
        result2.error?.shouldShowUI,
        false,
        "Second error should not show UI",
      );

      // Setting a new token should reset error state
      gitLabProvider.setToken("new-token");
      const result3 = await gitLabProvider.getMergeRequestForCommit(
        "group/project",
        "def456",
      );

      assert.strictEqual(
        result3.error?.shouldShowUI,
        true,
        "Error should show UI after token change",
      );
    });
  });
});
