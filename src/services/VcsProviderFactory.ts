import { IVcsProvider } from "../interfaces/IVcsProvider";

/**
 * Factory for creating and managing VCS provider instances
 * Supports automatic provider detection from remote URLs
 */
export class VcsProviderFactory {
  private providers: Map<string, IVcsProvider> = new Map();

  /**
   * Register a VCS provider
   */
  registerProvider(provider: IVcsProvider): void {
    this.providers.set(provider.id, provider);
  }

  /**
   * Get a provider by ID
   */
  getProvider(providerId: string): IVcsProvider | undefined {
    return this.providers.get(providerId);
  }

  /**
   * Detect provider from a git remote URL
   * @param remoteUrl The git remote URL
   * @returns The matching provider or undefined
   */
  detectProvider(remoteUrl: string): IVcsProvider | undefined {
    for (const provider of this.providers.values()) {
      if (provider.isProviderUrl(remoteUrl)) {
        return provider;
      }
    }
    return undefined;
  }

  /**
   * Get all registered providers
   */
  getAllProviders(): IVcsProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Clear all providers
   */
  clear(): void {
    this.providers.clear();
  }
}
