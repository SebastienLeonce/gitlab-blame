import * as assert from "assert";
import { HoverContentService } from "@services/HoverContentService";
import { VCS_PROVIDERS } from "@constants";
import { MergeRequest } from "@types";

suite("HoverContentService", () => {
  let hoverContentService: HoverContentService;

  setup(() => {
    hoverContentService = new HoverContentService();
  });

  suite("getMrPrefix", () => {
    test("returns ! for GitLab", () => {
      assert.strictEqual(
        hoverContentService.getMrPrefix(VCS_PROVIDERS.GITLAB),
        "!",
      );
    });

    test("returns # for GitHub", () => {
      assert.strictEqual(
        hoverContentService.getMrPrefix(VCS_PROVIDERS.GITHUB),
        "#",
      );
    });
  });

  suite("escapeMarkdown", () => {
    test("escapes backslashes", () => {
      assert.strictEqual(
        hoverContentService.escapeMarkdown("path\\to\\file"),
        "path\\\\to\\\\file",
      );
    });

    test("escapes backticks", () => {
      assert.strictEqual(
        hoverContentService.escapeMarkdown("use `code` here"),
        "use \\`code\\` here",
      );
    });

    test("escapes asterisks", () => {
      assert.strictEqual(
        hoverContentService.escapeMarkdown("*bold* text"),
        "\\*bold\\* text",
      );
    });

    test("escapes underscores", () => {
      assert.strictEqual(
        hoverContentService.escapeMarkdown("_italic_ text"),
        "\\_italic\\_ text",
      );
    });

    test("escapes curly braces", () => {
      assert.strictEqual(
        hoverContentService.escapeMarkdown("{object}"),
        "\\{object\\}",
      );
    });

    test("escapes square brackets", () => {
      assert.strictEqual(
        hoverContentService.escapeMarkdown("[link]"),
        "\\[link\\]",
      );
    });

    test("escapes parentheses", () => {
      assert.strictEqual(
        hoverContentService.escapeMarkdown("(note)"),
        "\\(note\\)",
      );
    });

    test("escapes hash symbol", () => {
      assert.strictEqual(
        hoverContentService.escapeMarkdown("# heading"),
        "\\# heading",
      );
    });

    test("escapes plus symbol", () => {
      assert.strictEqual(
        hoverContentService.escapeMarkdown("a + b"),
        "a \\+ b",
      );
    });

    test("escapes hyphen/minus", () => {
      assert.strictEqual(
        hoverContentService.escapeMarkdown("- item"),
        "\\- item",
      );
    });

    test("escapes period/dot", () => {
      assert.strictEqual(
        hoverContentService.escapeMarkdown("1. list"),
        "1\\. list",
      );
    });

    test("escapes exclamation mark", () => {
      assert.strictEqual(
        hoverContentService.escapeMarkdown("!important"),
        "\\!important",
      );
    });

    test("handles empty string", () => {
      assert.strictEqual(hoverContentService.escapeMarkdown(""), "");
    });

    test("handles string with no special characters", () => {
      assert.strictEqual(
        hoverContentService.escapeMarkdown("normal text"),
        "normal text",
      );
    });

    test("escapes multiple special characters in sequence", () => {
      assert.strictEqual(
        hoverContentService.escapeMarkdown("**bold**"),
        "\\*\\*bold\\*\\*",
      );
    });

    test("escapes markdown link syntax", () => {
      const input = "[Click here](https://example.com)";
      const expected = "\\[Click here\\]\\(https://example\\.com\\)";
      assert.strictEqual(hoverContentService.escapeMarkdown(input), expected);
    });

    test("escapes markdown image syntax", () => {
      const input = "![alt](image.png)";
      const expected = "\\!\\[alt\\]\\(image\\.png\\)";
      assert.strictEqual(hoverContentService.escapeMarkdown(input), expected);
    });

    test("prevents markdown bold injection in author name", () => {
      const maliciousAuthor = "**Evil Author**";
      const escaped = hoverContentService.escapeMarkdown(maliciousAuthor);
      assert.strictEqual(escaped, "\\*\\*Evil Author\\*\\*");
    });

    test("prevents markdown italic injection", () => {
      const maliciousText = "_sneaky italic_";
      const escaped = hoverContentService.escapeMarkdown(maliciousText);
      assert.strictEqual(escaped, "\\_sneaky italic\\_");
    });

    test("handles mixed content with Unicode", () => {
      const input = "Fix bug #123 - 田中太郎";
      const expected = "Fix bug \\#123 \\- 田中太郎";
      assert.strictEqual(hoverContentService.escapeMarkdown(input), expected);
    });

    test("escapes all special characters in realistic commit message", () => {
      const input =
        "fix(api): resolve issue #42 - handle `null` values [BREAKING]";
      const expected =
        "fix\\(api\\): resolve issue \\#42 \\- handle \\`null\\` values \\[BREAKING\\]";
      assert.strictEqual(hoverContentService.escapeMarkdown(input), expected);
    });
  });

  suite("formatRichHoverContent", () => {
    const sampleMR: MergeRequest = {
      iid: 42,
      title: "Test MR",
      webUrl: "https://gitlab.com/group/project/-/merge_requests/42",
      mergedAt: null,
      state: "merged",
    };

    test("returns MR link when MR provided", () => {
      const result = hoverContentService.formatRichHoverContent(
        sampleMR,
        VCS_PROVIDERS.GITLAB,
      );
      assert.ok(result.includes("**Merge Request**"));
      assert.ok(result.includes("!42"));
    });

    test("returns loading message when loading is true", () => {
      const result = hoverContentService.formatRichHoverContent(
        null,
        VCS_PROVIDERS.GITLAB,
        { loading: true },
      );
      assert.strictEqual(result, "*Loading merge request...*");
    });

    test("returns empty string when no MR and not loading", () => {
      const result = hoverContentService.formatRichHoverContent(
        null,
        VCS_PROVIDERS.GITLAB,
      );
      assert.strictEqual(result, "");
    });

    test("truncates long MR titles", () => {
      const longTitleMR: MergeRequest = {
        iid: 123,
        title:
          "This is a very long merge request title that exceeds fifty characters",
        webUrl: "https://gitlab.com/group/project/-/merge_requests/123",
        mergedAt: null,
        state: "merged",
      };
      const result = hoverContentService.formatRichHoverContent(
        longTitleMR,
        VCS_PROVIDERS.GITLAB,
      );
      assert.ok(
        result.includes("\\.\\.\\.") || result.includes("..."),
        "Should truncate long title",
      );
    });

    test("uses # prefix for GitHub", () => {
      const result = hoverContentService.formatRichHoverContent(
        sampleMR,
        VCS_PROVIDERS.GITHUB,
      );
      assert.ok(result.includes("#42"));
      assert.ok(!result.includes("!42"));
    });

    test("returns empty string when MR provided but providerId is undefined", () => {
      const result = hoverContentService.formatRichHoverContent(
        sampleMR,
        undefined,
      );
      assert.strictEqual(result, "");
    });
  });
});
