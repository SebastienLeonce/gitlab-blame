import { IVcsProvider } from "../../interfaces/IVcsProvider";
import {
  MergeRequest,
  VcsResult,
  RemoteInfo,
  VcsErrorType,
  GitHubPR,
} from "../../interfaces/types";
import { VCS_PROVIDERS, DEFAULTS } from "../../constants";
import { parseGitHubRemote, isGitHubRemote } from "../../utils/remoteParser";

/**
 * GitHub VCS provider implementation
 * Handles GitHub-specific API calls and URL parsing
 */
export class GitHubProvider implements IVcsProvider {
  readonly id = VCS_PROVIDERS.GITHUB;
  readonly name = "GitHub";

  private token: string | undefined;
  private hostUrl: string;
  private hasShownTokenError = false;

  constructor(hostUrl: string = DEFAULTS.GITHUB_URL) {
    this.hostUrl = hostUrl;
  }

  setToken(token: string | undefined): void {
    this.token = token;
    this.hasShownTokenError = false;
  }

  hasToken(): boolean {
    return this.token !== undefined && this.token.length > 0;
  }

  getHostUrl(): string {
    return this.hostUrl;
  }

  setHostUrl(url: string): void {
    this.hostUrl = url;
  }

  parseRemoteUrl(remoteUrl: string): RemoteInfo | null {
    if (!this.isProviderUrl(remoteUrl)) {
      return null;
    }

    const parsed = parseGitHubRemote(remoteUrl);
    if (!parsed) {
      return null;
    }
    return {
      ...parsed,
      provider: this.id,
    };
  }

  isProviderUrl(remoteUrl: string): boolean {
    // Check if hostname contains "github" (for github.com)
    if (isGitHubRemote(remoteUrl)) {
      return true;
    }

    // Check if hostname matches configured GitHub URL
    const hostname = this.extractHostname(remoteUrl);
    if (!hostname) {
      return false;
    }

    const configuredHost = this.getConfiguredGitHost();
    return hostname.toLowerCase() === configuredHost.toLowerCase();
  }

  async getMergeRequestForCommit(
    projectPath: string,
    commitSha: string,
    hostUrl?: string,
  ): Promise<VcsResult<MergeRequest | null>> {
    if (!this.token) {
      const shouldShow = !this.hasShownTokenError;
      this.hasShownTokenError = true;
      return {
        success: false,
        error: {
          type: VcsErrorType.NoToken,
          message: "No Personal Access Token configured",
          shouldShowUI: shouldShow,
        },
      };
    }

    const gitHost = hostUrl ?? this.hostUrl;
    const apiHost = this.convertToApiUrl(gitHost);
    const url = `${apiHost}/repos/${projectPath}/commits/${commitSha}/pulls`;

    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `token ${this.token}`,
          Accept: "application/vnd.github+json",
        },
      });

      if (!response.ok) {
        return this.handleApiError(response.status);
      }

      const prs: GitHubPR[] = (await response.json()) as GitHubPR[];

      if (prs.length === 0) {
        // Fallback: Try to extract PR number from commit message
        // GitHub's API only returns PRs for merge commits, not individual commits
        const prNumber = await this.getPRNumberFromCommit(
          apiHost,
          projectPath,
          commitSha,
        );
        if (prNumber) {
          const pr = await this.fetchPullRequest(
            apiHost,
            projectPath,
            prNumber,
          );
          if (pr) {
            return { success: true, data: pr };
          }
        }
        return { success: true, data: null };
      }

      const selectedPr = this.selectPullRequest(prs);
      return { success: true, data: selectedPr };
    } catch (error) {
      console.error("[GitHub] API request failed:", error);
      let errorMessage = "Network error";
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      return {
        success: false,
        error: {
          type: VcsErrorType.NetworkError,
          message: errorMessage,
          shouldShowUI: false,
        },
      };
    }
  }

  resetErrorState(): void {
    this.hasShownTokenError = false;
  }

  /**
   * Select the appropriate PR from a list
   * Strategy: First merged PR by merged_at date
   */
  private selectPullRequest(prs: GitHubPR[]): MergeRequest | null {
    const mergedPRs = prs.filter((pr) => pr.merged_at !== null);

    if (mergedPRs.length === 0) {
      if (prs.length > 0) {
        return this.mapToPullRequest(prs[0]);
      }
      return null;
    }

    const firstMerged = mergedPRs.sort((a, b) => {
      const dateA = new Date(a.merged_at!).getTime();
      const dateB = new Date(b.merged_at!).getTime();
      return dateA - dateB;
    })[0];

    return this.mapToPullRequest(firstMerged);
  }

  /**
   * Map GitHub API response to internal MergeRequest type
   */
  private mapToPullRequest(pr: GitHubPR): MergeRequest {
    return {
      iid: pr.number,
      title: pr.title,
      webUrl: pr.html_url,
      mergedAt: pr.merged_at,
      state: pr.state,
    };
  }

  /**
   * Handle API error responses
   * Returns VcsResult with error details but NO UI
   */
  private handleApiError(statusCode: number): VcsResult<MergeRequest | null> {
    switch (statusCode) {
      case 401:
      case 403: {
        const shouldShow = !this.hasShownTokenError;
        this.hasShownTokenError = true;
        return {
          success: false,
          error: {
            type: VcsErrorType.InvalidToken,
            message: "Invalid or expired token",
            statusCode,
            shouldShowUI: shouldShow,
          },
        };
      }

      case 404:
        return {
          success: false,
          error: {
            type: VcsErrorType.NotFound,
            message: "Repository or commit not found",
            statusCode,
            shouldShowUI: false,
          },
        };

      case 429:
        return {
          success: false,
          error: {
            type: VcsErrorType.RateLimited,
            message: "API rate limited",
            statusCode,
            shouldShowUI: false,
          },
        };

      default:
        return {
          success: false,
          error: {
            type: VcsErrorType.Unknown,
            message: `API error ${statusCode}`,
            statusCode,
            shouldShowUI: false,
          },
        };
    }
  }

  /**
   * Extract hostname from remote URL
   */
  private extractHostname(remoteUrl: string): string | null {
    // SSH: git@hostname:path -> extract hostname
    const sshMatch = remoteUrl.match(/^git@([^:]+):/);
    if (sshMatch) {
      return sshMatch[1];
    }

    // HTTPS: https://hostname/path -> extract hostname
    try {
      const url = new URL(remoteUrl);
      return url.hostname;
    } catch {
      return null;
    }
  }

  /**
   * Get configured git hostname from hostUrl
   * Extracts hostname from the configured git URL and strips 'api.' prefix
   * to match git remote hostnames (e.g., api.github.com -> github.com)
   */
  private getConfiguredGitHost(): string {
    try {
      const url = new URL(this.hostUrl);
      // Remove 'api.' prefix if present for git remote matching
      return url.hostname.replace(/^api\./, "");
    } catch {
      return "";
    }
  }

  /**
   * Convert git URL to API URL
   * github.com -> api.github.com
   * github.enterprise.com -> api.github.enterprise.com
   */
  private convertToApiUrl(gitUrl: string): string {
    try {
      const url = new URL(gitUrl);
      if (url.hostname === "github.com") {
        return "https://api.github.com";
      }
      return `https://api.${url.hostname}`;
    } catch {
      return gitUrl;
    }
  }

  /**
   * Get PR number from commit message
   * GitHub automatically adds "(#123)" to merge commit messages
   */
  private async getPRNumberFromCommit(
    apiHost: string,
    projectPath: string,
    commitSha: string,
  ): Promise<number | null> {
    try {
      const url = `${apiHost}/repos/${projectPath}/commits/${commitSha}`;
      const response = await fetch(url, {
        headers: {
          Authorization: `token ${this.token}`,
          Accept: "application/vnd.github+json",
        },
      });

      if (!response.ok) {
        return null;
      }

      const commit = (await response.json()) as {
        commit: { message: string };
      };
      const message = commit.commit.message;

      // Extract PR number from patterns like "(#123)" or "Merge pull request #123"
      const match =
        message.match(/\(#(\d+)\)/) || message.match(/pull request #(\d+)/i);
      if (match) {
        return parseInt(match[1], 10);
      }

      return null;
    } catch (error) {
      console.error(
        `[GitHub] Failed to get PR number from commit message:`,
        error,
      );
      return null;
    }
  }

  /**
   * Fetch a specific pull request by number
   */
  private async fetchPullRequest(
    apiHost: string,
    projectPath: string,
    prNumber: number,
  ): Promise<MergeRequest | null> {
    try {
      const url = `${apiHost}/repos/${projectPath}/pulls/${prNumber}`;
      const response = await fetch(url, {
        headers: {
          Authorization: `token ${this.token}`,
          Accept: "application/vnd.github+json",
        },
      });

      if (!response.ok) {
        return null;
      }

      const pr: GitHubPR = (await response.json()) as GitHubPR;
      return this.mapToPullRequest(pr);
    } catch (error) {
      console.error(`[GitHub] Failed to fetch PR #${prNumber}:`, error);
      return null;
    }
  }
}
