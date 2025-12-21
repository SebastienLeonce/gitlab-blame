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

## GitLabService (Deprecated)

> **⚠️ Deprecated**: Use `GitLabProvider` from `src/providers/vcs/GitLabProvider.ts` instead.
> This service will be removed in a future version.

**Location**: `src/services/GitLabService.ts`

**Migration**:
- `GitLabService.getMergeRequestForCommit()` → `GitLabProvider.getMergeRequestForCommit()`
- `GitLabService.parseRemoteUrl()` → `GitLabProvider.parseRemoteUrl()`
- Error handling now returns `VcsResult` instead of showing UI directly

### Error Types (Deprecated)

Use `VcsErrorType` from `src/interfaces/types.ts` instead.

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
