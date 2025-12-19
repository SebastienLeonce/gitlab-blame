import * as vscode from "vscode";
import { GitService } from "./services/GitService";

let gitService: GitService | undefined;

export async function activate(
  context: vscode.ExtensionContext,
): Promise<void> {
  console.log("GitLab Blame MR Link extension is now active");

  // Initialize GitService
  gitService = new GitService();
  const gitInitialized = await gitService.initialize();

  if (!gitInitialized) {
    const error = gitService.getInitializationError();
    void vscode.window.showErrorMessage(
      `GitLab Blame: Failed to initialize Git - ${error}`,
    );
  }

  // Register command: Set Personal Access Token
  const setTokenCommand = vscode.commands.registerCommand(
    "gitlabBlame.setToken",
    async () => {
      const token = await vscode.window.showInputBox({
        prompt: "Enter your GitLab Personal Access Token",
        password: true,
        ignoreFocusOut: true,
        placeHolder: "glpat-xxxxxxxxxxxxxxxxxxxx",
      });

      if (token) {
        await context.secrets.store("gitlabBlame.token", token);
        void vscode.window.showInformationMessage(
          "GitLab token saved successfully",
        );
      }
    },
  );

  // Register command: Clear Cache
  const clearCacheCommand = vscode.commands.registerCommand(
    "gitlabBlame.clearCache",
    () => {
      // TODO: Implement cache clearing when CacheService is created
      void vscode.window.showInformationMessage("GitLab Blame cache cleared");
    },
  );

  context.subscriptions.push(setTokenCommand, clearCacheCommand);

  // TODO: Initialize remaining services and register HoverProvider
  // - GitLabService (Phase 3)
  // - CacheService (Phase 4)
  // - BlameHoverProvider (Phase 5)
}

export function deactivate(): void {
  gitService = undefined;
}

/**
 * Get the GitService instance
 * @returns GitService if initialized, undefined otherwise
 */
export function getGitService(): GitService | undefined {
  return gitService;
}
