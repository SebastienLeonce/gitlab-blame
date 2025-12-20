import * as assert from "assert";
import * as sinon from "sinon";
import * as vscode from "vscode";
import { CacheService } from "../../src/services/CacheService";
import { CONFIG_KEYS } from "../../src/constants";

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
      const result = cacheService.get("abc123");
      assert.strictEqual(result, undefined);
    });

    test("returns cached value for cache hit", () => {
      cacheService.set("abc123", sampleMR);
      const result = cacheService.get("abc123");
      assert.deepStrictEqual(result, sampleMR);
    });

    test("caches null value (no MR found)", () => {
      cacheService.set("abc123", null);
      const result = cacheService.get("abc123");
      assert.strictEqual(result, null);
    });

    test("distinguishes between null and undefined", () => {
      // undefined = not in cache
      assert.strictEqual(cacheService.get("notcached"), undefined);

      // null = cached as "no MR found"
      cacheService.set("cached", null);
      assert.strictEqual(cacheService.get("cached"), null);
    });
  });

  suite("TTL expiration", () => {
    test("returns value before TTL expires", () => {
      cacheService.set("abc123", sampleMR);

      // Advance time by 30 minutes (less than 1 hour TTL)
      clock.tick(30 * 60 * 1000);

      const result = cacheService.get("abc123");
      assert.deepStrictEqual(result, sampleMR);
    });

    test("returns undefined after TTL expires", () => {
      cacheService.set("abc123", sampleMR);

      // Advance time by 2 hours (more than 1 hour TTL)
      clock.tick(2 * 60 * 60 * 1000);

      const result = cacheService.get("abc123");
      assert.strictEqual(result, undefined);
    });

    test("removes expired entry from cache on access", () => {
      cacheService.set("abc123", sampleMR);
      assert.strictEqual(cacheService.size, 1);

      // Advance time past TTL
      clock.tick(2 * 60 * 60 * 1000);

      // Access triggers removal
      cacheService.get("abc123");
      assert.strictEqual(cacheService.size, 0);
    });
  });

  suite("has", () => {
    test("returns false for cache miss", () => {
      assert.strictEqual(cacheService.has("abc123"), false);
    });

    test("returns true for cache hit", () => {
      cacheService.set("abc123", sampleMR);
      assert.strictEqual(cacheService.has("abc123"), true);
    });

    test("returns true for cached null", () => {
      cacheService.set("abc123", null);
      assert.strictEqual(cacheService.has("abc123"), true);
    });

    test("returns false after TTL expires", () => {
      cacheService.set("abc123", sampleMR);
      clock.tick(2 * 60 * 60 * 1000);
      assert.strictEqual(cacheService.has("abc123"), false);
    });
  });

  suite("clear", () => {
    test("removes all entries", () => {
      cacheService.set("abc123", sampleMR);
      cacheService.set("def456", sampleMR);
      cacheService.set("ghi789", null);

      assert.strictEqual(cacheService.size, 3);

      cacheService.clear();

      assert.strictEqual(cacheService.size, 0);
      assert.strictEqual(cacheService.get("abc123"), undefined);
      assert.strictEqual(cacheService.get("def456"), undefined);
      assert.strictEqual(cacheService.get("ghi789"), undefined);
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
      disabledCache.set("abc123", sampleMR);
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
      disabledCache.set("abc123", sampleMR);
      assert.strictEqual(disabledCache.size, 0);
      disabledCache.dispose();
    });
  });

  suite("size", () => {
    test("returns 0 for empty cache", () => {
      assert.strictEqual(cacheService.size, 0);
    });

    test("returns correct count", () => {
      cacheService.set("abc123", sampleMR);
      assert.strictEqual(cacheService.size, 1);

      cacheService.set("def456", sampleMR);
      assert.strictEqual(cacheService.size, 2);

      cacheService.set("ghi789", null);
      assert.strictEqual(cacheService.size, 3);
    });
  });

  suite("dispose", () => {
    test("clears cache on dispose", () => {
      cacheService.set("abc123", sampleMR);
      cacheService.set("def456", sampleMR);
      assert.strictEqual(cacheService.size, 2);

      cacheService.dispose();

      assert.strictEqual(cacheService.size, 0);
    });
  });
});
