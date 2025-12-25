# Quality Assurance

This document describes the quality assurance practices, automated gates, and testing strategies for the GitLab Blame MR Link extension.

## Automated Quality Gates

The project uses **Husky** to manage git hooks that enforce code quality on every commit and push.

### Pre-Commit Hook (~5-10 seconds)

Runs on **every commit** to catch issues early:

#### Checks Performed

1. **ESLint** - Lints staged TypeScript files
   - Runs: `npm run lint`
   - Enforces: Code style, best practices, TypeScript-specific rules
   - Fails on: Any ESLint errors

2. **TypeScript Type Check** - Full project type check
   - Runs: `npm run typecheck`
   - Enforces: Type safety across entire codebase
   - Fails on: Type errors, missing types, incompatible assignments

3. **package-lock.json Sync Validation** (~2-5 seconds)
   - Triggers: When `package.json` or `package-lock.json` is modified
   - Runs: `npm ci --dry-run` to verify sync
   - Enforces: Lock file is in sync with package.json
   - Fails on: Version mismatches, missing dependencies
   - **Fix**: Run `npm install` to regenerate lock file
   - **Why**: Prevents CI failures from out-of-sync dependencies

4. **Documentation Sync Reminder** (non-blocking)
   - Triggers: When `src/` files changed but `ref/` or `CLAUDE.md` unchanged
   - Shows: Reminder to update relevant documentation
   - Action: User can press Enter to continue or Ctrl+C to abort and update docs

#### Bypass

Emergency bypass (not recommended):
```bash
git commit --no-verify
```

#### Example Output

**Success:**
```
🔍 Pre-commit quality checks...

📝 Running ESLint on staged files...
✅ ESLint passed

🔍 Running TypeScript type check...
✅ Type check passed

✅ Pre-commit checks passed!
```

**With documentation reminder:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 DOCUMENTATION SYNC REMINDER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You modified src/ files but didn't update documentation.

Consider updating:
  • ref/api/services.md       - if you changed service interfaces
  • ref/api/providers.md      - if you changed provider interfaces
  • ref/architecture.md       - if you changed system architecture
  • CLAUDE.md                 - if you changed project structure/commands

Press Enter to continue anyway, or Ctrl+C to abort and update docs...
```

---

### Pre-Push Hook (~20-30 seconds)

Runs on **every push** to prevent broken code from reaching remote:

#### Checks Performed

1. **Focused Test Detection**
   - Searches: `.only()` in test files
   - Purpose: Prevent commits that skip other tests
   - Fails on: Any `.only()` found

2. **Skipped Test Warning**
   - Searches: `.skip()` in test files
   - Purpose: Alert about intentionally skipped tests
   - Action: Shows count, continues (non-blocking)

3. **Full Test Suite with Coverage**
   - Runs: `npm run test:coverage`
   - Executes: All ~300 unit and integration tests
   - Measures: Code coverage with c8
   - Enforces: Coverage thresholds (see below)
   - Fails on: Test failures OR coverage below thresholds

4. **Production Build Verification**
   - Runs: `npm run build`
   - Purpose: Ensure bundle builds successfully
   - Fails on: Build errors, missing dependencies

#### Coverage Thresholds

Enforced by c8 configuration in `package.json`:

| Metric | Threshold | Current |
|--------|-----------|---------|
| Lines | 90% | 93.6% ✅ |
| Functions | 90% | 94.2% ✅ |
| Branches | 85% | 95.9% ✅ |
| Statements | 90% | 93.6% ✅ |

#### Bypass

Emergency bypass (not recommended):
```bash
git push --no-verify
```

#### Example Output

**Success:**
```
🚀 Pre-push quality gate (this may take ~20-30 seconds)...

🔍 Checking for focused tests (.only)...
✅ No focused tests found

🔍 Checking for skipped tests (.skip)...

🧪 Running tests with coverage...
✅ All tests passed with sufficient coverage

🏗️  Building production bundle...
✅ Production build successful

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ All pre-push checks passed! Safe to push.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Coverage failure:**
```
❌ Coverage threshold not met:
  Lines: 87.2% (threshold: 90%) ❌

ERROR: Coverage for lines (87.2%) does not meet global threshold (90%)
```

---

## Test Philosophy

### Unit, Integration, and E2E Tests

The extension uses **three-tier testing strategy** for comprehensive quality assurance:

**Unit Tests** (`test/suite/unit/`):
1. **Complete logic coverage** - All code paths tested
2. **Full mocking** - Uses Sinon to stub all external dependencies (VS Code APIs, services)
3. **Fast execution** - 304 tests run in ~514ms
4. **Deterministic** - No flaky tests due to timing or environment
5. **Easy debugging** - Failures pinpoint exact issue

**Integration Tests** (`test/suite/integration/`):
1. **Real VS Code APIs** - Tests extension with actual VS Code APIs (not stubbed)
2. **Service integration** - Verifies extension activation, commands, configuration
3. **Fast execution** - 9 tests run in ~50ms
4. **No external dependencies** - No real Git operations or external API calls

**E2E Tests** (`test/suite/e2e/`):
1. **Full system verification** - Tests extension with real VS Code Git API
2. **Fixture repository** - Uses real git repository for realistic testing
3. **Reliable execution** - Git repository detection with retry pattern (see below)
4. **Full workflow testing** - Hover, inline decorations, error handling, API mocking with nock

**Total**: 326 tests (210 unit, 9 integration, 22 E2E), ~500ms execution time, 93%+ code coverage

### Test Coverage Breakdown

**Unit Tests** (`test/suite/unit/`):

| Test Suite | Tests | Coverage Areas |
|------------|-------|----------------|
| `blameHoverProvider.test.ts` | 60+ | Markdown escaping, date formatting, MR fetching, cache, errors |
| `githubProvider.test.ts` | 50+ | Token management, API calls, PR detection, commit message parsing |
| `gitlabProvider.test.ts` | 40+ | Token management, API calls, error handling, MR selection |
| `gitService.test.ts` | 30+ | Blame parsing, edge cases, unicode handling |
| `cacheService.test.ts` | 67 | TTL, expiration, null caching, provider-specific keys |
| `remoteParser.test.ts` | 15+ | SSH, HTTPS, nested groups, self-hosted GitLab/GitHub |
| `tokenService.test.ts` | 31 | Multi-provider token management, SecretStorage |
| `vcsProviderFactory.test.ts` | 11 | Provider registration, detection, URL matching |
| `blameDecorationProvider.test.ts` | 20+ | Inline decorations, display modes, active line tracking |

**Integration Tests** (`test/suite/integration/`):

| Test Suite | Tests | Coverage Areas |
|------------|-------|----------------|
| `integration.test.ts` | 9 | Extension activation, commands, configuration, hover provider |

**E2E Tests** (`test/suite/e2e/`):

| Test Suite | Tests | Coverage Areas |
|------------|-------|----------------|
| `hoverShowsMrInfo.e2e.ts` | 10+ | Hover provider with real fixture repository and nocked GitHub APIs |
| `inlineDecoration.e2e.ts` | 8+ | Inline decoration rendering with real files and display modes |
| `errorHandling.e2e.ts` | 4+ | Error scenarios in real VS Code environment |

**Total**: 326 tests, ~500ms execution time, 93%+ code coverage

### Test Patterns

- **Mocking**: Uses Sinon for stubbing services and external dependencies
- **Isolation**: Each test has independent state (sandbox, fresh instances)
- **Private Method Testing**: Uses TypeScript type casting to test private methods
- **Time Control**: Uses Sinon fake timers for deterministic date/time testing

### Git Repository Detection in E2E Tests

VS Code's Git extension loads repositories asynchronously **after** `api.state === "initialized"`. This creates a race condition where:
- Extension activates successfully
- Git API is initialized
- But `api.repositories` is still empty (Git still scanning)

**Solution:** Use `waitForGitRepository()` helper that mirrors production code's retry pattern from `BlameDecorationProvider.initialUpdateWithRetry()`.

**Pattern:**
```typescript
await waitForExtensionActivation();
const fixtureUri = vscode.Uri.file(fixtureRepo.getFilePath("src/auth.ts"));
await waitForGitRepository(fixtureUri);  // Retries 3x with 500ms delays
```

**Failure scenarios:**
- Timeout error: Git didn't detect repo in 1.5 seconds (increase retries if needed)
- API unavailable: Extension didn't export API correctly
- Clear error messages guide debugging

### Running Tests

```bash
npm test                # Run unit + integration tests (~300 tests)
npm run test:unit       # Alias for npm test
npm run test:e2e        # Run E2E tests (~22 tests, requires VS Code instance)
npm run test:coverage   # Run unit + integration with coverage report
npm run test:watch      # Watch mode for TDD
npm run pretest         # Compile tests only (manual)
```

---

## Code Quality Standards

### TypeScript Configuration

**Compiler Options** (`tsconfig.json`):
- `strict: true` - All strict type checking enabled
- `target: "ES2022"` - Modern JavaScript features
- `esModuleInterop: true` - Better module interop
- `skipLibCheck: true` - Faster compilation
- `forceConsistentCasingInFileNames: true` - Cross-platform compatibility

**Strict Mode Implications:**
- No implicit `any` types
- Strict null checks
- Strict function types
- Strict bind/call/apply
- No unused locals/parameters (except `_` prefix)

### ESLint Rules

**Base Rulesets**:
- `eslint:recommended` - Core ESLint best practices
- `plugin:@typescript-eslint/recommended` - TypeScript-specific rules
- `plugin:@typescript-eslint/recommended-requiring-type-checking` - Advanced type-aware rules

**Custom Rules**:
```json
{
  "@typescript-eslint/naming-convention": ["warn", {...}],
  "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
  "curly": "warn",
  "eqeqeq": "warn",
  "no-throw-literal": "warn"
}
```

**Potential Future Enhancements** (see `CODE_QUALITY_ANALYSIS.md` §1.2):
- `@typescript-eslint/no-explicit-any: "error"`
- `@typescript-eslint/no-floating-promises: "error"`
- `@typescript-eslint/no-misused-promises: "error"`
- `@typescript-eslint/prefer-nullish-coalescing: "warn"`

### Coverage Configuration

**c8 Configuration** (`package.json`):
```json
{
  "c8": {
    "include": ["dist/**/*.js"],
    "exclude": ["out/test/**", ".vscode-test/**", "**/*.d.ts"],
    "reporter": ["text", "text-summary", "html", "lcov"],
    "check-coverage": true,
    "lines": 90,
    "functions": 90,
    "branches": 85,
    "statements": 90
  }
}
```

**Reports Generated**:
- `text` - Console output with summary
- `text-summary` - Brief console summary
- `html` - Interactive HTML report in `coverage/`
- `lcov` - Machine-readable format for CI/CD

---

## Code Quality Tools

| Tool | Version | Purpose | Configuration |
|------|---------|---------|---------------|
| **TypeScript** | 5.3.2 | Type safety | `tsconfig.json` (strict mode) |
| **ESLint** | 8.55.0 | Code linting | `.eslintrc.json` |
| **Mocha** | 10.2.0 | Test runner | Runs 200+ tests |
| **Sinon** | 17.0.1 | Test mocking | Stubs, spies, fake timers |
| **c8** | 10.1.3 | Coverage | Threshold enforcement |
| **esbuild** | 0.19.8 | Bundler | Fast builds, minification |
| **Husky** | 9.1.7 | Git hooks | Pre-commit, pre-push |

---

## Development Workflow

### Recommended Development Cycle

1. **Make changes** to source files
2. **Run tests in watch mode** (optional): `npm run test:watch`
3. **Run type check in watch mode** (optional): `npm run typecheck:watch`
4. **Stage changes**: `git add .`
5. **Commit**: `git commit -m "type(scope): description"`
   - Pre-commit hook runs automatically
   - Fix any lint/type errors if hook fails
6. **Push**: `git push`
   - Pre-push hook runs automatically
   - Fix any test/coverage/build issues if hook fails

### Manual Quality Check

Run all quality checks manually:

```bash
npm run validate
```

This runs (in order):
1. `npm run lint` - ESLint check
2. `npm run typecheck` - TypeScript type check
3. `npm run test:coverage` - Tests with coverage
4. `npm run build` - Production build

Equivalent to running both git hooks manually.

### Continuous Integration

Git hooks are mirrored in GitHub Actions CI to ensure quality gates cannot be bypassed via `--no-verify`.

**CI Pipeline** (`.github/workflows/ci.yml`):
- ✅ Lint - ESLint check
- ✅ Type check - TypeScript compilation
- ✅ Tests with coverage - Full test suite with c8 coverage enforcement
- ✅ Production build - esbuild bundle verification
- ✅ Coverage upload - Codecov integration for coverage tracking

The CI runs on every push to `main` and on all pull requests.

---

## Commit Message Format

### Conventional Commits

Use the format: `type(scope): description`

**Valid Types**:
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation changes
- `test` - Test additions/changes
- `refactor` - Code refactoring (no functionality change)
- `perf` - Performance improvements
- `chore` - Build/tooling changes
- `ci` - CI/CD changes
- `style` - Code style changes (formatting, whitespace)
- `build` - Build system changes

**Valid Scopes** (optional but recommended):
- `providers` - VCS provider changes (GitLabProvider, etc.)
- `services` - Service layer (GitService, CacheService, TokenService, etc.)
- `cache` - Cache-related changes
- `ui` - User interface/hover changes
- `config` - Configuration changes
- `deps` - Dependency updates
- `hooks` - Git hooks changes

### Examples

```bash
feat(providers): add GitHub provider support
fix(cache): prevent race condition in TTL expiry
docs(api): update IVcsProvider interface documentation
test(gitlab): add edge case tests for nested groups
refactor(services): extract token validation logic
perf(cache): optimize cache lookup with Map
chore(deps): update TypeScript to 5.3.2
ci(github): add automated release workflow
```

### Breaking Changes

For breaking changes, add `!` after scope and include `BREAKING CHANGE:` in body:

```bash
feat(providers)!: change IVcsProvider interface signature

BREAKING CHANGE: getMergeRequestForCommit now returns VcsResult<MR[]> instead of VcsResult<MR>
```

---

## Documentation Sync Requirement

**Before committing code changes**, verify documentation is updated:

### Checklist

- [ ] **New/modified public methods** → Update `ref/api/` files
- [ ] **Architecture changes** → Update `ref/architecture.md`
- [ ] **New patterns** → Update `ref/patterns.md`
- [ ] **Configuration changes** → Update `ref/configuration.md` and `CLAUDE.md`
- [ ] **Quality changes** → Update `ref/quality-assurance.md` (this file)
- [ ] **No redundant comments** → Only "WHY" comments, not "WHAT"

The pre-commit hook will remind you if `src/` changed but documentation didn't.

---

## Bypassing Quality Gates

### When to Bypass

**Emergency situations only**:
- Hotfix deployment needed immediately
- Git hook causing false positive (should be fixed, not bypassed)
- CI/CD mirrors these checks, so bypass is temporary

### How to Bypass

```bash
# Skip pre-commit
git commit --no-verify

# Skip pre-push
git push --no-verify
```

### Risks

- Broken code can reach remote
- Coverage can regress
- Type errors can slip through
- Failed builds can be pushed

**Mitigation**: Ensure CI/CD runs the same checks as git hooks.

---

## Future Enhancements

Potential improvements identified in `CODE_QUALITY_ANALYSIS.md`:

1. **Stricter ESLint rules** - Prevent `any`, floating promises, etc.
2. **GitHub Actions CI/CD** - Mirror hooks in CI
3. **Conventional commit enforcement** - Add commit-msg hook
4. **Prettier integration** - Automated code formatting
5. **CONTRIBUTING.md** - Contributor guide with PR process
6. **Automated changelog** - Generate from conventional commits
