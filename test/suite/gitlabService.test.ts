import * as assert from "assert";
import * as sinon from "sinon";
import * as vscode from "vscode";
import { GitLabService } from "../../src/services/GitLabService";

suite("GitLabService", () => {
  let gitLabService: GitLabService;
  let getConfigurationStub: sinon.SinonStub;
  let fetchStub: sinon.SinonStub;
  let showErrorMessageStub: sinon.SinonStub;
  let showWarningMessageStub: sinon.SinonStub;
  let executeCommandStub: sinon.SinonStub;

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
    // Stub vscode.workspace.getConfiguration
    getConfigurationStub = sinon.stub(vscode.workspace, "getConfiguration");
    getConfigurationStub.returns({
      get: sinon.stub().callsFake((key: string, defaultValue: unknown) => {
        if (key === "gitlabUrl") {
          return "https://gitlab.com";
        }
        return defaultValue;
      }),
    } as unknown as vscode.WorkspaceConfiguration);

    // Stub vscode.window methods
    showErrorMessageStub = sinon.stub(vscode.window, "showErrorMessage");
    showErrorMessageStub.resolves(undefined);
    showWarningMessageStub = sinon.stub(vscode.window, "showWarningMessage");
    showWarningMessageStub.resolves(undefined);
    executeCommandStub = sinon.stub(vscode.commands, "executeCommand");
    executeCommandStub.resolves();

    // Stub global fetch
    fetchStub = sinon.stub(global, "fetch");

    gitLabService = new GitLabService();
  });

  teardown(() => {
    getConfigurationStub.restore();
    showErrorMessageStub.restore();
    showWarningMessageStub.restore();
    executeCommandStub.restore();
    fetchStub.restore();
  });

  suite("Token Management", () => {
    test("hasToken returns false when no token set", () => {
      assert.strictEqual(gitLabService.hasToken(), false);
    });

    test("hasToken returns true when token is set", () => {
      gitLabService.setToken("glpat-test-token");
      assert.strictEqual(gitLabService.hasToken(), true);
    });

    test("hasToken returns false when token is empty string", () => {
      gitLabService.setToken("");
      assert.strictEqual(gitLabService.hasToken(), false);
    });

    test("hasToken returns false when token is undefined", () => {
      gitLabService.setToken("glpat-test-token");
      gitLabService.setToken(undefined);
      assert.strictEqual(gitLabService.hasToken(), false);
    });
  });

  suite("GitLab URL Management", () => {
    test("getGitLabUrl returns configured URL", () => {
      assert.strictEqual(gitLabService.getGitLabUrl(), "https://gitlab.com");
    });

    test("setGitLabUrl updates the URL", () => {
      gitLabService.setGitLabUrl("https://gitlab.example.com");
      assert.strictEqual(
        gitLabService.getGitLabUrl(),
        "https://gitlab.example.com",
      );
    });
  });

  suite("parseRemoteUrl", () => {
    test("parses SSH URL correctly", () => {
      const result = gitLabService.parseRemoteUrl(
        "git@gitlab.com:group/project.git",
      );
      assert.deepStrictEqual(result, {
        host: "https://gitlab.com",
        projectPath: "group/project",
      });
    });

    test("parses HTTPS URL correctly", () => {
      const result = gitLabService.parseRemoteUrl(
        "https://gitlab.com/group/project.git",
      );
      assert.deepStrictEqual(result, {
        host: "https://gitlab.com",
        projectPath: "group/project",
      });
    });

    test("returns null for invalid URL", () => {
      const result = gitLabService.parseRemoteUrl("invalid-url");
      assert.strictEqual(result, null);
    });
  });

  suite("getMergeRequestForCommit", () => {
    test("returns null and shows warning when no token", async () => {
      const result = await gitLabService.getMergeRequestForCommit(
        "group/project",
        "abc123",
      );

      assert.strictEqual(result, null);
      assert.strictEqual(showWarningMessageStub.calledOnce, true);
      assert.ok(
        showWarningMessageStub.firstCall.args[0].includes(
          "No Personal Access Token",
        ),
      );
    });

    test("shows token warning only once per session", async () => {
      await gitLabService.getMergeRequestForCommit("group/project", "abc123");
      await gitLabService.getMergeRequestForCommit("group/project", "def456");

      assert.strictEqual(showWarningMessageStub.calledOnce, true);
    });

    test("resetTokenErrorFlag allows warning to show again", async () => {
      await gitLabService.getMergeRequestForCommit("group/project", "abc123");
      gitLabService.resetTokenErrorFlag();
      await gitLabService.getMergeRequestForCommit("group/project", "def456");

      assert.strictEqual(showWarningMessageStub.calledTwice, true);
    });

    test("makes correct API call with token", async () => {
      gitLabService.setToken("glpat-test-token");
      fetchStub.resolves({
        ok: true,
        json: async () => sampleGitLabMRs,
      } as Response);

      await gitLabService.getMergeRequestForCommit("group/project", "abc123");

      assert.strictEqual(fetchStub.calledOnce, true);
      const [url, options] = fetchStub.firstCall.args;
      assert.strictEqual(
        url,
        "https://gitlab.com/api/v4/projects/group%2Fproject/repository/commits/abc123/merge_requests",
      );
      assert.strictEqual(options.headers["PRIVATE-TOKEN"], "glpat-test-token");
    });

    test("uses custom gitlabHost when provided", async () => {
      gitLabService.setToken("glpat-test-token");
      fetchStub.resolves({
        ok: true,
        json: async () => sampleGitLabMRs,
      } as Response);

      await gitLabService.getMergeRequestForCommit(
        "group/project",
        "abc123",
        "https://gitlab.example.com",
      );

      const [url] = fetchStub.firstCall.args;
      assert.ok(url.startsWith("https://gitlab.example.com"));
    });

    test("returns null for empty MR array", async () => {
      gitLabService.setToken("glpat-test-token");
      fetchStub.resolves({
        ok: true,
        json: async () => [],
      } as Response);

      const result = await gitLabService.getMergeRequestForCommit(
        "group/project",
        "abc123",
      );

      assert.strictEqual(result, null);
    });

    test("returns mapped MR for successful response", async () => {
      gitLabService.setToken("glpat-test-token");
      fetchStub.resolves({
        ok: true,
        json: async () => sampleGitLabMRs,
      } as Response);

      const result = await gitLabService.getMergeRequestForCommit(
        "group/project",
        "abc123",
      );

      assert.deepStrictEqual(result, {
        iid: 123,
        title: "First MR",
        webUrl: "https://gitlab.com/group/project/-/merge_requests/123",
        mergedAt: "2025-01-01T00:00:00Z",
        state: "merged",
      });
    });

    test("handles network error gracefully", async () => {
      gitLabService.setToken("glpat-test-token");
      fetchStub.rejects(new Error("Network error"));

      const result = await gitLabService.getMergeRequestForCommit(
        "group/project",
        "abc123",
      );

      assert.strictEqual(result, null);
    });
  });

  suite("API Error Handling", () => {
    test("shows error message for 401 status", async () => {
      gitLabService.setToken("glpat-test-token");
      fetchStub.resolves({
        ok: false,
        status: 401,
      } as Response);

      await gitLabService.getMergeRequestForCommit("group/project", "abc123");

      assert.strictEqual(showErrorMessageStub.calledOnce, true);
      assert.ok(
        showErrorMessageStub.firstCall.args[0].includes("Invalid or expired"),
      );
    });

    test("shows error message for 403 status", async () => {
      gitLabService.setToken("glpat-test-token");
      fetchStub.resolves({
        ok: false,
        status: 403,
      } as Response);

      await gitLabService.getMergeRequestForCommit("group/project", "abc123");

      assert.strictEqual(showErrorMessageStub.calledOnce, true);
    });

    test("shows auth error only once per session", async () => {
      gitLabService.setToken("glpat-test-token");
      fetchStub.resolves({
        ok: false,
        status: 401,
      } as Response);

      await gitLabService.getMergeRequestForCommit("group/project", "abc123");
      await gitLabService.getMergeRequestForCommit("group/project", "def456");

      assert.strictEqual(showErrorMessageStub.calledOnce, true);
    });

    test("silently handles 404 status", async () => {
      gitLabService.setToken("glpat-test-token");
      fetchStub.resolves({
        ok: false,
        status: 404,
      } as Response);

      const result = await gitLabService.getMergeRequestForCommit(
        "group/project",
        "abc123",
      );

      assert.strictEqual(result, null);
      assert.strictEqual(showErrorMessageStub.called, false);
      assert.strictEqual(showWarningMessageStub.called, false);
    });

    test("silently handles 429 rate limit", async () => {
      gitLabService.setToken("glpat-test-token");
      fetchStub.resolves({
        ok: false,
        status: 429,
      } as Response);

      const result = await gitLabService.getMergeRequestForCommit(
        "group/project",
        "abc123",
      );

      assert.strictEqual(result, null);
      assert.strictEqual(showErrorMessageStub.called, false);
    });
  });

  suite("MR Selection Logic", () => {
    test("returns single MR", async () => {
      gitLabService.setToken("glpat-test-token");
      fetchStub.resolves({
        ok: true,
        json: async () => [
          {
            id: 1,
            iid: 123,
            title: "Test MR",
            web_url: "https://gitlab.com/group/project/-/merge_requests/123",
            state: "merged",
            merged_at: "2025-01-01T00:00:00Z",
          },
        ],
      } as Response);

      const result = await gitLabService.getMergeRequestForCommit(
        "group/project",
        "abc123",
      );

      assert.strictEqual(result?.iid, 123);
    });

    test("selects first merged MR by date (chronologically earliest)", async () => {
      gitLabService.setToken("glpat-test-token");
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
          {
            id: 3,
            iid: 789,
            title: "Third MR",
            web_url: "https://gitlab.com/group/project/-/merge_requests/789",
            state: "merged",
            merged_at: "2025-01-03T00:00:00Z",
          },
        ],
      } as Response);

      const result = await gitLabService.getMergeRequestForCommit(
        "group/project",
        "abc123",
      );

      assert.strictEqual(result?.iid, 123);
      assert.strictEqual(result?.title, "First MR");
    });

    test("returns open MR as fallback when no merged MRs", async () => {
      gitLabService.setToken("glpat-test-token");
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

      const result = await gitLabService.getMergeRequestForCommit(
        "group/project",
        "abc123",
      );

      assert.strictEqual(result?.iid, 123);
      assert.strictEqual(result?.state, "opened");
    });

    test("ignores closed MRs and selects merged", async () => {
      gitLabService.setToken("glpat-test-token");
      fetchStub.resolves({
        ok: true,
        json: async () => [
          {
            id: 1,
            iid: 123,
            title: "Closed MR",
            web_url: "https://gitlab.com/group/project/-/merge_requests/123",
            state: "closed",
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

      const result = await gitLabService.getMergeRequestForCommit(
        "group/project",
        "abc123",
      );

      assert.strictEqual(result?.iid, 456);
      assert.strictEqual(result?.state, "merged");
    });

    test("handles MR with merged state but null merged_at", async () => {
      gitLabService.setToken("glpat-test-token");
      fetchStub.resolves({
        ok: true,
        json: async () => [
          {
            id: 1,
            iid: 123,
            title: "Weird MR",
            web_url: "https://gitlab.com/group/project/-/merge_requests/123",
            state: "merged",
            merged_at: null,
          },
          {
            id: 2,
            iid: 456,
            title: "Normal MR",
            web_url: "https://gitlab.com/group/project/-/merge_requests/456",
            state: "merged",
            merged_at: "2025-01-01T00:00:00Z",
          },
        ],
      } as Response);

      const result = await gitLabService.getMergeRequestForCommit(
        "group/project",
        "abc123",
      );

      assert.strictEqual(result?.iid, 456);
    });

    test("maps GitLab API response to MergeRequest type", async () => {
      gitLabService.setToken("glpat-test-token");
      fetchStub.resolves({
        ok: true,
        json: async () => [
          {
            id: 12345,
            iid: 123,
            title: "Fix bug",
            web_url: "https://gitlab.com/group/project/-/merge_requests/123",
            state: "merged",
            merged_at: "2025-01-15T10:30:00Z",
          },
        ],
      } as Response);

      const result = await gitLabService.getMergeRequestForCommit(
        "group/project",
        "abc123",
      );

      assert.deepStrictEqual(result, {
        iid: 123,
        title: "Fix bug",
        webUrl: "https://gitlab.com/group/project/-/merge_requests/123",
        mergedAt: "2025-01-15T10:30:00Z",
        state: "merged",
      });
    });
  });

  suite("URL Encoding", () => {
    test("correctly encodes project path with slashes", async () => {
      gitLabService.setToken("glpat-test-token");
      fetchStub.resolves({
        ok: true,
        json: async () => [],
      } as Response);

      await gitLabService.getMergeRequestForCommit(
        "org/team/subteam/project",
        "abc123",
      );

      const [url] = fetchStub.firstCall.args;
      assert.ok(url.includes("org%2Fteam%2Fsubteam%2Fproject"));
    });

    test("correctly encodes project path with special characters", async () => {
      gitLabService.setToken("glpat-test-token");
      fetchStub.resolves({
        ok: true,
        json: async () => [],
      } as Response);

      await gitLabService.getMergeRequestForCommit(
        "group/project-name.test",
        "abc123",
      );

      const [url] = fetchStub.firstCall.args;
      assert.ok(url.includes("group%2Fproject-name.test"));
    });
  });
});
