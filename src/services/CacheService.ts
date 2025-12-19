import * as vscode from "vscode";
import { MergeRequest } from "../types";

interface CacheEntry {
  value: MergeRequest | null;
  expiresAt: number;
}

/**
 * Service for caching commit SHA to MR mappings
 * Implements TTL-based expiration and manual invalidation
 */
export class CacheService {
  private cache = new Map<string, CacheEntry>();
  private ttlMs: number;
  private disposables: vscode.Disposable[] = [];

  constructor() {
    // Get TTL from configuration (in seconds), convert to milliseconds
    const config = vscode.workspace.getConfiguration("gitlabBlame");
    const ttlSeconds = config.get<number>("cacheTTL", 3600);
    this.ttlMs = ttlSeconds * 1000;
  }

  /**
   * Initialize the cache service and set up git operation listeners
   * @param gitApi The VS Code Git API for watching repository changes
   */
  initialize(gitApi: GitAPI | undefined): void {
    if (!gitApi) {
      return;
    }

    // Watch for repository state changes (covers pull, fetch, checkout, etc.)
    for (const repo of gitApi.repositories) {
      this.watchRepository(repo);
    }

    // Watch for new repositories being opened
    this.disposables.push(
      gitApi.onDidOpenRepository((repo) => {
        this.watchRepository(repo);
      }),
    );

    // Listen for configuration changes
    this.disposables.push(
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration("gitlabBlame.cacheTTL")) {
          const config = vscode.workspace.getConfiguration("gitlabBlame");
          const ttlSeconds = config.get<number>("cacheTTL", 3600);
          this.ttlMs = ttlSeconds * 1000;
        }
      }),
    );
  }

  /**
   * Watch a repository for state changes that should invalidate the cache
   */
  private watchRepository(repo: Repository): void {
    this.disposables.push(
      repo.state.onDidChange(() => {
        // Repository state changed (could be pull, fetch, checkout, commit, etc.)
        // Invalidate cache to ensure fresh data
        this.clear();
      }),
    );
  }

  /**
   * Get a cached MR for a commit SHA
   * @param sha The commit SHA
   * @returns The cached MR, null if cached as "no MR", or undefined if not in cache
   */
  get(sha: string): MergeRequest | null | undefined {
    const entry = this.cache.get(sha);

    if (!entry) {
      return undefined; // Not in cache
    }

    // Check if entry has expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(sha);
      return undefined; // Expired
    }

    return entry.value; // Could be MergeRequest or null (no MR found)
  }

  /**
   * Cache an MR (or null for "no MR found") for a commit SHA
   * @param sha The commit SHA
   * @param mr The MR to cache, or null if no MR was found
   */
  set(sha: string, mr: MergeRequest | null): void {
    // Don't cache if TTL is 0 (caching disabled)
    if (this.ttlMs <= 0) {
      return;
    }

    this.cache.set(sha, {
      value: mr,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  /**
   * Check if a SHA is in the cache (and not expired)
   * @param sha The commit SHA
   * @returns true if the SHA is cached
   */
  has(sha: string): boolean {
    return this.get(sha) !== undefined;
  }

  /**
   * Clear all cached entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get the current cache size
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Dispose of all resources
   */
  dispose(): void {
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables = [];
    this.cache.clear();
  }
}

// Import types from git.d.ts (only the ones we need for cache invalidation)
interface GitAPI {
  readonly repositories: Repository[];
  readonly onDidOpenRepository: vscode.Event<Repository>;
}

interface Repository {
  readonly state: RepositoryState;
}

interface RepositoryState {
  readonly onDidChange: vscode.Event<void>;
}
