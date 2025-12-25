/**
 * Test timing constants
 *
 * These values are tuned for E2E test reliability across local and CI environments.
 * Increase if tests become flaky in CI; decrease if tests are unnecessarily slow.
 */
export const TEST_TIMING = {
  EXTENSION_ACTIVATION_MS: 1000,
  BLAME_COMPUTATION_MS: 3000,
  GIT_REPO_DETECTION_MS: 500,
  EDITOR_STABILIZE_MS: 500,
  DECORATION_UPDATE_MS: 1000,
  DEBOUNCE_QUICK_MS: 600,
  CURSOR_MOVE_MS: 200,
  CACHE_CLEAR_MS: 100,
  RAPID_ACTION_MS: 20,
  SAME_LINE_CURSOR_MS: 300,
  SUITE_SETUP_TIMEOUT_MS: 60000,
} as const;

/**
 * Test data constants
 */
export const TEST_DATA = {
  // Uses 'test_' prefix to avoid triggering secret scanners in CI/CD
  GITHUB_TOKEN: "test_ghp_mock_token_12345",
  GITHUB_INVALID_TOKEN: "test_ghp_invalid_token",
  REPO_OWNER: "test-owner",
  REPO_NAME: "test-repo",
  TEST_FILE: "src/auth.ts",
} as const;
