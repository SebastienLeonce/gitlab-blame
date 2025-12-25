# Git Blame MR/PR Link - AI Context

VS Code extension that adds Merge Request/Pull Request links to git blame hovers. Supports GitLab and GitHub with multi-provider architecture.

**🔍 For detailed documentation:**
- `README.md` - **Marketplace-optimized** user documentation
- `CONTRIBUTING.md` - Development setup, architecture overview, testing guidelines
- `ref/` folder - Detailed API and architecture documentation

This file is AI context only.

---

## Quick Reference

| Topic | Reference |
|-------|-----------|
| **Contributing Guide** | `CONTRIBUTING.md` - Development setup, architecture overview, PR guidelines |
| **Architecture** | `ref/architecture.md` - Detailed system design, data flow, components |
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
│   ├── BlameDecorationProvider.ts   # Inline decoration provider
│   ├── BlameHoverProvider.ts        # Hover tooltip logic
│   └── vcs/
│       ├── GitHubProvider.ts        # GitHub VCS provider
│       └── GitLabProvider.ts        # GitLab VCS provider
├── services/
│   ├── CacheService.ts              # TTL cache (implements ICacheService)
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

test/
├── runTest.ts                       # Unit+integration test runner
├── runE2ETest.ts                    # E2E test runner
└── suite/
    ├── index.ts                     # Test loader (loads unit/ and integration/)
    ├── unit/                        # Unit tests (full Sinon mocking, ~210 tests)
    │   ├── blameDecorationProvider.test.ts
    │   ├── blameHoverProvider.test.ts
    │   ├── cacheService.test.ts
    │   ├── gitService.test.ts
    │   ├── githubProvider.test.ts
    │   ├── gitlabProvider.test.ts
    │   ├── remoteParser.test.ts
    │   ├── tokenService.test.ts
    │   └── vcsProviderFactory.test.ts
    ├── integration/                 # Integration tests (real VS Code APIs, ~9 tests)
    │   └── integration.test.ts
    └── e2e/                         # E2E tests (full system, ~22 tests)
        ├── index.ts
        ├── *.e2e.ts                 # 3 test files
        └── helpers/                 # Test utilities
```

---

## Commands (npm scripts)

### Essential Commands

```bash
npm run build           # Production build (esbuild, minified)
npm run watch           # Development watch mode
npm test                # Run unit tests
npm run test:e2e        # Run end-to-end tests (requires VS Code instance)
npm run lint            # ESLint check
npm run typecheck       # TypeScript type checking
npm run validate        # Run all checks (lint + typecheck + coverage + build)
```

### Full Command List

```bash
# Build
npm run build           # Production build (esbuild, minified)
npm run build:dev       # Development build (esbuild, with sourcemap, no minification)
npm run watch           # Development watch mode

# Linting
npm run lint            # ESLint check
npm run lint:fix        # Auto-fix lint issues

# Type Checking
npm run typecheck       # TypeScript type checking
npm run typecheck:watch # TypeScript in watch mode

# Testing
npm test                # Run unit tests only
npm run test:unit       # Alias for npm test
npm run test:e2e        # Run end-to-end tests (requires VS Code instance)
npm run test:coverage   # Run unit tests with coverage report
npm run test:watch      # Watch mode for TDD
npm run pretest         # Compile tests only
npm run pretest:e2e     # Compile and prepare e2e tests (build + compile + copy fixtures)

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

### E2E Test Reliability

E2E tests now reliably detect the fixture Git repository using `waitForGitRepository()` helper:
- Waits for Git extension to finish scanning workspace folders
- Uses retry pattern matching production code (3 retries × 500ms)
- Tests verify actual functionality, not just "didn't crash"

---

## Release & CI/CD Protocol

### Automated Release Workflow

**Starting from v1.4.0, releases are automated:**

1. `npm run version:patch` - Bump version, create commit
2. `git push origin main` - Push to main
3. **Automatic**: Auto-tag workflow detects version change
4. **Automatic**: Workflow waits for CI to pass
5. **Automatic**: Creates and pushes tag
6. **Automatic**: Tag triggers publish workflow
7. **Automatic**: E2E tests + quality checks run
8. **Automatic**: Publishes to marketplace (if tests pass)

### Important Rules

**DO**:
- ✅ Use `npm run version:patch|minor|major` for version bumps
- ✅ Wait for CI (~2-5 min) before next release
- ✅ Update CHANGELOG.md before version bump
- ✅ Ensure all tests pass locally before pushing

**DON'T**:
- ❌ Manually create tags (`git tag v1.3.1`)
- ❌ Manually push tags (`git push --tags`)
- ❌ Create multiple version bumps rapidly
- ❌ Force-push tags

### Recovery from Failed Publish

If publish fails after tag creation:
```bash
# Fix issue, then bump to new patch version
npm run version:patch
git push origin main
# Automation retries with new version
```

See: `ref/release-process.md` §Troubleshooting

---

## Git Hooks & Quality Gates

**📖 Detailed documentation**: See `ref/quality-assurance.md`

### Pre-Commit (~5-10s)
- ✅ ESLint on staged files
- ✅ TypeScript type check
- 📝 Documentation sync reminder (non-blocking)

### Pre-Push (~20-30s)
- ✅ Full test suite (325 tests)
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
| `gitlabBlame.displayMode` | `inline` | How to display MR/PR info: `hover`, `inline`, or `both` |
| `gitlabBlame.gitlabUrl` | `https://gitlab.com` | GitLab instance URL |
| `gitlabBlame.githubUrl` | `https://github.com` | GitHub URL (auto-converted to API URL) |
| `gitlabBlame.cacheTTL` | `3600` | Cache timeout (seconds) |

**📖 Full reference**: See `ref/configuration.md`

---

## Extension Commands

| Command ID | Title | Auto-Detection |
|------------|-------|----------------|
| `gitlabBlame.setToken` | Set Personal Access Token | ✓ Detects GitLab/GitHub from git remote |
| `gitlabBlame.deleteToken` | Delete Personal Access Token | ✓ Detects GitLab/GitHub from git remote |
| `gitlabBlame.toggleDisplayMode` | Toggle Display Mode | N/A |
| `gitlabBlame.clearCache` | Clear Cache | N/A |
| `gitlabBlame.showStatus` | Show Status | Shows all providers |

---

## Key AI Patterns & Conventions

### Provider Abstraction
- `IVcsProvider` interface enables multi-provider support
- Factory pattern: `VcsProviderFactory` auto-detects provider from remote URL
- Providers return `VcsResult<T>` (data or error), never show UI directly
- GitHub provider uses two-step approach:
  1. Primary: `/commits/{sha}/pulls` API (works for merge commits)
  2. Fallback: Parse commit message for `(#123)` and fetch specific PR (for individual commits)

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
- Provider-specific cache keys: `{providerId}:{sha}` (prevents GitLab/GitHub collisions)
- Auto-invalidates on git operations (pull, fetch, checkout, commit)
- Caches `null` to avoid repeated API calls for commits without MRs/PRs

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

- [ ] User-facing changes → Update `README.md` (marketplace-focused)
- [ ] Development changes → Update `CONTRIBUTING.md`
- [ ] New/modified public methods → Update `ref/api/`
- [ ] Architecture changes → Update `ref/architecture.md` and `CONTRIBUTING.md`
- [ ] New patterns → Update `ref/patterns.md`
- [ ] Configuration changes → Update `README.md`, `ref/configuration.md`, and `CLAUDE.md`
- [ ] Quality/testing changes → Update `ref/quality-assurance.md` and `CONTRIBUTING.md`

Pre-commit hook will remind if `src/` changed but `ref/` didn't.

---

## Development Guidelines

### Error Logging

**Use the centralized ErrorLogger service for all logging** - Do NOT use `console.*` directly (enforced by ESLint `no-console` rule).

```typescript
import { logger } from "./services/ErrorLogger";

// Error logging
logger.error("Provider", "Context description", error);

// Warning logging
logger.warn("Provider", "Context description", message);

// Info logging
logger.info("Informational message");
```

**Format**: `[Provider] Context: Message`

**Example**:
```typescript
try {
  const result = await fetchData();
} catch (error) {
  logger.error("GitHub", "API request failed", error);
}
// Output: ERROR: [GitHub] API request failed: Network timeout
```

**Why**:
- ✅ Consistent error format across all components
- ✅ Centralized logging to VS Code Output Channel
- ✅ Easier debugging (all logs in one place)
- ✅ Enforced by ESLint `no-console` rule

**📖 Full API documentation**: See `ref/api/services.md` §ErrorLogger

### Import Conventions

**Use TypeScript path aliases, not relative parent directory imports** - Enforced by ESLint `no-restricted-imports` rule.

**Available Path Aliases**:

| Alias | Resolves To | Usage Example |
|-------|-------------|---------------|
| `@src` | `src/` | `import { activate } from "@src/extension"` |
| `@constants` | `src/constants` | `import { CONFIG_KEYS } from "@constants"` |
| `@types` | `src/types` | `import { MergeRequest } from "@types"` |
| `@interfaces` | `src/interfaces` | `import { IVcsProvider } from "@interfaces"` |
| `@services` | `src/services` | `import { GitService } from "@services/GitService"` |
| `@providers` | `src/providers` | `import { GitLabProvider } from "@providers/vcs/GitLabProvider"` |
| `@utils` | `src/utils` | `import { parseRemoteUrl } from "@utils/remoteParser"` |
| `@test-helpers` | `test/suite/e2e/helpers` | `import { waitForGitRepository } from "@test-helpers"` |

**ESLint Rules**:

```typescript
✅ // ALLOWED: Path aliases
import { CONFIG_KEYS } from "@constants";
import { GitService } from "@services/GitService";

✅ // ALLOWED: Same-folder relative imports
import { GitLabProvider } from "./GitLabProvider";

✅ // ALLOWED: Child folder imports
import { GitLabProvider } from "./vcs/GitLabProvider";

❌ // FORBIDDEN: Parent directory imports
import { CONFIG_KEYS } from "../../constants";
import { GitService } from "../services/GitService";
```

**Why Path Aliases**:
- **Refactor-safe**: Move files without breaking imports
- **Clear dependencies**: Explicit layer separation (`@services`, `@providers`, `@utils`)
- **Better IDE support**: Auto-completion and navigation
- **Enforced architecture**: ESLint prevents crossing layers incorrectly

**Implementation**: `tsc-alias` resolves path aliases at compile time for test files.

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
- **Supported Providers**: GitLab, GitHub
- **Token Scopes**:
  - GitLab: `read_api`
  - GitHub: `repo` (private) or `public_repo` (public only)
- **Runtime Dependencies**: None (zero dependencies)
- **Dev Dependencies**: TypeScript, ESLint, esbuild, Mocha, Sinon, Husky
- **Extension API**: Uses `vscode.git` (built-in)
- **Test Count**: 325 tests (304 unit + 21 E2E), ~500ms unit test execution
- **Coverage**: 94-95% across all metrics (enforced: 90% lines/functions/statements, 85% branches)
- **APIs**:
  - GitLab: `GET /api/v4/projects/:id/repository/commits/:sha/merge_requests`
  - GitHub: `GET /repos/{owner}/{repo}/commits/{sha}/pulls` + fallback to commit message parsing
- **Known Limitations**:
  - Uses `origin` remote only (see `ref/configuration.md`)
  - GitHub: API only returns PRs for merge commits; fallback parses commit message for `(#123)` pattern

---

## Notes for AI

- Always read `package.json` before running scripts (script names may vary)
- **Documentation Structure**:
  - `README.md` is marketplace-optimized for end users (do NOT add dev docs here)
  - `CONTRIBUTING.md` contains all development documentation
  - `ref/` folder has detailed API and architecture docs
- Follow commit message format (enforced by hooks)
- Update docs when changing code (README for users, CONTRIBUTING for devs, ref/ for details)
- Run `npm run validate` before committing major changes
- **Multi-Provider Support**: GitLab and GitHub are fully implemented and tested
  - Auto-detects provider from git remote URL
  - Separate token storage per provider
  - Provider-specific cache keys prevent collisions
- Supports nested GitLab groups and self-hosted instances (GitLab/GitHub Enterprise)
- **Known Limitation**: Extension only uses `origin` remote (not other remotes)
- Future: Bitbucket provider (see `ref/multi-provider.md`)
