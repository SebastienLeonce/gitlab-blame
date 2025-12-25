import * as vscode from "vscode";
import { TIME_CONSTANTS, UI_CONSTANTS } from "@constants";
import { ICacheService } from "@interfaces/ICacheService";
import { IVcsProvider } from "@interfaces/IVcsProvider";
import { MergeRequest, BlameInfo, VcsError } from "@interfaces/types";
import { GitService } from "@services/GitService";
import { VcsProviderFactory } from "@services/VcsProviderFactory";

/**
 * Callback for handling VCS errors with UI
 */
export type VcsErrorHandler = (error: VcsError, provider: IVcsProvider) => void;

/**
 * Provides hover information for git blame with MR/PR links
 * Works with any VCS provider (GitLab, GitHub, etc.) via VcsProviderFactory
 */
export class BlameHoverProvider implements vscode.HoverProvider {
  private pendingRequests = new Map<string, Promise<MergeRequest | null>>();

  constructor(
    private gitService: GitService,
    private vcsProviderFactory: VcsProviderFactory,
    private cacheService: ICacheService,
    private onVcsError?: VcsErrorHandler,
  ) {}

  async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
  ): Promise<vscode.Hover | null> {
    const blameInfo = await this.gitService.getBlameForLine(
      document.uri,
      position.line,
    );

    if (!blameInfo) {
      // No blame info (uncommitted line or error)
      return null;
    }

    if (token.isCancellationRequested) {
      return null;
    }

    const content = await this.buildHoverContent(
      document.uri,
      blameInfo,
      token,
    );

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

    const mrResult = await this.getMergeRequestInfo(uri, blameInfo.sha, token);

    if (mrResult.mr) {
      const mrLink = this.formatMrLink(mrResult.mr);
      md.appendMarkdown(`**Merge Request**: ${mrLink}\n\n`);
    } else if (mrResult.loading) {
      md.appendMarkdown(`*Loading merge request...*\n\n`);
    }

    const shortSha = blameInfo.sha.substring(0, UI_CONSTANTS.SHORT_SHA_LENGTH);
    const dateStr = this.formatRelativeDate(blameInfo.date);
    md.appendMarkdown(
      `\`${shortSha}\` by ${this.escapeMarkdown(blameInfo.author)} • ${dateStr}`,
    );

    if (blameInfo.summary) {
      md.appendMarkdown(`\n\n*${this.escapeMarkdown(blameInfo.summary)}*`);
    }

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
    const remoteUrl = this.gitService.getRemoteUrl(uri);
    if (!remoteUrl) {
      return { mr: null, loading: false, checked: false };
    }

    const provider = this.vcsProviderFactory.detectProvider(remoteUrl);
    if (!provider) {
      return { mr: null, loading: false, checked: false };
    }

    const cached = this.cacheService.get(provider.id, sha);
    if (cached !== undefined) {
      // Cache hit (could be MR or null for "no MR")
      return { mr: cached, loading: false, checked: true };
    }

    const pendingKey = `${provider.id}:${sha}`;
    if (this.pendingRequests.has(pendingKey)) {
      return { mr: null, loading: true, checked: false };
    }

    if (!provider.hasToken()) {
      return { mr: null, loading: false, checked: false };
    }

    const remoteInfo = provider.parseRemoteUrl(remoteUrl);
    if (!remoteInfo) {
      return { mr: null, loading: false, checked: false };
    }

    const requestPromise = this.fetchAndCacheMR(
      provider,
      remoteInfo.projectPath,
      sha,
      remoteInfo.host,
    );
    this.pendingRequests.set(pendingKey, requestPromise);

    try {
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
    provider: IVcsProvider,
    projectPath: string,
    sha: string,
    host: string,
  ): Promise<MergeRequest | null> {
    const result = await provider.getMergeRequestForCommit(
      projectPath,
      sha,
      host,
    );

    if (!result.success && result.error) {
      if (this.onVcsError) {
        this.onVcsError(result.error, provider);
      }
      // Cache null to avoid repeated errors
      this.cacheService.set(provider.id, sha, null);
      return null;
    }

    const mr = result.data ?? null;
    this.cacheService.set(provider.id, sha, mr);
    return mr;
  }

  /**
   * Format a date as relative time (e.g., "2 days ago")
   */
  private formatRelativeDate(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / TIME_CONSTANTS.MS_PER_SECOND);
    const diffMin = Math.floor(diffSec / TIME_CONSTANTS.SECONDS_PER_MINUTE);
    const diffHour = Math.floor(diffMin / TIME_CONSTANTS.MINUTES_PER_HOUR);
    const diffDay = Math.floor(diffHour / TIME_CONSTANTS.HOURS_PER_DAY);
    const diffWeek = Math.floor(diffDay / TIME_CONSTANTS.DAYS_PER_WEEK);
    const diffMonth = Math.floor(diffDay / TIME_CONSTANTS.DAYS_PER_MONTH);
    const diffYear = Math.floor(diffDay / TIME_CONSTANTS.DAYS_PER_YEAR);

    if (diffSec < TIME_CONSTANTS.SECONDS_PER_MINUTE) {
      return "just now";
    } else if (diffMin < TIME_CONSTANTS.MINUTES_PER_HOUR) {
      return `${diffMin} minute${diffMin === 1 ? "" : "s"} ago`;
    } else if (diffHour < TIME_CONSTANTS.HOURS_PER_DAY) {
      return `${diffHour} hour${diffHour === 1 ? "" : "s"} ago`;
    } else if (diffDay < TIME_CONSTANTS.DAYS_PER_WEEK) {
      return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`;
    } else if (diffWeek < TIME_CONSTANTS.WEEKS_PER_MONTH) {
      return `${diffWeek} week${diffWeek === 1 ? "" : "s"} ago`;
    } else if (diffMonth < TIME_CONSTANTS.MONTHS_PER_YEAR) {
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

    if (fullText.length <= UI_CONSTANTS.MAX_TITLE_LENGTH) {
      return `[${this.escapeMarkdown(fullText)}](${mr.webUrl})`;
    }

    // Truncate title only, preserving full MR number
    const availableForTitle =
      UI_CONSTANTS.MAX_TITLE_LENGTH -
      prefix.length -
      UI_CONSTANTS.ELLIPSIS_LENGTH;
    const truncatedTitle =
      mr.title.substring(0, Math.max(0, availableForTitle)) + "...";
    const truncatedText = prefix + truncatedTitle;

    // Use Markdown link title syntax for full title tooltip
    const escapedTitle = this.escapeMarkdownTitle(mr.title);
    return `[${this.escapeMarkdown(truncatedText)}](${mr.webUrl} "${escapedTitle}")`;
  }
}
