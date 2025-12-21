# Multi-Provider Architecture

This extension supports multiple VCS providers (GitLab, GitHub, Bitbucket) through an abstraction layer.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    VcsProviderFactory                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │GitLabProvider│  │GitHubProvider│  │BitbucketProvider│         │
│  │ (active)    │  │ (active)    │  │ (future)    │             │
│  └──────┬──────┘  └──────┬──────┘  └─────────────┘             │
│         │                │                                       │
│         ▼                ▼                                       │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    IVcsProvider                          │    │
│  │  - getMergeRequestForCommit()                           │    │
│  │  - parseRemoteUrl()                                      │    │
│  │  - isProviderUrl()                                       │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

## Provider Interface

All VCS providers implement the `IVcsProvider` interface:

```typescript
interface IVcsProvider {
  readonly id: string;
  readonly name: string;

  setToken(token: string | undefined): void;
  hasToken(): boolean;
  getHostUrl(): string;
  setHostUrl(url: string): void;
  parseRemoteUrl(remoteUrl: string): RemoteInfo | null;
  isProviderUrl(remoteUrl: string): boolean;
  getMergeRequestForCommit(
    projectPath: string,
    commitSha: string,
    hostUrl?: string,
  ): Promise<VcsResult<MergeRequest | null>>;
  resetErrorState(): void;
}
```

## Provider Detection Flow

The `VcsProviderFactory` automatically detects the appropriate provider from a git remote URL:

1. User hovers over a line
2. Extension gets git remote URL from GitService
3. Factory calls `isProviderUrl()` on each registered provider
4. First matching provider is used
5. Provider fetches MR/PR information
6. Result returned to BlameHoverProvider

```typescript
// In BlameHoverProvider
const remoteUrl = this.gitService.getRemoteUrl(uri);
const provider = this.vcsProviderFactory.detectProvider(remoteUrl);
if (provider) {
  const result = await provider.getMergeRequestForCommit(projectPath, sha);
}
```

## Error Handling

Services return `VcsResult` instead of showing UI directly:

```typescript
interface VcsResult<T> {
  success: boolean;
  data?: T;
  error?: VcsError;
}

interface VcsError {
  type: VcsErrorType;
  message: string;
  statusCode?: number;
  shouldShowUI?: boolean;
}
```

### Error Types

| Type | Description | shouldShowUI |
|------|-------------|--------------|
| `NoToken` | No token configured | `true` (once) |
| `InvalidToken` | Token rejected (401/403) | `true` (once) |
| `NotFound` | Project/commit not found | `false` |
| `RateLimited` | API rate limit hit | `false` |
| `NetworkError` | Network failure | `false` |
| `Unknown` | Other errors | `false` |

### UI Delegation

The extension handles all UI via a callback:

```typescript
// In extension.ts
function handleVcsError(error: VcsError, provider: IVcsProvider): void {
  if (!error.shouldShowUI) return;

  switch (error.type) {
    case VcsErrorType.NoToken:
      vscode.window.showWarningMessage(
        `${provider.name}: No token configured`,
        "Set Token"
      );
      break;
    // ... other cases
  }
}

// BlameHoverProvider receives callback
const hoverProvider = new BlameHoverProvider(
  gitService,
  factory,
  cache,
  handleVcsError,
);
```

## Token Management

The `TokenService` manages tokens for multiple providers:

```typescript
const tokenService = new TokenService(context.secrets);
await tokenService.loadTokens();

// Get token for a provider
const gitlabToken = tokenService.getToken("gitlab");

// Set token for a provider
await tokenService.setToken("gitlab", "glpat-xxx");
```

### Secret Storage Keys

| Provider | Secret Key |
|----------|------------|
| GitLab | `gitlabBlame.token` |
| GitHub | `gitlabBlame.githubToken` |
| Bitbucket | `gitlabBlame.bitbucketToken` (future) |

## Adding a New Provider

To add support for a new VCS (e.g., GitHub):

### 1. Create Provider Class

```typescript
// src/providers/vcs/GitHubProvider.ts
import { IVcsProvider } from "../../interfaces/IVcsProvider";
import { VCS_PROVIDERS } from "../../constants";

export class GitHubProvider implements IVcsProvider {
  readonly id = VCS_PROVIDERS.GITHUB;
  readonly name = "GitHub";

  private token: string | undefined;
  private hostUrl = "https://github.com";

  // Implement all interface methods...

  parseRemoteUrl(remoteUrl: string): RemoteInfo | null {
    // Parse github.com URLs
  }

  isProviderUrl(remoteUrl: string): boolean {
    return remoteUrl.includes("github.com");
  }

  async getMergeRequestForCommit(
    projectPath: string,
    sha: string,
  ): Promise<VcsResult<MergeRequest | null>> {
    // Call GitHub API: GET /repos/{owner}/{repo}/commits/{sha}/pulls
  }
}
```

### 2. Add Constants

```typescript
// src/constants.ts
export const VCS_PROVIDERS = {
  GITLAB: "gitlab",
  GITHUB: "github",  // Add this
  BITBUCKET: "bitbucket",
} as const;

export const SECRET_KEYS = {
  GITLAB_TOKEN: "gitlabBlame.token",
  GITHUB_TOKEN: "gitlabBlame.githubToken",  // Add this
} as const;
```

### 3. Register Provider

```typescript
// src/extension.ts
import { GitHubProvider } from "./providers/vcs/GitHubProvider";

// In activate()
const githubProvider = new GitHubProvider();
const githubToken = tokenService.getToken(VCS_PROVIDERS.GITHUB);
githubProvider.setToken(githubToken);
factory.registerProvider(githubProvider);
```

### 4. Update TokenService

```typescript
// src/services/TokenService.ts
private getSecretKeyForProvider(providerId: string): string | undefined {
  switch (providerId) {
    case VCS_PROVIDERS.GITLAB:
      return SECRET_KEYS.GITLAB_TOKEN;
    case VCS_PROVIDERS.GITHUB:
      return SECRET_KEYS.GITHUB_TOKEN;  // Add this
    default:
      return undefined;
  }
}
```

### 5. Add Tests

```typescript
// test/suite/githubProvider.test.ts
suite("GitHubProvider", () => {
  test("parses GitHub SSH URL", () => {
    const provider = new GitHubProvider();
    const info = provider.parseRemoteUrl("git@github.com:owner/repo.git");
    assert.deepStrictEqual(info, {
      host: "https://github.com",
      projectPath: "owner/repo",
      provider: "github",
    });
  });
  // ... more tests
});
```

### 6. Update Documentation

- Update `ref/api/providers.md` with new provider API
- Update `ref/multi-provider.md` with provider-specific notes
- Update `CLAUDE.md` project structure

## Current Providers

### GitLab (Active)

- **Provider ID**: `gitlab`
- **API**: GitLab REST API v4
- **Endpoint**: `GET /api/v4/projects/:id/repository/commits/:sha/merge_requests`
- **Auth Headers**:
  - `PRIVATE-TOKEN: <token>`
  - `Accept: application/json`
- **Token Scope**: `read_api`
- **MR Selection**: First merged MR by `merged_at` date (ascending)
- **Self-Hosted**: Configure via `gitlabBlame.gitlabUrl` setting

### GitHub (Active)

- **Provider ID**: `github`
- **API**: GitHub REST API v3
- **Primary Endpoint**: `GET /repos/{owner}/{repo}/commits/{sha}/pulls`
- **Fallback Strategy**: Parse commit message for `(#123)` pattern, then `GET /repos/{owner}/{repo}/pulls/{number}`
- **Auth Headers**:
  - `Authorization: token <personal_access_token>` (note: `token` prefix, not `Bearer`)
  - `Accept: application/vnd.github+json`
- **Token Scope**: `repo` (private repos) or `public_repo` (public repos only)
- **PR Selection**: First merged PR by `merged_at` date (ascending), same logic as GitLab
- **Rate Limits**: 5,000 req/hour (authenticated), 60 req/hour (unauthenticated)
- **Self-Hosted**: Configure via `gitlabBlame.githubUrl` setting

**API Limitation**: GitHub's `/commits/{sha}/pulls` endpoint only returns PRs for merge commits, not individual commits within a PR branch. To handle this:
1. Try the primary endpoint first
2. If empty, fetch commit details and parse message for `(#123)` pattern (GitHub auto-adds this)
3. If found, fetch that specific PR via `/pulls/{number}`

This ensures PRs are found for both merge commits and individual branch commits.

#### GitHub Enterprise Detection

The GitHub provider supports both GitHub.com and GitHub Enterprise instances:

**Detection Methods**:

1. **Automatic Detection** (hostname contains "github"):
   - `git@github.com:owner/repo.git` ✓
   - `https://github.com/owner/repo.git` ✓
   - `git@github.enterprise.com:owner/repo.git` ✓

2. **Config-Based Detection** (for custom hostnames):
   - Set `gitlabBlame.githubUrl` to your API URL (e.g., `https://api.git.company.com`)
   - Provider extracts hostname from config and matches against remote URL
   - Example: Config `https://api.git.company.com` → matches `git@git.company.com:owner/repo.git`

**API URL to Git Hostname Mapping**:
- `api.github.com` → `github.com`
- `api.github.enterprise.com` → `github.enterprise.com`
- `api.git.company.com` → `git.company.com` (strips `api.` prefix)

**Configuration Examples**:

```json
{
  // GitHub.com (default, no config needed)
  "gitlabBlame.githubUrl": "https://github.com",

  // GitHub Enterprise Server
  "gitlabBlame.githubUrl": "https://github.enterprise.com",

  // Custom GitHub Enterprise (without "github" in hostname)
  "gitlabBlame.githubUrl": "https://git.company.com"
}
```

### Bitbucket (Planned)

- **Provider ID**: `bitbucket`
- **API**: Bitbucket REST API 2.0
- **Endpoint**: TBD
- **Auth Header**: TBD
- **PR Selection**: TBD
