# Services API Reference

## GitService

**Location**: `src/services/GitService.ts`

Wraps VS Code's built-in Git extension API for blame operations.

### Methods

> **Note**: Uses VS Code's Git API which returns standard blame format (not porcelain).

#### `initialize(): Promise<boolean>`

Initialize the Git service by activating VS Code's Git extension.

**Returns**: `true` if initialization succeeded, `false` otherwise.

**Example**:
```typescript
const gitService = new GitService();
const success = await gitService.initialize();
if (!success) {
  console.error(gitService.getInitializationError());
}
```

#### `isInitialized(): boolean`

Check if the service is ready.

#### `getInitializationError(): string | undefined`

Get the error message if initialization failed.

#### `getAPI(): API | undefined`

Get the underlying VS Code Git API instance.

#### `getRepository(uri: vscode.Uri): Repository | null`

Get the Git repository for a file.

**Parameters**:
- `uri`: VS Code URI of a file in the repository

**Returns**: Repository object or `null` if not in a git repo.

#### `getBlameForLine(uri: vscode.Uri, line: number): Promise<BlameInfo | undefined>`

Get blame info for a specific line.

**Parameters**:
- `uri`: File URI
- `line`: 0-based line number

**Returns**: `BlameInfo` object or `undefined` if unavailable.

**Example**:
```typescript
const blame = await gitService.getBlameForLine(document.uri, position.line);
if (blame) {
  console.log(`Commit ${blame.sha} by ${blame.author}`);
}
```

#### `getBlameForFile(uri: vscode.Uri): Promise<Map<number, BlameInfo> | undefined>`

Get blame info for all lines in a file.

**Returns**: Map of 1-based line numbers to `BlameInfo`.

#### `getRemoteUrl(uri: vscode.Uri): string | undefined`

Get the origin remote URL for a repository.

**Parameters**:
- `uri`: File URI within the repository

**Returns**: Remote URL string or `undefined`.

---

## VcsProviderFactory

**Location**: `src/services/VcsProviderFactory.ts`

Factory for creating and managing VCS provider instances. Supports automatic provider detection from remote URLs.

### Constructor

```typescript
const factory = new VcsProviderFactory();
```

### Methods

#### `registerProvider(provider: IVcsProvider): void`

Register a VCS provider implementation.

**Parameters**:
- `provider`: Provider implementing `IVcsProvider` interface

**Example**:
```typescript
const gitlabProvider = new GitLabProvider("https://gitlab.com");
factory.registerProvider(gitlabProvider);
```

#### `getProvider(providerId: string): IVcsProvider | undefined`

Get a provider by its ID.

**Parameters**:
- `providerId`: Provider identifier (e.g., "gitlab", "github")

**Returns**: Provider instance or `undefined` if not registered.

#### `detectProvider(remoteUrl: string): IVcsProvider | undefined`

Auto-detect provider from a git remote URL.

**Parameters**:
- `remoteUrl`: Git remote URL (SSH or HTTPS)

**Returns**: Matching provider or `undefined` if none match.

**Example**:
```typescript
const provider = factory.detectProvider("git@gitlab.com:group/project.git");
if (provider) {
  const result = await provider.getMergeRequestForCommit(projectPath, sha);
}
```

#### `getAllProviders(): IVcsProvider[]`

Get all registered providers.

#### `clear(): void`

Remove all registered providers.

---

## TokenService

**Location**: `src/services/TokenService.ts`

Manages authentication tokens for multiple VCS providers using VS Code's SecretStorage.

### Constructor

```typescript
const tokenService = new TokenService(context.secrets);
```

**Parameters**:
- `secretStorage`: VS Code SecretStorage instance from extension context

### Methods

#### `loadTokens(): Promise<void>`

Load all provider tokens from secure storage.

**Example**:
```typescript
await tokenService.loadTokens();
const gitlabToken = tokenService.getToken("gitlab");
```

#### `getToken(providerId: string): string | undefined`

Get token for a specific provider.

**Parameters**:
- `providerId`: Provider identifier (e.g., "gitlab")

**Returns**: Token string or `undefined` if not set.

#### `setToken(providerId: string, token: string): Promise<void>`

Set and persist token for a provider.

**Parameters**:
- `providerId`: Provider identifier
- `token`: Authentication token

#### `deleteToken(providerId: string): Promise<void>`

Delete token for a provider.

#### `hasToken(providerId: string): boolean`

Check if a token exists for a provider.

---

## ErrorLogger

**Location**: `src/services/ErrorLogger.ts`

Centralized error logging service with VS Code Output Channel integration. Provides consistent error formatting across all components.

### Singleton Pattern

```typescript
import { logger } from "./services/ErrorLogger";
```

The `logger` export is a singleton instance that should be used throughout the extension.

### Methods

#### `initialize(outputChannel: vscode.OutputChannel): void`

Initialize the logger with a VS Code Output Channel.

**Parameters**:
- `outputChannel`: VS Code OutputChannel instance for logging

**Example**:
```typescript
import { logger } from "./services/ErrorLogger";

// In extension.ts activation
const outputChannel = vscode.window.createOutputChannel("Extension Name");
logger.initialize(outputChannel);
```

**Important**: Must be called during extension activation before any logging occurs.

#### `error(provider: string, context: string, error: unknown): void`

Log an error with consistent formatting.

**Parameters**:
- `provider`: Provider/service name (e.g., "GitHub", "GitLab", "Git")
- `context`: Brief description of what failed (e.g., "API request failed")
- `error`: The error object (any type)

**Format**: `ERROR: [Provider] Context: Message`

**Example**:
```typescript
try {
  await fetchData();
} catch (error) {
  logger.error("GitHub", "API request failed", error);
}
```

**Output**:
```
ERROR: [GitHub] API request failed: Network timeout
```

#### `warn(provider: string, context: string, message: string): void`

Log a warning message.

**Parameters**:
- `provider`: Provider/service name
- `context`: Brief description
- `message`: Warning message

**Format**: `WARN: [Provider] Context: Message`

**Example**:
```typescript
logger.warn("Cache", "TTL configuration", "Cache disabled (TTL = 0)");
```

#### `info(message: string): void`

Log an informational message.

**Parameters**:
- `message`: Info message

**Example**:
```typescript
logger.info("Cache cleared (15 entries)");
```

### Why Use ErrorLogger?

- ✅ **Consistent Format**: All logs follow `[Provider] Context: Message` format
- ✅ **Output Channel Integration**: Logs appear in VS Code Output panel
- ✅ **Centralized**: Single place to modify logging behavior
- ✅ **ESLint Compliance**: Avoids direct `console.*` usage (enforced by `no-console` rule)
- ✅ **Easier Debugging**: All logs in one place with consistent formatting

### ESLint Configuration

The `no-console` ESLint rule is enforced to prevent direct console usage:

```json
{
  "rules": {
    "no-console": "error"
  }
}
```

All code (including `ErrorLogger`) must avoid using `console.*` directly. All logging goes through the VS Code Output Channel.

---

## CacheService

**Location**: `src/services/CacheService.ts`

TTL-based cache for commit SHA to MR mappings. Implements `ICacheService` interface.

### Constructor

```typescript
const cacheService = new CacheService();
```

Reads `gitlabBlame.cacheTTL` from VS Code configuration (default: 3600 seconds).

### Cache Key Format

**Cache keys use format**: `{providerId}:{sha}`

**Examples**:
- `gitlab:abc123def456` - GitLab commit
- `github:abc123def456` - GitHub commit

**Why**: Prevents cache collisions when the same commit SHA exists in both GitLab and GitHub repositories (e.g., mirrored repos).

### Methods

#### `initialize(gitApi: API | undefined): void`

Set up cache with Git API watchers for auto-invalidation.

**Parameters**:
- `gitApi`: VS Code Git API instance (from `GitService.getAPI()`)

**Auto-invalidation**: Cache clears on any repository state change (pull, fetch, checkout, commit).

#### `get(providerId: string, sha: string): MergeRequest | null | undefined`

Get cached MR for a commit.

**Parameters**:
- `providerId`: VCS provider identifier (e.g., "gitlab", "github")
- `sha`: Commit SHA

**Returns**:
- `MergeRequest`: Cached MR data
- `null`: Cached as "no MR exists"
- `undefined`: Not in cache or expired

**Example**:
```typescript
const cached = cacheService.get("github", "abc123");
if (cached === null) {
  console.log("Commit has no PR (cached)");
} else if (cached === undefined) {
  console.log("Not in cache");
} else {
  console.log("PR:", cached);
}
```

#### `set(providerId: string, sha: string, mr: MergeRequest | null): void`

Cache an MR (or `null` for "no MR").

**Parameters**:
- `providerId`: VCS provider identifier
- `sha`: Commit SHA
- `mr`: MR data or `null` if commit has no MR

Does nothing if TTL is 0 (caching disabled).

**Example**:
```typescript
// Cache a PR
cacheService.set("github", "abc123", prData);

// Cache "no PR exists"
cacheService.set("github", "def456", null);
```

#### `has(providerId: string, sha: string): boolean`

Check if SHA is cached and not expired for a specific provider.

**Parameters**:
- `providerId`: VCS provider identifier
- `sha`: Commit SHA

#### `clear(): void`

Clear all cached entries (for all providers).

#### `size: number` (getter)

Get current cache entry count (across all providers).

#### `dispose(): void`

Clean up watchers and clear cache.

---

## HoverContentService

**Location**: `src/services/HoverContentService.ts`

Stateless service for formatting hover content (MR links, blame info, relative dates). Used by both `BlameHoverProvider` and `BlameDecorationProvider` to ensure consistent hover content formatting.

### Interface

**Location**: `src/interfaces/IHoverContentService.ts`

```typescript
interface IHoverContentService {
  formatRichHoverContent(
    mr: MergeRequest | null,
    blameInfo: BlameInfo,
    providerId: VcsProviderId | undefined,
    options?: RichHoverContentOptions,
  ): string;
  escapeMarkdown(text: string): string;
  formatRelativeDate(date: Date): string;
  getMrPrefix(providerId: VcsProviderId): string;
}

interface RichHoverContentOptions {
  loading?: boolean;  // Whether MR data is still loading
  checked?: boolean;  // Whether MR lookup was completed
}
```

### Constructor

```typescript
const hoverContentService = new HoverContentService();
```

No dependencies - this is a stateless service with pure formatting functions.

### Methods

#### `getMrPrefix(providerId: VcsProviderId): string`

Get the MR/PR prefix for a provider.

**Parameters**:
- `providerId`: VCS provider identifier ("gitlab" or "github")

**Returns**: `"!"` for GitLab, `"#"` for GitHub.

**Example**:
```typescript
const prefix = hoverContentService.getMrPrefix("gitlab"); // "!"
const prefix = hoverContentService.getMrPrefix("github"); // "#"
```

#### `escapeMarkdown(text: string): string`

Escape special markdown characters in text to prevent rendering issues.

**Parameters**:
- `text`: Text to escape

**Returns**: Escaped text safe for markdown.

**Example**:
```typescript
hoverContentService.escapeMarkdown("Fix *bold* issue");
// Returns: "Fix \\*bold\\* issue"
```

#### `formatRelativeDate(date: Date): string`

Format a date as human-readable relative time.

**Parameters**:
- `date`: Date to format

**Returns**: Relative time string (e.g., "2 days ago", "just now").

**Example**:
```typescript
const date = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
hoverContentService.formatRelativeDate(date); // "2 days ago"
```

#### `formatRichHoverContent(mr, blameInfo, providerId, options?): string`

Format rich hover content with MR link, SHA, author, date, and commit summary.

**Parameters**:
- `mr`: Merge request data (or `null` if no MR)
- `blameInfo`: Git blame information
- `providerId`: Provider ID for MR link prefix (can be `undefined`)
- `options`: Optional loading/checked state

**Returns**: Multi-line markdown string.

**Example**:
```typescript
const content = hoverContentService.formatRichHoverContent(
  mr,
  blameInfo,
  "gitlab",
  { loading: false, checked: true }
);
// Returns:
// **Merge Request**: [!42 Test MR](url)
//
// `abc123d` by John Doe • 2 days ago
//
// *Fix authentication bug*
```

**Output variations**:
- With MR: Shows MR link, commit info, and summary
- Loading state: Shows "*Loading merge request...*" instead of MR link
- No MR (checked): Shows "*No associated merge request*"

### Usage

Both providers inject `HoverContentService` via constructor:

```typescript
// In extension.ts
const hoverContentService = new HoverContentService();

const hoverProvider = new BlameHoverProvider(
  gitService,
  vcsProviderFactory,
  cacheService,
  hoverContentService,  // Shared service
  handleVcsError,
);

const decorationProvider = new BlameDecorationProvider(
  gitService,
  vcsProviderFactory,
  cacheService,
  hoverContentService,  // Same instance
  displayMode,
  handleVcsError,
);
```

### Design Notes

- **Stateless**: All methods are pure functions - no internal state
- **Returns strings**: Service returns raw markdown strings; providers create `vscode.MarkdownString` and set `isTrusted`/`supportHtml` as needed
- **Provider-agnostic prefix**: Accepts `VcsProviderId` to determine correct prefix
- **Single source of truth**: Both providers use same formatting logic

---


```typescript
// Old (deprecated)
enum GitLabErrorType { ... }

// New
enum VcsErrorType {
  NoToken = "NO_TOKEN",
  InvalidToken = "INVALID_TOKEN",
  RateLimited = "RATE_LIMITED",
  NetworkError = "NETWORK_ERROR",
  NotFound = "NOT_FOUND",
  Unknown = "UNKNOWN",
}
```

---

## Type Definitions

**Location**: `src/interfaces/types.ts` (also re-exported from `src/types/index.ts`)

### MergeRequest

```typescript
interface MergeRequest {
  iid: number;           // MR number within project
  title: string;         // MR title
  webUrl: string;        // Full URL to MR page
  mergedAt: string | null; // ISO timestamp or null
  state: string;         // "merged", "opened", "closed"
}
```

### BlameInfo

```typescript
interface BlameInfo {
  sha: string;           // Full commit SHA
  author: string;        // Author name
  authorEmail: string;   // Author email
  date: Date;            // Commit date
  summary: string;       // Commit message first line
  line: number;          // 1-based line number
}
```

### RemoteInfo

```typescript
interface RemoteInfo {
  host: string;          // e.g., "https://gitlab.com"
  projectPath: string;   // e.g., "group/project"
  provider: string;      // e.g., "gitlab"
}
```

### VcsResult

```typescript
interface VcsResult<T> {
  success: boolean;
  data?: T;
  error?: VcsError;
}
```

### VcsError

```typescript
interface VcsError {
  type: VcsErrorType;
  message: string;
  statusCode?: number;
  shouldShowUI?: boolean;
}
```

### GitLabMR

Internal type matching GitLab API response:

```typescript
interface GitLabMR {
  id: number;
  iid: number;
  title: string;
  web_url: string;
  state: string;
  merged_at: string | null;
  author?: {
    name: string;
    username: string;
  };
}
```

### GitHubPR

Internal type matching GitHub API response:

```typescript
interface GitHubPR {
  id: number;
  number: number;
  title: string;
  html_url: string;
  state: string;
  merged_at: string | null;
  user?: {
    login: string;
  };
}
```

**Note**: Both `GitLabMR` and `GitHubPR` are mapped to the common `MergeRequest` type for internal use.
