import * as assert from "assert";
import * as sinon from "sinon";
import * as vscode from "vscode";
import { GitService } from "../../src/services/GitService";

suite("GitService", () => {
  let gitService: GitService;
  let getExtensionStub: sinon.SinonStub;

  // Valid 40-character hex SHAs for testing
  const SHA1 = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";
  const SHA2 = "b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3";
  const SHA3 = "c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4";
  const ZERO_SHA = "0000000000000000000000000000000000000000";

  setup(() => {
    // Stub vscode.extensions.getExtension to avoid actual Git extension dependency
    getExtensionStub = sinon.stub(vscode.extensions, "getExtension");
    gitService = new GitService();
  });

  teardown(() => {
    getExtensionStub.restore();
  });

  suite("parseBlameOutput", () => {
    // Access private method for testing
    function parseBlameOutput(output: string): Map<number, unknown> {
      return (
        gitService as unknown as {
          parseBlameOutput: (s: string) => Map<number, unknown>;
        }
      ).parseBlameOutput(output);
    }

    test("parses single line blame output", () => {
      const output = `${SHA1} 1 1 1
author John Doe
author-mail <john@example.com>
author-time 1704067200
author-tz +0000
committer John Doe
committer-mail <john@example.com>
committer-time 1704067200
committer-tz +0000
summary Initial commit
filename src/index.ts
\tconst x = 1;
`;

      const result = parseBlameOutput(output);

      assert.strictEqual(result.size, 1);
      const line1 = result.get(1) as {
        sha: string;
        author: string;
        authorEmail: string;
        summary: string;
        line: number;
      };
      assert.strictEqual(line1.sha, SHA1);
      assert.strictEqual(line1.author, "John Doe");
      assert.strictEqual(line1.authorEmail, "john@example.com");
      assert.strictEqual(line1.summary, "Initial commit");
      assert.strictEqual(line1.line, 1);
    });

    test("parses multi-line blame output from same commit", () => {
      const output = `${SHA1} 1 1 3
author John Doe
author-mail <john@example.com>
author-time 1704067200
author-tz +0000
committer John Doe
committer-mail <john@example.com>
committer-time 1704067200
committer-tz +0000
summary Initial commit
filename src/index.ts
\tline 1
${SHA1} 2 2
author John Doe
author-mail <john@example.com>
author-time 1704067200
author-tz +0000
committer John Doe
committer-mail <john@example.com>
committer-time 1704067200
committer-tz +0000
summary Initial commit
filename src/index.ts
\tline 2
${SHA1} 3 3
author John Doe
author-mail <john@example.com>
author-time 1704067200
author-tz +0000
committer John Doe
committer-mail <john@example.com>
committer-time 1704067200
committer-tz +0000
summary Initial commit
filename src/index.ts
\tline 3
`;

      const result = parseBlameOutput(output);

      assert.strictEqual(result.size, 3);
      assert.ok(result.has(1));
      assert.ok(result.has(2));
      assert.ok(result.has(3));
    });

    test("parses blame output with multiple different commits", () => {
      const output = `${SHA1} 1 1 1
author John Doe
author-mail <john@example.com>
author-time 1704067200
author-tz +0000
committer John Doe
committer-mail <john@example.com>
committer-time 1704067200
committer-tz +0000
summary First commit
filename src/index.ts
\tconst x = 1;
${SHA2} 2 2 1
author Jane Smith
author-mail <jane@example.com>
author-time 1704153600
author-tz +0000
committer Jane Smith
committer-mail <jane@example.com>
committer-time 1704153600
committer-tz +0000
summary Second commit
filename src/index.ts
\tconst y = 2;
`;

      const result = parseBlameOutput(output);

      assert.strictEqual(result.size, 2);

      const line1 = result.get(1) as {
        sha: string;
        author: string;
        summary: string;
      };
      assert.strictEqual(line1.sha, SHA1);
      assert.strictEqual(line1.author, "John Doe");
      assert.strictEqual(line1.summary, "First commit");

      const line2 = result.get(2) as {
        sha: string;
        author: string;
        summary: string;
      };
      assert.strictEqual(line2.sha, SHA2);
      assert.strictEqual(line2.author, "Jane Smith");
      assert.strictEqual(line2.summary, "Second commit");
    });

    test("skips uncommitted changes (40 zeros SHA)", () => {
      const output = `${ZERO_SHA} 1 1 1
author Not Committed Yet
author-mail <not.committed.yet>
author-time 1704067200
author-tz +0000
committer Not Committed Yet
committer-mail <not.committed.yet>
committer-time 1704067200
committer-tz +0000
summary Uncommitted changes
filename src/index.ts
\tuncommitted line
${SHA1} 2 2 1
author John Doe
author-mail <john@example.com>
author-time 1704067200
author-tz +0000
committer John Doe
committer-mail <john@example.com>
committer-time 1704067200
committer-tz +0000
summary Real commit
filename src/index.ts
\tcommitted line
`;

      const result = parseBlameOutput(output);

      assert.strictEqual(result.size, 1);
      assert.strictEqual(
        result.has(1),
        false,
        "Uncommitted line should not be in result",
      );
      assert.strictEqual(
        result.has(2),
        true,
        "Committed line should be in result",
      );
    });

    test("handles empty output", () => {
      const result = parseBlameOutput("");

      assert.strictEqual(result.size, 0);
    });

    test("handles output with only newlines", () => {
      const result = parseBlameOutput("\n\n\n");

      assert.strictEqual(result.size, 0);
    });

    test("parses author name with special characters", () => {
      const output = `${SHA1} 1 1 1
author José García-López
author-mail <jose@example.com>
author-time 1704067200
author-tz +0000
committer José García-López
committer-mail <jose@example.com>
committer-time 1704067200
committer-tz +0000
summary Commit with special chars
filename src/index.ts
\tcode
`;

      const result = parseBlameOutput(output);
      const line1 = result.get(1) as { author: string };

      assert.strictEqual(line1.author, "José García-López");
    });

    test("parses author email correctly (removes angle brackets)", () => {
      const output = `${SHA1} 1 1 1
author John Doe
author-mail <john.doe@company.example.com>
author-time 1704067200
author-tz +0000
committer John Doe
committer-mail <john.doe@company.example.com>
committer-time 1704067200
committer-tz +0000
summary Test
filename src/index.ts
\tcode
`;

      const result = parseBlameOutput(output);
      const line1 = result.get(1) as { authorEmail: string };

      assert.strictEqual(line1.authorEmail, "john.doe@company.example.com");
    });

    test("parses timestamp correctly into Date object", () => {
      // 1704067200 = 2024-01-01 00:00:00 UTC
      const output = `${SHA1} 1 1 1
author John Doe
author-mail <john@example.com>
author-time 1704067200
author-tz +0000
committer John Doe
committer-mail <john@example.com>
committer-time 1704067200
committer-tz +0000
summary Test
filename src/index.ts
\tcode
`;

      const result = parseBlameOutput(output);
      const line1 = result.get(1) as { date: Date };

      assert.ok(line1.date instanceof Date);
      assert.strictEqual(line1.date.getTime(), 1704067200 * 1000);
    });

    test("handles commit summary with special characters", () => {
      const output = `${SHA1} 1 1 1
author John Doe
author-mail <john@example.com>
author-time 1704067200
author-tz +0000
committer John Doe
committer-mail <john@example.com>
committer-time 1704067200
committer-tz +0000
summary fix: resolve bug #123 - "quotes" & <brackets>
filename src/index.ts
\tcode
`;

      const result = parseBlameOutput(output);
      const line1 = result.get(1) as { summary: string };

      assert.strictEqual(
        line1.summary,
        'fix: resolve bug #123 - "quotes" & <brackets>',
      );
    });

    test("handles missing author-mail gracefully", () => {
      const output = `${SHA1} 1 1 1
author John Doe
author-time 1704067200
author-tz +0000
committer John Doe
committer-time 1704067200
committer-tz +0000
summary Test
filename src/index.ts
\tcode
`;

      const result = parseBlameOutput(output);
      const line1 = result.get(1) as { authorEmail: string };

      // Should use default empty string
      assert.strictEqual(line1.authorEmail, "");
    });

    test("handles missing summary gracefully", () => {
      const output = `${SHA1} 1 1 1
author John Doe
author-mail <john@example.com>
author-time 1704067200
author-tz +0000
committer John Doe
committer-mail <john@example.com>
committer-time 1704067200
committer-tz +0000
filename src/index.ts
\tcode
`;

      const result = parseBlameOutput(output);
      const line1 = result.get(1) as { summary: string };

      // Should use default empty string
      assert.strictEqual(line1.summary, "");
    });

    test("handles missing author gracefully", () => {
      const output = `${SHA1} 1 1 1
author-mail <john@example.com>
author-time 1704067200
author-tz +0000
committer John Doe
committer-mail <john@example.com>
committer-time 1704067200
committer-tz +0000
summary Test
filename src/index.ts
\tcode
`;

      const result = parseBlameOutput(output);
      const line1 = result.get(1) as { author: string };

      // Should use default "Unknown"
      assert.strictEqual(line1.author, "Unknown");
    });

    test("correctly maps line numbers (uses final-line from blame)", () => {
      // In porcelain format: <sha> <orig-line> <final-line> [count]
      // The parser uses final-line (2nd number) as the map key
      const output = `${SHA1} 10 5 1
author John Doe
author-mail <john@example.com>
author-time 1704067200
author-tz +0000
committer John Doe
committer-mail <john@example.com>
committer-time 1704067200
committer-tz +0000
summary Test
filename src/index.ts
\tcode at line 5
`;

      const result = parseBlameOutput(output);

      // The final line number (5) should be used as the key
      assert.strictEqual(result.has(5), true);
      assert.strictEqual(result.has(10), false);

      const line5 = result.get(5) as { line: number };
      assert.strictEqual(line5.line, 5);
    });

    test("handles large line numbers", () => {
      const output = `${SHA1} 1 9999 1
author John Doe
author-mail <john@example.com>
author-time 1704067200
author-tz +0000
committer John Doe
committer-mail <john@example.com>
committer-time 1704067200
committer-tz +0000
summary Test
filename src/index.ts
\tcode
`;

      const result = parseBlameOutput(output);

      assert.strictEqual(result.has(9999), true);
    });

    test("handles tab in line content", () => {
      const output = `${SHA1} 1 1 1
author John Doe
author-mail <john@example.com>
author-time 1704067200
author-tz +0000
committer John Doe
committer-mail <john@example.com>
committer-time 1704067200
committer-tz +0000
summary Test
filename src/index.ts
\t\t\tindented code with tabs
`;

      const result = parseBlameOutput(output);

      // Should parse successfully - line content starting with tab indicates end of block
      assert.strictEqual(result.size, 1);
    });

    test("handles empty line content", () => {
      const output = `${SHA1} 1 1 1
author John Doe
author-mail <john@example.com>
author-time 1704067200
author-tz +0000
committer John Doe
committer-mail <john@example.com>
committer-time 1704067200
committer-tz +0000
summary Test
filename src/index.ts
\t
`;

      const result = parseBlameOutput(output);

      // Empty line (just tab) should still be parsed
      assert.strictEqual(result.size, 1);
    });

    test("handles previous field in blame output", () => {
      const output = `${SHA1} 1 1 1
author John Doe
author-mail <john@example.com>
author-time 1704067200
author-tz +0000
committer John Doe
committer-mail <john@example.com>
committer-time 1704067200
committer-tz +0000
summary Test
previous ${SHA2} src/old-index.ts
filename src/index.ts
\tcode
`;

      const result = parseBlameOutput(output);

      // Previous field should be ignored but not break parsing
      assert.strictEqual(result.size, 1);
      const line1 = result.get(1) as { sha: string };
      assert.strictEqual(line1.sha, SHA1);
    });

    test("handles boundary field in blame output", () => {
      const output = `${SHA1} 1 1 1
author John Doe
author-mail <john@example.com>
author-time 1704067200
author-tz +0000
committer John Doe
committer-mail <john@example.com>
committer-time 1704067200
committer-tz +0000
summary Test
boundary
filename src/index.ts
\tcode
`;

      const result = parseBlameOutput(output);

      // Boundary field should be ignored but not break parsing
      assert.strictEqual(result.size, 1);
    });

    test("parses realistic multi-commit file", () => {
      const output = `${SHA1} 1 1 2
author Alice Developer
author-mail <alice@company.com>
author-time 1700000000
author-tz -0800
committer Alice Developer
committer-mail <alice@company.com>
committer-time 1700000000
committer-tz -0800
summary feat: add initial implementation
filename src/feature.ts
\timport { something } from 'somewhere';
${SHA1} 2 2
author Alice Developer
author-mail <alice@company.com>
author-time 1700000000
author-tz -0800
committer Alice Developer
committer-mail <alice@company.com>
committer-time 1700000000
committer-tz -0800
summary feat: add initial implementation
filename src/feature.ts
\t
${SHA2} 3 3 1
author Bob Maintainer
author-mail <bob@company.com>
author-time 1700100000
author-tz -0800
committer Bob Maintainer
committer-mail <bob@company.com>
committer-time 1700100000
committer-tz -0800
summary fix: correct import path
filename src/feature.ts
\timport { something } from './somewhere';
${SHA3} 4 4 3
author Charlie Contributor
author-mail <charlie@external.com>
author-time 1700200000
author-tz +0100
committer Alice Developer
committer-mail <alice@company.com>
committer-time 1700200100
committer-tz -0800
summary docs: add JSDoc comments
filename src/feature.ts
\t/**
${SHA3} 5 5
author Charlie Contributor
author-mail <charlie@external.com>
author-time 1700200000
author-tz +0100
committer Alice Developer
committer-mail <alice@company.com>
committer-time 1700200100
committer-tz -0800
summary docs: add JSDoc comments
filename src/feature.ts
\t * Main function
${SHA3} 6 6
author Charlie Contributor
author-mail <charlie@external.com>
author-time 1700200000
author-tz +0100
committer Alice Developer
committer-mail <alice@company.com>
committer-time 1700200100
committer-tz -0800
summary docs: add JSDoc comments
filename src/feature.ts
\t */
`;

      const result = parseBlameOutput(output);

      assert.strictEqual(result.size, 6);

      // Check first commit (lines 1-2)
      const line1 = result.get(1) as { author: string; summary: string };
      assert.strictEqual(line1.author, "Alice Developer");
      assert.strictEqual(line1.summary, "feat: add initial implementation");

      // Check second commit (line 3)
      const line3 = result.get(3) as { author: string; summary: string };
      assert.strictEqual(line3.author, "Bob Maintainer");
      assert.strictEqual(line3.summary, "fix: correct import path");

      // Check third commit (lines 4-6)
      const line4 = result.get(4) as { author: string; summary: string };
      assert.strictEqual(line4.author, "Charlie Contributor");
      assert.strictEqual(line4.summary, "docs: add JSDoc comments");
    });

    test("handles Unicode in all fields", () => {
      const output = `${SHA1} 1 1 1
author 田中太郎
author-mail <tanaka@example.jp>
author-time 1704067200
author-tz +0900
committer 田中太郎
committer-mail <tanaka@example.jp>
committer-time 1704067200
committer-tz +0900
summary 新機能を追加
filename src/index.ts
\tconst x = 1;
`;

      const result = parseBlameOutput(output);
      const line1 = result.get(1) as { author: string; summary: string };

      assert.strictEqual(line1.author, "田中太郎");
      assert.strictEqual(line1.summary, "新機能を追加");
    });
  });

  suite("isInitialized", () => {
    test("returns false before initialization", () => {
      assert.strictEqual(gitService.isInitialized(), false);
    });
  });

  suite("getInitializationError", () => {
    test("returns undefined before initialization attempt", () => {
      assert.strictEqual(gitService.getInitializationError(), undefined);
    });
  });

  suite("getAPI", () => {
    test("returns undefined before initialization", () => {
      assert.strictEqual(gitService.getAPI(), undefined);
    });
  });
});
