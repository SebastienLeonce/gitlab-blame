import * as assert from "assert";
import { VcsProviderFactory } from "@services/VcsProviderFactory";
import { IVcsProvider } from "@interfaces/IVcsProvider";
import { VcsResult, RemoteInfo, VcsErrorType } from "@types";

suite("VcsProviderFactory", () => {
  let factory: VcsProviderFactory;
  let mockProvider: IVcsProvider;

  setup(() => {
    factory = new VcsProviderFactory();

    // Create a mock provider
    mockProvider = {
      id: "test-provider",
      name: "Test Provider",
      hasToken: () => false,
      setToken: () => {},
      getHostUrl: () => "https://test.com",
      setHostUrl: () => {},
      parseRemoteUrl: (): RemoteInfo | null => null,
      isProviderUrl: (url: string) => url.includes("test.com"),
      getMergeRequestForCommit: async (): Promise<VcsResult<any>> => ({
        success: false,
        error: {
          type: VcsErrorType.NetworkError,
          message: "Not implemented",
          shouldShowUI: false,
        },
      }),
      getMergeRequestStats: async (): Promise<VcsResult<any>> => ({
        success: false,
        error: {
          type: VcsErrorType.NetworkError,
          message: "Not implemented",
          shouldShowUI: false,
        },
      }),
      resetErrorState: () => {},
    };
  });

  suite("registerProvider", () => {
    test("registers a provider", () => {
      factory.registerProvider(mockProvider);
      const retrieved = factory.getProvider("test-provider");
      assert.strictEqual(retrieved, mockProvider);
    });

    test("can register multiple providers", () => {
      const mockProvider2: IVcsProvider = {
        ...mockProvider,
        id: "test-provider-2",
        name: "Test Provider 2",
      };

      factory.registerProvider(mockProvider);
      factory.registerProvider(mockProvider2);

      assert.strictEqual(factory.getProvider("test-provider"), mockProvider);
      assert.strictEqual(factory.getProvider("test-provider-2"), mockProvider2);
    });
  });

  suite("getProvider", () => {
    test("returns provider by ID", () => {
      factory.registerProvider(mockProvider);
      const result = factory.getProvider("test-provider");
      assert.strictEqual(result, mockProvider);
    });

    test("returns undefined for unknown provider", () => {
      const result = factory.getProvider("unknown");
      assert.strictEqual(result, undefined);
    });
  });

  suite("detectProvider", () => {
    test("detects provider from remote URL", () => {
      factory.registerProvider(mockProvider);
      const result = factory.detectProvider("https://test.com/repo.git");
      assert.strictEqual(result, mockProvider);
    });

    test("returns undefined when no provider matches", () => {
      factory.registerProvider(mockProvider);
      const result = factory.detectProvider("https://other.com/repo.git");
      assert.strictEqual(result, undefined);
    });

    test("returns first matching provider when multiple match", () => {
      const mockProvider2: IVcsProvider = {
        ...mockProvider,
        id: "test-provider-2",
        name: "Test Provider 2",
      };

      factory.registerProvider(mockProvider);
      factory.registerProvider(mockProvider2);

      const result = factory.detectProvider("https://test.com/repo.git");
      // Should return first registered matching provider
      assert.strictEqual(result, mockProvider);
    });
  });

  suite("getAllProviders", () => {
    test("returns empty array when no providers registered", () => {
      const result = factory.getAllProviders();
      assert.strictEqual(result.length, 0);
    });

    test("returns all registered providers", () => {
      const mockProvider2: IVcsProvider = {
        ...mockProvider,
        id: "test-provider-2",
        name: "Test Provider 2",
      };

      factory.registerProvider(mockProvider);
      factory.registerProvider(mockProvider2);

      const result = factory.getAllProviders();
      assert.strictEqual(result.length, 2);
      assert.ok(result.includes(mockProvider));
      assert.ok(result.includes(mockProvider2));
    });
  });

  suite("clear", () => {
    test("removes all providers", () => {
      factory.registerProvider(mockProvider);
      assert.strictEqual(factory.getAllProviders().length, 1);

      factory.clear();
      assert.strictEqual(factory.getAllProviders().length, 0);
      assert.strictEqual(factory.getProvider("test-provider"), undefined);
    });
  });
});
