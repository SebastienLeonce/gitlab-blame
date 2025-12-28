import { UI_CONSTANTS, VCS_PROVIDERS, VcsProviderId } from "@constants";
import {
  IHoverContentService,
  RichHoverContentOptions,
} from "@interfaces/IHoverContentService";
import { MergeRequest } from "@interfaces/types";

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
   * Format hover content with MR link only
   * Returns empty string if no MR and not loading (caller should suppress hover)
   */
  formatRichHoverContent(
    mr: MergeRequest | null,
    providerId: VcsProviderId | undefined,
    options: RichHoverContentOptions = {},
  ): string {
    const { loading = false } = options;

    if (mr && providerId) {
      const mrLink = this.formatRichMrLink(mr, providerId);
      return `**Merge Request**: ${mrLink}`;
    }

    if (loading) {
      return `*Loading merge request...*`;
    }

    return "";
  }
}
