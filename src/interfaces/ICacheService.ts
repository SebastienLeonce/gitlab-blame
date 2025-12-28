import { MergeRequest, MergeRequestStats, GitAPI } from "./types";

/**
 * Interface for cache service implementations
 */
export interface ICacheService {
  /**
   * Initialize the cache service and set up invalidation listeners
   * @param gitApi The VS Code Git API for watching repository changes
   */
  initialize(gitApi: GitAPI | undefined): void;

  /**
   * Get a cached MR for a commit SHA
   * @param providerId The VCS provider ID (e.g., 'gitlab', 'github')
   * @param sha The commit SHA
   * @returns The cached MR, null if cached as "no MR", or undefined if not in cache
   */
  get(providerId: string, sha: string): MergeRequest | null | undefined;

  /**
   * Cache an MR (or null for "no MR found") for a commit SHA
   * @param providerId The VCS provider ID (e.g., 'gitlab', 'github')
   * @param sha The commit SHA
   * @param mr The MR to cache, or null if no MR was found
   */
  set(providerId: string, sha: string, mr: MergeRequest | null): void;

  /**
   * Check if a SHA is in the cache (and not expired)
   * @param providerId The VCS provider ID (e.g., 'gitlab', 'github')
   * @param sha The commit SHA
   * @returns true if the SHA is cached
   */
  has(providerId: string, sha: string): boolean;

  /**
   * Update an existing cached MR with stats data
   * @param providerId The VCS provider ID (e.g., 'gitlab', 'github')
   * @param sha The commit SHA
   * @param stats The stats to add to the cached MR
   * @returns true if cache was updated, false if entry not found or expired
   */
  updateStats(
    providerId: string,
    sha: string,
    stats: MergeRequestStats,
  ): boolean;

  /**
   * Clear all cached entries
   */
  clear(): void;

  /**
   * Get the current cache size
   */
  readonly size: number;

  /**
   * Dispose of all resources
   */
  dispose(): void;
}
