# GitLab Blame MR Link - Project Context

VS Code extension that adds GitLab Merge Request links to git blame hovers.

## Quick Reference

| Resource | Path |
|----------|------|
| Architecture | `ref/architecture.md` |
| Services API | `ref/api/services.md` |
| Providers API | `ref/api/providers.md` |
| Utilities API | `ref/api/utilities.md` |
| Configuration | `ref/configuration.md` |
| Code Patterns | `ref/patterns.md` |

## Project Structure

```
src/
├── extension.ts           # Entry point, commands
├── providers/
│   └── BlameHoverProvider.ts
├── services/
│   ├── CacheService.ts    # TTL cache
│   ├── GitLabService.ts   # GitLab API client
│   └── GitService.ts      # vscode.git wrapper
├── types/
│   ├── git.d.ts           # VS Code Git API types
│   └── index.ts           # Internal types
└── utils/
    └── remoteParser.ts    # Git URL parser
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
| `src/extension.ts` | Extension entry, command registration |
| `src/providers/BlameHoverProvider.ts` | Hover tooltip logic |
| `src/services/GitLabService.ts` | GitLab API calls |
| `src/services/CacheService.ts` | SHA → MR cache |
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

- Uses VS Code Git API (`vscode.git`), not process spawning
- Token stored in `SecretStorage` (encrypted)
- Cache auto-invalidates on git operations
- MR selection: first merged by `merged_at` date
- Shows token error once per session (deduplication)

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
