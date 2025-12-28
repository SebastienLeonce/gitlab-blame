import { UI_CONSTANTS, VCS_PROVIDERS, VcsProviderId } from "@constants";
import {
  IHoverContentService,
  RichHoverContentOptions,
} from "@interfaces/IHoverContentService";
import { MergeRequest, MergeRequestStats } from "@interfaces/types";

/**
 * Service for formatting hover content (MR links)
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
   * Format stats line based on provider data using ThemeIcons
   * GitHub: "$(diff-added) 100  $(diff-removed) 50  $(file) 5"
   * GitLab: "$(diff) 42 changes"
   */
  private formatStatsLine(stats: MergeRequestStats): string {
    if (stats.additions !== undefined && stats.deletions !== undefined) {
      let line = `$(diff-added) ${stats.additions}  $(diff-removed) ${stats.deletions}`;
      if (stats.changedFiles !== undefined) {
        line += `  $(file) ${stats.changedFiles}`;
      }
      return line;
    }

    if (stats.changesCount !== undefined) {
      const changeLabel = stats.changesCount === "1" ? "change" : "changes";
      return `$(diff) ${stats.changesCount} ${changeLabel}`;
    }

    return "";
  }

  /**
   * Format hover content with MR link and optional stats
   * Returns empty string if no MR and not loading (caller should suppress hover)
   */
  formatRichHoverContent(
    mr: MergeRequest | null,
    providerId: VcsProviderId | undefined,
    options: RichHoverContentOptions = {},
  ): string {
    const { loading = false, statsLoading = false } = options;

    if (mr && providerId) {
      const mrLink = this.formatRichMrLink(mr, providerId);
      let content = `**Merge Request**: ${mrLink}`;

      if (mr.stats) {
        const statsLine = this.formatStatsLine(mr.stats);
        if (statsLine) {
          content += `\n\n${statsLine}`;
        }
      } else if (statsLoading) {
        content += `\n\n*Loading stats...*`;
      }

      return content;
    }

    if (loading) {
      return `*Loading merge request...*`;
    }

    return "";
  }
}
