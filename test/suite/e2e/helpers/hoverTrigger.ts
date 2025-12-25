import * as vscode from "vscode";

/**
 * Result of checking hover for MR info
 */
export interface HoverMrResult {
  /** Whether MR info was found in hover */
  hasMr: boolean;
  /** MR/PR number if found */
  mrNumber?: number;
  /** MR/PR title if found */
  title?: string;
  /** Full hover content for debugging */
  rawContent: string;
}

/**
 * Trigger hover programmatically and capture the result
 */
export class HoverTrigger {
  /**
   * Execute vscode.executeHoverProvider command to get hover content
   * This is the official way to programmatically get hover content
   *
   * @see https://code.visualstudio.com/api/references/commands
   */
  async getHoverContent(
    uri: vscode.Uri,
    position: vscode.Position,
  ): Promise<vscode.Hover[] | undefined> {
    return vscode.commands.executeCommand<vscode.Hover[]>(
      "vscode.executeHoverProvider",
      uri,
      position,
    );
  }

  /**
   * Get hover content as markdown strings
   */
  async getHoverMarkdown(
    uri: vscode.Uri,
    position: vscode.Position,
  ): Promise<string[]> {
    const hovers = await this.getHoverContent(uri, position);
    if (!hovers || hovers.length === 0) {
      return [];
    }

    const markdownStrings: string[] = [];
    for (const hover of hovers) {
      for (const content of hover.contents) {
        if (typeof content === "string") {
          markdownStrings.push(content);
        } else if (content instanceof vscode.MarkdownString) {
          markdownStrings.push(content.value);
        } else if ("value" in content) {
          markdownStrings.push((content as { value: string }).value);
        }
      }
    }
    return markdownStrings;
  }

  /**
   * Get all hover content combined as a single string
   */
  async getHoverText(
    uri: vscode.Uri,
    position: vscode.Position,
  ): Promise<string> {
    const markdown = await this.getHoverMarkdown(uri, position);
    return markdown.join("\n");
  }

  /**
   * Check if hover contains MR/PR information
   */
  async checkForMrInfo(
    uri: vscode.Uri,
    position: vscode.Position,
  ): Promise<HoverMrResult> {
    const markdown = await this.getHoverMarkdown(uri, position);
    const combined = markdown.join("\n");

    // Check for MR/PR link pattern (GitLab !123 or GitHub #123)
    const mrMatch = combined.match(/[!#](\d+)/);

    // Check for MR title in various formats
    // Format 1: **Merge Request**: [title](url)
    // Format 2: **Pull Request**: [title](url)
    const titleMatch = combined.match(
      /\*\*(?:Merge|Pull) Request\*\*:\s*\[([^\]]+)\]/,
    );

    return {
      hasMr:
        combined.includes("**Merge Request**") ||
        combined.includes("**Pull Request**") ||
        /[!#]\d+/.test(combined),
      mrNumber: mrMatch ? parseInt(mrMatch[1], 10) : undefined,
      title: titleMatch ? titleMatch[1] : undefined,
      rawContent: combined,
    };
  }

  /**
   * Check if hover shows "no associated merge request"
   */
  async hasNoMrMessage(
    uri: vscode.Uri,
    position: vscode.Position,
  ): Promise<boolean> {
    const text = await this.getHoverText(uri, position);
    return (
      text.toLowerCase().includes("no associated merge request") ||
      text.toLowerCase().includes("no associated pull request")
    );
  }

  /**
   * Check if hover shows loading state
   */
  async isLoading(
    uri: vscode.Uri,
    position: vscode.Position,
  ): Promise<boolean> {
    const text = await this.getHoverText(uri, position);
    return (
      text.toLowerCase().includes("loading") || text.includes("$(loading~spin)")
    );
  }

  /**
   * Wait for hover to contain MR info (with timeout)
   */
  async waitForMrInfo(
    uri: vscode.Uri,
    position: vscode.Position,
    timeout = 5000,
  ): Promise<HoverMrResult> {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const result = await this.checkForMrInfo(uri, position);
      if (result.hasMr) {
        return result;
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    // Return final result even if no MR found
    return this.checkForMrInfo(uri, position);
  }
}
