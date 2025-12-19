import * as vscode from "vscode";
import { GitService } from "./services/GitService";
import { GitLabService } from "./services/GitLabService";

let gitService: GitService | undefined;
let gitLabService: GitLabService | undefined;

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

  // Initialize GitLabService
  gitLabService = new GitLabService();

  // Load token from SecretStorage
  const storedToken = await context.secrets.get("gitlabBlame.token");
  if (storedToken) {
    gitLabService.setToken(storedToken);
  }

  // Listen for secret changes (e.g., token updated externally)
  context.subscriptions.push(
    context.secrets.onDidChange((e) => {
      if (e.key === "gitlabBlame.token") {
        void context.secrets.get("gitlabBlame.token").then((token) => {
          gitLabService?.setToken(token);
          gitLabService?.resetTokenErrorFlag();
        });
      }
    }),
  );

  // Listen for configuration changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("gitlabBlame.gitlabUrl")) {
        const config = vscode.workspace.getConfiguration("gitlabBlame");
        const newUrl = config.get<string>("gitlabUrl", "https://gitlab.com");
        gitLabService?.setGitLabUrl(newUrl);
      }
    }),
  );

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
        gitLabService?.setToken(token);
        gitLabService?.resetTokenErrorFlag();
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
  // - CacheService (Phase 4)
  // - BlameHoverProvider (Phase 5)
}

export function deactivate(): void {
  gitService = undefined;
  gitLabService = undefined;
}

/**
 * Get the GitService instance
 * @returns GitService if initialized, undefined otherwise
 */
export function getGitService(): GitService | undefined {
  return gitService;
}

/**
 * Get the GitLabService instance
 * @returns GitLabService if initialized, undefined otherwise
 */
export function getGitLabService(): GitLabService | undefined {
  return gitLabService;
}
