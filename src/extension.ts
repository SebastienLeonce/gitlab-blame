import * as vscode from "vscode";
import {
  CONFIG_KEYS,
  SECRET_KEYS,
  COMMANDS,
  DEFAULTS,
  VCS_PROVIDERS,
  DISPLAY_MODES,
  DisplayMode,
} from "./constants";
import { IVcsProvider } from "./interfaces/IVcsProvider";
import { VcsError, VcsErrorType } from "./interfaces/types";
import { BlameDecorationProvider } from "./providers/BlameDecorationProvider";
import { BlameHoverProvider } from "./providers/BlameHoverProvider";
import { GitHubProvider } from "./providers/vcs/GitHubProvider";
import { GitLabProvider } from "./providers/vcs/GitLabProvider";
import { CacheService } from "./services/CacheService";
import { logger } from "./services/ErrorLogger";
import { GitService } from "./services/GitService";
import { TokenService } from "./services/TokenService";
import { VcsProviderFactory } from "./services/VcsProviderFactory";

// Extension-wide output channel for error logging
let outputChannel: vscode.OutputChannel;

// Service instances (encapsulated in object to avoid global mutation)
interface ExtensionState {
  gitService?: GitService;
  cacheService?: CacheService;
  tokenService?: TokenService;
  vcsProviderFactory?: VcsProviderFactory;
  decorationProvider?: BlameDecorationProvider;
}

const state: ExtensionState = {};

export async function activate(
  context: vscode.ExtensionContext,
): Promise<void> {
  // Create output channel for error logging
  outputChannel = vscode.window.createOutputChannel("GitLab Blame");
  context.subscriptions.push(outputChannel);

  // Initialize centralized error logger
  logger.initialize(outputChannel);

  state.gitService = new GitService();
  const gitInitialized = await state.gitService.initialize();

  if (!gitInitialized) {
    const error = state.gitService.getInitializationError();
    logger.error(
      "Extension",
      "Failed to initialize Git",
      error || "Unknown error",
    );
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

  const githubUrl = config.get<string>(
    CONFIG_KEYS.GITHUB_URL,
    DEFAULTS.GITHUB_URL,
  );
  const githubProvider = new GitHubProvider(githubUrl);
  const githubToken = state.tokenService.getToken(VCS_PROVIDERS.GITHUB);
  githubProvider.setToken(githubToken);
  state.vcsProviderFactory.registerProvider(githubProvider);

  state.cacheService = new CacheService();
  state.cacheService.initialize(state.gitService.getAPI());

  const hoverProvider = new BlameHoverProvider(
    state.gitService,
    state.vcsProviderFactory,
    state.cacheService,
    handleVcsError,
  );

  // Get display mode configuration
  const displayMode = config.get<string>(
    CONFIG_KEYS.DISPLAY_MODE,
    DEFAULTS.DISPLAY_MODE,
  );

  state.decorationProvider = new BlameDecorationProvider(
    state.gitService,
    state.vcsProviderFactory,
    state.cacheService,
    displayMode as DisplayMode,
    handleVcsError,
  );

  // Conditionally activate decoration provider
  if (
    displayMode === DISPLAY_MODES.INLINE ||
    displayMode === DISPLAY_MODES.BOTH
  ) {
    state.decorationProvider.activate();
  }

  // Conditionally register hover provider
  if (
    displayMode === DISPLAY_MODES.HOVER ||
    displayMode === DISPLAY_MODES.BOTH
  ) {
    context.subscriptions.push(
      vscode.languages.registerHoverProvider({ scheme: "file" }, hoverProvider),
    );
  }

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

      if (e.key === SECRET_KEYS.GITHUB_TOKEN) {
        const token = await context.secrets.get(SECRET_KEYS.GITHUB_TOKEN);
        if (state.tokenService && token) {
          await state.tokenService.setToken(VCS_PROVIDERS.GITHUB, token);
        }
        const provider = state.vcsProviderFactory?.getProvider(
          VCS_PROVIDERS.GITHUB,
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

      if (e.affectsConfiguration(CONFIG_KEYS.GITHUB_URL)) {
        const config = vscode.workspace.getConfiguration();
        const newUrl = config.get<string>(
          CONFIG_KEYS.GITHUB_URL,
          DEFAULTS.GITHUB_URL,
        );
        const provider = state.vcsProviderFactory?.getProvider(
          VCS_PROVIDERS.GITHUB,
        );
        if (provider) {
          provider.setHostUrl(newUrl);
        }
      }

      if (e.affectsConfiguration(CONFIG_KEYS.DISPLAY_MODE)) {
        void vscode.window
          .showInformationMessage(
            "Display mode changed. Reload window to apply changes.",
            "Reload",
          )
          .then((action) => {
            if (action === "Reload") {
              void vscode.commands.executeCommand(
                "workbench.action.reloadWindow",
              );
            }
          });
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
  const context = `${error.type}${error.statusCode ? ` (${error.statusCode})` : ""}`;

  if (!error.shouldShowUI) {
    logger.warn(provider.name, context, error.message);
    return;
  }

  logger.error(provider.name, context, error.message);

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
      logger.error(provider.name, "Unknown error", error);
  }
}

/**
 * Auto-detect VCS provider from current workspace's git remote
 * @returns The detected provider or undefined if not detected
 */
function detectCurrentProvider(): IVcsProvider | undefined {
  if (!state.gitService || !state.vcsProviderFactory) {
    return undefined;
  }

  const activeEditor = vscode.window.activeTextEditor;
  if (!activeEditor) {
    return undefined;
  }

  const remoteUrl = state.gitService.getRemoteUrl(activeEditor.document.uri);
  if (!remoteUrl) {
    return undefined;
  }

  return state.vcsProviderFactory.detectProvider(remoteUrl);
}

/**
 * Register all extension commands
 */
function registerCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(COMMANDS.SET_TOKEN, async () => {
      let detectedProvider = detectCurrentProvider();

      if (!detectedProvider) {
        const selected = await vscode.window.showQuickPick(
          ["GitLab", "GitHub"],
          {
            placeHolder: "Select VCS provider",
            ignoreFocusOut: true,
          },
        );

        if (!selected) {
          return;
        }

        const providerId =
          selected === "GitLab" ? VCS_PROVIDERS.GITLAB : VCS_PROVIDERS.GITHUB;
        detectedProvider = state.vcsProviderFactory?.getProvider(providerId);
      }

      if (!detectedProvider) {
        void vscode.window.showErrorMessage("Provider not available");
        return;
      }

      const tokenPrompt =
        detectedProvider.id === VCS_PROVIDERS.GITLAB
          ? "Enter your GitLab Personal Access Token"
          : "Enter your GitHub Personal Access Token";

      const tokenPlaceholder =
        detectedProvider.id === VCS_PROVIDERS.GITLAB
          ? "glpat-xxxxxxxxxxxxxxxxxxxx"
          : "ghp_xxxxxxxxxxxxxxxxxxxx";

      const token = await vscode.window.showInputBox({
        prompt: tokenPrompt,
        password: true,
        ignoreFocusOut: true,
        placeHolder: tokenPlaceholder,
      });

      if (token) {
        await state.tokenService?.setToken(detectedProvider.id, token);
        detectedProvider.setToken(token);
        detectedProvider.resetErrorState();

        const wasDetected = detectedProvider.id === detectCurrentProvider()?.id;
        void vscode.window.showInformationMessage(
          `${detectedProvider.name} token saved successfully${wasDetected ? " (detected from workspace)" : ""}`,
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
      let detectedProvider = detectCurrentProvider();

      if (!detectedProvider) {
        const selected = await vscode.window.showQuickPick(
          ["GitLab", "GitHub"],
          {
            placeHolder: "Select VCS provider to delete token",
            ignoreFocusOut: true,
          },
        );

        if (!selected) {
          return;
        }

        const providerId =
          selected === "GitLab" ? VCS_PROVIDERS.GITLAB : VCS_PROVIDERS.GITHUB;
        detectedProvider = state.vcsProviderFactory?.getProvider(providerId);
      }

      if (!detectedProvider || !detectedProvider.hasToken()) {
        void vscode.window.showInformationMessage(
          `${detectedProvider?.name ?? "VCS"}: No token configured`,
        );
        return;
      }

      const confirm = await vscode.window.showWarningMessage(
        `Are you sure you want to delete your ${detectedProvider.name} Personal Access Token?`,
        { modal: true },
        "Delete",
      );

      if (confirm === "Delete") {
        await state.tokenService?.deleteToken(detectedProvider.id);
        detectedProvider.setToken(undefined);
        void vscode.window.showInformationMessage(
          `${detectedProvider.name}: Token deleted successfully`,
        );
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(COMMANDS.SHOW_STATUS, async () => {
      const config = vscode.workspace.getConfiguration();
      const cacheTTL = config.get<number>(
        CONFIG_KEYS.CACHE_TTL,
        DEFAULTS.CACHE_TTL_SECONDS,
      );
      const cacheSize = state.cacheService?.size ?? 0;
      const gitInitialized = state.gitService?.isInitialized() ?? false;

      const providers = state.vcsProviderFactory?.getAllProviders() ?? [];
      const providerStatus = providers
        .map((p) => {
          const url = p.getHostUrl();
          const hasToken = p.hasToken();
          return `${p.name}:\n  URL: ${url}\n  Token: ${hasToken ? "✓" : "✗"}`;
        })
        .join("\n\n");

      const statusItems = [
        providerStatus,
        `Cache TTL: ${cacheTTL} seconds`,
        `Cache entries: ${cacheSize}`,
        `Git extension: ${gitInitialized ? "Connected ✓" : "Not connected ✗"}`,
      ];

      const action = await vscode.window.showInformationMessage(
        `VCS Blame Status\n\n${statusItems.join("\n\n")}`,
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

  context.subscriptions.push(
    vscode.commands.registerCommand(COMMANDS.TOGGLE_DISPLAY_MODE, async () => {
      const config = vscode.workspace.getConfiguration();
      const currentMode = config.get<string>(
        CONFIG_KEYS.DISPLAY_MODE,
        DEFAULTS.DISPLAY_MODE,
      );

      // Cycle through modes: hover -> inline -> both -> hover
      const modes = [
        DISPLAY_MODES.HOVER,
        DISPLAY_MODES.INLINE,
        DISPLAY_MODES.BOTH,
      ] as const;
      const currentIndex = modes.indexOf(currentMode as (typeof modes)[number]);
      const nextMode = modes[(currentIndex + 1) % modes.length];

      await config.update(
        CONFIG_KEYS.DISPLAY_MODE,
        nextMode,
        vscode.ConfigurationTarget.Global,
      );

      void vscode.window
        .showInformationMessage(
          `Display mode: ${nextMode}. Reload window to apply.`,
          "Reload",
        )
        .then((action) => {
          if (action === "Reload") {
            void vscode.commands.executeCommand(
              "workbench.action.reloadWindow",
            );
          }
        });
    }),
  );
}

export function deactivate(): void {
  state.decorationProvider?.dispose();
  state.cacheService?.dispose();
  state.vcsProviderFactory?.clear();
  state.gitService = undefined;
  state.cacheService = undefined;
  state.tokenService = undefined;
  state.vcsProviderFactory = undefined;
  state.decorationProvider = undefined;
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
