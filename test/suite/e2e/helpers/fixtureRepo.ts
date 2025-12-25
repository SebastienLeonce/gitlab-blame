import * as fs from "fs";
import * as path from "path";
import { exec, execSync } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * Fixture commit data
 */
export interface FixtureCommit {
  id: string;
  message: string;
  author: string;
  date: string;
  files: { name: string; content: string }[];
  prNumber?: number;
}

/**
 * Fixture commits representing the test repo's history
 */
export const FIXTURE_COMMITS: FixtureCommit[] = [
  {
    id: "commit-1",
    message: "feat: add user authentication (#1)",
    author: "Test Author",
    date: "2024-01-15T10:00:00Z",
    files: [{ name: "src/auth.ts", content: "" }],
    prNumber: 1,
  },
];

/**
 * Fixture repository manager for e2e tests
 * Uses a static git repo in test/suite/e2e/fixtures/test-repo/
 */
export class FixtureRepository {
  private repoPath: string;
  private initialized = false;

  constructor(basePath: string) {
    this.repoPath = path.join(basePath, "test-repo");
  }

  /**
   * Setup - ensure the fixture repo exists and has git initialized
   *
   * NOTE: The .git directory is committed to source control for faster CI and immediate usability.
   * If .git is missing (e.g., after manual deletion), it will be regenerated via initializeGitRepo().
   * This approach prioritizes convenience and CI speed over repository size (~140KB overhead).
   */
  async setup(): Promise<void> {
    const gitDir = path.join(this.repoPath, ".git");

    if (!fs.existsSync(gitDir)) {
      await this.initializeGitRepo();
    }

    this.initialized = true;
  }

  /**
   * Initialize git repo with known commit (for CI or first-time setup)
   * Uses async exec to avoid blocking event loop during test setup
   */
  private async initializeGitRepo(): Promise<void> {
    const options = { cwd: this.repoPath };

    await execAsync("git init", options);
    await execAsync('git config user.email "test@example.com"', options);
    await execAsync('git config user.name "Test Author"', options);
    await execAsync(
      "git remote add origin git@github.com:test-owner/test-repo.git",
      options,
    );
    await execAsync("git add .", options);

    // Set git dates for deterministic commit SHA
    const env = {
      ...process.env,
      GIT_AUTHOR_DATE: "2024-01-15T10:00:00Z",
      GIT_COMMITTER_DATE: "2024-01-15T10:00:00Z",
    };
    await execAsync('git commit -m "feat: add user authentication (#1)"', {
      ...options,
      env,
    });
  }

  /**
   * Get the actual SHA for a fixture commit
   * Uses execSync as it's called synchronously in test assertions for readability
   */
  getActualSha(_commitId: string): string {
    try {
      return execSync("git rev-parse HEAD", {
        cwd: this.repoPath,
        encoding: "utf-8",
      }).trim();
    } catch (error) {
      throw new Error(
        `Failed to get SHA for fixture repository at ${this.repoPath}. ` +
          `Ensure the fixture repo is initialized and has commits. ` +
          `Original error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Get the short SHA (7 chars) for a fixture commit
   * This matches what the extension uses for API calls
   */
  getShortSha(commitId: string): string {
    return this.getActualSha(commitId).substring(0, 7);
  }

  /**
   * Get the repository path
   */
  getPath(): string {
    return this.repoPath;
  }

  /**
   * Get a file path within the repository
   */
  getFilePath(relativePath: string): string {
    return path.join(this.repoPath, relativePath);
  }

  /**
   * Check if repository is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Cleanup - don't delete, just reset state
   */
  cleanup(): void {
    this.initialized = false;
  }
}
