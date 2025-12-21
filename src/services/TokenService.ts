import * as vscode from "vscode";
import { VCS_PROVIDERS, SECRET_KEYS } from "../constants";

/**
 * Manages tokens for multiple VCS providers
 * Handles secure storage and retrieval via VS Code SecretStorage
 */
export class TokenService {
  private tokens: Map<string, string | undefined> = new Map();

  constructor(private secretStorage: vscode.SecretStorage) {}

  /**
   * Load tokens from secret storage for all providers
   */
  async loadTokens(): Promise<void> {
    // Load GitLab token (maintain backwards compatibility with existing key)
    const gitlabToken = await this.secretStorage.get(SECRET_KEYS.GITLAB_TOKEN);
    this.tokens.set(VCS_PROVIDERS.GITLAB, gitlabToken);

    // Load GitHub token
    const githubToken = await this.secretStorage.get(SECRET_KEYS.GITHUB_TOKEN);
    this.tokens.set(VCS_PROVIDERS.GITHUB, githubToken);
  }

  /**
   * Get token for a specific provider
   */
  getToken(providerId: string): string | undefined {
    return this.tokens.get(providerId);
  }

  /**
   * Set token for a specific provider
   */
  async setToken(providerId: string, token: string): Promise<void> {
    this.tokens.set(providerId, token);

    // Store in secret storage based on provider
    const secretKey = this.getSecretKeyForProvider(providerId);
    if (secretKey) {
      await this.secretStorage.store(secretKey, token);
    }
  }

  /**
   * Delete token for a specific provider
   */
  async deleteToken(providerId: string): Promise<void> {
    this.tokens.delete(providerId);

    const secretKey = this.getSecretKeyForProvider(providerId);
    if (secretKey) {
      await this.secretStorage.delete(secretKey);
    }
  }

  /**
   * Check if a token exists for a provider
   */
  hasToken(providerId: string): boolean {
    const token = this.tokens.get(providerId);
    return token !== undefined && token.length > 0;
  }

  /**
   * Get secret key for a provider (backwards compatible)
   */
  private getSecretKeyForProvider(providerId: string): string | undefined {
    switch (providerId) {
      case VCS_PROVIDERS.GITLAB:
        return SECRET_KEYS.GITLAB_TOKEN;
      case VCS_PROVIDERS.GITHUB:
        return SECRET_KEYS.GITHUB_TOKEN;
      default:
        return undefined;
    }
  }
}
