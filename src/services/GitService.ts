import * as vscode from "vscode";
import { GitExtension, API, Repository } from "../types/git";
import { BlameInfo } from "../types";

/**
 * Service for interacting with Git via VS Code's built-in Git extension
 */
export class GitService {
  private api: API | undefined;
  private initializationError: string | undefined;

  /**
   * Initialize the Git service by getting the VS Code Git extension API
   * @returns true if initialization succeeded, false otherwise
   */
  async initialize(): Promise<boolean> {
    try {
      const gitExtension =
        vscode.extensions.getExtension<GitExtension>("vscode.git");

      if (!gitExtension) {
        this.initializationError = "Git extension not found";
        return false;
      }

      if (!gitExtension.isActive) {
        await gitExtension.activate();
      }

      const git = gitExtension.exports;

      if (!git.enabled) {
        this.initializationError =
          "Git extension is disabled. Please enable it in VS Code settings.";
        return false;
      }

      this.api = git.getAPI(1);

      if (this.api.state !== "initialized") {
        // Wait for Git to initialize
        await new Promise<void>((resolve) => {
          const disposable = this.api!.onDidChangeState((state) => {
            if (state === "initialized") {
              disposable.dispose();
              resolve();
            }
          });
        });
      }

      return true;
    } catch (error) {
      this.initializationError =
        error instanceof Error ? error.message : "Unknown error";
      return false;
    }
  }

  /**
   * Get the initialization error message if initialization failed
   */
  getInitializationError(): string | undefined {
    return this.initializationError;
  }

  /**
   * Check if the service is initialized
   */
  isInitialized(): boolean {
    return this.api !== undefined;
  }

  /**
   * Get the Git API instance
   * @returns The VS Code Git API or undefined if not initialized
   */
  getAPI(): API | undefined {
    return this.api;
  }

  /**
   * Get the repository for a given URI
   */
  getRepository(uri: vscode.Uri): Repository | null {
    if (!this.api) {
      return null;
    }
    return this.api.getRepository(uri);
  }

  /**
   * Get blame information for a specific line in a file
   * @param uri The file URI
   * @param line The line number (0-based)
   * @returns BlameInfo for the line, or undefined if not available
   */
  async getBlameForLine(
    uri: vscode.Uri,
    line: number,
  ): Promise<BlameInfo | undefined> {
    const repo = this.getRepository(uri);
    if (!repo) {
      return undefined;
    }

    try {
      const blameOutput = await repo.blame(uri.fsPath);
      const blameMap = this.parseBlameOutput(blameOutput);
      return blameMap.get(line + 1); // git blame uses 1-based line numbers
    } catch (error) {
      console.error("GitLab Blame: Error getting blame info:", error);
      return undefined;
    }
  }

  /**
   * Get blame information for all lines in a file
   * @param uri The file URI
   * @returns Map of line numbers (1-based) to BlameInfo
   */
  async getBlameForFile(
    uri: vscode.Uri,
  ): Promise<Map<number, BlameInfo> | undefined> {
    const repo = this.getRepository(uri);
    if (!repo) {
      return undefined;
    }

    try {
      const blameOutput = await repo.blame(uri.fsPath);
      return this.parseBlameOutput(blameOutput);
    } catch (error) {
      console.error("GitLab Blame: Error getting blame info:", error);
      return undefined;
    }
  }

  /**
   * Get the remote URL for the origin remote
   * @param uri A file URI within the repository
   * @returns The remote URL or undefined
   */
  getRemoteUrl(uri: vscode.Uri): string | undefined {
    const repo = this.getRepository(uri);
    if (!repo) {
      return undefined;
    }

    const origin = repo.state.remotes.find((r) => r.name === "origin");
    return origin?.fetchUrl ?? origin?.pushUrl;
  }

  /**
   * Parse git blame --porcelain output into a map of line numbers to BlameInfo
   *
   * Porcelain format:
   * <sha> <orig-line> <final-line> [<num-lines>]
   * author <name>
   * author-mail <email>
   * author-time <timestamp>
   * author-tz <timezone>
   * committer <name>
   * committer-mail <email>
   * committer-time <timestamp>
   * committer-tz <timezone>
   * summary <message>
   * [previous <sha> <filename>]
   * filename <filename>
   * \t<line-content>
   */
  private parseBlameOutput(output: string): Map<number, BlameInfo> {
    const result = new Map<number, BlameInfo>();
    const lines = output.split("\n");

    let currentSha: string | undefined;
    let currentAuthor: string | undefined;
    let currentAuthorEmail: string | undefined;
    let currentDate: Date | undefined;
    let currentSummary: string | undefined;
    let currentLine: number | undefined;

    for (const line of lines) {
      // SHA line: <sha> <orig-line> <final-line> [<num-lines>]
      const shaMatch = line.match(/^([a-f0-9]{40}) \d+ (\d+)/);
      if (shaMatch) {
        currentSha = shaMatch[1];
        currentLine = parseInt(shaMatch[2], 10);
        continue;
      }

      // Author name
      if (line.startsWith("author ")) {
        currentAuthor = line.substring(7);
        continue;
      }

      // Author email
      if (line.startsWith("author-mail ")) {
        currentAuthorEmail = line.substring(12).replace(/[<>]/g, "");
        continue;
      }

      // Author time (Unix timestamp)
      if (line.startsWith("author-time ")) {
        const timestamp = parseInt(line.substring(12), 10);
        currentDate = new Date(timestamp * 1000);
        continue;
      }

      // Commit summary
      if (line.startsWith("summary ")) {
        currentSummary = line.substring(8);
        continue;
      }

      // Line content (starts with tab) - end of block for this line
      if (line.startsWith("\t") && currentSha && currentLine !== undefined) {
        // Check for uncommitted changes (all zeros SHA)
        const isUncommitted = currentSha === "0".repeat(40);

        if (!isUncommitted) {
          result.set(currentLine, {
            sha: currentSha,
            author: currentAuthor ?? "Unknown",
            authorEmail: currentAuthorEmail ?? "",
            date: currentDate ?? new Date(),
            summary: currentSummary ?? "",
            line: currentLine,
          });
        }

        // Reset for next block (but keep SHA info for consecutive lines from same commit)
      }
    }

    return result;
  }
}
