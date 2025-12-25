import * as assert from "assert";
import * as sinon from "sinon";
import * as vscode from "vscode";
import { CacheService } from "@services/CacheService";
import { CONFIG_KEYS } from "@constants";

suite("CacheService", () => {
  let cacheService: CacheService;
  let clock: sinon.SinonFakeTimers;
  let getConfigurationStub: sinon.SinonStub;

  const sampleMR = {
    iid: 123,
    title: "Test MR",
    webUrl: "https://gitlab.com/group/project/-/merge_requests/123",
    mergedAt: "2025-01-01T00:00:00Z",
    state: "merged",
  };

  setup(() => {
    // Stub vscode.workspace.getConfiguration before creating CacheService
    getConfigurationStub = sinon.stub(vscode.workspace, "getConfiguration");
    getConfigurationStub.returns({
      get: sinon.stub().callsFake((key: string, defaultValue: unknown) => {
        if (key === CONFIG_KEYS.CACHE_TTL) {
          return 3600; // 1 hour TTL
        }
        return defaultValue;
      }),
    } as unknown as vscode.WorkspaceConfiguration);

    clock = sinon.useFakeTimers();
    cacheService = new CacheService();
  });

  teardown(() => {
    clock.restore();
    getConfigurationStub.restore();
    cacheService.dispose();
  });

  suite("get/set", () => {
    test("returns undefined for cache miss", () => {
      const result = cacheService.get("gitlab", "abc123");
      assert.strictEqual(result, undefined);
    });

    test("returns cached value for cache hit", () => {
      cacheService.set("gitlab", "abc123", sampleMR);
      const result = cacheService.get("gitlab", "abc123");
      assert.deepStrictEqual(result, sampleMR);
    });

    test("caches null value (no MR found)", () => {
      cacheService.set("gitlab", "abc123", null);
      const result = cacheService.get("gitlab", "abc123");
      assert.strictEqual(result, null);
    });

    test("distinguishes between null and undefined", () => {
      // undefined = not in cache
      assert.strictEqual(cacheService.get("gitlab", "notcached"), undefined);

      // null = cached as "no MR found"
      cacheService.set("gitlab", "cached", null);
      assert.strictEqual(cacheService.get("gitlab", "cached"), null);
    });
  });

  suite("TTL expiration", () => {
    test("returns value before TTL expires", () => {
      cacheService.set("gitlab", "abc123", sampleMR);

      // Advance time by 30 minutes (less than 1 hour TTL)
      clock.tick(30 * 60 * 1000);

      const result = cacheService.get("gitlab", "abc123");
      assert.deepStrictEqual(result, sampleMR);
    });

    test("returns undefined after TTL expires", () => {
      cacheService.set("gitlab", "abc123", sampleMR);

      // Advance time by 2 hours (more than 1 hour TTL)
      clock.tick(2 * 60 * 60 * 1000);

      const result = cacheService.get("gitlab", "abc123");
      assert.strictEqual(result, undefined);
    });

    test("removes expired entry from cache on access", () => {
      cacheService.set("gitlab", "abc123", sampleMR);
      assert.strictEqual(cacheService.size, 1);

      // Advance time past TTL
      clock.tick(2 * 60 * 60 * 1000);

      // Access triggers removal
      cacheService.get("gitlab", "abc123");
      assert.strictEqual(cacheService.size, 0);
    });
  });

  suite("has", () => {
    test("returns false for cache miss", () => {
      assert.strictEqual(cacheService.has("gitlab", "abc123"), false);
    });

    test("returns true for cache hit", () => {
      cacheService.set("gitlab", "abc123", sampleMR);
      assert.strictEqual(cacheService.has("gitlab", "abc123"), true);
    });

    test("returns true for cached null", () => {
      cacheService.set("gitlab", "abc123", null);
      assert.strictEqual(cacheService.has("gitlab", "abc123"), true);
    });

    test("returns false after TTL expires", () => {
      cacheService.set("gitlab", "abc123", sampleMR);
      clock.tick(2 * 60 * 60 * 1000);
      assert.strictEqual(cacheService.has("gitlab", "abc123"), false);
    });
  });

  suite("clear", () => {
    test("removes all entries", () => {
      cacheService.set("gitlab", "abc123", sampleMR);
      cacheService.set("gitlab", "def456", sampleMR);
      cacheService.set("gitlab", "ghi789", null);

      assert.strictEqual(cacheService.size, 3);

      cacheService.clear();

      assert.strictEqual(cacheService.size, 0);
      assert.strictEqual(cacheService.get("gitlab", "abc123"), undefined);
      assert.strictEqual(cacheService.get("gitlab", "def456"), undefined);
      assert.strictEqual(cacheService.get("gitlab", "ghi789"), undefined);
    });
  });

  suite("TTL disabled", () => {
    test("does not cache when TTL is 0", () => {
      // Create a new cache service with TTL = 0
      getConfigurationStub.returns({
        get: sinon.stub().callsFake((key: string, defaultValue: unknown) => {
          if (key === CONFIG_KEYS.CACHE_TTL) {
            return 0;
          }
          return defaultValue;
        }),
      } as unknown as vscode.WorkspaceConfiguration);

      const disabledCache = new CacheService();
      disabledCache.set("gitlab", "abc123", sampleMR);
      assert.strictEqual(disabledCache.size, 0);
      disabledCache.dispose();
    });

    test("does not cache when TTL is negative", () => {
      // Create a new cache service with negative TTL
      getConfigurationStub.returns({
        get: sinon.stub().callsFake((key: string, defaultValue: unknown) => {
          if (key === CONFIG_KEYS.CACHE_TTL) {
            return -1;
          }
          return defaultValue;
        }),
      } as unknown as vscode.WorkspaceConfiguration);

      const disabledCache = new CacheService();
      disabledCache.set("gitlab", "abc123", sampleMR);
      assert.strictEqual(disabledCache.size, 0);
      disabledCache.dispose();
    });
  });

  suite("size", () => {
    test("returns 0 for empty cache", () => {
      assert.strictEqual(cacheService.size, 0);
    });

    test("returns correct count", () => {
      cacheService.set("gitlab", "abc123", sampleMR);
      assert.strictEqual(cacheService.size, 1);

      cacheService.set("gitlab", "def456", sampleMR);
      assert.strictEqual(cacheService.size, 2);

      cacheService.set("gitlab", "ghi789", null);
      assert.strictEqual(cacheService.size, 3);
    });
  });

  suite("dispose", () => {
    test("clears cache on dispose", () => {
      cacheService.set("gitlab", "abc123", sampleMR);
      cacheService.set("gitlab", "def456", sampleMR);
      assert.strictEqual(cacheService.size, 2);

      cacheService.dispose();

      assert.strictEqual(cacheService.size, 0);
    });
  });

  suite("provider-specific caching", () => {
    const githubPR = {
      iid: 456,
      title: "GitHub PR",
      webUrl: "https://github.com/owner/repo/pull/456",
      mergedAt: "2025-01-02T00:00:00Z",
      state: "merged",
    };

    test("different providers can cache same SHA without collision", () => {
      cacheService.set("gitlab", "abc123", sampleMR);
      cacheService.set("github", "abc123", githubPR);

      const gitlabResult = cacheService.get("gitlab", "abc123");
      const githubResult = cacheService.get("github", "abc123");

      assert.deepStrictEqual(gitlabResult, sampleMR);
      assert.deepStrictEqual(githubResult, githubPR);
    });

    test("cache key format is providerId:sha", () => {
      cacheService.set("gitlab", "abc123", sampleMR);
      cacheService.set("github", "abc123", githubPR);

      // Both entries should exist independently
      assert.strictEqual(cacheService.size, 2);
    });

    test("clearing cache clears all providers", () => {
      cacheService.set("gitlab", "abc123", sampleMR);
      cacheService.set("github", "abc123", githubPR);
      cacheService.set("gitlab", "def456", sampleMR);

      assert.strictEqual(cacheService.size, 3);

      cacheService.clear();

      assert.strictEqual(cacheService.size, 0);
      assert.strictEqual(cacheService.get("gitlab", "abc123"), undefined);
      assert.strictEqual(cacheService.get("github", "abc123"), undefined);
      assert.strictEqual(cacheService.get("gitlab", "def456"), undefined);
    });

    test("has() works with providerId", () => {
      cacheService.set("gitlab", "abc123", sampleMR);
      cacheService.set("github", "def456", githubPR);

      assert.strictEqual(cacheService.has("gitlab", "abc123"), true);
      assert.strictEqual(cacheService.has("github", "def456"), true);
      assert.strictEqual(cacheService.has("gitlab", "def456"), false);
      assert.strictEqual(cacheService.has("github", "abc123"), false);
    });
  });
});
