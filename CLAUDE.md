# GitLab Blame MR Link - Project Context

VS Code extension that adds GitLab Merge Request links to git blame hovers. Supports multi-provider architecture for future GitHub/Bitbucket support.

## Quick Reference

| Resource | Path |
|----------|------|
| Architecture | `ref/architecture.md` |
| Services API | `ref/api/services.md` |
| Providers API | `ref/api/providers.md` |
| Utilities API | `ref/api/utilities.md` |
| Configuration | `ref/configuration.md` |
| Code Patterns | `ref/patterns.md` |
| Multi-Provider Guide | `ref/multi-provider.md` |

## Project Structure

```
src/
├── constants.ts                     # Config keys, commands, defaults
├── extension.ts                     # Entry point, commands, error handling
├── interfaces/
│   ├── ICacheService.ts             # Cache service interface
│   ├── IVcsProvider.ts              # VCS provider interface
│   ├── index.ts                     # Barrel exports
│   └── types.ts                     # Shared type definitions
├── providers/
│   ├── BlameHoverProvider.ts        # Hover tooltip logic
│   └── vcs/
│       └── GitLabProvider.ts        # GitLab VCS provider
├── services/
│   ├── CacheService.ts              # TTL cache (implements ICacheService)
│   ├── GitLabService.ts             # @deprecated - use GitLabProvider
│   ├── GitService.ts                # vscode.git wrapper
│   ├── TokenService.ts              # Multi-provider token management
│   └── VcsProviderFactory.ts        # Provider registry and detection
├── types/
│   ├── git.d.ts                     # VS Code Git API types
│   └── index.ts                     # Re-exports from interfaces
└── utils/
    └── remoteParser.ts              # Git URL parser
```

## Commands

```bash
npm run build      # Production build (esbuild, minified)
npm run watch      # Development watch mode
npm run lint       # ESLint check
npm run lint:fix   # Auto-fix lint issues
npm run typecheck  # TypeScript type checking
npm run pretest    # Compile tests
npm test           # Run tests
```

## Key Files

| File | Purpose |
|------|---------|
| `src/extension.ts` | Extension entry, command registration, error UI handling |
| `src/providers/BlameHoverProvider.ts` | Hover tooltip logic, provider-agnostic |
| `src/providers/vcs/GitLabProvider.ts` | GitLab API implementation |
| `src/services/VcsProviderFactory.ts` | Provider registry and auto-detection |
| `src/services/TokenService.ts` | Multi-provider token management |
| `src/services/CacheService.ts` | SHA → MR cache |
| `src/interfaces/IVcsProvider.ts` | Provider interface contract |
| `package.json` | Extension manifest, settings schema |

## Configuration Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `gitlabBlame.gitlabUrl` | `https://gitlab.com` | GitLab instance URL |
| `gitlabBlame.cacheTTL` | `3600` | Cache timeout (seconds) |

## Extension Commands

| Command ID | Title |
|------------|-------|
| `gitlabBlame.setToken` | Set Personal Access Token |
| `gitlabBlame.deleteToken` | Delete Personal Access Token |
| `gitlabBlame.clearCache` | Clear Cache |
| `gitlabBlame.showStatus` | Show Status |

## Dependencies

- **Runtime**: None (zero dependencies)
- **Extension**: `vscode.git` (built-in)
- **Dev**: TypeScript, ESLint, esbuild, Mocha, Sinon

## API Endpoints Used

```
GET /api/v4/projects/:id/repository/commits/:sha/merge_requests
Header: PRIVATE-TOKEN: <token>
```

## Important Patterns

- **Provider abstraction**: `IVcsProvider` interface enables multi-provider support
- **Services return data, not UI**: `VcsResult` type with `shouldShowUI` flag
- **Factory pattern**: `VcsProviderFactory` auto-detects provider from remote URL
- Uses VS Code Git API (`vscode.git`), not process spawning
- Token stored in `SecretStorage` via `TokenService` (encrypted)
- Cache auto-invalidates on git operations
- MR selection: first merged by `merged_at` date
- Shows token error once per session (deduplication via provider state)

## Testing

Run in VS Code:
1. Press F5 to launch Extension Development Host
2. Open a GitLab repository
3. Hover over any line to see blame + MR link

## Notes

- Minimum VS Code: 1.84.0
- Token scope needed: `read_api`
- Supports nested GitLab groups
- Works with self-hosted GitLab instances
- Architecture ready for GitHub/Bitbucket providers

## Development Guidelines

### Documentation Sync Requirement

**Before committing any code changes**, ensure that:

1. **`ref/` folder** is updated to reflect any API, architecture, or pattern changes
2. **`CLAUDE.md`** is updated if project structure, commands, settings, or key patterns change

This keeps documentation in sync with the codebase and ensures accurate context for future development.

**Checklist before commit**:
- [ ] New/modified public methods documented in `ref/api/`
- [ ] Architecture changes reflected in `ref/architecture.md`
- [ ] New patterns added to `ref/patterns.md`
- [ ] Configuration changes updated in `ref/configuration.md` and `CLAUDE.md`
