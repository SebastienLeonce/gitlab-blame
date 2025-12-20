import * as assert from "assert";
import {
  parseGitLabRemote,
  extractProjectPath,
  isGitLabRemote,
} from "../../src/utils/remoteParser";

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
        "git@gitlab.pytheascapital.net:backend/services/api.git",
      );
      assert.deepStrictEqual(result, {
        host: "https://gitlab.pytheascapital.net",
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
});
