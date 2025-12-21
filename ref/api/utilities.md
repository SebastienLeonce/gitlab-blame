# Utilities API Reference

## Remote Parser

**Location**: `src/utils/remoteParser.ts`

Utilities for parsing git remote URLs to extract GitLab project information.

### Types

#### `GitLabRemoteInfo`

```typescript
interface GitLabRemoteInfo {
  host: string;        // Full URL (e.g., "https://gitlab.com")
  projectPath: string; // Project path (e.g., "group/subgroup/project")
}
```

### Functions

#### `parseGitLabRemote(remoteUrl: string): GitLabRemoteInfo | null`

Extract GitLab host and project path from a git remote URL.

**Parameters**:
- `remoteUrl`: Git remote URL (SSH or HTTPS format)

**Returns**: `GitLabRemoteInfo` or `null` if URL cannot be parsed.

**Supported Formats**:

| Format | Example | Result |
|--------|---------|--------|
| SSH | `git@gitlab.com:group/project.git` | `{ host: "https://gitlab.com", projectPath: "group/project" }` |
| HTTPS | `https://gitlab.com/group/project.git` | `{ host: "https://gitlab.com", projectPath: "group/project" }` |
| Nested Groups | `git@gitlab.com:a/b/c/project.git` | `{ host: "https://gitlab.com", projectPath: "a/b/c/project" }` |
| Self-hosted | `git@gitlab.mycompany.com:team/app.git` | `{ host: "https://gitlab.mycompany.com", projectPath: "team/app" }` |

**Examples**:

```typescript
// SSH format
parseGitLabRemote('git@gitlab.com:group/project.git');
// => { host: 'https://gitlab.com', projectPath: 'group/project' }

// HTTPS format
parseGitLabRemote('https://gitlab.example.com/org/team/project.git');
// => { host: 'https://gitlab.example.com', projectPath: 'org/team/project' }

// Self-hosted with nested groups
parseGitLabRemote('git@gitlab.enterprise.net:backend/services/api.git');
// => { host: 'https://gitlab.enterprise.net', projectPath: 'backend/services/api' }

// Invalid URL
parseGitLabRemote('not-a-url');
// => null
```

**Implementation Notes**:
- SSH URLs are matched with regex: `/^git@([^:]+):(.+?)(?:\.git)?$/`
- HTTPS URLs are parsed using `URL` constructor
- `.git` suffix is stripped from project paths
- Returns `null` for invalid URLs or empty paths

---

#### `extractProjectPath(remoteUrl: string): string | null`

Convenience function to get just the project path.

**Parameters**:
- `remoteUrl`: Git remote URL

**Returns**: Project path string or `null`.

**Example**:

```typescript
extractProjectPath('git@gitlab.com:mygroup/myproject.git');
// => 'mygroup/myproject'
```

---

#### `isGitLabRemote(remoteUrl: string): boolean`

Heuristic check if a URL appears to be a GitLab remote.

**Parameters**:
- `remoteUrl`: Git remote URL

**Returns**: `true` if the URL looks like a GitLab remote.

**Detection Logic**:
1. If URL contains "gitlab" (case-insensitive) → `true`
2. If URL parses successfully → `true` (could be self-hosted GitLab)
3. Otherwise → `false`

**Note**: This is intentionally permissive. Actual validation happens when the GitLab API is called.

**Example**:

```typescript
isGitLabRemote('git@gitlab.com:group/project.git');
// => true

isGitLabRemote('git@my-server.com:group/project.git');
// => true (could be self-hosted GitLab)

isGitLabRemote('not a url');
// => false
```
