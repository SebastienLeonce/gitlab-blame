import * as vscode from "vscode";
import * as path from "path";
import type { ExtensionApi } from "@src/extension";

/** Extension ID */
const EXTENSION_ID = "sebastien-dev.gitlab-blame";

/** Cached extension API */
let cachedApi: ExtensionApi | undefined;

/**
 * Wait for the extension to fully activate and return its API
 */
export async function waitForExtensionActivation(): Promise<
  vscode.Extension<ExtensionApi>
> {
  const ext = vscode.extensions.getExtension<ExtensionApi>(EXTENSION_ID);
  if (!ext) {
    throw new Error(`Extension ${EXTENSION_ID} not found`);
  }

  // Only set cachedApi if not already set (preserve across test suites)
  if (!cachedApi) {
    if (!ext.isActive) {
      cachedApi = await ext.activate();
    } else {
      cachedApi = ext.exports;
    }
  }

  await sleep(1000);

  return ext;
}

/**
 * Wait for Git extension to detect the fixture repository
 *
 * VS Code's Git extension loads repositories asynchronously AFTER api.state === "initialized".
 * This function uses the same retry pattern as BlameDecorationProvider.initialUpdateWithRetry()
 * to ensure the fixture repo is detected before tests run.
 *
 * @param fixtureUri - URI of a file in the fixture repository
 * @param maxRetries - Maximum retry attempts (default: 20 for E2E test reliability in CI)
 * @param retryDelayMs - Delay between retries (default: 500ms, matching UI_CONSTANTS.INIT_RETRY_DELAY_MS)
 * @returns Promise that resolves when repo is detected, rejects on timeout
 */
export async function waitForGitRepository(
  fixtureUri: vscode.Uri,
  maxRetries = 20,
  retryDelayMs = 500,
): Promise<void> {
  const api = getExtensionApi();
  if (!api) {
    throw new Error("Extension API not available");
  }

  const gitService = api.getGitService();
  if (!gitService) {
    throw new Error("GitService not accessible via extension exports");
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const remoteUrl = gitService.getRemoteUrl(fixtureUri);

    if (remoteUrl) {
      return;
    }

    if (attempt < maxRetries) {
      // Retry after delay (Git still loading repositories)
      await sleep(retryDelayMs);
    }
  }

  throw new Error(
    `Git extension did not detect fixture repository after ${maxRetries * retryDelayMs}ms. ` +
      `This may indicate:\n` +
      `  1. Git extension is still scanning workspaces\n` +
      `  2. Fixture repository is not in a workspace folder\n` +
      `  3. .git directory is missing or corrupted (should be committed to version control)`,
  );
}

/**
 * Get the extension if active
 */
export function getExtension(): vscode.Extension<ExtensionApi> | undefined {
  return vscode.extensions.getExtension<ExtensionApi>(EXTENSION_ID);
}

/**
 * Get the extension API
 */
export function getExtensionApi(): ExtensionApi | undefined {
  if (cachedApi) {
    return cachedApi;
  }
  const ext = getExtension();
  if (ext?.isActive) {
    return ext.exports;
  }
  return undefined;
}

/**
 * Open a file in the editor and wait for it to be ready
 */
export async function openFile(filePath: string): Promise<vscode.TextEditor> {
  const uri = vscode.Uri.file(filePath);
  const document = await vscode.workspace.openTextDocument(uri);
  const editor = await vscode.window.showTextDocument(document);

  await sleep(500);

  return editor;
}

/**
 * Close all editors
 */
export async function closeAllEditors(): Promise<void> {
  await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  await sleep(100);
}

/**
 * Move cursor to a specific position
 */
export async function moveCursor(
  editor: vscode.TextEditor,
  line: number,
  character = 0,
): Promise<void> {
  const position = new vscode.Position(line, character);
  editor.selection = new vscode.Selection(position, position);
  editor.revealRange(new vscode.Range(position, position));

  await sleep(200);
}

/**
 * Get the active text editor
 */
export function getActiveEditor(): vscode.TextEditor | undefined {
  return vscode.window.activeTextEditor;
}

/**
 * Clear the extension cache via command
 */
export async function clearCache(): Promise<void> {
  try {
    await vscode.commands.executeCommand("gitlabBlame.clearCache");
    await sleep(100);
  } catch {
    // Command may not be available if extension not fully loaded
  }
}

/**
 * Set a token for the extension
 * Note: This requires the extension to export TokenService for testing
 */
export async function setToken(
  providerId: string,
  token: string,
): Promise<boolean> {
  const api = getExtensionApi();
  if (!api) {
    return false;
  }

  const tokenService = api.getTokenService();
  if (tokenService) {
    await tokenService.setToken(providerId, token);
    return true;
  }

  return false;
}

/**
 * Delete a token for the extension
 */
export async function deleteToken(providerId: string): Promise<boolean> {
  const api = getExtensionApi();
  if (!api) {
    return false;
  }

  const tokenService = api.getTokenService();
  if (tokenService) {
    await tokenService.deleteToken(providerId);
    return true;
  }

  return false;
}

/**
 * Get fixture test repository path (relative to e2e test directory)
 */
export function getFixtureRepoPath(basePath: string): string {
  return path.join(basePath, "test-repo");
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wait for a condition to be true
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout = 5000,
  interval = 100,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await condition()) {
      return;
    }
    await sleep(interval);
  }
  throw new Error(`Condition not met within ${timeout}ms`);
}

/**
 * Wait for a value to be defined
 */
export async function waitForValue<T>(
  getter: () => T | undefined | Promise<T | undefined>,
  timeout = 5000,
): Promise<T> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const value = await getter();
    if (value !== undefined) {
      return value;
    }
    await sleep(100);
  }
  throw new Error(`Value not available within ${timeout}ms`);
}
