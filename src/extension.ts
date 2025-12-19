import * as vscode from "vscode";
import { GitService } from "./services/GitService";
import { GitLabService } from "./services/GitLabService";
import { CacheService } from "./services/CacheService";
import { BlameHoverProvider } from "./providers/BlameHoverProvider";

let gitService: GitService | undefined;
let gitLabService: GitLabService | undefined;
let cacheService: CacheService | undefined;

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
    // Don't return - allow extension to partially work
  }

  // Initialize GitLabService
  gitLabService = new GitLabService();

  // Load token from SecretStorage
  const storedToken = await context.secrets.get("gitlabBlame.token");
  if (storedToken) {
    gitLabService.setToken(storedToken);
  }

  // Initialize CacheService with Git API for watching repo changes
  cacheService = new CacheService();
  cacheService.initialize(gitService.getAPI());

  // Register BlameHoverProvider for all file types
  const hoverProvider = new BlameHoverProvider(
    gitService,
    gitLabService,
    cacheService,
  );
  context.subscriptions.push(
    vscode.languages.registerHoverProvider({ scheme: "file" }, hoverProvider),
  );

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
      const size = cacheService?.size ?? 0;
      cacheService?.clear();
      void vscode.window.showInformationMessage(
        `GitLab Blame: Cache cleared (${size} entries removed)`,
      );
    },
  );

  context.subscriptions.push(setTokenCommand, clearCacheCommand);
}

export function deactivate(): void {
  cacheService?.dispose();
  gitService = undefined;
  gitLabService = undefined;
  cacheService = undefined;
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

/**
 * Get the CacheService instance
 * @returns CacheService if initialized, undefined otherwise
 */
export function getCacheService(): CacheService | undefined {
  return cacheService;
}
