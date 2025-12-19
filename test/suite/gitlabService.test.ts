import * as assert from "assert";

// Test the MR selection logic in isolation
// (GitLabService depends on vscode, so we test the core algorithm)

interface GitLabMR {
  id: number;
  iid: number;
  title: string;
  web_url: string;
  state: string;
  merged_at: string | null;
}

interface MergeRequest {
  iid: number;
  title: string;
  webUrl: string;
  mergedAt: string | null;
  state: string;
}

/**
 * Select the appropriate MR from a list of MRs
 * Strategy: Select the first merged MR by merged_at date
 */
function selectMergeRequest(mrs: GitLabMR[]): MergeRequest | null {
  if (mrs.length === 0) {
    return null;
  }

  // Filter to merged MRs with a merged_at date
  const mergedMRs = mrs.filter((mr) => mr.state === "merged" && mr.merged_at);

  if (mergedMRs.length === 0) {
    // Fallback: return first MR if none are merged
    return mapToMergeRequest(mrs[0]);
  }

  // Sort by merged_at date (ascending) and take the first one
  const firstMerged = mergedMRs.sort((a, b) => {
    const dateA = new Date(a.merged_at!).getTime();
    const dateB = new Date(b.merged_at!).getTime();
    return dateA - dateB;
  })[0];

  return mapToMergeRequest(firstMerged);
}

function mapToMergeRequest(mr: GitLabMR): MergeRequest {
  return {
    iid: mr.iid,
    title: mr.title,
    webUrl: mr.web_url,
    mergedAt: mr.merged_at,
    state: mr.state,
  };
}

suite("GitLabService MR Selection", () => {
  suite("selectMergeRequest", () => {
    test("returns null for empty array", () => {
      const result = selectMergeRequest([]);
      assert.strictEqual(result, null);
    });

    test("returns single MR", () => {
      const mrs: GitLabMR[] = [
        {
          id: 1,
          iid: 123,
          title: "Test MR",
          web_url: "https://gitlab.com/group/project/-/merge_requests/123",
          state: "merged",
          merged_at: "2025-01-01T00:00:00Z",
        },
      ];

      const result = selectMergeRequest(mrs);

      assert.strictEqual(result?.iid, 123);
      assert.strictEqual(result?.title, "Test MR");
    });

    test("selects first merged MR by date (chronologically earliest)", () => {
      const mrs: GitLabMR[] = [
        {
          id: 2,
          iid: 456,
          title: "Second MR",
          web_url: "https://gitlab.com/group/project/-/merge_requests/456",
          state: "merged",
          merged_at: "2025-01-02T00:00:00Z",
        },
        {
          id: 1,
          iid: 123,
          title: "First MR",
          web_url: "https://gitlab.com/group/project/-/merge_requests/123",
          state: "merged",
          merged_at: "2025-01-01T00:00:00Z",
        },
        {
          id: 3,
          iid: 789,
          title: "Third MR",
          web_url: "https://gitlab.com/group/project/-/merge_requests/789",
          state: "merged",
          merged_at: "2025-01-03T00:00:00Z",
        },
      ];

      const result = selectMergeRequest(mrs);

      assert.strictEqual(result?.iid, 123);
      assert.strictEqual(result?.title, "First MR");
    });

    test("returns open MR as fallback when no merged MRs", () => {
      const mrs: GitLabMR[] = [
        {
          id: 1,
          iid: 123,
          title: "Open MR",
          web_url: "https://gitlab.com/group/project/-/merge_requests/123",
          state: "opened",
          merged_at: null,
        },
      ];

      const result = selectMergeRequest(mrs);

      assert.strictEqual(result?.iid, 123);
      assert.strictEqual(result?.state, "opened");
    });

    test("ignores closed MRs and selects merged", () => {
      const mrs: GitLabMR[] = [
        {
          id: 1,
          iid: 123,
          title: "Closed MR",
          web_url: "https://gitlab.com/group/project/-/merge_requests/123",
          state: "closed",
          merged_at: null,
        },
        {
          id: 2,
          iid: 456,
          title: "Merged MR",
          web_url: "https://gitlab.com/group/project/-/merge_requests/456",
          state: "merged",
          merged_at: "2025-01-01T00:00:00Z",
        },
      ];

      const result = selectMergeRequest(mrs);

      assert.strictEqual(result?.iid, 456);
      assert.strictEqual(result?.state, "merged");
    });

    test("handles MR with merged state but null merged_at", () => {
      const mrs: GitLabMR[] = [
        {
          id: 1,
          iid: 123,
          title: "Weird MR",
          web_url: "https://gitlab.com/group/project/-/merge_requests/123",
          state: "merged",
          merged_at: null, // Edge case: merged but no date
        },
        {
          id: 2,
          iid: 456,
          title: "Normal MR",
          web_url: "https://gitlab.com/group/project/-/merge_requests/456",
          state: "merged",
          merged_at: "2025-01-01T00:00:00Z",
        },
      ];

      const result = selectMergeRequest(mrs);

      // Should select the one with a valid merged_at
      assert.strictEqual(result?.iid, 456);
    });

    test("maps GitLab API response to MergeRequest type", () => {
      const mrs: GitLabMR[] = [
        {
          id: 12345,
          iid: 123,
          title: "Fix bug",
          web_url: "https://gitlab.com/group/project/-/merge_requests/123",
          state: "merged",
          merged_at: "2025-01-15T10:30:00Z",
        },
      ];

      const result = selectMergeRequest(mrs);

      assert.deepStrictEqual(result, {
        iid: 123,
        title: "Fix bug",
        webUrl: "https://gitlab.com/group/project/-/merge_requests/123",
        mergedAt: "2025-01-15T10:30:00Z",
        state: "merged",
      });
    });
  });
});
