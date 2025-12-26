import * as assert from "assert";
import * as sinon from "sinon";
import { HoverContentService } from "@services/HoverContentService";
import { VCS_PROVIDERS } from "@constants";
import { MergeRequest, BlameInfo } from "@types";

suite("HoverContentService", () => {
  let hoverContentService: HoverContentService;
  let clock: sinon.SinonFakeTimers;

  setup(() => {
    hoverContentService = new HoverContentService();
  });

  teardown(() => {
    if (clock) {
      clock.restore();
    }
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

  suite("formatRelativeDate", () => {
    setup(() => {
      // Fix time to a known point: 2024-01-15 12:00:00 UTC
      clock = sinon.useFakeTimers(new Date("2024-01-15T12:00:00Z").getTime());
    });

    teardown(() => {
      clock.restore();
    });

    test("returns 'just now' for current time", () => {
      const now = new Date();
      assert.strictEqual(
        hoverContentService.formatRelativeDate(now),
        "just now",
      );
    });

    test("returns 'just now' for 30 seconds ago", () => {
      const date = new Date(Date.now() - 30 * 1000);
      assert.strictEqual(
        hoverContentService.formatRelativeDate(date),
        "just now",
      );
    });

    test("returns 'just now' for 59 seconds ago", () => {
      const date = new Date(Date.now() - 59 * 1000);
      assert.strictEqual(
        hoverContentService.formatRelativeDate(date),
        "just now",
      );
    });

    test("returns '1 minute ago' for 60 seconds ago", () => {
      const date = new Date(Date.now() - 60 * 1000);
      assert.strictEqual(
        hoverContentService.formatRelativeDate(date),
        "1 minute ago",
      );
    });

    test("returns '1 minute ago' for 90 seconds ago", () => {
      const date = new Date(Date.now() - 90 * 1000);
      assert.strictEqual(
        hoverContentService.formatRelativeDate(date),
        "1 minute ago",
      );
    });

    test("returns '2 minutes ago' for 2 minutes", () => {
      const date = new Date(Date.now() - 2 * 60 * 1000);
      assert.strictEqual(
        hoverContentService.formatRelativeDate(date),
        "2 minutes ago",
      );
    });

    test("returns '59 minutes ago' for 59 minutes", () => {
      const date = new Date(Date.now() - 59 * 60 * 1000);
      assert.strictEqual(
        hoverContentService.formatRelativeDate(date),
        "59 minutes ago",
      );
    });

    test("returns '1 hour ago' for 60 minutes", () => {
      const date = new Date(Date.now() - 60 * 60 * 1000);
      assert.strictEqual(
        hoverContentService.formatRelativeDate(date),
        "1 hour ago",
      );
    });

    test("returns '1 hour ago' for 90 minutes", () => {
      const date = new Date(Date.now() - 90 * 60 * 1000);
      assert.strictEqual(
        hoverContentService.formatRelativeDate(date),
        "1 hour ago",
      );
    });

    test("returns '2 hours ago' for 2 hours", () => {
      const date = new Date(Date.now() - 2 * 60 * 60 * 1000);
      assert.strictEqual(
        hoverContentService.formatRelativeDate(date),
        "2 hours ago",
      );
    });

    test("returns '23 hours ago' for 23 hours", () => {
      const date = new Date(Date.now() - 23 * 60 * 60 * 1000);
      assert.strictEqual(
        hoverContentService.formatRelativeDate(date),
        "23 hours ago",
      );
    });

    test("returns '1 day ago' for 24 hours", () => {
      const date = new Date(Date.now() - 24 * 60 * 60 * 1000);
      assert.strictEqual(
        hoverContentService.formatRelativeDate(date),
        "1 day ago",
      );
    });

    test("returns '1 day ago' for 36 hours", () => {
      const date = new Date(Date.now() - 36 * 60 * 60 * 1000);
      assert.strictEqual(
        hoverContentService.formatRelativeDate(date),
        "1 day ago",
      );
    });

    test("returns '2 days ago' for 48 hours", () => {
      const date = new Date(Date.now() - 48 * 60 * 60 * 1000);
      assert.strictEqual(
        hoverContentService.formatRelativeDate(date),
        "2 days ago",
      );
    });

    test("returns '6 days ago' for 6 days", () => {
      const date = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
      assert.strictEqual(
        hoverContentService.formatRelativeDate(date),
        "6 days ago",
      );
    });

    test("returns '1 week ago' for 7 days", () => {
      const date = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      assert.strictEqual(
        hoverContentService.formatRelativeDate(date),
        "1 week ago",
      );
    });

    test("returns '2 weeks ago' for 14 days", () => {
      const date = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
      assert.strictEqual(
        hoverContentService.formatRelativeDate(date),
        "2 weeks ago",
      );
    });

    test("returns '3 weeks ago' for 21 days", () => {
      const date = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000);
      assert.strictEqual(
        hoverContentService.formatRelativeDate(date),
        "3 weeks ago",
      );
    });

    test("returns '1 month ago' for 30 days", () => {
      const date = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      assert.strictEqual(
        hoverContentService.formatRelativeDate(date),
        "1 month ago",
      );
    });

    test("returns '2 months ago' for 60 days", () => {
      const date = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
      assert.strictEqual(
        hoverContentService.formatRelativeDate(date),
        "2 months ago",
      );
    });

    test("returns '11 months ago' for 330 days", () => {
      const date = new Date(Date.now() - 330 * 24 * 60 * 60 * 1000);
      assert.strictEqual(
        hoverContentService.formatRelativeDate(date),
        "11 months ago",
      );
    });

    test("returns '1 year ago' for 365 days", () => {
      const date = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
      assert.strictEqual(
        hoverContentService.formatRelativeDate(date),
        "1 year ago",
      );
    });

    test("returns '2 years ago' for 730 days", () => {
      const date = new Date(Date.now() - 730 * 24 * 60 * 60 * 1000);
      assert.strictEqual(
        hoverContentService.formatRelativeDate(date),
        "2 years ago",
      );
    });

    test("returns '5 years ago' for 5 years", () => {
      const date = new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000);
      assert.strictEqual(
        hoverContentService.formatRelativeDate(date),
        "5 years ago",
      );
    });

    test("handles singular vs plural for minutes", () => {
      const oneMin = new Date(Date.now() - 1 * 60 * 1000);
      const twoMin = new Date(Date.now() - 2 * 60 * 1000);
      assert.strictEqual(
        hoverContentService.formatRelativeDate(oneMin),
        "1 minute ago",
      );
      assert.strictEqual(
        hoverContentService.formatRelativeDate(twoMin),
        "2 minutes ago",
      );
    });

    test("handles singular vs plural for hours", () => {
      const oneHour = new Date(Date.now() - 1 * 60 * 60 * 1000);
      const twoHours = new Date(Date.now() - 2 * 60 * 60 * 1000);
      assert.strictEqual(
        hoverContentService.formatRelativeDate(oneHour),
        "1 hour ago",
      );
      assert.strictEqual(
        hoverContentService.formatRelativeDate(twoHours),
        "2 hours ago",
      );
    });

    test("handles singular vs plural for days", () => {
      const oneDay = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
      const twoDays = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      assert.strictEqual(
        hoverContentService.formatRelativeDate(oneDay),
        "1 day ago",
      );
      assert.strictEqual(
        hoverContentService.formatRelativeDate(twoDays),
        "2 days ago",
      );
    });

    test("handles singular vs plural for weeks", () => {
      const oneWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const twoWeeks = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
      assert.strictEqual(
        hoverContentService.formatRelativeDate(oneWeek),
        "1 week ago",
      );
      assert.strictEqual(
        hoverContentService.formatRelativeDate(twoWeeks),
        "2 weeks ago",
      );
    });

    test("handles singular vs plural for months", () => {
      const oneMonth = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const twoMonths = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
      assert.strictEqual(
        hoverContentService.formatRelativeDate(oneMonth),
        "1 month ago",
      );
      assert.strictEqual(
        hoverContentService.formatRelativeDate(twoMonths),
        "2 months ago",
      );
    });

    test("handles singular vs plural for years", () => {
      const oneYear = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
      const twoYears = new Date(Date.now() - 730 * 24 * 60 * 60 * 1000);
      assert.strictEqual(
        hoverContentService.formatRelativeDate(oneYear),
        "1 year ago",
      );
      assert.strictEqual(
        hoverContentService.formatRelativeDate(twoYears),
        "2 years ago",
      );
    });
  });

  suite("formatSimpleMrLink", () => {
    const sampleMR: MergeRequest = {
      iid: 42,
      title: "Fix bug",
      webUrl: "https://gitlab.com/group/project/-/merge_requests/42",
      mergedAt: null,
      state: "merged",
    };

    test("formats GitLab MR link with ! prefix", () => {
      const result = hoverContentService.formatSimpleMrLink(
        sampleMR,
        VCS_PROVIDERS.GITLAB,
      );
      assert.strictEqual(
        result,
        "[!42: Fix bug](https://gitlab.com/group/project/-/merge_requests/42)",
      );
    });

    test("formats GitHub PR link with # prefix", () => {
      const githubPR: MergeRequest = {
        iid: 123,
        title: "Add feature",
        webUrl: "https://github.com/user/repo/pull/123",
        mergedAt: null,
        state: "merged",
      };
      const result = hoverContentService.formatSimpleMrLink(
        githubPR,
        VCS_PROVIDERS.GITHUB,
      );
      assert.strictEqual(
        result,
        "[#123: Add feature](https://github.com/user/repo/pull/123)",
      );
    });

    test("escapes markdown in MR title", () => {
      const mrWithMarkdown: MergeRequest = {
        iid: 1,
        title: "Fix *bold* issue",
        webUrl: "https://example.com",
        mergedAt: null,
        state: "merged",
      };
      const result = hoverContentService.formatSimpleMrLink(
        mrWithMarkdown,
        VCS_PROVIDERS.GITLAB,
      );
      assert.ok(result.includes("\\*bold\\*"));
    });
  });

  suite("formatRichHoverContent", () => {
    const sampleBlameInfo: BlameInfo = {
      sha: "abc123def456",
      author: "John Doe",
      authorEmail: "john@example.com",
      date: new Date("2024-01-15T12:00:00Z"),
      summary: "Fix authentication bug",
      line: 10,
    };

    const sampleMR: MergeRequest = {
      iid: 42,
      title: "Test MR",
      webUrl: "https://gitlab.com/group/project/-/merge_requests/42",
      mergedAt: null,
      state: "merged",
    };

    setup(() => {
      clock = sinon.useFakeTimers(new Date("2024-01-15T12:00:00Z").getTime());
    });

    teardown(() => {
      clock.restore();
    });

    test("includes MR link when MR provided", () => {
      const result = hoverContentService.formatRichHoverContent(
        sampleMR,
        sampleBlameInfo,
        VCS_PROVIDERS.GITLAB,
      );
      assert.ok(result.includes("**Merge Request**"));
      assert.ok(result.includes("!42"));
    });

    test("shows loading state when loading is true", () => {
      const result = hoverContentService.formatRichHoverContent(
        null,
        sampleBlameInfo,
        VCS_PROVIDERS.GITLAB,
        { loading: true },
      );
      assert.ok(result.includes("*Loading merge request...*"));
    });

    test("shows no MR message when checked and no MR", () => {
      const result = hoverContentService.formatRichHoverContent(
        null,
        sampleBlameInfo,
        VCS_PROVIDERS.GITLAB,
        { checked: true },
      );
      assert.ok(result.includes("*No associated merge request*"));
    });

    test("includes short SHA", () => {
      const result = hoverContentService.formatRichHoverContent(
        sampleMR,
        sampleBlameInfo,
        VCS_PROVIDERS.GITLAB,
      );
      assert.ok(result.includes("`abc123d`"));
    });

    test("includes author name", () => {
      const result = hoverContentService.formatRichHoverContent(
        sampleMR,
        sampleBlameInfo,
        VCS_PROVIDERS.GITLAB,
      );
      assert.ok(result.includes("John Doe"));
    });

    test("includes relative date", () => {
      const result = hoverContentService.formatRichHoverContent(
        sampleMR,
        sampleBlameInfo,
        VCS_PROVIDERS.GITLAB,
      );
      assert.ok(result.includes("just now"));
    });

    test("includes commit summary", () => {
      const result = hoverContentService.formatRichHoverContent(
        sampleMR,
        sampleBlameInfo,
        VCS_PROVIDERS.GITLAB,
      );
      assert.ok(result.includes("*Fix authentication bug*"));
    });

    test("escapes markdown in author name", () => {
      const blameWithMarkdown: BlameInfo = {
        ...sampleBlameInfo,
        author: "**Evil Author**",
      };
      const result = hoverContentService.formatRichHoverContent(
        sampleMR,
        blameWithMarkdown,
        VCS_PROVIDERS.GITLAB,
      );
      assert.ok(result.includes("\\*\\*Evil Author\\*\\*"));
    });

    test("escapes markdown in commit summary", () => {
      const blameWithMarkdown: BlameInfo = {
        ...sampleBlameInfo,
        summary: "_Sneaky_ commit",
      };
      const result = hoverContentService.formatRichHoverContent(
        sampleMR,
        blameWithMarkdown,
        VCS_PROVIDERS.GITLAB,
      );
      assert.ok(result.includes("\\_Sneaky\\_"));
    });

    test("handles blame without summary", () => {
      const blameNoSummary: BlameInfo = {
        ...sampleBlameInfo,
        summary: "",
      };
      const result = hoverContentService.formatRichHoverContent(
        sampleMR,
        blameNoSummary,
        VCS_PROVIDERS.GITLAB,
      );
      assert.ok(!result.includes("*$")); // No empty italic block
    });

    test("truncates long MR titles in rich content", () => {
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
        sampleBlameInfo,
        VCS_PROVIDERS.GITLAB,
      );
      // Should contain truncation indicator
      assert.ok(
        result.includes("\\.\\.\\.") || result.includes("..."),
        "Should truncate long title",
      );
    });

    test("uses correct prefix for GitHub", () => {
      const result = hoverContentService.formatRichHoverContent(
        sampleMR,
        sampleBlameInfo,
        VCS_PROVIDERS.GITHUB,
      );
      assert.ok(result.includes("#42"));
      assert.ok(!result.includes("!42"));
    });

    test("handles undefined providerId gracefully", () => {
      const result = hoverContentService.formatRichHoverContent(
        sampleMR,
        sampleBlameInfo,
        undefined,
      );
      // Should still include commit info without MR link
      assert.ok(result.includes("`abc123d`"));
      assert.ok(result.includes("John Doe"));
      // Should not include MR section when providerId is undefined
      assert.ok(!result.includes("**Merge Request**"));
    });
  });
});
