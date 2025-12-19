# Services API Reference

## GitService

**Location**: `src/services/GitService.ts`

Wraps VS Code's built-in Git extension API for blame operations.

### Methods

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

## GitLabService

**Location**: `src/services/GitLabService.ts`

Client for GitLab REST API operations.

### Constructor

```typescript
const gitLabService = new GitLabService();
```

Reads `gitlabBlame.gitlabUrl` from VS Code configuration.

### Methods

#### `setToken(token: string | undefined): void`

Set the Personal Access Token for API authentication.

#### `hasToken(): boolean`

Check if a token is configured.

#### `getGitLabUrl(): string`

Get the configured GitLab instance URL.

#### `setGitLabUrl(url: string): void`

Update the GitLab URL (called when configuration changes).

#### `parseRemoteUrl(remoteUrl: string): GitLabRemoteInfo | null`

Parse a git remote URL to extract host and project path.

**Returns**:
```typescript
interface GitLabRemoteInfo {
  host: string;       // e.g., "https://gitlab.com"
  projectPath: string; // e.g., "group/project"
}
```

#### `getMergeRequestForCommit(projectPath: string, commitSha: string, gitlabHost?: string): Promise<MergeRequest | null>`

Fetch the MR associated with a commit.

**Parameters**:
- `projectPath`: GitLab project path (e.g., "group/project")
- `commitSha`: Full commit SHA
- `gitlabHost`: Optional GitLab host (uses configured URL if omitted)

**Returns**: `MergeRequest` object or `null` if not found.

**API Endpoint**: `GET /api/v4/projects/:id/repository/commits/:sha/merge_requests`

**MR Selection Logic**:
1. Filter to merged MRs with `merged_at` date
2. Sort by `merged_at` ascending
3. Return first (earliest merged)
4. Fallback: return first MR if none are merged

#### `resetTokenErrorFlag(): void`

Reset the error flag to allow showing token errors again.

---

## CacheService

**Location**: `src/services/CacheService.ts`

TTL-based cache for commit SHA to MR mappings.

### Constructor

```typescript
const cacheService = new CacheService();
```

Reads `gitlabBlame.cacheTTL` from VS Code configuration (default: 3600 seconds).

### Methods

#### `initialize(gitApi: API | undefined): void`

Set up cache with Git API watchers for auto-invalidation.

**Parameters**:
- `gitApi`: VS Code Git API instance (from `GitService.getAPI()`)

**Auto-invalidation**: Cache clears on any repository state change (pull, fetch, checkout, commit).

#### `get(sha: string): MergeRequest | null | undefined`

Get cached MR for a commit.

**Returns**:
- `MergeRequest`: Cached MR data
- `null`: Cached as "no MR exists"
- `undefined`: Not in cache or expired

#### `set(sha: string, mr: MergeRequest | null): void`

Cache an MR (or `null` for "no MR").

Does nothing if TTL is 0 (caching disabled).

#### `has(sha: string): boolean`

Check if SHA is cached and not expired.

#### `clear(): void`

Clear all cached entries.

#### `size: number` (getter)

Get current cache entry count.

#### `dispose(): void`

Clean up watchers and clear cache.

---

## Type Definitions

**Location**: `src/types/index.ts`

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
