import * as path from "path";
import Mocha from "mocha";
import { glob } from "glob";

export async function run(): Promise<void> {
  // Create the mocha test with longer timeout for e2e tests
  const mocha = new Mocha({
    ui: "tdd",
    color: true,
    timeout: 30000, // E2E tests need longer timeout
    slow: 5000, // Mark tests taking > 5s as slow
  });

  const testsRoot = path.resolve(__dirname, ".");

  // Find all e2e test files (*.e2e.js pattern)
  const files = await glob("**/*.e2e.js", { cwd: testsRoot });

  // Add files to the test suite
  files.forEach((f) => mocha.addFile(path.resolve(testsRoot, f)));

  // Run the mocha test
  return new Promise((resolve, reject) => {
    mocha.run((failures) => {
      if (failures > 0) {
        reject(new Error(`${failures} e2e tests failed.`));
      } else {
        resolve();
      }
    });
  });
}
