import { VcsProviderId } from "@constants";
import { MergeRequest, BlameInfo } from "./types";

/**
 * Options for rich hover content formatting
 */
export interface RichHoverContentOptions {
  /** Whether MR data is still loading */
  loading?: boolean;
  /** Whether MR lookup was completed (to show "No MR" message) */
  checked?: boolean;
}

/**
 * Interface for hover content formatting service
 * Stateless service - all methods are pure formatting functions
 */
export interface IHoverContentService {
  /**
   * Format a simple MR/PR link for inline decoration hover
   * Returns markdown string: [!123: Title](url) or [#123: Title](url)
   * @param mr The merge request data
   * @param providerId Provider ID to determine prefix (! for GitLab, # for GitHub)
   * @returns Formatted markdown string
   */
  formatSimpleMrLink(mr: MergeRequest, providerId: VcsProviderId): string;

  /**
   * Format rich hover content with MR link, SHA, author, date, and commit summary
   * @param mr The merge request data (or null if no MR)
   * @param blameInfo Git blame information
   * @param providerId Provider ID for MR link prefix
   * @param options Optional loading/checked state
   * @returns Formatted markdown string
   */
  formatRichHoverContent(
    mr: MergeRequest | null,
    blameInfo: BlameInfo,
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
   * Format a date as relative time (e.g., "2 days ago")
   * @param date Date to format
   * @returns Human-readable relative time string
   */
  formatRelativeDate(date: Date): string;

  /**
   * Get the MR/PR prefix for a provider
   * @param providerId Provider ID
   * @returns "!" for GitLab, "#" for GitHub
   */
  getMrPrefix(providerId: VcsProviderId): string;
}
