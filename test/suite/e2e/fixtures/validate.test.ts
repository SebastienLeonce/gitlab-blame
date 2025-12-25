import * as assert from "assert";
import * as fs from "fs";
import { execSync } from "child_process";
import * as path from "path";
import { FIXTURE_COMMITS } from "../helpers/fixtureRepo";

/**
 * Fixture Validation Tests
 *
 * These tests ensure that the fixture repository state matches the expected
 * configuration defined in FIXTURE_COMMITS. Run these tests after modifying
 * fixtures to catch fixture/code drift.
 *
 * Usage: npm run fixture:verify
 */
suite("Fixture Validation", () => {
  const fixtureBasePath = path.resolve(__dirname, "./");
  const testRepoPath = path.join(fixtureBasePath, "test-repo");

  test("test-repo directory exists", () => {
    assert.ok(
      fs.existsSync(testRepoPath),
      `Fixture directory must exist at ${testRepoPath}`,
    );
  });

  test("test-repo has .git directory", () => {
    const gitDir = path.join(testRepoPath, ".git");
    const exists = fs.existsSync(gitDir);

    if (!exists) {
      assert.fail(
        "Fixture .git directory is missing. The fixture .git should be committed to version control. " +
          "Check if git repository is corrupted or run 'npm run fixture:rebuild' to regenerate it.",
      );
    }

    assert.ok(exists, "Fixture must have .git directory");
  });

  test("test-repo has expected commit count", () => {
    const count = execSync("git rev-list --count HEAD", {
      cwd: testRepoPath,
      encoding: "utf-8",
    }).trim();

    const expectedCount = FIXTURE_COMMITS.length;

    assert.strictEqual(
      count,
      String(expectedCount),
      `Expected ${expectedCount} commit(s), found ${count}. Update FIXTURE_COMMITS or regenerate fixture.`,
    );
  });

  test("test-repo has expected commit messages", () => {
    const messages = execSync("git log --pretty=%s", {
      cwd: testRepoPath,
      encoding: "utf-8",
    })
      .trim()
      .split("\n")
      .reverse(); // Oldest first (matches FIXTURE_COMMITS order)

    FIXTURE_COMMITS.forEach((commit, i) => {
      assert.strictEqual(
        messages[i],
        commit.message,
        `Commit ${i + 1} message mismatch.\nExpected: "${commit.message}"\nActual: "${messages[i]}"\nUpdate FIXTURE_COMMITS or regenerate fixture.`,
      );
    });
  });

  test("test-repo has expected files", () => {
    FIXTURE_COMMITS.forEach((commit) => {
      commit.files.forEach((file) => {
        const filePath = path.join(testRepoPath, file.name);
        assert.ok(
          fs.existsSync(filePath),
          `Expected file ${file.name} to exist (from commit: "${commit.message}")`,
        );
      });
    });
  });

  test("test-repo has expected remote URL", () => {
    const remote = execSync("git remote get-url origin", {
      cwd: testRepoPath,
      encoding: "utf-8",
    }).trim();

    const expectedRemote = "git@github.com:test-owner/test-repo.git";

    assert.strictEqual(
      remote,
      expectedRemote,
      `Remote URL mismatch.\nExpected: "${expectedRemote}"\nActual: "${remote}"\nUpdate fixture or FIXTURE_COMMITS.`,
    );
  });

  test("test-repo has expected author name", () => {
    const authors = execSync("git log --pretty=%an", {
      cwd: testRepoPath,
      encoding: "utf-8",
    })
      .trim()
      .split("\n");

    const uniqueAuthors = [...new Set(authors)];

    FIXTURE_COMMITS.forEach((commit, i) => {
      assert.strictEqual(
        authors[FIXTURE_COMMITS.length - 1 - i], // Reverse order (git log shows newest first)
        commit.author,
        `Commit ${i + 1} author mismatch.\nExpected: "${commit.author}"\nActual: "${authors[FIXTURE_COMMITS.length - 1 - i]}"`,
      );
    });

    // Additional check: All commits should have same author (for simplicity)
    assert.strictEqual(
      uniqueAuthors.length,
      1,
      `Expected single author across all commits, found ${uniqueAuthors.length}: ${uniqueAuthors.join(", ")}`,
    );
  });

  test("test-repo has expected author email", () => {
    const emails = execSync("git log --pretty=%ae", {
      cwd: testRepoPath,
      encoding: "utf-8",
    })
      .trim()
      .split("\n");

    const uniqueEmails = [...new Set(emails)];
    const expectedEmail = "test@example.com";

    emails.forEach((email, i) => {
      assert.strictEqual(
        email,
        expectedEmail,
        `Commit ${i + 1} email mismatch.\nExpected: "${expectedEmail}"\nActual: "${email}"`,
      );
    });

    // Additional check: All commits should have same email
    assert.strictEqual(
      uniqueEmails.length,
      1,
      `Expected single email across all commits, found ${uniqueEmails.length}: ${uniqueEmails.join(", ")}`,
    );
  });

  test("test-repo commits use deterministic dates", () => {
    const dates = execSync("git log --pretty=%aI", {
      cwd: testRepoPath,
      encoding: "utf-8",
    })
      .trim()
      .split("\n")
      .reverse(); // Oldest first

    FIXTURE_COMMITS.forEach((commit, i) => {
      assert.strictEqual(
        dates[i],
        commit.date,
        `Commit ${i + 1} date mismatch.\nExpected: "${commit.date}"\nActual: "${dates[i]}"\nEnsure deterministic dates (GIT_AUTHOR_DATE/GIT_COMMITTER_DATE) were used.`,
      );
    });
  });

  test("FIXTURE_COMMITS matches fixture state (summary)", () => {
    const commitCount = parseInt(
      execSync("git rev-list --count HEAD", {
        cwd: testRepoPath,
        encoding: "utf-8",
      }).trim(),
      10,
    );

    const messages = execSync("git log --pretty=%s", {
      cwd: testRepoPath,
      encoding: "utf-8",
    })
      .trim()
      .split("\n")
      .reverse();

    const allFilesExist = FIXTURE_COMMITS.every((commit) =>
      commit.files.every((file) =>
        fs.existsSync(path.join(testRepoPath, file.name)),
      ),
    );

    const allMessagesMatch = FIXTURE_COMMITS.every(
      (commit, i) => commit.message === messages[i],
    );

    assert.strictEqual(
      commitCount,
      FIXTURE_COMMITS.length,
      "Commit count mismatch",
    );
    assert.ok(allFilesExist, "Not all expected files exist");
    assert.ok(allMessagesMatch, "Not all commit messages match");
  });
});
