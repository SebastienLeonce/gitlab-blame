import * as vscode from "vscode";
import { FixtureRepository } from "./fixtureRepo";
import {
  waitForExtensionActivation,
  waitForGitRepository,
  closeAllEditors,
} from "./testUtils";
import { TEST_DATA } from "./testConstants";

export interface E2ETestContext {
  fixtureRepo: FixtureRepository;
  fixtureBasePath: string;
}

/**
 * Standard E2E test suite setup
 * Activates extension, sets up fixture repository, and waits for Git detection
 *
 * @param fixtureBasePath - Path to fixtures directory (typically `__dirname + "/fixtures"`)
 * @param displayMode - Display mode to set (default: "both" for full coverage)
 * @returns Context with fixture repository instance
 */
export async function setupE2ESuite(
  fixtureBasePath: string,
  displayMode: "hover" | "inline" | "both" = "both",
): Promise<E2ETestContext> {
  const config = vscode.workspace.getConfiguration();
  await config.update(
    "gitlabBlame.displayMode",
    displayMode,
    vscode.ConfigurationTarget.Global,
  );

  const fixtureRepo = new FixtureRepository(fixtureBasePath);
  await fixtureRepo.setup();

  await waitForExtensionActivation();

  const fixtureUri = vscode.Uri.file(
    fixtureRepo.getFilePath(TEST_DATA.TEST_FILE),
  );
  await waitForGitRepository(fixtureUri);

  return { fixtureRepo, fixtureBasePath };
}

/**
 * Standard E2E test suite teardown
 */
export async function teardownE2ESuite(
  context: E2ETestContext,
  apiMockClass?: { disable: () => void },
): Promise<void> {
  await closeAllEditors();
  context.fixtureRepo.cleanup();
  if (apiMockClass) {
    apiMockClass.disable();
  }
}
