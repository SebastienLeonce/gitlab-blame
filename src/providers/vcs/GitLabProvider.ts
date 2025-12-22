import { VCS_PROVIDERS, DEFAULTS, HTTP_STATUS } from "../../constants";
import { IVcsProvider } from "../../interfaces/IVcsProvider";
import {
  MergeRequest,
  VcsResult,
  RemoteInfo,
  VcsErrorType,
  GitLabMR,
} from "../../interfaces/types";
import { logger } from "../../services/ErrorLogger";
import { parseGitLabRemote, isGitLabRemote } from "../../utils/remoteParser";

/**
 * GitLab VCS provider implementation
 * Handles GitLab-specific API calls and URL parsing
 */
export class GitLabProvider implements IVcsProvider {
  readonly id = VCS_PROVIDERS.GITLAB;
  readonly name = "GitLab";

  private token: string | undefined;
  private hostUrl: string;
  private hasShownTokenError = false;

  constructor(hostUrl: string = DEFAULTS.GITLAB_URL) {
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
    // First check if this is actually a GitLab URL
    if (!this.isProviderUrl(remoteUrl)) {
      return null;
    }

    const parsed = parseGitLabRemote(remoteUrl);
    if (!parsed) {
      return null;
    }
    return {
      ...parsed,
      provider: this.id,
    };
  }

  isProviderUrl(remoteUrl: string): boolean {
    return isGitLabRemote(remoteUrl);
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

    const host = hostUrl ?? this.hostUrl;
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
        return this.handleApiError(response.status);
      }

      const mrs: GitLabMR[] = (await response.json()) as GitLabMR[];
      if (mrs.length === 0) {
        return { success: true, data: null };
      }

      const selectedMr = this.selectMergeRequest(mrs);
      return { success: true, data: selectedMr };
    } catch (error) {
      logger.error("GitLab", "API request failed", error);
      return {
        success: false,
        error: {
          type: VcsErrorType.NetworkError,
          message: error instanceof Error ? error.message : "Network error",
          shouldShowUI: false,
        },
      };
    }
  }

  resetErrorState(): void {
    this.hasShownTokenError = false;
  }

  /**
   * Select the appropriate MR from a list
   * Strategy: First merged MR by merged_at date
   */
  private selectMergeRequest(mrs: GitLabMR[]): MergeRequest | null {
    const mergedMRs = mrs.filter((mr) => mr.state === "merged" && mr.merged_at);

    if (mergedMRs.length === 0) {
      if (mrs.length > 0) {
        return this.mapToMergeRequest(mrs[0]);
      }
      return null;
    }

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
   * Returns VcsResult with error details but NO UI
   */
  private handleApiError(statusCode: number): VcsResult<MergeRequest | null> {
    switch (statusCode) {
      case HTTP_STATUS.UNAUTHORIZED:
      case HTTP_STATUS.FORBIDDEN: {
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

      case HTTP_STATUS.NOT_FOUND:
        return {
          success: false,
          error: {
            type: VcsErrorType.NotFound,
            message: "Project or commit not found",
            statusCode,
            shouldShowUI: false,
          },
        };

      case HTTP_STATUS.TOO_MANY_REQUESTS:
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
}
