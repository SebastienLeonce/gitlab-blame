import { MergeRequest, VcsResult, RemoteInfo } from "./types";

/**
 * Interface for VCS provider implementations (GitLab, GitHub, Bitbucket)
 *
 * Design principles:
 * - Services return data, not UI
 * - All operations return VcsResult for consistent error handling
 * - No direct vscode.window calls
 */
export interface IVcsProvider {
  /**
   * Unique identifier for this provider (e.g., "gitlab", "github")
   */
  readonly id: string;

  /**
   * Human-readable name for this provider
   */
  readonly name: string;

  /**
   * Set the authentication token for this provider
   * @param token The authentication token (PAT, OAuth token, etc.)
   */
  setToken(token: string | undefined): void;

  /**
   * Check if a token is configured
   */
  hasToken(): boolean;

  /**
   * Get the configured host URL for this provider
   */
  getHostUrl(): string;

  /**
   * Update the host URL (e.g., for self-hosted instances)
   */
  setHostUrl(url: string): void;

  /**
   * Parse a git remote URL to extract provider-specific information
   * @param remoteUrl The git remote URL (SSH or HTTPS)
   * @returns RemoteInfo if the URL matches this provider, null otherwise
   */
  parseRemoteUrl(remoteUrl: string): RemoteInfo | null;

  /**
   * Check if a remote URL belongs to this provider
   */
  isProviderUrl(remoteUrl: string): boolean;

  /**
   * Get the merge/pull request associated with a commit
   * @param projectPath The project path (e.g., "group/project")
   * @param commitSha The commit SHA
   * @param hostUrl Optional host URL override
   * @returns VcsResult with MergeRequest or error
   */
  getMergeRequestForCommit(
    projectPath: string,
    commitSha: string,
    hostUrl?: string,
  ): Promise<VcsResult<MergeRequest | null>>;

  /**
   * Reset any error state flags (e.g., for retry logic)
   */
  resetErrorState(): void;
}
