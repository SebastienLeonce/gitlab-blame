# Architecture Overview

GitLab Blame MR Link is a VS Code extension that adds GitLab Merge Request links to git blame hovers. The architecture supports multiple VCS providers through an abstraction layer.

## High-Level Design

```
┌─────────────────────────────────────────────────────────────────────┐
│                         VS Code Host                                 │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                  BlameHoverProvider                          │    │
│  │             (providers/BlameHoverProvider.ts)               │    │
│  │        Registers for all files, builds hover content        │    │
│  └──────────┬──────────────┬──────────────┬────────────────────┘    │
│             │              │              │                          │
│      ┌──────▼─────┐ ┌──────▼─────┐ ┌──────▼──────────────┐         │
│      │ GitService │ │CacheService│ │ VcsProviderFactory  │         │
│      │(services/) │ │(services/) │ │    (services/)      │         │
│      └──────┬─────┘ └──────┬─────┘ └──────┬──────────────┘         │
│             │              │              │                          │
│      ┌──────▼─────┐ ┌──────▼─────┐ ┌──────▼──────────────┐         │
│      │ vscode.git │ │  In-Memory │ │   GitLabProvider    │         │
│      │ Extension  │ │   Cache    │ │  (providers/vcs/)   │         │
│      └────────────┘ └────────────┘ └──────┬──────────────┘         │
│                                           │                          │
│                                    ┌──────▼──────────────┐         │
│                                    │    GitLab API       │         │
│                                    │     (fetch)         │         │
│                                    └─────────────────────┘         │
└─────────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

### Extension Entry Point (`src/extension.ts`)

- Initializes all services on activation
- Creates `VcsProviderFactory` and registers providers
- Registers the hover provider for all file types
- Registers extension commands (setToken, deleteToken, clearCache, showStatus)
- Manages lifecycle (activate/deactivate)
- Listens for configuration and secret changes
- Handles VCS errors via `handleVcsError()` callback

### BlameHoverProvider (`src/providers/BlameHoverProvider.ts`)

- Implements `vscode.HoverProvider` interface
- Triggered when user hovers over a line in any file
- Coordinates between GitService, CacheService, and VcsProviderFactory
- Uses factory to auto-detect appropriate VCS provider from remote URL
- Formats hover content as Markdown with MR/PR links
- Handles pending request deduplication to avoid duplicate API calls
- Supports cancellation tokens for responsive UI
- Delegates error UI to extension via `VcsErrorHandler` callback

### GitService (`src/services/GitService.ts`)

- Wraps VS Code's built-in Git extension API (`vscode.git`)
- Provides blame information for files and lines
- Parses git blame porcelain format output
- Retrieves remote URL for VCS API calls
- No external dependencies - uses VS Code's Git API

### VcsProviderFactory (`src/services/VcsProviderFactory.ts`)

- Registry for VCS provider implementations
- Auto-detects provider from git remote URL
- Returns appropriate provider for making API calls
- Supports multiple providers (GitLab, future: GitHub, Bitbucket)

### TokenService (`src/services/TokenService.ts`)

- Manages authentication tokens for multiple VCS providers
- Uses VS Code's `SecretStorage` for secure storage
- Loads/saves tokens per provider ID
- Backwards compatible with existing GitLab token storage

### GitLabProvider (`src/providers/vcs/GitLabProvider.ts`)

- Implements `IVcsProvider` interface for GitLab
- Calls GitLab REST API to fetch MRs associated with commits
- Uses `PRIVATE-TOKEN` header for authentication
- Returns `VcsResult` with data or error (no direct UI)
- Handles API errors (401, 403, 404, 429)
- Selects appropriate MR when multiple exist (first merged by date)

### CacheService (`src/services/CacheService.ts`)

- Implements `ICacheService` interface
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
   - Get git remote URL from GitService
   - **VcsProviderFactory.detectProvider()** finds matching provider
   - **Provider.getMergeRequestForCommit()** calls VCS API
   - On error, **VcsErrorHandler** callback shows UI
   - Result cached with TTL
6. **Hover markdown** returned with MR link, commit SHA, author, date, message

## Key Design Decisions

### Provider Abstraction

VCS providers implement `IVcsProvider` interface, enabling support for GitLab, GitHub, and Bitbucket. The factory pattern allows runtime provider detection based on remote URL.

### Services Return Data, Not UI

All VCS operations return `VcsResult<T>` instead of showing dialogs directly. The extension's error handler decides when and how to show UI. This improves testability and separation of concerns.

### Zero Runtime Dependencies

The extension uses only VS Code APIs and native fetch. This keeps the bundle small and avoids dependency vulnerabilities.

### VS Code Git API vs Process Spawning

Uses VS Code's Git extension API (`vscode.git`) instead of spawning `git` processes. This is more secure, faster, and provides typed interfaces.

### TTL Cache with Auto-Invalidation

The cache invalidates automatically on repository state changes (detected via vscode.git events). This ensures data freshness after git operations without manual intervention.

### MR Selection Strategy

When a commit has multiple associated MRs, the extension selects the first merged MR by `merged_at` date. Falls back to any MR if none are merged.

### Single Error Message

Token errors use `shouldShowUI` flag to show once per session, avoiding message spam. The provider tracks error state internally.

### Secure Token Storage

Uses VS Code's `SecretStorage` API via `TokenService` for Personal Access Tokens, which provides secure, encrypted storage managed by VS Code.

## File Structure

```
src/
├── constants.ts                     # Config keys, commands, defaults
├── extension.ts                     # Entry point, command registration
├── interfaces/
│   ├── ICacheService.ts             # Cache service interface
│   ├── IVcsProvider.ts              # VCS provider interface
│   ├── index.ts                     # Barrel exports
│   └── types.ts                     # Shared type definitions
├── providers/
│   ├── BlameHoverProvider.ts        # Hover provider implementation
│   └── vcs/
│       └── GitLabProvider.ts        # GitLab VCS provider
├── services/
│   ├── CacheService.ts              # TTL cache with auto-invalidation
│   ├── GitLabService.ts             # @deprecated - use GitLabProvider
│   ├── GitService.ts                # VS Code Git API wrapper
│   ├── TokenService.ts              # Multi-provider token management
│   └── VcsProviderFactory.ts        # Provider registry and detection
├── types/
│   ├── git.d.ts                     # VS Code Git extension types
│   └── index.ts                     # Re-exports from interfaces
└── utils/
    └── remoteParser.ts              # Git remote URL parser
```

## Build Configuration

- **Bundler**: esbuild (fast, produces small bundles)
- **Target**: CommonJS (required for VS Code extensions)
- **External**: `vscode` module (provided by VS Code runtime)
- **Output**: Single bundled file at `dist/extension.js`
