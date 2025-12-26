import {
  TIME_CONSTANTS,
  UI_CONSTANTS,
  VCS_PROVIDERS,
  VcsProviderId,
} from "@constants";
import {
  IHoverContentService,
  RichHoverContentOptions,
} from "@interfaces/IHoverContentService";
import { BlameInfo, MergeRequest } from "@interfaces/types";

/**
 * Service for formatting hover content (MR links, blame info, etc.)
 * Stateless - all methods are pure formatting functions
 */
export class HoverContentService implements IHoverContentService {
  /**
   * Get the MR/PR prefix for a provider
   */
  getMrPrefix(providerId: VcsProviderId): string {
    return providerId === VCS_PROVIDERS.GITLAB ? "!" : "#";
  }

  /**
   * Escape special markdown characters
   */
  escapeMarkdown(text: string): string {
    return text.replace(/[\\`*_{}[\]()#+\-.!]/g, "\\$&");
  }

  /**
   * Escape characters for Markdown link title attribute
   */
  private escapeMarkdownTitle(text: string): string {
    return text.replace(/["\\]/g, "\\$&");
  }

  /**
   * Format a date as relative time (e.g., "2 days ago")
   */
  formatRelativeDate(date: Date): string {
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
   * Format a simple MR/PR link for inline decoration hover
   * Example: [!123: Fix authentication bug](https://gitlab.com/.../42)
   */
  formatSimpleMrLink(mr: MergeRequest, providerId: VcsProviderId): string {
    const prefix = this.getMrPrefix(providerId);
    const mrText = `${prefix}${mr.iid}`;
    return `[${mrText}: ${this.escapeMarkdown(mr.title)}](${mr.webUrl})`;
  }

  /**
   * Format MR link with truncation and tooltip for long titles (rich hover)
   */
  private formatRichMrLink(
    mr: MergeRequest,
    providerId: VcsProviderId,
  ): string {
    const prefix = this.getMrPrefix(providerId);
    const mrNumber = `${prefix}${mr.iid} `;
    const fullText = mrNumber + mr.title;

    if (fullText.length <= UI_CONSTANTS.MAX_TITLE_LENGTH) {
      return `[${this.escapeMarkdown(fullText)}](${mr.webUrl})`;
    }

    // Truncate title only, preserving full MR number
    const availableForTitle =
      UI_CONSTANTS.MAX_TITLE_LENGTH -
      mrNumber.length -
      UI_CONSTANTS.ELLIPSIS_LENGTH;
    const truncatedTitle =
      mr.title.substring(0, Math.max(0, availableForTitle)) + "...";
    const truncatedText = mrNumber + truncatedTitle;

    // Use Markdown link title syntax for full title tooltip
    const escapedTitle = this.escapeMarkdownTitle(mr.title);
    return `[${this.escapeMarkdown(truncatedText)}](${mr.webUrl} "${escapedTitle}")`;
  }

  /**
   * Format rich hover content with MR link, SHA, author, date, and commit summary
   */
  formatRichHoverContent(
    mr: MergeRequest | null,
    blameInfo: BlameInfo,
    providerId: VcsProviderId | undefined,
    options: RichHoverContentOptions = {},
  ): string {
    const { loading = false, checked = false } = options;
    const parts: string[] = [];

    if (mr && providerId) {
      const mrLink = this.formatRichMrLink(mr, providerId);
      parts.push(`**Merge Request**: ${mrLink}`);
    } else if (loading) {
      parts.push(`*Loading merge request...*`);
    }

    const shortSha = blameInfo.sha.substring(0, UI_CONSTANTS.SHORT_SHA_LENGTH);
    const dateStr = this.formatRelativeDate(blameInfo.date);
    parts.push(
      `\`${shortSha}\` by ${this.escapeMarkdown(blameInfo.author)} • ${dateStr}`,
    );

    if (blameInfo.summary) {
      parts.push(`*${this.escapeMarkdown(blameInfo.summary)}*`);
    }

    if (!mr && !loading && checked) {
      parts.push(`*No associated merge request*`);
    }

    return parts.join("\n\n");
  }
}
