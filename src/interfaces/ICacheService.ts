import { MergeRequest, GitAPI } from "./types";

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
   * @param sha The commit SHA
   * @returns The cached MR, null if cached as "no MR", or undefined if not in cache
   */
  get(sha: string): MergeRequest | null | undefined;

  /**
   * Cache an MR (or null for "no MR found") for a commit SHA
   * @param sha The commit SHA
   * @param mr The MR to cache, or null if no MR was found
   */
  set(sha: string, mr: MergeRequest | null): void;

  /**
   * Check if a SHA is in the cache (and not expired)
   * @param sha The commit SHA
   * @returns true if the SHA is cached
   */
  has(sha: string): boolean;

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
