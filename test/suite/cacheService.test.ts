import * as assert from "assert";
import * as sinon from "sinon";

// Mock vscode module
const mockVscode = {
  workspace: {
    getConfiguration: sinon.stub().returns({
      get: sinon.stub().callsFake((key: string, defaultValue: unknown) => {
        if (key === "cacheTTL") {
          return 3600;
        }
        return defaultValue;
      }),
    }),
    onDidChangeConfiguration: sinon.stub().returns({ dispose: sinon.stub() }),
  },
  Disposable: class {
    dispose() {}
  },
};

// We need to test the cache logic without the full VS Code integration
// Create a simplified cache for testing
interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

interface MergeRequest {
  iid: number;
  title: string;
  webUrl: string;
  mergedAt: string | null;
  state: string;
}

class TestCache {
  private cache = new Map<string, CacheEntry<MergeRequest | null>>();
  private ttlMs: number;

  constructor(ttlSeconds: number) {
    this.ttlMs = ttlSeconds * 1000;
  }

  get(sha: string): MergeRequest | null | undefined {
    const entry = this.cache.get(sha);
    if (!entry) {
      return undefined;
    }
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(sha);
      return undefined;
    }
    return entry.value;
  }

  set(sha: string, mr: MergeRequest | null): void {
    if (this.ttlMs <= 0) {
      return;
    }
    this.cache.set(sha, {
      value: mr,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  has(sha: string): boolean {
    return this.get(sha) !== undefined;
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }

  setTTL(seconds: number): void {
    this.ttlMs = seconds * 1000;
  }
}

suite("CacheService", () => {
  let cache: TestCache;
  let clock: sinon.SinonFakeTimers;

  const sampleMR: MergeRequest = {
    iid: 123,
    title: "Test MR",
    webUrl: "https://gitlab.com/group/project/-/merge_requests/123",
    mergedAt: "2025-01-01T00:00:00Z",
    state: "merged",
  };

  setup(() => {
    cache = new TestCache(3600); // 1 hour TTL
    clock = sinon.useFakeTimers();
  });

  teardown(() => {
    clock.restore();
  });

  suite("get/set", () => {
    test("returns undefined for cache miss", () => {
      const result = cache.get("abc123");
      assert.strictEqual(result, undefined);
    });

    test("returns cached value for cache hit", () => {
      cache.set("abc123", sampleMR);
      const result = cache.get("abc123");
      assert.deepStrictEqual(result, sampleMR);
    });

    test("caches null value (no MR found)", () => {
      cache.set("abc123", null);
      const result = cache.get("abc123");
      assert.strictEqual(result, null);
    });

    test("distinguishes between null and undefined", () => {
      // undefined = not in cache
      assert.strictEqual(cache.get("notcached"), undefined);

      // null = cached as "no MR found"
      cache.set("cached", null);
      assert.strictEqual(cache.get("cached"), null);
    });
  });

  suite("TTL expiration", () => {
    test("returns value before TTL expires", () => {
      cache.set("abc123", sampleMR);

      // Advance time by 30 minutes (less than 1 hour TTL)
      clock.tick(30 * 60 * 1000);

      const result = cache.get("abc123");
      assert.deepStrictEqual(result, sampleMR);
    });

    test("returns undefined after TTL expires", () => {
      cache.set("abc123", sampleMR);

      // Advance time by 2 hours (more than 1 hour TTL)
      clock.tick(2 * 60 * 60 * 1000);

      const result = cache.get("abc123");
      assert.strictEqual(result, undefined);
    });

    test("removes expired entry from cache on access", () => {
      cache.set("abc123", sampleMR);
      assert.strictEqual(cache.size, 1);

      // Advance time past TTL
      clock.tick(2 * 60 * 60 * 1000);

      // Access triggers removal
      cache.get("abc123");
      assert.strictEqual(cache.size, 0);
    });
  });

  suite("has", () => {
    test("returns false for cache miss", () => {
      assert.strictEqual(cache.has("abc123"), false);
    });

    test("returns true for cache hit", () => {
      cache.set("abc123", sampleMR);
      assert.strictEqual(cache.has("abc123"), true);
    });

    test("returns true for cached null", () => {
      cache.set("abc123", null);
      assert.strictEqual(cache.has("abc123"), true);
    });

    test("returns false after TTL expires", () => {
      cache.set("abc123", sampleMR);
      clock.tick(2 * 60 * 60 * 1000);
      assert.strictEqual(cache.has("abc123"), false);
    });
  });

  suite("clear", () => {
    test("removes all entries", () => {
      cache.set("abc123", sampleMR);
      cache.set("def456", sampleMR);
      cache.set("ghi789", null);

      assert.strictEqual(cache.size, 3);

      cache.clear();

      assert.strictEqual(cache.size, 0);
      assert.strictEqual(cache.get("abc123"), undefined);
      assert.strictEqual(cache.get("def456"), undefined);
      assert.strictEqual(cache.get("ghi789"), undefined);
    });
  });

  suite("TTL disabled", () => {
    test("does not cache when TTL is 0", () => {
      cache.setTTL(0);
      cache.set("abc123", sampleMR);
      assert.strictEqual(cache.size, 0);
    });

    test("does not cache when TTL is negative", () => {
      cache.setTTL(-1);
      cache.set("abc123", sampleMR);
      assert.strictEqual(cache.size, 0);
    });
  });

  suite("size", () => {
    test("returns 0 for empty cache", () => {
      assert.strictEqual(cache.size, 0);
    });

    test("returns correct count", () => {
      cache.set("abc123", sampleMR);
      assert.strictEqual(cache.size, 1);

      cache.set("def456", sampleMR);
      assert.strictEqual(cache.size, 2);

      cache.set("ghi789", null);
      assert.strictEqual(cache.size, 3);
    });
  });
});
