import * as vscode from "vscode";
import { MergeRequest, GitLabMR } from "../types";
import { parseGitLabRemote, GitLabRemoteInfo } from "../utils/remoteParser";

/**
 * Error types for GitLab API operations
 */
export enum GitLabErrorType {
  NoToken = "NO_TOKEN",
  InvalidToken = "INVALID_TOKEN",
  RateLimited = "RATE_LIMITED",
  NetworkError = "NETWORK_ERROR",
  NotFound = "NOT_FOUND",
  Unknown = "UNKNOWN",
}

export interface GitLabError {
  type: GitLabErrorType;
  message: string;
  statusCode?: number;
}

/**
 * Service for interacting with the GitLab API
 */
export class GitLabService {
  private token: string | undefined;
  private gitlabUrl: string;
  private hasShownTokenError = false;

  constructor() {
    // Get GitLab URL from configuration
    const config = vscode.workspace.getConfiguration("gitlabBlame");
    this.gitlabUrl = config.get<string>("gitlabUrl", "https://gitlab.com");
  }

  /**
   * Set the Personal Access Token for API authentication
   */
  setToken(token: string | undefined): void {
    this.token = token;
    this.hasShownTokenError = false;
  }

  /**
   * Check if a token is configured
   */
  hasToken(): boolean {
    return this.token !== undefined && this.token.length > 0;
  }

  /**
   * Get the configured GitLab URL
   */
  getGitLabUrl(): string {
    return this.gitlabUrl;
  }

  /**
   * Update the GitLab URL (e.g., when configuration changes)
   */
  setGitLabUrl(url: string): void {
    this.gitlabUrl = url;
  }

  /**
   * Parse a git remote URL to extract GitLab info
   */
  parseRemoteUrl(remoteUrl: string): GitLabRemoteInfo | null {
    return parseGitLabRemote(remoteUrl);
  }

  /**
   * Get the merge request associated with a commit
   *
   * @param projectPath The GitLab project path (e.g., "group/project")
   * @param commitSha The commit SHA
   * @param gitlabHost Optional GitLab host URL (uses configured URL if not provided)
   * @returns The first merged MR, or null if none found
   */
  async getMergeRequestForCommit(
    projectPath: string,
    commitSha: string,
    gitlabHost?: string,
  ): Promise<MergeRequest | null> {
    if (!this.token) {
      this.showTokenError();
      return null;
    }

    const host = gitlabHost ?? this.gitlabUrl;
    const encodedPath = encodeURIComponent(projectPath);
    const url = `${host}/api/v4/projects/${encodedPath}/repository/commits/${commitSha}/merge_requests`;

    try {
      const response = await fetch(url, {
        headers: {
          "PRIVATE-TOKEN": this.token,
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        this.handleApiError(response.status);
        return null;
      }

      const mrs: GitLabMR[] = (await response.json()) as GitLabMR[];
      if (mrs.length === 0) {
        return null;
      }

      return this.selectMergeRequest(mrs);
    } catch (error) {
      console.error("GitLab Blame: API request failed:", error);
      return null;
    }
  }

  /**
   * Select the appropriate MR from a list of MRs associated with a commit
   * Strategy: Select the first merged MR by merged_at date
   *
   * @param mrs List of MRs from GitLab API
   * @returns The selected MR, or null if none suitable
   */
  private selectMergeRequest(mrs: GitLabMR[]): MergeRequest | null {
    // Filter to merged MRs with a merged_at date
    const mergedMRs = mrs.filter((mr) => mr.state === "merged" && mr.merged_at);

    if (mergedMRs.length === 0) {
      // Fallback: return first MR if none are merged (e.g., open MR)
      if (mrs.length > 0) {
        return this.mapToMergeRequest(mrs[0]);
      }
      return null;
    }

    // Sort by merged_at date (ascending) and take the first one
    const firstMerged = mergedMRs.sort((a, b) => {
      const dateA = new Date(a.merged_at!).getTime();
      const dateB = new Date(b.merged_at!).getTime();
      return dateA - dateB;
    })[0];

    return this.mapToMergeRequest(firstMerged);
  }

  /**
   * Map GitLab API response to internal MergeRequest type
   */
  private mapToMergeRequest(mr: GitLabMR): MergeRequest {
    return {
      iid: mr.iid,
      title: mr.title,
      webUrl: mr.web_url,
      mergedAt: mr.merged_at,
      state: mr.state,
    };
  }

  /**
   * Handle API error responses
   */
  private handleApiError(statusCode: number): void {
    switch (statusCode) {
      case 401:
      case 403:
        if (!this.hasShownTokenError) {
          this.hasShownTokenError = true;
          void vscode.window
            .showErrorMessage(
              "GitLab Blame: Invalid or expired token. Please update your Personal Access Token.",
              "Set Token",
            )
            .then((action) => {
              if (action === "Set Token") {
                void vscode.commands.executeCommand("gitlabBlame.setToken");
              }
            });
        }
        break;

      case 404:
        // Project or commit not found - silently ignore
        break;

      case 429:
        console.warn("GitLab Blame: API rate limited");
        break;

      default:
        console.error(`GitLab Blame: API error ${statusCode}`);
    }
  }

  /**
   * Show error message when no token is configured
   */
  private showTokenError(): void {
    if (this.hasShownTokenError) {
      return;
    }

    this.hasShownTokenError = true;
    void vscode.window
      .showWarningMessage(
        "GitLab Blame: No Personal Access Token configured.",
        "Set Token",
      )
      .then((action) => {
        if (action === "Set Token") {
          void vscode.commands.executeCommand("gitlabBlame.setToken");
        }
      });
  }

  /**
   * Reset the token error flag (e.g., when a new token is set)
   */
  resetTokenErrorFlag(): void {
    this.hasShownTokenError = false;
  }
}
