# Providers API Reference

## IVcsProvider Interface

**Location**: `src/interfaces/IVcsProvider.ts`

Interface for VCS provider implementations (GitLab, GitHub, Bitbucket).

### Design Principles

- Services return data, not UI
- All operations return `VcsResult` for consistent error handling
- No direct `vscode.window` calls in providers

### Interface Definition

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

### Properties

#### `id: string` (readonly)

Unique identifier for the provider (e.g., "gitlab", "github", "bitbucket").

#### `name: string` (readonly)

Human-readable provider name (e.g., "GitLab", "GitHub").

### Methods

#### `setToken(token: string | undefined): void`

Set the authentication token for API calls.

#### `hasToken(): boolean`

Check if a valid token is configured.

#### `getHostUrl(): string`

Get the configured host URL (e.g., "https://gitlab.com").

#### `setHostUrl(url: string): void`

Update the host URL for self-hosted instances.

#### `parseRemoteUrl(remoteUrl: string): RemoteInfo | null`

Parse a git remote URL to extract provider-specific information.

**Returns**: `RemoteInfo` if URL matches this provider, `null` otherwise.

#### `isProviderUrl(remoteUrl: string): boolean`

Check if a remote URL belongs to this provider.

#### `getMergeRequestForCommit(projectPath, commitSha, hostUrl?): Promise<VcsResult<MergeRequest | null>>`

Get the MR/PR associated with a commit.

**Returns**: `VcsResult` with MR data or error information.

#### `resetErrorState(): void`

Reset error state flags (e.g., for "shown once" error handling).

---

## GitLabProvider

**Location**: `src/providers/vcs/GitLabProvider.ts`

GitLab implementation of `IVcsProvider`.

### Constructor

```typescript
const provider = new GitLabProvider(hostUrl?: string);
```

**Parameters**:
- `hostUrl`: GitLab instance URL (default: "https://gitlab.com")

### Properties

- `id`: "gitlab"
- `name`: "GitLab"

### API Details

**Endpoint**: `GET /api/v4/projects/:id/repository/commits/:sha/merge_requests`

**Headers**:
```
PRIVATE-TOKEN: <token>
Accept: application/json
```

### MR Selection Logic

1. Filter to merged MRs with `merged_at` date
2. Sort by `merged_at` ascending
3. Return first (earliest merged)
4. Fallback: return first MR if none are merged

### Error Handling

Returns `VcsResult` with typed errors:

```typescript
// No token configured
{ success: false, error: { type: VcsErrorType.NoToken, shouldShowUI: true } }

// Invalid/expired token (401, 403)
{ success: false, error: { type: VcsErrorType.InvalidToken, statusCode: 401 } }

// Not found (404)
{ success: false, error: { type: VcsErrorType.NotFound, shouldShowUI: false } }

// Rate limited (429)
{ success: false, error: { type: VcsErrorType.RateLimited, shouldShowUI: false } }

// Network error
{ success: false, error: { type: VcsErrorType.NetworkError, message: "..." } }
```

### Usage Example

```typescript
import { GitLabProvider } from "./providers/vcs/GitLabProvider";
import { VcsProviderFactory } from "./services/VcsProviderFactory";

const factory = new VcsProviderFactory();
const gitlabProvider = new GitLabProvider("https://gitlab.com");
gitlabProvider.setToken("glpat-xxxxxxxxxxxx");
factory.registerProvider(gitlabProvider);

// Later, auto-detect and use
const provider = factory.detectProvider("git@gitlab.com:group/project.git");
if (provider) {
  const result = await provider.getMergeRequestForCommit("group/project", "abc123");
  if (result.success) {
    console.log("MR:", result.data);
  } else {
    console.error("Error:", result.error);
  }
}
```

---

## GitHubProvider

**Location**: `src/providers/vcs/GitHubProvider.ts`

GitHub implementation of `IVcsProvider`.

### Constructor

```typescript
const provider = new GitHubProvider(hostUrl?: string);
```

**Parameters**:
- `hostUrl`: GitHub URL (default: "https://github.com", auto-converted to API URL)
  - For GitHub.com: Use default
  - For GitHub Enterprise: Use your instance URL (e.g., "https://github.enterprise.com")

### Properties

- `id`: "github"
- `name`: "GitHub"

### API Details

**Endpoint**: `GET /repos/:owner/:repo/commits/:sha/pulls`

**Headers**:
```
Authorization: token <personal_access_token>
Accept: application/vnd.github.v3+json
```

**Required Token Scopes**: `repo` (for private repos) or `public_repo` (for public repos only)

### PR Selection Logic

1. Filter to merged PRs with `merged_at` date
2. Sort by `merged_at` ascending
3. Return first (earliest merged)
4. Fallback: return first PR if none are merged

**Note**: Same logic as GitLab for consistency.

### GitHub Enterprise Detection

The provider supports both GitHub.com and GitHub Enterprise instances.

**Detection Strategy**:

1. **GitHub.com**: Automatically detected if remote URL contains "github" (case-insensitive)
   - `git@github.com:owner/repo.git` ✓
   - `https://github.com/owner/repo.git` ✓

2. **GitHub Enterprise with "github" in hostname**: Automatically detected
   - `git@github.enterprise.com:owner/repo.git` ✓

3. **GitHub Enterprise without "github" in hostname**: Config-based detection
   - Set `gitlabBlame.githubUrl` to your API URL (e.g., `https://api.git.company.com`)
   - Provider extracts hostname from config and matches against remote URL
   - Example: Config `https://api.git.company.com` → matches `git@git.company.com:owner/repo.git`

**API URL to Git Hostname Mapping**:
- `api.github.com` → `github.com`
- `api.github.enterprise.com` → `github.enterprise.com`
- `api.git.company.com` → `git.company.com`

The provider automatically strips the `api.` prefix when matching remote URLs.

### Error Handling

Returns `VcsResult` with typed errors (same as GitLab):

```typescript
// No token configured
{ success: false, error: { type: VcsErrorType.NoToken, shouldShowUI: true } }

// Invalid/expired token (401, 403)
{ success: false, error: { type: VcsErrorType.InvalidToken, statusCode: 401 } }

// Not found (404)
{ success: false, error: { type: VcsErrorType.NotFound, shouldShowUI: false } }

// Rate limited (429)
{ success: false, error: { type: VcsErrorType.RateLimited, shouldShowUI: false } }

// Network error
{ success: false, error: { type: VcsErrorType.NetworkError, message: "..." } }
```

**Rate Limits**:
- Authenticated: 5,000 requests/hour
- Unauthenticated: 60 requests/hour

### Usage Example

```typescript
import { GitHubProvider } from "./providers/vcs/GitHubProvider";
import { VcsProviderFactory } from "./services/VcsProviderFactory";

const factory = new VcsProviderFactory();

// GitHub.com
const githubProvider = new GitHubProvider("https://github.com");
githubProvider.setToken("ghp_xxxxxxxxxxxx");
factory.registerProvider(githubProvider);

// GitHub Enterprise
const gheProvider = new GitHubProvider("https://github.enterprise.com");
gheProvider.setToken("ghp_xxxxxxxxxxxx");
factory.registerProvider(gheProvider);

// Later, auto-detect and use
const provider = factory.detectProvider("git@github.com:owner/repo.git");
if (provider) {
  const result = await provider.getMergeRequestForCommit("owner/repo", "abc123");
  if (result.success) {
    console.log("PR:", result.data);
  } else {
    console.error("Error:", result.error);
  }
}
```

---

## ICacheService Interface

**Location**: `src/interfaces/ICacheService.ts`

Interface for cache service implementations.

```typescript
interface ICacheService {
  initialize(gitApi: GitAPI | undefined): void;
  get(providerId: string, sha: string): MergeRequest | null | undefined;
  set(providerId: string, sha: string, mr: MergeRequest | null): void;
  has(providerId: string, sha: string): boolean;
  clear(): void;
  readonly size: number;
  dispose(): void;
}
```

**Note**: Cache methods now require `providerId` to prevent collisions when the same commit SHA exists in both GitLab and GitHub repositories.

See [CacheService in Services API](./services.md#cacheservice) for implementation details.

---

## BlameHoverProvider

**Location**: `src/providers/BlameHoverProvider.ts`

Implements VS Code's `HoverProvider` interface to display git blame information with MR/PR links.

### Constants

#### `MR_TITLE_MAX_LENGTH = 50`

Maximum length for MR link text in hover. Titles exceeding this are truncated with "..." and show full title on hover via Markdown link title attribute.

### Constructor

```typescript
constructor(
  gitService: GitService,
  vcsProviderFactory: VcsProviderFactory,
  cacheService: ICacheService,
  onVcsError?: VcsErrorHandler
)
```

**Parameters**:
- `gitService`: Git service for blame operations
- `vcsProviderFactory`: Factory for VCS provider detection
- `cacheService`: Cache service implementing `ICacheService`
- `onVcsError`: Optional callback for handling VCS errors with UI

### VcsErrorHandler Type

```typescript
type VcsErrorHandler = (error: VcsError, provider: IVcsProvider) => void;
```

Called when a VCS operation fails. The extension can use this to show appropriate UI based on `error.shouldShowUI`.

### Interface Implementation

#### `provideHover(document, position, token): Promise<Hover | null>`

Called by VS Code when user hovers over text in a file.

**Parameters**:
- `document`: The text document
- `position`: Cursor position
- `token`: Cancellation token

**Returns**: `vscode.Hover` with blame info or `null`.

### Internal Methods

#### `buildHoverContent(uri, blameInfo, token): Promise<MarkdownString>`

Constructs the hover tooltip content.

**Content Structure**:
```
**Merge Request**: [!123 MR Title](https://gitlab.com/...)

`abc1234` by Author Name • 2 days ago

*Commit message summary*
```

Long MR titles are truncated (hover to see full title):
```
**Merge Request**: [!456 Implement very long feature na...](https://... "Full title here")

`abc1234` by Author Name • 2 days ago
```

If no MR found:
```
`abc1234` by Author Name • 2 days ago

*Commit message summary*

*No associated merge request*
```

#### `getMergeRequestInfo(uri, sha, token): Promise<MRResult>`

Fetches MR info from cache or API using provider auto-detection.

**Returns**:
```typescript
{
  mr: MergeRequest | null,  // The MR if found
  loading: boolean,          // True if request in progress
  checked: boolean           // True if we actually checked
}
```

**Flow**:
1. Check cache
2. Check for pending request (deduplication)
3. Get remote URL from GitService
4. Detect provider via VcsProviderFactory
5. Check provider has token
6. Parse remote URL
7. Call provider API
8. Handle errors via callback
9. Cache result

#### `fetchAndCacheMR(provider, projectPath, sha, host): Promise<MergeRequest | null>`

Makes API call via provider and stores result in cache.

**Important**: Caches `null` results (including errors) to avoid repeated API calls.

#### `formatRelativeDate(date: Date): string`

Formats dates as relative time.

**Examples**:
- "just now"
- "5 minutes ago"
- "2 hours ago"
- "3 days ago"
- "2 weeks ago"
- "4 months ago"
- "1 year ago"

#### `escapeMarkdown(text: string): string`

Escapes special markdown characters to prevent formatting issues.

**Escaped characters**: `\` `` ` `` `*` `_` `{` `}` `[` `]` `(` `)` `#` `+` `-` `.` `!`

#### `escapeMarkdownTitle(text: string): string`

Escapes characters for Markdown link title attribute (used in tooltips).

**Escaped characters**: `"` `\`

#### `formatMrLink(mr: MergeRequest): string`

Formats an MR as a clickable Markdown link with truncation for long titles.

**Behavior**:
- If `!{iid} {title}` ≤ 50 characters: Shows full text as link
- If longer: Truncates title with "..." and adds full title as hover tooltip

### Usage Example

The provider is registered in `extension.ts`:

```typescript
const hoverProvider = new BlameHoverProvider(
  gitService,
  vcsProviderFactory,
  cacheService,
  handleVcsError  // Error callback for UI
);

context.subscriptions.push(
  vscode.languages.registerHoverProvider(
    { scheme: "file" },
    hoverProvider
  )
);
```

The `{ scheme: "file" }` selector means the provider is active for all files in the filesystem (not virtual documents, untitled files, etc.).
