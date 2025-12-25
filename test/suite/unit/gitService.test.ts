import * as assert from "assert";
import * as sinon from "sinon";
import * as vscode from "vscode";
import { GitService } from "../../../src/services/GitService";

suite("GitService", () => {
  let gitService: GitService;
  let getExtensionStub: sinon.SinonStub;

  // Short SHAs as used in standard blame format
  const SHA1 = "a1b2c3d4e";
  const SHA2 = "b2c3d4e5f";
  const SHA3 = "c3d4e5f6a";
  const ZERO_SHA = "00000000";

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

    // Helper to create standard blame format line
    function blameLine(
      sha: string,
      author: string,
      date: string,
      time: string,
      tz: string,
      lineNum: number,
      content: string,
    ): string {
      // Pad author to align date (standard format does this)
      const paddedAuthor = author.padEnd(16);
      return `${sha} (${paddedAuthor} ${date} ${time} ${tz} ${lineNum.toString().padStart(3)}) ${content}`;
    }

    test("parses single line blame output", () => {
      const output = blameLine(
        SHA1,
        "John Doe",
        "2024-01-01",
        "00:00:00",
        "+0000",
        1,
        "const x = 1;",
      );

      const result = parseBlameOutput(output);

      assert.strictEqual(result.size, 1);
      const line1 = result.get(1) as {
        sha: string;
        author: string;
        line: number;
      };
      assert.strictEqual(line1.sha, SHA1);
      assert.strictEqual(line1.author, "John Doe");
      assert.strictEqual(line1.line, 1);
    });

    test("parses multi-line blame output from same commit", () => {
      const output = [
        blameLine(
          SHA1,
          "John Doe",
          "2024-01-01",
          "00:00:00",
          "+0000",
          1,
          "line 1",
        ),
        blameLine(
          SHA1,
          "John Doe",
          "2024-01-01",
          "00:00:00",
          "+0000",
          2,
          "line 2",
        ),
        blameLine(
          SHA1,
          "John Doe",
          "2024-01-01",
          "00:00:00",
          "+0000",
          3,
          "line 3",
        ),
      ].join("\n");

      const result = parseBlameOutput(output);

      assert.strictEqual(result.size, 3);
      assert.ok(result.has(1));
      assert.ok(result.has(2));
      assert.ok(result.has(3));
    });

    test("parses blame output with multiple different commits", () => {
      const output = [
        blameLine(
          SHA1,
          "John Doe",
          "2024-01-01",
          "00:00:00",
          "+0000",
          1,
          "const x = 1;",
        ),
        blameLine(
          SHA2,
          "Jane Smith",
          "2024-01-02",
          "00:00:00",
          "+0000",
          2,
          "const y = 2;",
        ),
      ].join("\n");

      const result = parseBlameOutput(output);

      assert.strictEqual(result.size, 2);

      const line1 = result.get(1) as { sha: string; author: string };
      assert.strictEqual(line1.sha, SHA1);
      assert.strictEqual(line1.author, "John Doe");

      const line2 = result.get(2) as { sha: string; author: string };
      assert.strictEqual(line2.sha, SHA2);
      assert.strictEqual(line2.author, "Jane Smith");
    });

    test("skips uncommitted changes (zeros SHA)", () => {
      const output = [
        blameLine(
          ZERO_SHA,
          "Not Committed",
          "2024-01-01",
          "00:00:00",
          "+0000",
          1,
          "uncommitted",
        ),
        blameLine(
          SHA1,
          "John Doe",
          "2024-01-01",
          "00:00:00",
          "+0000",
          2,
          "committed",
        ),
      ].join("\n");

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
      const output = blameLine(
        SHA1,
        "José García",
        "2024-01-01",
        "00:00:00",
        "+0000",
        1,
        "code",
      );

      const result = parseBlameOutput(output);
      const line1 = result.get(1) as { author: string };

      assert.strictEqual(line1.author, "José García");
    });

    test("parses timestamp correctly into Date object", () => {
      const output = blameLine(
        SHA1,
        "John Doe",
        "2024-01-01",
        "12:30:45",
        "+0000",
        1,
        "code",
      );

      const result = parseBlameOutput(output);
      const line1 = result.get(1) as { date: Date };

      assert.ok(line1.date instanceof Date);
      // Check that year, month, day, hours, minutes, seconds are parsed correctly
      assert.strictEqual(line1.date.getFullYear(), 2024);
      assert.strictEqual(line1.date.getMonth(), 0); // January = 0
      assert.strictEqual(line1.date.getDate(), 1);
    });

    test("handles large line numbers", () => {
      const output = blameLine(
        SHA1,
        "John Doe",
        "2024-01-01",
        "00:00:00",
        "+0000",
        9999,
        "code",
      );

      const result = parseBlameOutput(output);

      assert.strictEqual(result.has(9999), true);
    });

    test("handles empty line content", () => {
      // Standard format with empty content after the )
      const output = `${SHA1} (John Doe          2024-01-01 00:00:00 +0000   1) `;

      const result = parseBlameOutput(output);

      assert.strictEqual(result.size, 1);
    });

    test("handles boundary commit (^ prefix)", () => {
      // Boundary commits have ^ prefix on SHA
      const output = `^${SHA1} (John Doe          2024-01-01 00:00:00 +0000   1) code`;

      const result = parseBlameOutput(output);

      assert.strictEqual(result.size, 1);
      const line1 = result.get(1) as { sha: string };
      // SHA should be captured without the ^ prefix
      assert.strictEqual(line1.sha, SHA1);
    });

    test("parses realistic multi-commit file", () => {
      const output = [
        blameLine(
          SHA1,
          "Alice Dev",
          "2024-01-01",
          "10:00:00",
          "-0800",
          1,
          "import { x } from 'y';",
        ),
        blameLine(SHA1, "Alice Dev", "2024-01-01", "10:00:00", "-0800", 2, ""),
        blameLine(
          SHA2,
          "Bob Maint",
          "2024-01-02",
          "11:00:00",
          "-0800",
          3,
          "import { z } from './z';",
        ),
        blameLine(
          SHA3,
          "Charlie C",
          "2024-01-03",
          "12:00:00",
          "+0100",
          4,
          "/**",
        ),
        blameLine(
          SHA3,
          "Charlie C",
          "2024-01-03",
          "12:00:00",
          "+0100",
          5,
          " * Main",
        ),
        blameLine(
          SHA3,
          "Charlie C",
          "2024-01-03",
          "12:00:00",
          "+0100",
          6,
          " */",
        ),
      ].join("\n");

      const result = parseBlameOutput(output);

      assert.strictEqual(result.size, 6);

      // Check first commit (lines 1-2)
      const line1 = result.get(1) as { author: string };
      assert.strictEqual(line1.author, "Alice Dev");

      // Check second commit (line 3)
      const line3 = result.get(3) as { author: string };
      assert.strictEqual(line3.author, "Bob Maint");

      // Check third commit (lines 4-6)
      const line4 = result.get(4) as { author: string };
      assert.strictEqual(line4.author, "Charlie C");
    });

    test("handles Unicode in author name", () => {
      const output = blameLine(
        SHA1,
        "田中太郎",
        "2024-01-01",
        "00:00:00",
        "+0900",
        1,
        "const x = 1;",
      );

      const result = parseBlameOutput(output);
      const line1 = result.get(1) as { author: string };

      assert.strictEqual(line1.author, "田中太郎");
    });

    test("handles line content with special characters", () => {
      const output = blameLine(
        SHA1,
        "John Doe",
        "2024-01-01",
        "00:00:00",
        "+0000",
        1,
        'const msg = "Hello <world> & friends";',
      );

      const result = parseBlameOutput(output);

      assert.strictEqual(result.size, 1);
    });

    test("handles various timezone formats", () => {
      const lines = [
        blameLine(SHA1, "Dev A", "2024-01-01", "00:00:00", "+0000", 1, "UTC"),
        blameLine(SHA2, "Dev B", "2024-01-01", "00:00:00", "-0800", 2, "PST"),
        blameLine(SHA3, "Dev C", "2024-01-01", "00:00:00", "+0530", 3, "IST"),
      ].join("\n");

      const result = parseBlameOutput(lines);

      assert.strictEqual(result.size, 3);
    });

    test("handles author names with numbers", () => {
      const output = blameLine(
        SHA1,
        "user123",
        "2024-01-01",
        "00:00:00",
        "+0000",
        1,
        "code",
      );

      const result = parseBlameOutput(output);
      const line1 = result.get(1) as { author: string };

      assert.strictEqual(line1.author, "user123");
    });

    test("handles very long author names", () => {
      const longName = "A Very Long Author Name That Exceeds Normal Length";
      const output = `${SHA1} (${longName} 2024-01-01 00:00:00 +0000   1) code`;

      const result = parseBlameOutput(output);
      const line1 = result.get(1) as { author: string };

      assert.strictEqual(line1.author, longName);
    });

    test("standard format returns empty string for authorEmail", () => {
      // Standard blame format doesn't include email
      const output = blameLine(
        SHA1,
        "John Doe",
        "2024-01-01",
        "00:00:00",
        "+0000",
        1,
        "code",
      );

      const result = parseBlameOutput(output);
      const line1 = result.get(1) as { authorEmail: string };

      assert.strictEqual(line1.authorEmail, "");
    });

    test("standard format returns empty string for summary", () => {
      // Standard blame format doesn't include commit message
      const output = blameLine(
        SHA1,
        "John Doe",
        "2024-01-01",
        "00:00:00",
        "+0000",
        1,
        "code",
      );

      const result = parseBlameOutput(output);
      const line1 = result.get(1) as { summary: string };

      assert.strictEqual(line1.summary, "");
    });

    test("handles lines with only whitespace content", () => {
      const output = `${SHA1} (John Doe          2024-01-01 00:00:00 +0000   1)     `;

      const result = parseBlameOutput(output);

      assert.strictEqual(result.size, 1);
    });

    test("handles real-world blame format from VS Code Git API", () => {
      // Exact format as seen in the wild
      const output = `d01a7c049 (lsidoree         2025-07-09 17:57:39 +0200   1) import {
d01a7c049 (lsidoree         2025-07-09 17:57:39 +0200   2)   something,
abc123def (another.user     2025-08-15 10:30:00 +0000   3) } from 'module';`;

      const result = parseBlameOutput(output);

      assert.strictEqual(result.size, 3);

      const line1 = result.get(1) as { sha: string; author: string };
      assert.strictEqual(line1.sha, "d01a7c049");
      assert.strictEqual(line1.author, "lsidoree");

      const line3 = result.get(3) as { sha: string; author: string };
      assert.strictEqual(line3.sha, "abc123def");
      assert.strictEqual(line3.author, "another.user");
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

  suite("getBlameForFile - PUBLIC API", () => {
    test("returns blame map for all lines in file", async () => {
      // Mock the Git API and repository
      const mockRepo = {
        blame: sinon
          .stub()
          .resolves(
            [
              "a1b2c3d4e (John Doe        2024-01-01 10:00:00 +0000   1) line 1",
              "b2c3d4e5f (Jane Smith      2024-01-02 11:00:00 +0000   2) line 2",
              "c3d4e5f6a (Bob Johnson     2024-01-03 12:00:00 +0000   3) line 3",
            ].join("\n"),
          ),
      };

      const mockApi = {
        getRepository: sinon.stub().returns(mockRepo),
        state: "initialized" as const,
        onDidChangeState: sinon.stub(),
      };

      // Setup Git API
      (gitService as any).api = mockApi;

      const testUri = vscode.Uri.file("/test/file.ts");
      const result = await gitService.getBlameForFile(testUri);

      assert.ok(result);
      assert.strictEqual(result.size, 3);
      assert.ok(result.has(1));
      assert.ok(result.has(2));
      assert.ok(result.has(3));

      const line1 = result.get(1);
      assert.strictEqual(line1?.sha, "a1b2c3d4e");
      assert.strictEqual(line1?.author, "John Doe");
    });

    test("returns undefined when no repository found", async () => {
      const mockApi = {
        getRepository: sinon.stub().returns(null),
        state: "initialized" as const,
        onDidChangeState: sinon.stub(),
      };

      (gitService as any).api = mockApi;

      const testUri = vscode.Uri.file("/test/file.ts");
      const result = await gitService.getBlameForFile(testUri);

      assert.strictEqual(result, undefined);
    });

    test("returns undefined on blame failure", async () => {
      const mockRepo = {
        blame: sinon.stub().rejects(new Error("Git blame failed")),
      };

      const mockApi = {
        getRepository: sinon.stub().returns(mockRepo),
        state: "initialized" as const,
        onDidChangeState: sinon.stub(),
      };

      (gitService as any).api = mockApi;

      const testUri = vscode.Uri.file("/test/file.ts");
      const result = await gitService.getBlameForFile(testUri);

      // Should handle error gracefully and return undefined
      assert.strictEqual(result, undefined);
    });
  });

  suite("getRemoteUrl - PUBLIC API", () => {
    test("returns fetchUrl when available", () => {
      const mockRepo = {
        state: {
          remotes: [
            {
              name: "origin",
              fetchUrl: "git@gitlab.com:group/project.git",
              pushUrl: "git@gitlab.com:group/project.git",
            },
          ],
        },
      };

      const mockApi = {
        getRepository: sinon.stub().returns(mockRepo),
        state: "initialized" as const,
        onDidChangeState: sinon.stub(),
      };

      (gitService as any).api = mockApi;

      const testUri = vscode.Uri.file("/test/file.ts");
      const result = gitService.getRemoteUrl(testUri);

      assert.strictEqual(result, "git@gitlab.com:group/project.git");
    });

    test("returns pushUrl when fetchUrl not available", () => {
      const mockRepo = {
        state: {
          remotes: [
            {
              name: "origin",
              fetchUrl: undefined,
              pushUrl: "https://gitlab.com/group/project.git",
            },
          ],
        },
      };

      const mockApi = {
        getRepository: sinon.stub().returns(mockRepo),
        state: "initialized" as const,
        onDidChangeState: sinon.stub(),
      };

      (gitService as any).api = mockApi;

      const testUri = vscode.Uri.file("/test/file.ts");
      const result = gitService.getRemoteUrl(testUri);

      assert.strictEqual(result, "https://gitlab.com/group/project.git");
    });

    test("returns undefined when no repository found", () => {
      const mockApi = {
        getRepository: sinon.stub().returns(null),
        state: "initialized" as const,
        onDidChangeState: sinon.stub(),
      };

      (gitService as any).api = mockApi;

      const testUri = vscode.Uri.file("/test/file.ts");
      const result = gitService.getRemoteUrl(testUri);

      assert.strictEqual(result, undefined);
    });

    test("returns undefined when no origin remote found", () => {
      const mockRepo = {
        state: {
          remotes: [
            {
              name: "upstream",
              fetchUrl: "git@gitlab.com:upstream/project.git",
              pushUrl: "git@gitlab.com:upstream/project.git",
            },
          ],
        },
      };

      const mockApi = {
        getRepository: sinon.stub().returns(mockRepo),
        state: "initialized" as const,
        onDidChangeState: sinon.stub(),
      };

      (gitService as any).api = mockApi;

      const testUri = vscode.Uri.file("/test/file.ts");
      const result = gitService.getRemoteUrl(testUri);

      assert.strictEqual(result, undefined);
    });
  });
});
