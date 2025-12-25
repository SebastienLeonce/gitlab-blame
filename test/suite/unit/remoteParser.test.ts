import * as assert from "assert";
import {
  parseGitLabRemote,
  extractProjectPath,
  isGitLabRemote,
  parseGitHubRemote,
  isGitHubRemote,
} from "../../../src/utils/remoteParser";

suite("Remote Parser", () => {
  suite("parseGitLabRemote", () => {
    test("parses SSH URL", () => {
      const result = parseGitLabRemote("git@gitlab.com:group/project.git");
      assert.deepStrictEqual(result, {
        host: "https://gitlab.com",
        projectPath: "group/project",
      });
    });

    test("parses SSH URL without .git suffix", () => {
      const result = parseGitLabRemote("git@gitlab.com:group/project");
      assert.deepStrictEqual(result, {
        host: "https://gitlab.com",
        projectPath: "group/project",
      });
    });

    test("parses HTTPS URL", () => {
      const result = parseGitLabRemote("https://gitlab.com/group/project.git");
      assert.deepStrictEqual(result, {
        host: "https://gitlab.com",
        projectPath: "group/project",
      });
    });

    test("parses HTTPS URL without .git suffix", () => {
      const result = parseGitLabRemote("https://gitlab.com/group/project");
      assert.deepStrictEqual(result, {
        host: "https://gitlab.com",
        projectPath: "group/project",
      });
    });

    test("handles nested groups (SSH)", () => {
      const result = parseGitLabRemote(
        "git@gitlab.com:org/team/subteam/project.git",
      );
      assert.deepStrictEqual(result, {
        host: "https://gitlab.com",
        projectPath: "org/team/subteam/project",
      });
    });

    test("handles nested groups (HTTPS)", () => {
      const result = parseGitLabRemote(
        "https://gitlab.com/org/team/subteam/project.git",
      );
      assert.deepStrictEqual(result, {
        host: "https://gitlab.com",
        projectPath: "org/team/subteam/project",
      });
    });

    test("handles self-hosted GitLab (SSH)", () => {
      const result = parseGitLabRemote(
        "git@gitlab.enterprise.net:backend/services/api.git",
      );
      assert.deepStrictEqual(result, {
        host: "https://gitlab.enterprise.net",
        projectPath: "backend/services/api",
      });
    });

    test("handles self-hosted GitLab (HTTPS)", () => {
      const result = parseGitLabRemote(
        "https://gitlab.example.com/mygroup/myproject.git",
      );
      assert.deepStrictEqual(result, {
        host: "https://gitlab.example.com",
        projectPath: "mygroup/myproject",
      });
    });

    test("returns null for invalid URL", () => {
      const result = parseGitLabRemote("not-a-valid-url");
      assert.strictEqual(result, null);
    });

    test("returns null for empty URL", () => {
      const result = parseGitLabRemote("");
      assert.strictEqual(result, null);
    });

    test("returns null for URL with only host", () => {
      const result = parseGitLabRemote("https://gitlab.com/");
      assert.strictEqual(result, null);
    });
  });

  suite("extractProjectPath", () => {
    test("extracts project path from SSH URL", () => {
      const result = extractProjectPath("git@gitlab.com:group/project.git");
      assert.strictEqual(result, "group/project");
    });

    test("extracts project path from HTTPS URL", () => {
      const result = extractProjectPath("https://gitlab.com/group/project.git");
      assert.strictEqual(result, "group/project");
    });

    test("returns null for invalid URL", () => {
      const result = extractProjectPath("invalid");
      assert.strictEqual(result, null);
    });
  });

  suite("isGitLabRemote", () => {
    test("returns true for gitlab.com URL", () => {
      assert.strictEqual(
        isGitLabRemote("git@gitlab.com:group/project.git"),
        true,
      );
    });

    test("returns true for self-hosted GitLab URL", () => {
      assert.strictEqual(
        isGitLabRemote("git@gitlab.example.com:group/project.git"),
        true,
      );
    });

    test("returns false for non-GitLab git URL", () => {
      // After multi-provider refactoring, we only identify URLs with 'gitlab' in hostname
      assert.strictEqual(
        isGitLabRemote("git@example.com:group/project.git"),
        false,
      );
    });

    test("returns false for invalid URL", () => {
      assert.strictEqual(isGitLabRemote("not-a-url"), false);
    });
  });

  suite("parseGitHubRemote", () => {
    test("parses SSH URL", () => {
      const result = parseGitHubRemote("git@github.com:owner/repo.git");
      assert.deepStrictEqual(result, {
        host: "https://github.com",
        projectPath: "owner/repo",
      });
    });

    test("parses SSH URL without .git suffix", () => {
      const result = parseGitHubRemote("git@github.com:owner/repo");
      assert.deepStrictEqual(result, {
        host: "https://github.com",
        projectPath: "owner/repo",
      });
    });

    test("parses HTTPS URL", () => {
      const result = parseGitHubRemote("https://github.com/owner/repo.git");
      assert.deepStrictEqual(result, {
        host: "https://github.com",
        projectPath: "owner/repo",
      });
    });

    test("parses HTTPS URL without .git suffix", () => {
      const result = parseGitHubRemote("https://github.com/owner/repo");
      assert.deepStrictEqual(result, {
        host: "https://github.com",
        projectPath: "owner/repo",
      });
    });

    test("handles nested organizations (SSH)", () => {
      const result = parseGitHubRemote("git@github.com:org/team/repo.git");
      assert.deepStrictEqual(result, {
        host: "https://github.com",
        projectPath: "org/team/repo",
      });
    });

    test("handles nested organizations (HTTPS)", () => {
      const result = parseGitHubRemote("https://github.com/org/team/repo.git");
      assert.deepStrictEqual(result, {
        host: "https://github.com",
        projectPath: "org/team/repo",
      });
    });

    test("handles self-hosted GitHub Enterprise (SSH)", () => {
      const result = parseGitHubRemote(
        "git@github.company.com:backend/services/api.git",
      );
      assert.deepStrictEqual(result, {
        host: "https://github.company.com",
        projectPath: "backend/services/api",
      });
    });

    test("handles self-hosted GitHub Enterprise (HTTPS)", () => {
      const result = parseGitHubRemote(
        "https://github.example.com/myorg/myrepo.git",
      );
      assert.deepStrictEqual(result, {
        host: "https://github.example.com",
        projectPath: "myorg/myrepo",
      });
    });

    test("returns null for invalid URL", () => {
      const result = parseGitHubRemote("not-a-valid-url");
      assert.strictEqual(result, null);
    });

    test("returns null for empty URL", () => {
      const result = parseGitHubRemote("");
      assert.strictEqual(result, null);
    });

    test("returns null for URL with only host", () => {
      const result = parseGitHubRemote("https://github.com/");
      assert.strictEqual(result, null);
    });
  });

  suite("isGitHubRemote", () => {
    test("returns true for github.com URL", () => {
      assert.strictEqual(isGitHubRemote("git@github.com:owner/repo.git"), true);
    });

    test("returns true for GitHub Enterprise URL with 'github' in hostname", () => {
      assert.strictEqual(
        isGitHubRemote("git@github.example.com:owner/repo.git"),
        true,
      );
    });

    test("returns false for non-GitHub git URL", () => {
      assert.strictEqual(
        isGitHubRemote("git@example.com:owner/repo.git"),
        false,
      );
    });

    test("returns false for GitLab URL", () => {
      assert.strictEqual(
        isGitHubRemote("git@gitlab.com:group/project.git"),
        false,
      );
    });

    test("returns false for invalid URL", () => {
      assert.strictEqual(isGitHubRemote("not-a-url"), false);
    });

    test("is case insensitive", () => {
      assert.strictEqual(isGitHubRemote("git@GitHub.com:owner/repo.git"), true);
    });
  });
});
