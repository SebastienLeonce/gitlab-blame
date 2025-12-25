import * as path from "path";
import { runTests } from "@vscode/test-electron";

async function main() {
  try {
    // The folder containing the Extension Manifest package.json
    const extensionDevelopmentPath = path.resolve(__dirname, "../../");

    // The path to the e2e test runner script
    const extensionTestsPath = path.resolve(__dirname, "./suite/e2e/index");

    // The fixture repository folder (a git repo with known commits)
    // Fixtures are copied to out/ during build
    const fixtureWorkspace = path.resolve(
      __dirname,
      "./suite/e2e/fixtures/test-repo",
    );

    // Download VS Code, unzip it and run the e2e tests
    // Use fixture repo as workspace so VS Code Git extension detects it
    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [
        fixtureWorkspace, // Open fixture repo as workspace
        "--disable-extensions", // Disable other extensions for isolation
        "--skip-welcome",
        "--skip-release-notes",
      ],
    });
  } catch (err) {
    console.error("Failed to run e2e tests:", err);
    process.exit(1);
  }
}

void main();
