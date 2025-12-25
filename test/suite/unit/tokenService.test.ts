import * as assert from "assert";
import * as sinon from "sinon";
import * as vscode from "vscode";
import { TokenService } from "@services/TokenService";
import { VCS_PROVIDERS, SECRET_KEYS } from "@constants";

suite("TokenService", () => {
  let tokenService: TokenService;
  let mockSecretStorage: sinon.SinonStubbedInstance<vscode.SecretStorage>;

  setup(() => {
    // Create mock secret storage
    mockSecretStorage = {
      get: sinon.stub(),
      store: sinon.stub(),
      delete: sinon.stub(),
      onDidChange: sinon.stub(),
    } as unknown as sinon.SinonStubbedInstance<vscode.SecretStorage>;

    tokenService = new TokenService(mockSecretStorage);
  });

  teardown(() => {
    sinon.restore();
  });

  suite("loadTokens", () => {
    test("loads GitLab token from secret storage", async () => {
      const gitlabToken = "gitlab-test-token";
      mockSecretStorage.get
        .withArgs(SECRET_KEYS.GITLAB_TOKEN)
        .resolves(gitlabToken);
      mockSecretStorage.get
        .withArgs(SECRET_KEYS.GITHUB_TOKEN)
        .resolves(undefined);

      await tokenService.loadTokens();

      assert.strictEqual(
        tokenService.getToken(VCS_PROVIDERS.GITLAB),
        gitlabToken,
      );
      assert.ok(mockSecretStorage.get.calledWith(SECRET_KEYS.GITLAB_TOKEN));
    });

    test("loads GitHub token from secret storage", async () => {
      const githubToken = "github-test-token";
      mockSecretStorage.get
        .withArgs(SECRET_KEYS.GITLAB_TOKEN)
        .resolves(undefined);
      mockSecretStorage.get
        .withArgs(SECRET_KEYS.GITHUB_TOKEN)
        .resolves(githubToken);

      await tokenService.loadTokens();

      assert.strictEqual(
        tokenService.getToken(VCS_PROVIDERS.GITHUB),
        githubToken,
      );
      assert.ok(mockSecretStorage.get.calledWith(SECRET_KEYS.GITHUB_TOKEN));
    });

    test("loads both GitLab and GitHub tokens", async () => {
      const gitlabToken = "gitlab-test-token";
      const githubToken = "github-test-token";
      mockSecretStorage.get
        .withArgs(SECRET_KEYS.GITLAB_TOKEN)
        .resolves(gitlabToken);
      mockSecretStorage.get
        .withArgs(SECRET_KEYS.GITHUB_TOKEN)
        .resolves(githubToken);

      await tokenService.loadTokens();

      assert.strictEqual(
        tokenService.getToken(VCS_PROVIDERS.GITLAB),
        gitlabToken,
      );
      assert.strictEqual(
        tokenService.getToken(VCS_PROVIDERS.GITHUB),
        githubToken,
      );
    });

    test("handles missing tokens gracefully", async () => {
      mockSecretStorage.get.resolves(undefined);

      await tokenService.loadTokens();

      assert.strictEqual(
        tokenService.getToken(VCS_PROVIDERS.GITLAB),
        undefined,
      );
      assert.strictEqual(
        tokenService.getToken(VCS_PROVIDERS.GITHUB),
        undefined,
      );
    });
  });

  suite("getToken", () => {
    test("returns token for known provider", async () => {
      const token = "test-token";
      mockSecretStorage.get.withArgs(SECRET_KEYS.GITLAB_TOKEN).resolves(token);
      mockSecretStorage.get
        .withArgs(SECRET_KEYS.GITHUB_TOKEN)
        .resolves(undefined);

      await tokenService.loadTokens();

      assert.strictEqual(tokenService.getToken(VCS_PROVIDERS.GITLAB), token);
    });

    test("returns undefined for provider without token", () => {
      const result = tokenService.getToken(VCS_PROVIDERS.GITLAB);
      assert.strictEqual(result, undefined);
    });

    test("returns undefined for unknown provider", () => {
      const result = tokenService.getToken("unknown-provider");
      assert.strictEqual(result, undefined);
    });
  });

  suite("setToken", () => {
    test("sets GitLab token in memory and storage", async () => {
      const token = "new-gitlab-token";
      mockSecretStorage.store.resolves();

      await tokenService.setToken(VCS_PROVIDERS.GITLAB, token);

      assert.strictEqual(tokenService.getToken(VCS_PROVIDERS.GITLAB), token);
      assert.ok(
        mockSecretStorage.store.calledWith(SECRET_KEYS.GITLAB_TOKEN, token),
      );
    });

    test("sets GitHub token in memory and storage", async () => {
      const token = "new-github-token";
      mockSecretStorage.store.resolves();

      await tokenService.setToken(VCS_PROVIDERS.GITHUB, token);

      assert.strictEqual(tokenService.getToken(VCS_PROVIDERS.GITHUB), token);
      assert.ok(
        mockSecretStorage.store.calledWith(SECRET_KEYS.GITHUB_TOKEN, token),
      );
    });

    test("overwrites existing token", async () => {
      const oldToken = "old-token";
      const newToken = "new-token";
      mockSecretStorage.store.resolves();

      await tokenService.setToken(VCS_PROVIDERS.GITLAB, oldToken);
      await tokenService.setToken(VCS_PROVIDERS.GITLAB, newToken);

      assert.strictEqual(tokenService.getToken(VCS_PROVIDERS.GITLAB), newToken);
    });

    test("does not store token for unknown provider", async () => {
      const token = "test-token";
      mockSecretStorage.store.resolves();

      await tokenService.setToken("unknown-provider", token);

      assert.strictEqual(tokenService.getToken("unknown-provider"), token);
      assert.ok(mockSecretStorage.store.notCalled);
    });

    test("sets empty string token", async () => {
      mockSecretStorage.store.resolves();

      await tokenService.setToken(VCS_PROVIDERS.GITLAB, "");

      assert.strictEqual(tokenService.getToken(VCS_PROVIDERS.GITLAB), "");
      assert.ok(
        mockSecretStorage.store.calledWith(SECRET_KEYS.GITLAB_TOKEN, ""),
      );
    });
  });

  suite("deleteToken", () => {
    test("deletes GitLab token from memory and storage", async () => {
      const token = "test-token";
      mockSecretStorage.store.resolves();
      mockSecretStorage.delete.resolves();

      await tokenService.setToken(VCS_PROVIDERS.GITLAB, token);
      await tokenService.deleteToken(VCS_PROVIDERS.GITLAB);

      assert.strictEqual(
        tokenService.getToken(VCS_PROVIDERS.GITLAB),
        undefined,
      );
      assert.ok(mockSecretStorage.delete.calledWith(SECRET_KEYS.GITLAB_TOKEN));
    });

    test("deletes GitHub token from memory and storage", async () => {
      const token = "test-token";
      mockSecretStorage.store.resolves();
      mockSecretStorage.delete.resolves();

      await tokenService.setToken(VCS_PROVIDERS.GITHUB, token);
      await tokenService.deleteToken(VCS_PROVIDERS.GITHUB);

      assert.strictEqual(
        tokenService.getToken(VCS_PROVIDERS.GITHUB),
        undefined,
      );
      assert.ok(mockSecretStorage.delete.calledWith(SECRET_KEYS.GITHUB_TOKEN));
    });

    test("handles deleting non-existent token", async () => {
      mockSecretStorage.delete.resolves();

      await tokenService.deleteToken(VCS_PROVIDERS.GITLAB);

      assert.strictEqual(
        tokenService.getToken(VCS_PROVIDERS.GITLAB),
        undefined,
      );
      assert.ok(mockSecretStorage.delete.calledWith(SECRET_KEYS.GITLAB_TOKEN));
    });

    test("does not delete from storage for unknown provider", async () => {
      mockSecretStorage.store.resolves();
      mockSecretStorage.delete.resolves();

      await tokenService.setToken("unknown-provider", "test-token");
      await tokenService.deleteToken("unknown-provider");

      assert.strictEqual(tokenService.getToken("unknown-provider"), undefined);
      assert.ok(mockSecretStorage.delete.notCalled);
    });
  });

  suite("hasToken", () => {
    test("returns true when token exists and has length", async () => {
      const token = "test-token";
      mockSecretStorage.store.resolves();

      await tokenService.setToken(VCS_PROVIDERS.GITLAB, token);

      assert.strictEqual(tokenService.hasToken(VCS_PROVIDERS.GITLAB), true);
    });

    test("returns false when token does not exist", () => {
      assert.strictEqual(tokenService.hasToken(VCS_PROVIDERS.GITLAB), false);
    });

    test("returns false when token is empty string", async () => {
      mockSecretStorage.store.resolves();

      await tokenService.setToken(VCS_PROVIDERS.GITLAB, "");

      assert.strictEqual(tokenService.hasToken(VCS_PROVIDERS.GITLAB), false);
    });

    test("returns false for unknown provider", () => {
      assert.strictEqual(tokenService.hasToken("unknown-provider"), false);
    });

    test("returns false after token is deleted", async () => {
      const token = "test-token";
      mockSecretStorage.store.resolves();
      mockSecretStorage.delete.resolves();

      await tokenService.setToken(VCS_PROVIDERS.GITLAB, token);
      await tokenService.deleteToken(VCS_PROVIDERS.GITLAB);

      assert.strictEqual(tokenService.hasToken(VCS_PROVIDERS.GITLAB), false);
    });
  });

  suite("getSecretKeyForProvider (via setToken/deleteToken)", () => {
    test("uses correct secret key for GitLab", async () => {
      mockSecretStorage.store.resolves();

      await tokenService.setToken(VCS_PROVIDERS.GITLAB, "token");

      assert.ok(
        mockSecretStorage.store.calledWith(SECRET_KEYS.GITLAB_TOKEN, "token"),
      );
    });

    test("uses correct secret key for GitHub", async () => {
      mockSecretStorage.store.resolves();

      await tokenService.setToken(VCS_PROVIDERS.GITHUB, "token");

      assert.ok(
        mockSecretStorage.store.calledWith(SECRET_KEYS.GITHUB_TOKEN, "token"),
      );
    });

    test("returns undefined for Bitbucket (not implemented)", async () => {
      mockSecretStorage.store.resolves();

      await tokenService.setToken(VCS_PROVIDERS.BITBUCKET, "token");

      // Token is set in memory but not in secret storage
      assert.strictEqual(
        tokenService.getToken(VCS_PROVIDERS.BITBUCKET),
        "token",
      );
      assert.ok(mockSecretStorage.store.notCalled);
    });
  });
});
