# GitLab Blame MR Link - AI Context

VS Code extension that adds GitLab Merge Request links to git blame hovers. Multi-provider architecture for future GitHub/Bitbucket support.

**🔍 For detailed documentation, see `ref/` folder** - this file is AI context only.

---

## Quick Reference

| Topic | Reference |
|-------|-----------|
| **Architecture** | `ref/architecture.md` - System design, data flow, components |
| **Quality Assurance** | `ref/quality-assurance.md` - Git hooks, testing, coverage |
| **Release Process** | `ref/release-process.md` - Versioning, CI/CD, publishing |
| **Services API** | `ref/api/services.md` - Service interfaces and contracts |
| **Providers API** | `ref/api/providers.md` - VCS provider interface |
| **Utilities API** | `ref/api/utilities.md` - Helper functions |
| **Configuration** | `ref/configuration.md` - Settings and commands |
| **Code Patterns** | `ref/patterns.md` - Coding conventions |
| **Multi-Provider** | `ref/multi-provider.md` - Provider implementation guide |

---

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

ref/                                 # Documentation (for humans)
├── architecture.md                  # System architecture
├── quality-assurance.md             # Git hooks, testing, quality standards
├── release-process.md               # Versioning, CI/CD, publishing
├── configuration.md                 # Settings reference
├── patterns.md                      # Code patterns
├── multi-provider.md                # Provider guide
└── api/
    ├── services.md                  # Services API
    ├── providers.md                 # Providers API
    └── utilities.md                 # Utilities API
```

---

## Commands (npm scripts)

### Essential Commands

```bash
npm run build           # Production build (esbuild, minified)
npm run watch           # Development watch mode
npm test                # Run all tests
npm run lint            # ESLint check
npm run typecheck       # TypeScript type checking
npm run validate        # Run all checks (lint + typecheck + coverage + build)
```

### Full Command List

```bash
# Build
npm run build           # Production build (esbuild, minified)
npm run watch           # Development watch mode

# Linting
npm run lint            # ESLint check
npm run lint:fix        # Auto-fix lint issues

# Type Checking
npm run typecheck       # TypeScript type checking
npm run typecheck:watch # TypeScript in watch mode

# Testing
npm test                # Run all tests
npm run test:unit       # Alias for npm test
npm run test:coverage   # Run tests with coverage report
npm run test:watch      # Watch mode for TDD
npm run pretest         # Compile tests only

# Quality
npm run validate        # All checks: lint + typecheck + coverage + build
npm run pre-commit      # Manually run pre-commit checks
npm run pre-push        # Manually run pre-push checks

# Versioning
npm run version:patch   # Bump patch version
npm run version:minor   # Bump minor version
npm run version:major   # Bump major version

# Publishing
npm run package         # Create .vsix package
npm run publish         # Publish to marketplace
```

---

## Git Hooks & Quality Gates

**📖 Detailed documentation**: See `ref/quality-assurance.md`

### Pre-Commit (~5-10s)
- ✅ ESLint on staged files
- ✅ TypeScript type check
- 📝 Documentation sync reminder (non-blocking)

### Pre-Push (~20-30s)
- ✅ Full test suite (225 tests)
- ✅ Coverage threshold (90% lines, 85% branches, 90% functions, 90% statements)
- ✅ Production build verification
- ✅ No focused tests (`.only()`)

**Bypass** (emergency only): `git commit --no-verify` or `git push --no-verify`

---

## Commit Message Format

**Format**: `type(scope): description`

**Types**: `feat` | `fix` | `docs` | `test` | `refactor` | `perf` | `chore` | `ci`

**Scopes**: `providers` | `services` | `cache` | `ui` | `config` | `deps` | `hooks`

**Examples**:
```bash
feat(providers): add GitHub provider support
fix(cache): prevent race condition in TTL expiry
docs(api): update IVcsProvider interface
test(gitlab): add edge case for nested groups
```

**📖 Full specification**: See `ref/quality-assurance.md` §Commit Message Format

---

## Configuration Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `gitlabBlame.gitlabUrl` | `https://gitlab.com` | GitLab instance URL |
| `gitlabBlame.cacheTTL` | `3600` | Cache timeout (seconds) |

**📖 Full reference**: See `ref/configuration.md`

---

## Extension Commands

| Command ID | Title |
|------------|-------|
| `gitlabBlame.setToken` | Set Personal Access Token |
| `gitlabBlame.deleteToken` | Delete Personal Access Token |
| `gitlabBlame.clearCache` | Clear Cache |
| `gitlabBlame.showStatus` | Show Status |

---

## Key AI Patterns & Conventions

### Provider Abstraction
- `IVcsProvider` interface enables multi-provider support
- Factory pattern: `VcsProviderFactory` auto-detects provider from remote URL
- Providers return `VcsResult<T>` (data or error), never show UI directly

### Services Return Data, Not UI
- Services use `VcsResult` type with `shouldShowUI` flag
- Extension's error handler decides when/how to show dialogs
- Improves testability and separation of concerns

### Token Management
- Multi-provider support via `TokenService`
- Stored in VS Code `SecretStorage` (encrypted)
- Backwards compatible with existing GitLab token storage

### Cache Strategy
- TTL-based cache (configurable, default 3600s)
- Auto-invalidates on git operations (pull, fetch, checkout, commit)
- Caches `null` to avoid repeated API calls for commits without MRs

### Code Comments Philosophy

**Core Principle: Comment the "WHY", not the "WHAT"**

✅ **ALWAYS Comment**:
- Interface JSDoc (all methods)
- Public method JSDoc
- "WHY" comments (reasoning, not actions)
- Complex logic (regex, algorithms, edge cases)

❌ **NEVER Comment**:
- Redundant "WHAT" comments (code is self-explanatory)
- Obvious operations
- Self-documenting conditionals

🔄 **Prefer Refactoring Over Comments**:
- Extract well-named methods instead of explaining code

**📖 Full guide**: See §Development Guidelines in this file (below)

---

## Documentation Sync Requirement

**Before committing code changes**:

- [ ] New/modified public methods → Update `ref/api/`
- [ ] Architecture changes → Update `ref/architecture.md`
- [ ] New patterns → Update `ref/patterns.md`
- [ ] Configuration changes → Update `ref/configuration.md` and `CLAUDE.md`
- [ ] Quality/testing changes → Update `ref/quality-assurance.md`

Pre-commit hook will remind if `src/` changed but `ref/` didn't.

---

## Development Guidelines

### Code Comments Philosophy

**Core Principle: Comment the "WHY", not the "WHAT"**

Code should be self-documenting through clear naming and structure. Comments should explain intent, reasoning, or non-obvious behavior - not repeat what the code already says.

#### ✅ **ALWAYS Comment**

1. **Interface JSDoc** - All interface methods need JSDoc documentation
   ```typescript
   /**
    * Get a cached MR for a commit SHA
    * @param sha The commit SHA
    * @returns The cached MR, null if cached as "no MR", or undefined if not in cache
    */
   get(sha: string): MergeRequest | null | undefined;
   ```

2. **Public Method JSDoc** - Document the API for other developers
   ```typescript
   /**
    * Parse git blame output into a map of line numbers to BlameInfo
    * VS Code Git API returns standard blame format: <sha> (<author> <date>...)
    */
   private parseBlameOutput(output: string): Map<number, BlameInfo>
   ```

3. **"WHY" Comments** - Explain reasoning, not actions
   ```typescript
   ✅ // Service instances (encapsulated in object to avoid global mutation)
   ✅ // Get TTL from configuration (in seconds), convert to milliseconds
   ✅ // Don't cache if TTL is 0 (caching disabled)
   ✅ // Check for uncommitted changes (all zeros SHA or very short SHA)
   ```

4. **Complex Logic** - Clarify regex, algorithms, edge cases
   ```typescript
   ✅ // Standard blame format regex: ^?<sha> (<author> <date> <time> <timezone> <line>) <content>
   ✅ // SSH format: git@gitlab.example.com:group/subgroup/project.git
   ```

#### ❌ **NEVER Comment**

1. **Redundant "WHAT" Comments** - Code is self-explanatory
   ```typescript
   ❌ // Initialize GitService
   state.gitService = new GitService();

   ❌ // Check if request was cancelled
   if (token.isCancellationRequested) {

   ❌ // Get blame info for the current line
   const blameInfo = await this.gitService.getBlameForLine(uri, position.line);
   ```

2. **Obvious Operations**
   ```typescript
   ❌ // Parse the date and time
   const dateTime = new Date(`${date}T${time}`);

   ❌ // Check cache first
   const cached = this.cacheService.get(sha);
   ```

3. **Self-Documenting Conditionals**
   ```typescript
   ❌ // Only show UI if flagged
   if (!error.shouldShowUI) {

   ❌ // Show appropriate UI based on error type
   switch (error.type) {
   ```

#### 🔄 **Prefer Refactoring Over Comments**

Instead of:
```typescript
❌ // Check if entry has expired
if (Date.now() > entry.expiresAt) {
```

Extract to a well-named method:
```typescript
✅ if (this.isExpired(entry)) {
```

---

## Quick Facts

- **Minimum VS Code**: 1.84.0
- **GitLab Token Scope**: `read_api`
- **Runtime Dependencies**: None (zero dependencies)
- **Dev Dependencies**: TypeScript, ESLint, esbuild, Mocha, Sinon, Husky
- **Extension API**: Uses `vscode.git` (built-in)
- **Test Count**: 225 tests, ~500ms execution
- **Coverage**: 93-96% across all metrics (enforced: 90% lines/functions/statements, 85% branches)
- **GitLab API**: `GET /api/v4/projects/:id/repository/commits/:sha/merge_requests`

---

## Notes for AI

- Always read `package.json` before running scripts (script names may vary)
- Use `ref/` documentation for implementation details
- Follow commit message format (enforced by hooks)
- Update `ref/` docs when changing code
- Run `npm run validate` before committing major changes
- Supports nested GitLab groups and self-hosted instances
- Architecture ready for GitHub/Bitbucket providers (see `ref/multi-provider.md`)
