import * as vscode from "vscode";
import { GitService } from "../services/GitService";
import { GitLabService } from "../services/GitLabService";
import { CacheService } from "../services/CacheService";
import { MergeRequest, BlameInfo } from "../types";

/**
 * Provides hover information for git blame with GitLab MR links
 */
export class BlameHoverProvider implements vscode.HoverProvider {
  private static readonly MR_TITLE_MAX_LENGTH = 50;
  private pendingRequests = new Map<string, Promise<MergeRequest | null>>();

  constructor(
    private gitService: GitService,
    private gitLabService: GitLabService,
    private cacheService: CacheService,
  ) {}

  async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
  ): Promise<vscode.Hover | null> {
    // Get blame info for the current line
    const blameInfo = await this.gitService.getBlameForLine(
      document.uri,
      position.line,
    );

    if (!blameInfo) {
      // No blame info (uncommitted line or error)
      return null;
    }

    // Check if request was cancelled
    if (token.isCancellationRequested) {
      return null;
    }

    // Build the hover content
    const content = await this.buildHoverContent(
      document.uri,
      blameInfo,
      token,
    );

    if (token.isCancellationRequested) {
      return null;
    }

    return new vscode.Hover(content);
  }

  /**
   * Build the hover content with commit info and MR link
   */
  private async buildHoverContent(
    uri: vscode.Uri,
    blameInfo: BlameInfo,
    token: vscode.CancellationToken,
  ): Promise<vscode.MarkdownString> {
    const md = new vscode.MarkdownString();
    md.isTrusted = true;
    md.supportHtml = true;

    // Try to get MR info (from cache or API)
    const mrResult = await this.getMergeRequestInfo(uri, blameInfo.sha, token);

    // Add MR info if available
    if (mrResult.mr) {
      const mrLink = this.formatMrLink(mrResult.mr);
      md.appendMarkdown(`**Merge Request**: ${mrLink}\n\n`);
    } else if (mrResult.loading) {
      md.appendMarkdown(`*Loading merge request...*\n\n`);
    }

    // Add commit info
    const shortSha = blameInfo.sha.substring(0, 7);
    const dateStr = this.formatRelativeDate(blameInfo.date);
    md.appendMarkdown(
      `\`${shortSha}\` by ${this.escapeMarkdown(blameInfo.author)} • ${dateStr}`,
    );

    // Add commit message if available
    if (blameInfo.summary) {
      md.appendMarkdown(`\n\n*${this.escapeMarkdown(blameInfo.summary)}*`);
    }

    // Add "no MR" message if we checked and found nothing
    if (!mrResult.mr && !mrResult.loading && mrResult.checked) {
      md.appendMarkdown(`\n\n*No associated merge request*`);
    }

    return md;
  }

  /**
   * Get MR info from cache or fetch from API
   */
  private async getMergeRequestInfo(
    uri: vscode.Uri,
    sha: string,
    token: vscode.CancellationToken,
  ): Promise<{ mr: MergeRequest | null; loading: boolean; checked: boolean }> {
    // Check cache first
    const cached = this.cacheService.get(sha);
    if (cached !== undefined) {
      // Cache hit (could be MR or null for "no MR")
      return { mr: cached, loading: false, checked: true };
    }

    // Check if we have a pending request for this SHA
    const pendingKey = sha;
    if (this.pendingRequests.has(pendingKey)) {
      // Return loading state - another hover triggered the request
      return { mr: null, loading: true, checked: false };
    }

    // Check if token is configured
    if (!this.gitLabService.hasToken()) {
      return { mr: null, loading: false, checked: false };
    }

    // Get remote URL and parse it
    const remoteUrl = this.gitService.getRemoteUrl(uri);
    if (!remoteUrl) {
      return { mr: null, loading: false, checked: false };
    }

    const remoteInfo = this.gitLabService.parseRemoteUrl(remoteUrl);
    if (!remoteInfo) {
      return { mr: null, loading: false, checked: false };
    }

    // Start API request
    const requestPromise = this.fetchAndCacheMR(
      remoteInfo.projectPath,
      sha,
      remoteInfo.host,
    );
    this.pendingRequests.set(pendingKey, requestPromise);

    try {
      // Wait for the request with cancellation support
      const mr = await Promise.race([
        requestPromise,
        new Promise<null>((resolve) => {
          token.onCancellationRequested(() => resolve(null));
        }),
      ]);

      if (token.isCancellationRequested) {
        return { mr: null, loading: false, checked: false };
      }

      return { mr, loading: false, checked: true };
    } finally {
      this.pendingRequests.delete(pendingKey);
    }
  }

  /**
   * Fetch MR from API and cache the result
   */
  private async fetchAndCacheMR(
    projectPath: string,
    sha: string,
    gitlabHost: string,
  ): Promise<MergeRequest | null> {
    const mr = await this.gitLabService.getMergeRequestForCommit(
      projectPath,
      sha,
      gitlabHost,
    );

    // Cache the result (even if null, to avoid repeated API calls)
    this.cacheService.set(sha, mr);

    return mr;
  }

  /**
   * Format a date as relative time (e.g., "2 days ago")
   */
  private formatRelativeDate(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    const diffWeek = Math.floor(diffDay / 7);
    const diffMonth = Math.floor(diffDay / 30);
    const diffYear = Math.floor(diffDay / 365);

    if (diffSec < 60) {
      return "just now";
    } else if (diffMin < 60) {
      return `${diffMin} minute${diffMin === 1 ? "" : "s"} ago`;
    } else if (diffHour < 24) {
      return `${diffHour} hour${diffHour === 1 ? "" : "s"} ago`;
    } else if (diffDay < 7) {
      return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`;
    } else if (diffWeek < 4) {
      return `${diffWeek} week${diffWeek === 1 ? "" : "s"} ago`;
    } else if (diffMonth < 12) {
      return `${diffMonth} month${diffMonth === 1 ? "" : "s"} ago`;
    } else {
      return `${diffYear} year${diffYear === 1 ? "" : "s"} ago`;
    }
  }

  /**
   * Escape special markdown characters
   */
  private escapeMarkdown(text: string): string {
    return text.replace(/[\\`*_{}[\]()#+\-.!]/g, "\\$&");
  }

  /**
   * Escape characters for Markdown link title attribute
   */
  private escapeMarkdownTitle(text: string): string {
    return text.replace(/["\\]/g, "\\$&");
  }

  /**
   * Format MR link with truncation and tooltip for long titles
   */
  private formatMrLink(mr: MergeRequest): string {
    const prefix = `!${mr.iid} `;
    const fullText = prefix + mr.title;

    if (fullText.length <= BlameHoverProvider.MR_TITLE_MAX_LENGTH) {
      return `[${this.escapeMarkdown(fullText)}](${mr.webUrl})`;
    }

    // Truncate title only, preserving full MR number
    const availableForTitle =
      BlameHoverProvider.MR_TITLE_MAX_LENGTH - prefix.length - 3; // 3 for "..."
    const truncatedTitle =
      mr.title.substring(0, Math.max(0, availableForTitle)) + "...";
    const truncatedText = prefix + truncatedTitle;

    // Use Markdown link title syntax for full title tooltip
    const escapedTitle = this.escapeMarkdownTitle(mr.title);
    return `[${this.escapeMarkdown(truncatedText)}](${mr.webUrl} "${escapedTitle}")`;
  }
}
