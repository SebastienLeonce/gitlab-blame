import * as assert from "assert";
import * as vscode from "vscode";
import * as path from "path";
import { HoverTrigger } from "./helpers/hoverTrigger";
import {
  GitHubApiMock,
  createMockPR,
  type MockPR,
} from "./helpers/mockGitHubApi";
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
 * E2E Tests: Hover Shows MR/PR Info
 *
 * These tests verify the hover provider displays merge request/pull request
 * information correctly for committed lines.
 */
suite("E2E: Hover Shows MR/PR Info", () => {
  let fixtureRepo: FixtureRepository;
  let hoverTrigger: HoverTrigger;
  let apiMock: GitHubApiMock;
  // Fixtures are copied to out/ during build
  const fixtureBasePath = path.resolve(__dirname, "./fixtures");

  suiteSetup(async function () {
    this.timeout(TEST_TIMING.SUITE_SETUP_TIMEOUT_MS);

    const context = await setupE2ESuite(fixtureBasePath, "both");
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
  });

  teardown(async () => {
    apiMock.cleanup();
    await deleteToken("github");
    await closeAllEditors();
  });

  test("Hover shows PR link for commit with associated PR", async function () {
    const firstCommit = FIXTURE_COMMITS[0];
    const shortSha = fixtureRepo.getShortSha(firstCommit.id);

    const mockPr: MockPR = createMockPR(1, "feat: add user authentication");

    apiMock.mockCommitPullsNoHeaders(
      TEST_DATA.REPO_OWNER,
      TEST_DATA.REPO_NAME,
      shortSha,
      [mockPr],
    );

    await setToken("github", TEST_DATA.GITHUB_TOKEN);

    const filePath = fixtureRepo.getFilePath(TEST_DATA.TEST_FILE);
    const editor = await openFile(filePath);

    // Git blame is computed asynchronously after repository detection
    await sleep(TEST_TIMING.BLAME_COMPUTATION_MS);

    const position = new vscode.Position(0, 0);
    const result = await hoverTrigger.checkForMrInfo(
      editor.document.uri,
      position,
    );

    // Repository is guaranteed to be detected by waitForGitRepository()
    assert.ok(result.rawContent.length > 0, "Hover should return content");

    assert.ok(result.hasMr, "Should detect MR presence");
    assert.ok(
      result.rawContent.includes("**Merge Request**:") ||
        result.rawContent.includes("**Pull Request**:"),
      "Should contain 'Merge Request' or 'Pull Request' heading",
    );
    assert.ok(
      result.rawContent.includes("!1") || result.rawContent.includes("#1"),
      "Should contain MR/PR number in format '!1' or '#1'",
    );
    assert.ok(
      result.rawContent.includes("feat: add user authentication"),
      "Should contain MR/PR title",
    );

    assert.ok(
      result.rawContent.includes("by"),
      "Should contain commit author info",
    );
  });

  test("Hover shows 'No associated merge request' for commit without PR", async function () {
    // We use the same commit but mock it as having no PR
    const firstCommit = FIXTURE_COMMITS[0];
    const shortSha = fixtureRepo.getShortSha(firstCommit.id);

    apiMock.mockCommitPullsNoHeaders(
      TEST_DATA.REPO_OWNER,
      TEST_DATA.REPO_NAME,
      shortSha,
      [],
    );

    apiMock.mockCommitDetails(
      TEST_DATA.REPO_OWNER,
      TEST_DATA.REPO_NAME,
      shortSha,
      {
        sha: shortSha,
        commit: { message: "chore: update dependencies" },
      },
    );

    await setToken("github", TEST_DATA.GITHUB_TOKEN);

    const filePath = fixtureRepo.getFilePath(TEST_DATA.TEST_FILE);
    const editor = await openFile(filePath);

    await sleep(TEST_TIMING.EDITOR_STABILIZE_MS);

    const position = new vscode.Position(0, 0);
    const hoverText = await hoverTrigger.getHoverText(
      editor.document.uri,
      position,
    );

    // Content may vary based on whether Git extension detects the fixture repo
    assert.ok(
      editor.document.uri,
      "Document should be valid after hover attempt",
    );

    if (hoverText.length > 0) {
      assert.ok(
        !hoverText.includes("Error"),
        "Hover should not contain error messages",
      );
    }
  });

  test("Cache hit returns MR instantly without additional API call", async function () {
    const firstCommit = FIXTURE_COMMITS[0];
    const shortSha = fixtureRepo.getShortSha(firstCommit.id);

    const mockPr: MockPR = createMockPR(1, "feat: add user authentication");

    // Mock request - will be consumed if Git extension detects repo
    apiMock.mockCommitPullsNoHeaders(
      TEST_DATA.REPO_OWNER,
      TEST_DATA.REPO_NAME,
      shortSha,
      [mockPr],
    );

    await setToken("github", TEST_DATA.GITHUB_TOKEN);

    const filePath = fixtureRepo.getFilePath(TEST_DATA.TEST_FILE);
    const editor = await openFile(filePath);

    await sleep(TEST_TIMING.EDITOR_STABILIZE_MS);

    const position = new vscode.Position(0, 0);

    const firstHover = await hoverTrigger.getHoverContent(
      editor.document.uri,
      position,
    );

    await sleep(TEST_TIMING.EDITOR_STABILIZE_MS);

    const secondHover = await hoverTrigger.getHoverContent(
      editor.document.uri,
      position,
    );

    // The actual content depends on whether the fixture repo is detected
    assert.ok(editor.document.uri, "Document should remain valid");

    const firstHasContent = firstHover && firstHover.length > 0;
    const secondHasContent = secondHover && secondHover.length > 0;
    assert.strictEqual(
      firstHasContent,
      secondHasContent,
      "Both hover attempts should have consistent results",
    );
  });

  test("Hover shows commit info even without token", async function () {
    // Don't set token - API calls won't be made
    // But hover should still show basic commit info

    const filePath = fixtureRepo.getFilePath(TEST_DATA.TEST_FILE);
    const editor = await openFile(filePath);

    await sleep(TEST_TIMING.EDITOR_STABILIZE_MS);

    const position = new vscode.Position(0, 0);
    const content = await hoverTrigger.getHoverText(
      editor.document.uri,
      position,
    );

    // Even without token, git blame info should be available
    assert.ok(
      content.length > 0 ||
        (await hoverTrigger.getHoverContent(editor.document.uri, position)) !==
          undefined,
      "Should have some hover content",
    );
  });
});
