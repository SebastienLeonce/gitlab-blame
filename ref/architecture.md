# Architecture Overview

GitLab Blame MR Link is a VS Code extension that adds GitLab Merge Request links to git blame hovers. The architecture supports multiple VCS providers through an abstraction layer.

## High-Level Design

```
┌──────────────────────────────────────────────────────────────────────────┐
│                            VS Code Host                                   │
│  ┌──────────────────────────────────┐  ┌───────────────────────────────┐ │
│  │     BlameHoverProvider           │  │   BlameDecorationProvider     │ │
│  │  (providers/BlameHoverProvider)  │  │ (providers/BlameDecoration    │ │
│  │  On-demand hover tooltips        │  │   Provider.ts)                │ │
│  │                                  │  │ Inline end-of-line            │ │
│  │                                  │  │   annotations                 │ │
│  └──────┬───────────┬───────────┬───┴──┴──┬───────────┬────────────┬──┘ │
│         │           │           │         │           │            │     │
│         │           │           └────┬────┘           │            │     │
│         │           │      ┌─────────▼─────────┐      │            │     │
│         │           │      │HoverContentService│      │            │     │
│         │           │      │ (Shared content   │      │            │     │
│         │           │      │  formatting)      │      │            │     │
│         │           │      └───────────────────┘      │            │     │
│  ┌──────▼─────┐ ┌───▼─────┐ ┌──────────────────┐ ┌────▼───────────▼┐   │
│  │ GitService │ │  Cache  │ │VcsProviderFactory│ │   TokenService  │   │
│  │(services/) │ │ Service │ │    (services/)   │ │   (services/)   │   │
│  └──────┬─────┘ └───┬─────┘ └──┬───────────────┘ └─────────────────┘   │
│         │           │           │                                       │
│         │           │      ┌────▼────┐  ┌────────┐                     │
│  ┌──────▼─────┐ ┌───▼───┐  │ GitLab  │  │ GitHub │                     │
│  │ vscode.git │ │In-Mem │  │Provider │  │Provider│                     │
│  │ Extension  │ │ Cache │  │ (vcs/)  │  │ (vcs/) │                     │
│  └────────────┘ └───────┘  └────┬────┘  └───┬────┘                     │
│                                 │           │                           │
│                           ┌─────▼────┐ ┌────▼─────┐                    │
│                           │ GitLab   │ │ GitHub   │                    │
│                           │   API    │ │   API    │                    │
│                           │ (fetch)  │ │ (fetch)  │                    │
│                           └──────────┘ └──────────┘                    │
└──────────────────────────────────────────────────────────────────────────┘
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

### BlameDecorationProvider (`src/providers/BlameDecorationProvider.ts`)

- Provides inline end-of-line decorations showing MR/PR links
- Activated conditionally based on `displayMode` setting (inline or both)
- **Active Line Only Mode**: Decoration follows cursor, showing MR/PR link only on the currently active line
  - Previous decoration disappears when cursor moves to a new line
  - New decoration appears instantly (cache hit) or after API fetch (cache miss)
- **Cursor Movement Tracking**: Updates decoration when cursor moves (100ms debounce)
- Uses VS Code TextEditorDecorationType API for inline annotations
- Debounces file changes (500ms) to prevent excessive updates
- Only shows decoration on lines with associated MR/PR
- Shares cache with BlameHoverProvider (no duplicate API calls)
- Format: `!123` for GitLab, `#456` for GitHub
- **Display Mode Behavior**:
  - `inline` mode: Decorations include `hoverMessage` (only decoration provider active)
  - `hover` mode: Decorations include `hoverMessage` (fallback if hover provider fails)
  - `both` mode: Decorations **omit** `hoverMessage` to prevent duplication (HoverProvider handles tooltips)
- Delegates error UI to extension via `VcsErrorHandler` callback

### HoverContentService (`src/services/HoverContentService.ts`)

- Stateless service for formatting hover content (MR links, blame info, relative dates)
- Implements `IHoverContentService` interface
- **Single source of truth** for hover content formatting across all providers
- Used by both `BlameHoverProvider` and `BlameDecorationProvider`
- **Methods**:
  - `getMrPrefix(providerId)` - Returns `!` for GitLab, `#` for GitHub
  - `escapeMarkdown(text)` - Escapes special markdown characters
  - `formatRelativeDate(date)` - Formats dates as human-readable relative time
  - `formatSimpleMrLink(mr, providerId)` - Simple link: `[!123: Title](url)`
  - `formatRichHoverContent(mr, blameInfo, providerId, options)` - Full rich content with MR link, SHA, author, date, summary
- **Design Notes**:
  - Returns raw markdown strings (providers create `vscode.MarkdownString`)
  - No internal state - all methods are pure functions
  - Providers decide when/whether to show content

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
- Supports multiple providers (GitLab, GitHub, future: Bitbucket)

### TokenService (`src/services/TokenService.ts`)

- Manages authentication tokens for multiple VCS providers
- Uses VS Code's `SecretStorage` for secure storage
- Loads/saves tokens per provider ID
- Supports GitLab and GitHub tokens
- Backwards compatible with existing GitLab token storage

### GitLabProvider (`src/providers/vcs/GitLabProvider.ts`)

- Implements `IVcsProvider` interface for GitLab
- Calls GitLab REST API to fetch MRs associated with commits
- Uses `PRIVATE-TOKEN` header for authentication
- Returns `VcsResult` with data or error (no direct UI)
- Handles API errors (401, 403, 404, 429)
- Selects appropriate MR when multiple exist (first merged by date)
- Supports self-hosted GitLab instances via `gitlabBlame.gitlabUrl` setting

### GitHubProvider (`src/providers/vcs/GitHubProvider.ts`)

- Implements `IVcsProvider` interface for GitHub
- Calls GitHub REST API v3 to fetch PRs associated with commits
- Uses `Authorization: token <pat>` header for authentication
- Requires `Accept: application/vnd.github.v3+json` header
- Returns `VcsResult` with data or error (no direct UI)
- Handles API errors (401, 403, 404, 429)
- Selects appropriate PR when multiple exist (first merged by date)
- Supports GitHub.com and GitHub Enterprise Server
- Enterprise detection via hostname matching or config-based detection
- Configurable via `gitlabBlame.githubUrl` setting

### CacheService (`src/services/CacheService.ts`)

- Implements `ICacheService` interface
- Caches commit SHA → MergeRequest mappings with provider isolation
- **Cache key format**: `{providerId}:{sha}` (e.g., `gitlab:abc123`, `github:abc123`)
- Prevents collisions when same SHA exists in both GitLab and GitHub repos
- TTL-based expiration (configurable, default 3600s)
- Automatic invalidation on git operations (pull, fetch, checkout, commit)
- Watches repository state changes via Git API
- Caches `null` to avoid repeated API calls for commits without MRs

### Remote URL Parser (`src/utils/remoteParser.ts`)

- Extracts VCS host and project path from git remote URLs
- **GitLab Support**:
  - SSH format: `git@gitlab.com:group/project.git`
  - HTTPS format: `https://gitlab.com/group/project.git`
  - Handles nested groups: `group/subgroup/project`
- **GitHub Support**:
  - SSH format: `git@github.com:owner/repo.git`
  - HTTPS format: `https://github.com/owner/repo.git`
  - GitHub Enterprise: Custom domain support

## Data Flow

### Hover Mode

1. **User hovers over a line**
2. **BlameHoverProvider.provideHover()** called by VS Code
3. **GitService.getBlameForLine()** fetches blame via vscode.git API
4. **CacheService.get(providerId, sha)** checks for cached MR using provider-specific key
5. If not cached:
   - Get git remote URL from GitService
   - **VcsProviderFactory.detectProvider()** finds matching provider (GitLab or GitHub)
   - **Provider.getMergeRequestForCommit()** calls VCS API
   - On error, **VcsErrorHandler** callback shows UI
   - Result cached with TTL using key format `{providerId}:{sha}`
6. **Hover markdown** returned with MR/PR link, commit SHA, author, date, message

### Inline Mode (Active Line Only)

1. **File opens, content changes, or cursor moves** (debounced 100-500ms)
2. **BlameDecorationProvider.updateActiveLineDecoration()** triggered
3. **Clear all existing decorations** (only one decoration visible at a time)
4. **Get active line** from cursor position
5. **GitService.getBlameForLine()** fetches blame for single line
6. **CacheService.get(providerId, sha)** checks cache (fast path)
7. If cache miss: **Provider.getMergeRequestForCommit()** fetches from API
8. **editor.setDecorations()** applies single decoration for active line
9. **Cursor Movement** (debounced 100ms):
   - Track cursor position changes
   - Previous decoration automatically cleared
   - New decoration applied for new active line

## Key Design Decisions

### Provider Abstraction

VCS providers implement `IVcsProvider` interface, enabling support for GitLab, GitHub, and Bitbucket. The factory pattern allows runtime provider detection based on remote URL.

### Dual-Provider Architecture (Hover + Inline)

BlameHoverProvider and BlameDecorationProvider are separate classes with distinct lifecycles:
- **Hover**: On-demand, triggered by user hover events
- **Inline**: Active line only, follows cursor position

Both share the same service instances (GitService, CacheService, VcsProviderFactory) for consistency and cache reuse. Providers are conditionally activated based on `displayMode` setting.

### Active Line Only for Inline Decorations

BlameDecorationProvider shows the MR/PR decoration only on the currently active line:

**Why Active Line Only?**
- Minimizes visual clutter (only one decoration visible at a time)
- Decoration follows cursor, showing context for the line being worked on
- Fast response time (<100ms cache hit, ~300ms cache miss)
- Clean user experience without persistent decorations

**Behavior**:
- When cursor moves to a new line, old decoration disappears
- New decoration appears on the active line (instant if cached)
- Debounced (100ms) to avoid flickering during rapid cursor movement

### Configurable Display Modes

Users can choose how to view MR/PR information:
- **hover**: Tooltips only (minimal visual clutter)
- **inline**: End-of-line decorations (always visible, no hover needed, default)
- **both**: Inline + tooltips (maximum visibility)

Changing display mode requires window reload to re-register providers.

### Services Return Data, Not UI

All VCS operations return `VcsResult<T>` instead of showing dialogs directly. The extension's error handler decides when and how to show UI. This improves testability and separation of concerns.

### Zero Runtime Dependencies

The extension uses only VS Code APIs and native fetch. This keeps the bundle small and avoids dependency vulnerabilities.

### VS Code Git API vs Process Spawning

Uses VS Code's Git extension API (`vscode.git`) instead of spawning `git` processes. This is more secure, faster, and provides typed interfaces.

### TTL Cache with Auto-Invalidation and Provider Isolation

The cache invalidates automatically on repository state changes (detected via vscode.git events). This ensures data freshness after git operations without manual intervention.

Cache keys include provider ID (`{providerId}:{sha}`) to prevent collisions when the same commit SHA exists in both GitLab and GitHub repositories (e.g., mirrored repos).

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
│   ├── IHoverContentService.ts      # Hover content service interface
│   ├── IVcsProvider.ts              # VCS provider interface
│   ├── index.ts                     # Barrel exports
│   └── types.ts                     # Shared type definitions
├── providers/
│   ├── BlameDecorationProvider.ts   # Inline decoration provider
│   ├── BlameHoverProvider.ts        # Hover tooltip provider
│   └── vcs/
│       ├── GitHubProvider.ts        # GitHub VCS provider
│       └── GitLabProvider.ts        # GitLab VCS provider
├── services/
│   ├── CacheService.ts              # TTL cache with auto-invalidation
│   ├── GitService.ts                # VS Code Git API wrapper
│   ├── HoverContentService.ts       # Shared hover content formatting
│   ├── TokenService.ts              # Multi-provider token management
│   └── VcsProviderFactory.ts        # Provider registry and detection
├── types/
│   ├── git.d.ts                     # VS Code Git extension types
│   └── index.ts                     # Re-exports from interfaces
└── utils/
    └── remoteParser.ts              # Git remote URL parser (GitLab + GitHub)
```

## Build Configuration

- **Bundler**: esbuild (fast, produces small bundles)
- **Target**: CommonJS (required for VS Code extensions)
- **External**: `vscode` module (provided by VS Code runtime)
- **Output**: Single bundled file at `dist/extension.js`

## Quality Assurance

The project uses automated quality gates (git hooks, testing, coverage) to maintain code quality.

**📖 For complete documentation**, see `ref/quality-assurance.md`:
- Git hooks (pre-commit, pre-push)
- Test philosophy and coverage requirements
- Code quality standards
- Commit message format
- Development workflow

**Quick Summary**:
- 325 tests total: 304 unit (~514ms), 21 E2E (~29s), 93%+ coverage
- Pre-commit: ESLint + TypeScript type check
- Pre-push: Tests + coverage (90%/85% thresholds) + build
- Tools: TypeScript (strict), ESLint, Mocha, Sinon, c8, Husky
