import nock = require("nock");

/**
 * Mock PR data structure matching GitHub API response
 */
export interface MockPR {
  number: number;
  title: string;
  html_url: string;
  state: string;
  merged_at: string | null;
  additions?: number;
  deletions?: number;
  changed_files?: number;
}

/**
 * Mock commit data structure
 */
export interface MockCommit {
  sha: string;
  commit: { message: string };
}

// Type for nock scope
type NockScope = ReturnType<typeof nock>;

/**
 * GitHub API mock using nock
 * Intercepts HTTP requests to api.github.com
 */
export class GitHubApiMock {
  private scope: NockScope;

  constructor(baseUrl = "https://api.github.com") {
    this.scope = nock(baseUrl);
  }

  /**
   * Mock the /commits/{sha}/pulls endpoint (primary API)
   */
  mockCommitPulls(
    owner: string,
    repo: string,
    sha: string,
    prs: MockPR[],
  ): this {
    this.scope
      .get(`/repos/${owner}/${repo}/commits/${sha}/pulls`)
      .matchHeader("Authorization", /^(token|Bearer) /)
      .matchHeader("Accept", /application\/vnd\.github/)
      .reply(200, prs);
    return this;
  }

  /**
   * Mock the /commits/{sha}/pulls endpoint without header requirements (for debugging)
   */
  mockCommitPullsNoHeaders(
    owner: string,
    repo: string,
    sha: string,
    prs: MockPR[],
  ): this {
    this.scope
      .get(`/repos/${owner}/${repo}/commits/${sha}/pulls`)
      .reply(200, prs);
    return this;
  }

  /**
   * Mock the /commits/{sha} endpoint (for fallback PR detection via commit message)
   */
  mockCommitDetails(
    owner: string,
    repo: string,
    sha: string,
    commit: MockCommit,
  ): this {
    this.scope
      .get(`/repos/${owner}/${repo}/commits/${sha}`)
      .matchHeader("Authorization", /^(token|Bearer) /)
      .reply(200, commit);
    return this;
  }

  /**
   * Mock the /pulls/{number} endpoint
   */
  mockPullRequest(
    owner: string,
    repo: string,
    prNumber: number,
    pr: MockPR,
  ): this {
    this.scope
      .get(`/repos/${owner}/${repo}/pulls/${prNumber}`)
      .matchHeader("Authorization", /^(token|Bearer) /)
      .reply(200, pr);
    return this;
  }

  /**
   * Mock the /pulls/{number} endpoint without header requirements (for stats fetch)
   */
  mockPullRequestNoHeaders(
    owner: string,
    repo: string,
    prNumber: number,
    pr: MockPR,
  ): this {
    this.scope.get(`/repos/${owner}/${repo}/pulls/${prNumber}`).reply(200, pr);
    return this;
  }

  /**
   * Mock a 401 Unauthorized response
   */
  mockUnauthorized(owner: string, repo: string, sha: string): this {
    this.scope
      .get(`/repos/${owner}/${repo}/commits/${sha}/pulls`)
      .reply(401, { message: "Bad credentials" });
    return this;
  }

  /**
   * Mock a 403 Forbidden response (rate limited)
   */
  mockRateLimited(owner: string, repo: string, sha: string): this {
    this.scope.get(`/repos/${owner}/${repo}/commits/${sha}/pulls`).reply(429, {
      message:
        "API rate limit exceeded for user ID. Please wait before retrying.",
    });
    return this;
  }

  /**
   * Mock a 404 Not Found response
   */
  mockNotFound(owner: string, repo: string, sha: string): this {
    this.scope
      .get(`/repos/${owner}/${repo}/commits/${sha}/pulls`)
      .reply(404, { message: "Not Found" });
    return this;
  }

  /**
   * Mock any request to return a specific status code
   */
  mockAnyRequest(
    owner: string,
    repo: string,
    statusCode: number,
    body: Record<string, unknown>,
  ): this {
    this.scope
      .get(new RegExp(`/repos/${owner}/${repo}/.*`))
      .reply(statusCode, body);
    return this;
  }

  /**
   * Allow persistence (don't remove interceptor after use)
   */
  persist(): this {
    this.scope.persist();
    return this;
  }

  /**
   * Verify all expected requests were made
   */
  verify(): void {
    if (!nock.isDone()) {
      const pending = nock.pendingMocks();
      throw new Error(`Not all nock mocks were used: ${pending.join(", ")}`);
    }
  }

  /**
   * Check if all mocks have been consumed
   */
  isDone(): boolean {
    return nock.isDone();
  }

  /**
   * Get pending mock count
   */
  pendingMocks(): string[] {
    return nock.pendingMocks();
  }

  /**
   * Clean up this mock instance
   */
  cleanup(): void {
    nock.cleanAll();
  }

  /**
   * Enable nock for intercepting requests
   * Call this before creating mock instances
   */
  static enable(): void {
    if (!nock.isActive()) {
      nock.activate();
    }
    nock.disableNetConnect();
    // Allow VS Code internal communication
    nock.enableNetConnect("localhost");
    nock.enableNetConnect("127.0.0.1");
  }

  /**
   * Disable nock and restore normal HTTP behavior
   */
  static disable(): void {
    nock.cleanAll();
    nock.restore();
    nock.enableNetConnect();
  }

  /**
   * Clean all mocks without disabling nock
   */
  static cleanAll(): void {
    nock.cleanAll();
  }
}

/**
 * Create a standard mock PR response
 */
export function createMockPR(
  number: number,
  title: string,
  options: Partial<MockPR> = {},
): MockPR {
  return {
    number,
    title,
    html_url: `https://github.com/test-owner/test-repo/pull/${number}`,
    state: "closed",
    merged_at: "2024-01-15T12:00:00Z",
    ...options,
  };
}

/**
 * Create a mock PR response with stats
 */
export function createMockPRWithStats(
  number: number,
  title: string,
  stats: { additions: number; deletions: number; changedFiles: number },
  options: Partial<MockPR> = {},
): MockPR {
  return {
    number,
    title,
    html_url: `https://github.com/test-owner/test-repo/pull/${number}`,
    state: "closed",
    merged_at: "2024-01-15T12:00:00Z",
    additions: stats.additions,
    deletions: stats.deletions,
    changed_files: stats.changedFiles,
    ...options,
  };
}
