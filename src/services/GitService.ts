import * as vscode from "vscode";
import { BLAME_CONSTANTS } from "../constants";
import { BlameInfo } from "../types";
import { GitExtension, API, Repository } from "../types/git";
import { logger } from "./ErrorLogger";

/**
 * Git blame output parsing patterns
 */
const GIT_BLAME_PATTERNS = {
  /**
   * Standard git blame format:
   * ^?<sha> (<author> <date> <time> <timezone> <line>) <content>
   * Groups: [full, sha, author, date, time, timezone, lineNum, content]
   * @example d01a7c049 (lsidoree 2025-07-09 17:57:39 +0200 1) import {
   * @example ^abc1234  (Another Author 2024-01-15 10:30:00 +0000 42) const x = 1;
   */
  STANDARD_FORMAT:
    /^\^?([a-f0-9]+)\s+\((.+?)\s+(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})\s+([+-]\d{4})\s+(\d+)\)\s?(.*)$/,

  /**
   * Uncommitted changes indicator (all zeros SHA)
   * @example 0000000000 - indicates uncommitted changes
   */
  UNCOMMITTED_SHA: /^0+$/,
} as const;

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
      return blameMap.get(line + BLAME_CONSTANTS.LINE_NUMBER_OFFSET);
    } catch (error) {
      logger.error("Git", "Error getting blame info", error);
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
      logger.error("Git", "Error getting blame info for file", error);
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
   * Parse git blame output into a map of line numbers to BlameInfo
   *
   * VS Code Git API returns standard blame format:
   * <sha> (<author> <date> <time> <timezone> <line-number>) <content>
   *
   * Example:
   * d01a7c049 (lsidoree         2025-07-09 17:57:39 +0200   1) import {
   * ^abc1234  (Another Author   2024-01-15 10:30:00 +0000  42) const x = 1;
   *
   * Note: SHA may be prefixed with ^ for boundary commits
   */
  private parseBlameOutput(output: string): Map<number, BlameInfo> {
    const result = new Map<number, BlameInfo>();
    const lines = output.split("\n");

    for (const line of lines) {
      const match = line.match(GIT_BLAME_PATTERNS.STANDARD_FORMAT);
      if (!match) {
        continue;
      }

      const [, sha, author, date, time, , lineNumStr] = match;
      const lineNum = parseInt(lineNumStr, 10);

      // Check for uncommitted changes (all zeros SHA)
      const isUncommitted = GIT_BLAME_PATTERNS.UNCOMMITTED_SHA.test(sha);

      if (!isUncommitted && sha && author && lineNum) {
        const dateTime = new Date(`${date}T${time}`);

        result.set(lineNum, {
          sha: sha,
          author: author.trim(),
          authorEmail: "", // Standard format doesn't include email
          date: dateTime,
          summary: "", // Standard format doesn't include commit message
          line: lineNum,
        });
      }
    }

    return result;
  }
}
