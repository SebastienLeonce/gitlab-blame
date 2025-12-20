import * as vscode from "vscode";
import { GitService } from "./services/GitService";
import { CacheService } from "./services/CacheService";
import { TokenService } from "./services/TokenService";
import { VcsProviderFactory } from "./services/VcsProviderFactory";
import { GitLabProvider } from "./providers/vcs/GitLabProvider";
import { BlameHoverProvider } from "./providers/BlameHoverProvider";
import { IVcsProvider } from "./interfaces/IVcsProvider";
import { VcsError, VcsErrorType } from "./interfaces/types";
import {
  CONFIG_KEYS,
  SECRET_KEYS,
  COMMANDS,
  DEFAULTS,
  VCS_PROVIDERS,
} from "./constants";

// Service instances (encapsulated in object to avoid global mutation)
interface ExtensionState {
  gitService?: GitService;
  cacheService?: CacheService;
  tokenService?: TokenService;
  vcsProviderFactory?: VcsProviderFactory;
}

const state: ExtensionState = {};

export async function activate(
  context: vscode.ExtensionContext,
): Promise<void> {
  state.gitService = new GitService();
  const gitInitialized = await state.gitService.initialize();

  if (!gitInitialized) {
    const error = state.gitService.getInitializationError();
    void vscode.window.showErrorMessage(
      `GitLab Blame: Failed to initialize Git - ${error}`,
    );
  }

  state.tokenService = new TokenService(context.secrets);
  await state.tokenService.loadTokens();

  state.vcsProviderFactory = new VcsProviderFactory();

  const config = vscode.workspace.getConfiguration();
  const gitlabUrl = config.get<string>(
    CONFIG_KEYS.GITLAB_URL,
    DEFAULTS.GITLAB_URL,
  );
  const gitlabProvider = new GitLabProvider(gitlabUrl);
  const gitlabToken = state.tokenService.getToken(VCS_PROVIDERS.GITLAB);
  gitlabProvider.setToken(gitlabToken);
  state.vcsProviderFactory.registerProvider(gitlabProvider);

  state.cacheService = new CacheService();
  state.cacheService.initialize(state.gitService.getAPI());

  const hoverProvider = new BlameHoverProvider(
    state.gitService,
    state.vcsProviderFactory,
    state.cacheService,
    handleVcsError,
  );
  context.subscriptions.push(
    vscode.languages.registerHoverProvider({ scheme: "file" }, hoverProvider),
  );

  // Listen for secret changes (e.g., token updated externally)
  context.subscriptions.push(
    context.secrets.onDidChange(async (e) => {
      if (e.key === SECRET_KEYS.GITLAB_TOKEN) {
        const token = await context.secrets.get(SECRET_KEYS.GITLAB_TOKEN);
        if (state.tokenService && token) {
          await state.tokenService.setToken(VCS_PROVIDERS.GITLAB, token);
        }
        const provider = state.vcsProviderFactory?.getProvider(
          VCS_PROVIDERS.GITLAB,
        );
        if (provider) {
          provider.setToken(token);
          provider.resetErrorState();
        }
      }
    }),
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(CONFIG_KEYS.GITLAB_URL)) {
        const config = vscode.workspace.getConfiguration();
        const newUrl = config.get<string>(
          CONFIG_KEYS.GITLAB_URL,
          DEFAULTS.GITLAB_URL,
        );
        const provider = state.vcsProviderFactory?.getProvider(
          VCS_PROVIDERS.GITLAB,
        );
        if (provider) {
          provider.setHostUrl(newUrl);
        }
      }
    }),
  );

  registerCommands(context);
}

/**
 * Handle VCS errors by showing appropriate UI
 * This is the central error handler called by BlameHoverProvider
 */
function handleVcsError(error: VcsError, provider: IVcsProvider): void {
  if (!error.shouldShowUI) {
    console.warn(`${provider.name} error (${error.type}):`, error.message);
    return;
  }

  switch (error.type) {
    case VcsErrorType.NoToken:
      void vscode.window
        .showWarningMessage(
          `${provider.name} Blame: No Personal Access Token configured.`,
          "Set Token",
        )
        .then((action) => {
          if (action === "Set Token") {
            void vscode.commands.executeCommand(COMMANDS.SET_TOKEN);
          }
        });
      break;

    case VcsErrorType.InvalidToken:
      void vscode.window
        .showErrorMessage(
          `${provider.name} Blame: Invalid or expired token. Please update your Personal Access Token.`,
          "Set Token",
        )
        .then((action) => {
          if (action === "Set Token") {
            void vscode.commands.executeCommand(COMMANDS.SET_TOKEN);
          }
        });
      break;

    case VcsErrorType.RateLimited:
      void vscode.window.showWarningMessage(
        `${provider.name} Blame: API rate limited. Please try again later.`,
      );
      break;

    case VcsErrorType.NetworkError:
      void vscode.window.showErrorMessage(
        `${provider.name} Blame: Network error. ${error.message}`,
      );
      break;

    default:
      console.error(`${provider.name} error:`, error);
  }
}

/**
 * Register all extension commands
 */
function registerCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(COMMANDS.SET_TOKEN, async () => {
      const token = await vscode.window.showInputBox({
        prompt: "Enter your GitLab Personal Access Token",
        password: true,
        ignoreFocusOut: true,
        placeHolder: "glpat-xxxxxxxxxxxxxxxxxxxx",
      });

      if (token) {
        await state.tokenService?.setToken(VCS_PROVIDERS.GITLAB, token);
        const provider = state.vcsProviderFactory?.getProvider(
          VCS_PROVIDERS.GITLAB,
        );
        if (provider) {
          provider.setToken(token);
          provider.resetErrorState();
        }
        void vscode.window.showInformationMessage(
          "GitLab token saved successfully",
        );
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(COMMANDS.CLEAR_CACHE, () => {
      const size = state.cacheService?.size ?? 0;
      state.cacheService?.clear();
      void vscode.window.showInformationMessage(
        `GitLab Blame: Cache cleared (${size} entries removed)`,
      );
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(COMMANDS.DELETE_TOKEN, async () => {
      const provider = state.vcsProviderFactory?.getProvider(
        VCS_PROVIDERS.GITLAB,
      );
      const hasToken = provider?.hasToken() ?? false;

      if (!hasToken) {
        void vscode.window.showInformationMessage(
          "GitLab Blame: No token configured",
        );
        return;
      }

      const confirm = await vscode.window.showWarningMessage(
        "Are you sure you want to delete your GitLab Personal Access Token?",
        { modal: true },
        "Delete",
      );

      if (confirm === "Delete") {
        await state.tokenService?.deleteToken(VCS_PROVIDERS.GITLAB);
        provider?.setToken(undefined);
        void vscode.window.showInformationMessage(
          "GitLab Blame: Token deleted successfully",
        );
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(COMMANDS.SHOW_STATUS, async () => {
      const config = vscode.workspace.getConfiguration();
      const gitlabUrl = config.get<string>(
        CONFIG_KEYS.GITLAB_URL,
        DEFAULTS.GITLAB_URL,
      );
      const cacheTTL = config.get<number>(
        CONFIG_KEYS.CACHE_TTL,
        DEFAULTS.CACHE_TTL_SECONDS,
      );
      const provider = state.vcsProviderFactory?.getProvider(
        VCS_PROVIDERS.GITLAB,
      );
      const hasToken = provider?.hasToken() ?? false;
      const cacheSize = state.cacheService?.size ?? 0;
      const gitInitialized = state.gitService?.isInitialized() ?? false;

      const statusItems = [
        `GitLab URL: ${gitlabUrl}`,
        `Token: ${hasToken ? "Configured ✓" : "Not configured ✗"}`,
        `Cache TTL: ${cacheTTL} seconds`,
        `Cache entries: ${cacheSize}`,
        `Git extension: ${gitInitialized ? "Connected ✓" : "Not connected ✗"}`,
      ];

      const action = await vscode.window.showInformationMessage(
        `GitLab Blame Status\n\n${statusItems.join("\n")}`,
        "Set Token",
        "Open Settings",
      );

      if (action === "Set Token") {
        void vscode.commands.executeCommand(COMMANDS.SET_TOKEN);
      } else if (action === "Open Settings") {
        void vscode.commands.executeCommand(
          "workbench.action.openSettings",
          "gitlabBlame",
        );
      }
    }),
  );
}

export function deactivate(): void {
  state.cacheService?.dispose();
  state.vcsProviderFactory?.clear();
  state.gitService = undefined;
  state.cacheService = undefined;
  state.tokenService = undefined;
  state.vcsProviderFactory = undefined;
}

/**
 * Get the GitService instance (for testing)
 */
export function getGitService(): GitService | undefined {
  return state.gitService;
}

/**
 * Get the VcsProviderFactory instance (for testing)
 */
export function getVcsProviderFactory(): VcsProviderFactory | undefined {
  return state.vcsProviderFactory;
}

/**
 * Get the CacheService instance (for testing)
 */
export function getCacheService(): CacheService | undefined {
  return state.cacheService;
}
