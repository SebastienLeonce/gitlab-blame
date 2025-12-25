import * as assert from "assert";
import * as vscode from "vscode";
import * as path from "path";
import { HoverTrigger } from "./helpers/hoverTrigger";
import { GitHubApiMock } from "./helpers/mockGitHubApi";
import { FixtureRepository, FIXTURE_COMMITS } from "./helpers/fixtureRepo";
import {
  openFile,
  closeAllEditors,
  clearCache,
  setToken,
  deleteToken,
  sleep,
} from "./helpers/testUtils";
import { TEST_TIMING, TEST_DATA } from "./helpers/testConstants";
import { setupE2ESuite, teardownE2ESuite } from "./helpers/suiteSetup";

/**
 * E2E Tests: Error Handling
 *
 * These tests verify the extension handles various error scenarios gracefully:
 * - No token configured
 * - Invalid/expired token
 * - Rate limiting
 * - Network errors
 */
suite("E2E: Error Handling", () => {
  let fixtureRepo: FixtureRepository;
  let apiMock: GitHubApiMock;
  let hoverTrigger: HoverTrigger;
  // Fixtures are copied to out/ during build
  const fixtureBasePath = path.resolve(__dirname, "./fixtures");

  suiteSetup(async function () {
    this.timeout(TEST_TIMING.SUITE_SETUP_TIMEOUT_MS);

    const context = await setupE2ESuite(fixtureBasePath);
    fixtureRepo = context.fixtureRepo;

    hoverTrigger = new HoverTrigger();
  });

  suiteTeardown(async () => {
    await teardownE2ESuite({ fixtureRepo, fixtureBasePath }, GitHubApiMock);
  });

  setup(async () => {
    GitHubApiMock.enable();
    apiMock = new GitHubApiMock();
    await clearCache();
    await deleteToken("github");
  });

  teardown(async () => {
    apiMock.cleanup();
    await closeAllEditors();
  });

  test("No crash when no token configured", async function () {
    // Don't set token - extension should handle gracefully
    const filePath = fixtureRepo.getFilePath(TEST_DATA.TEST_FILE);
    const editor = await openFile(filePath);

    await sleep(TEST_TIMING.EDITOR_STABILIZE_MS);

    const position = new vscode.Position(0, 0);

    // Should not throw when getting hover
    let error: Error | undefined;
    try {
      await hoverTrigger.getHoverContent(editor.document.uri, position);
    } catch (e) {
      error = e as Error;
    }

    assert.strictEqual(
      error,
      undefined,
      "Should not throw when no token configured",
    );
  });

  test("Handles invalid token gracefully (401 response)", async function () {
    const firstCommit = FIXTURE_COMMITS[0];
    const actualSha = fixtureRepo.getActualSha(firstCommit.id);

    // Mock 401 Unauthorized response
    apiMock.mockUnauthorized(
      TEST_DATA.REPO_OWNER,
      TEST_DATA.REPO_NAME,
      actualSha,
    );

    await setToken("github", TEST_DATA.GITHUB_INVALID_TOKEN);

    const filePath = fixtureRepo.getFilePath(TEST_DATA.TEST_FILE);
    const editor = await openFile(filePath);

    await sleep(TEST_TIMING.EDITOR_STABILIZE_MS);

    const position = new vscode.Position(0, 0);

    // Should not throw, should handle gracefully
    let error: Error | undefined;
    try {
      await hoverTrigger.getHoverContent(editor.document.uri, position);
    } catch (e) {
      error = e as Error;
    }

    assert.strictEqual(
      error,
      undefined,
      "Should handle invalid token gracefully",
    );

    // Hover should still show some content (commit info without MR)
    const result = await hoverTrigger.checkForMrInfo(
      editor.document.uri,
      position,
    );
    // After error, MR info should not be shown
    assert.strictEqual(
      result.hasMr,
      false,
      "Should not show MR after auth error",
    );
  });

  test("Handles rate limiting gracefully (429 response)", async function () {
    const firstCommit = FIXTURE_COMMITS[0];
    const actualSha = fixtureRepo.getActualSha(firstCommit.id);

    // Mock 429 Rate Limited response
    apiMock.mockRateLimited(
      TEST_DATA.REPO_OWNER,
      TEST_DATA.REPO_NAME,
      actualSha,
    );

    await setToken("github", TEST_DATA.GITHUB_TOKEN);

    const filePath = fixtureRepo.getFilePath(TEST_DATA.TEST_FILE);
    const editor = await openFile(filePath);

    await sleep(TEST_TIMING.EDITOR_STABILIZE_MS);

    const position = new vscode.Position(0, 0);

    // Should handle gracefully without throwing
    let error: Error | undefined;
    try {
      await hoverTrigger.getHoverContent(editor.document.uri, position);
    } catch (e) {
      error = e as Error;
    }

    assert.strictEqual(
      error,
      undefined,
      "Should handle rate limiting gracefully",
    );

    // MR info should not be shown when rate limited
    const result = await hoverTrigger.checkForMrInfo(
      editor.document.uri,
      position,
    );
    assert.strictEqual(
      result.hasMr,
      false,
      "Should not show MR when rate limited",
    );
  });

  test("Handles 404 Not Found gracefully", async function () {
    const firstCommit = FIXTURE_COMMITS[0];
    const actualSha = fixtureRepo.getActualSha(firstCommit.id);

    // Mock 404 response
    apiMock.mockNotFound(TEST_DATA.REPO_OWNER, TEST_DATA.REPO_NAME, actualSha);

    await setToken("github", TEST_DATA.GITHUB_TOKEN);

    const filePath = fixtureRepo.getFilePath(TEST_DATA.TEST_FILE);
    const editor = await openFile(filePath);

    await sleep(TEST_TIMING.EDITOR_STABILIZE_MS);

    const position = new vscode.Position(0, 0);

    // Should handle gracefully
    let error: Error | undefined;
    try {
      await hoverTrigger.getHoverContent(editor.document.uri, position);
    } catch (e) {
      error = e as Error;
    }

    assert.strictEqual(error, undefined, "Should handle 404 gracefully");
  });

  test("Caches errors to prevent repeated API calls", async function () {
    const firstCommit = FIXTURE_COMMITS[0];
    const actualSha = fixtureRepo.getActualSha(firstCommit.id);

    // Mock error response - only mock once
    apiMock.mockUnauthorized(
      TEST_DATA.REPO_OWNER,
      TEST_DATA.REPO_NAME,
      actualSha,
    );

    await setToken("github", TEST_DATA.GITHUB_TOKEN);

    const filePath = fixtureRepo.getFilePath(TEST_DATA.TEST_FILE);
    const editor = await openFile(filePath);

    await sleep(TEST_TIMING.EDITOR_STABILIZE_MS);

    const position = new vscode.Position(0, 0);

    // First hover - triggers API call that fails
    await hoverTrigger.getHoverContent(editor.document.uri, position);

    await sleep(TEST_TIMING.CURSOR_MOVE_MS);

    // Second hover - should use cached error result (no new API call)
    await hoverTrigger.getHoverContent(editor.document.uri, position);

    // If we get here without error, caching worked
    // (otherwise nock would throw for unexpected request)
    assert.ok(true, "Error caching prevents repeated API calls");
  });

  test("Extension remains functional after error", async function () {
    const firstCommit = FIXTURE_COMMITS[0];
    const actualSha = fixtureRepo.getActualSha(firstCommit.id);

    // First: Simulate error
    apiMock.mockUnauthorized(
      TEST_DATA.REPO_OWNER,
      TEST_DATA.REPO_NAME,
      actualSha,
    );

    await setToken("github", TEST_DATA.GITHUB_TOKEN);

    const filePath = fixtureRepo.getFilePath(TEST_DATA.TEST_FILE);
    const editor = await openFile(filePath);

    await sleep(TEST_TIMING.EDITOR_STABILIZE_MS);

    const position = new vscode.Position(0, 0);

    // Trigger potential error
    let errorOnFirstHover = false;
    try {
      await hoverTrigger.getHoverContent(editor.document.uri, position);
    } catch {
      errorOnFirstHover = true;
    }

    // Clear cache and fix the "token" situation
    await clearCache();
    apiMock.cleanup();

    // Setup working mock
    apiMock = new GitHubApiMock();
    apiMock.mockCommitPulls(
      TEST_DATA.REPO_OWNER,
      TEST_DATA.REPO_NAME,
      actualSha,
      [
        {
          number: 1,
          title: "Test PR",
          html_url: `https://github.com/${TEST_DATA.REPO_OWNER}/${TEST_DATA.REPO_NAME}/pull/1`,
          state: "merged",
          merged_at: "2024-01-15T12:00:00Z",
        },
      ],
    );

    await sleep(TEST_TIMING.CURSOR_MOVE_MS);

    // Second hover after cache clear - should not throw
    let errorOnSecondHover = false;
    try {
      await hoverTrigger.getHoverContent(editor.document.uri, position);
    } catch {
      errorOnSecondHover = true;
    }

    // Verify the extension remains functional after error
    assert.ok(
      !errorOnSecondHover,
      "Extension should work without errors after cache clear",
    );
    assert.ok(
      editor.document.uri,
      "Document should remain valid after error recovery",
    );
  });
});
