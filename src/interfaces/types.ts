import * as vscode from "vscode";

/**
 * Merge/Pull Request information (provider-agnostic)
 */
export interface MergeRequest {
  iid: number;
  title: string;
  webUrl: string;
  mergedAt: string | null;
  state: string;
}

/**
 * Git blame information for a single line
 */
export interface BlameInfo {
  sha: string;
  author: string;
  authorEmail: string;
  date: Date;
  summary: string;
  line: number;
}

/**
 * GitLab API MR response structure
 */
export interface GitLabMR {
  id: number;
  iid: number;
  title: string;
  web_url: string;
  state: string;
  merged_at: string | null;
  author?: {
    name: string;
    username: string;
  };
}

/**
 * GitHub API Pull Request response structure
 */
export interface GitHubPR {
  id: number;
  number: number;
  title: string;
  html_url: string;
  state: string;
  merged_at: string | null;
  user?: {
    login: string;
  };
}

/**
 * Remote repository information
 */
export interface RemoteInfo {
  host: string;
  projectPath: string;
  provider: string;
}

/**
 * Git API types from VS Code Git extension (for cache invalidation)
 */
export interface GitAPI {
  readonly repositories: Repository[];
  readonly onDidOpenRepository: vscode.Event<Repository>;
}

export interface Repository {
  readonly state: RepositoryState;
}

export interface RepositoryState {
  readonly onDidChange: vscode.Event<void>;
}

/**
 * Result type for VCS provider operations
 */
export interface VcsResult<T> {
  success: boolean;
  data?: T;
  error?: VcsError;
}

/**
 * Standardized error type for VCS operations
 */
export interface VcsError {
  type: VcsErrorType;
  message: string;
  statusCode?: number;
  shouldShowUI: boolean;
}

/**
 * VCS error types
 */
export enum VcsErrorType {
  NoToken = "NO_TOKEN",
  InvalidToken = "INVALID_TOKEN",
  RateLimited = "RATE_LIMITED",
  NetworkError = "NETWORK_ERROR",
  NotFound = "NOT_FOUND",
  Unknown = "UNKNOWN",
}
