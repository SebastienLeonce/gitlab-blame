import { VcsProviderId } from "@constants";
import { MergeRequest } from "./types";

/**
 * Options for hover content formatting
 */
export interface RichHoverContentOptions {
  /** Whether MR data is still loading */
  loading?: boolean;
  /** Whether MR stats are still loading (show loading indicator for stats only) */
  statsLoading?: boolean;
}

/**
 * Interface for hover content formatting service
 * Stateless service - all methods are pure formatting functions
 */
export interface IHoverContentService {
  /**
   * Format hover content with MR link only
   * Returns empty string if no MR and not loading (caller should suppress hover)
   * @param mr The merge request data (or null if no MR)
   * @param providerId Provider ID for MR link prefix
   * @param options Optional loading state
   * @returns Formatted markdown string, or empty string if no content
   */
  formatRichHoverContent(
    mr: MergeRequest | null,
    providerId: VcsProviderId | undefined,
    options?: RichHoverContentOptions,
  ): string;

  /**
   * Escape special markdown characters in text
   * @param text Text to escape
   * @returns Escaped text safe for markdown
   */
  escapeMarkdown(text: string): string;

  /**
   * Get the MR/PR prefix for a provider
   * @param providerId Provider ID
   * @returns "!" for GitLab, "#" for GitHub
   */
  getMrPrefix(providerId: VcsProviderId): string;
}
