# Architecture Overview

GitLab Blame MR Link is a VS Code extension that adds GitLab Merge Request links to git blame hovers.

## High-Level Design

```
┌─────────────────────────────────────────────────────────────┐
│                    VS Code Host                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              BlameHoverProvider                      │    │
│  │         (providers/BlameHoverProvider.ts)           │    │
│  │    Registers for all files, builds hover content    │    │
│  └───────────┬──────────────┬──────────────┬───────────┘    │
│              │              │              │                 │
│       ┌──────▼─────┐ ┌──────▼─────┐ ┌──────▼─────┐         │
│       │ GitService │ │CacheService│ │GitLabService│         │
│       │(services/) │ │(services/) │ │ (services/) │         │
│       └──────┬─────┘ └──────┬─────┘ └──────┬─────┘         │
│              │              │              │                 │
│       ┌──────▼─────┐ ┌──────▼─────┐ ┌──────▼─────┐         │
│       │ vscode.git │ │  In-Memory │ │ GitLab API │         │
│       │ Extension  │ │   Cache    │ │  (fetch)   │         │
│       └────────────┘ └────────────┘ └────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

### Extension Entry Point (`src/extension.ts`)

- Initializes all services on activation
- Registers the hover provider for all file types
- Registers extension commands (setToken, deleteToken, clearCache, showStatus)
- Manages lifecycle (activate/deactivate)
- Listens for configuration and secret changes

### BlameHoverProvider (`src/providers/BlameHoverProvider.ts`)

- Implements `vscode.HoverProvider` interface
- Triggered when user hovers over a line in any file
- Coordinates between GitService, CacheService, and GitLabService
- Formats hover content as Markdown with MR links
- Handles pending request deduplication to avoid duplicate API calls
- Supports cancellation tokens for responsive UI

### GitService (`src/services/GitService.ts`)

- Wraps VS Code's built-in Git extension API (`vscode.git`)
- Provides blame information for files and lines
- Parses git blame porcelain format output
- Retrieves remote URL for GitLab API calls
- No external dependencies - uses VS Code's Git API

### GitLabService (`src/services/GitLabService.ts`)

- Calls GitLab REST API to fetch MRs associated with commits
- Uses `PRIVATE-TOKEN` header for authentication
- Handles API errors (401, 403, 404, 429)
- Selects appropriate MR when multiple exist (first merged by date)
- Shows user-friendly error messages for token issues

### CacheService (`src/services/CacheService.ts`)

- Caches commit SHA → MergeRequest mappings
- TTL-based expiration (configurable, default 3600s)
- Automatic invalidation on git operations (pull, fetch, checkout, commit)
- Watches repository state changes via Git API
- Caches `null` to avoid repeated API calls for commits without MRs

### Remote URL Parser (`src/utils/remoteParser.ts`)

- Extracts GitLab host and project path from git remote URLs
- Supports SSH format: `git@gitlab.com:group/project.git`
- Supports HTTPS format: `https://gitlab.com/group/project.git`
- Handles nested groups: `group/subgroup/project`

## Data Flow

1. **User hovers over a line**
2. **BlameHoverProvider.provideHover()** called by VS Code
3. **GitService.getBlameForLine()** fetches blame via vscode.git API
4. **CacheService.get()** checks for cached MR
5. If not cached:
   - Extract project path from git remote
   - **GitLabService.getMergeRequestForCommit()** calls GitLab API
   - Result cached with TTL
6. **Hover markdown** returned with MR link, commit SHA, author, date, message

## Key Design Decisions

### Zero Runtime Dependencies

The extension uses only VS Code APIs and native fetch. This keeps the bundle small and avoids dependency vulnerabilities.

### VS Code Git API vs Process Spawning

Uses VS Code's Git extension API (`vscode.git`) instead of spawning `git` processes. This is more secure, faster, and provides typed interfaces.

### TTL Cache with Auto-Invalidation

The cache invalidates automatically on repository state changes (detected via vscode.git events). This ensures data freshness after git operations without manual intervention.

### MR Selection Strategy

When a commit has multiple associated MRs, the extension selects the first merged MR by `merged_at` date. Falls back to any MR if none are merged.

### Single Error Message

Token errors are shown once per session to avoid message spam. The `hasShownTokenError` flag prevents repeated notifications.

### Secure Token Storage

Uses VS Code's `SecretStorage` API for Personal Access Tokens, which provides secure, encrypted storage managed by VS Code.

## File Structure

```
src/
├── extension.ts                 # Entry point, command registration
├── providers/
│   └── BlameHoverProvider.ts    # Hover provider implementation
├── services/
│   ├── CacheService.ts          # TTL cache with auto-invalidation
│   ├── GitLabService.ts         # GitLab API client
│   └── GitService.ts            # VS Code Git API wrapper
├── types/
│   ├── git.d.ts                 # VS Code Git extension types
│   └── index.ts                 # Internal type definitions
└── utils/
    └── remoteParser.ts          # Git remote URL parser
```

## Build Configuration

- **Bundler**: esbuild (fast, produces small bundles)
- **Target**: CommonJS (required for VS Code extensions)
- **External**: `vscode` module (provided by VS Code runtime)
- **Output**: Single bundled file at `dist/extension.js`
