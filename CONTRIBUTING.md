# Contributing to Git Blame MR/PR Link

Thank you for your interest in contributing! This guide will help you get started with development, testing, and submitting contributions.

## Development Setup

### Prerequisites

- **Node.js**: 18.x or 20.x
- **VS Code**: 1.84.0 or higher
- **Git**: Latest version

### Setup Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/SebastienLeonce/gitlab-blame.git
   cd gitlab-blame
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development**
   ```bash
   npm run watch      # Start watch mode with sourcemaps
   ```

4. **Launch Extension Development Host**
   - Press `F5` in VS Code
   - A new VS Code window will open with the extension loaded
   - Make changes, reload the window to test (`Ctrl+R` / `Cmd+R`)

## Development Commands

### Build & Watch

```bash
npm run build      # Production build (minified, no sourcemaps)
npm run watch      # Development watch mode (sourcemaps enabled)
```

### Testing

```bash
npm run pretest           # Compile tests
npm test                  # Run unit + integration tests (~300 tests)
npm run test:e2e          # Run E2E tests (~22 tests)
npm run test:coverage     # Run with coverage report (90%+ required)
npm run test:watch        # Watch mode for TDD
```

**Coverage Requirements**:
- Lines: 90%
- Functions: 90%
- Branches: 85%
- Statements: 90%

### Code Quality

```bash
npm run lint              # ESLint check
npm run lint:fix          # Auto-fix lint issues
npm run typecheck         # TypeScript type checking
npm run typecheck:watch   # TypeScript watch mode
npm run validate          # Run all checks (lint + typecheck + coverage + build)
```

**ESLint Rules** (16 rules enforced at error level):

**Bug Prevention**:
- `@typescript-eslint/no-floating-promises` - Catch unhandled promises
- `@typescript-eslint/no-misused-promises` - Prevent promise misuse in conditionals
- `@typescript-eslint/no-unnecessary-condition` - Flag always-true/false conditions
- `import/named` - Verify named imports exist
- `import/default` - Verify default imports exist

**Code Consistency**:
- `@typescript-eslint/naming-convention` - Enforce naming standards
- `@typescript-eslint/no-unused-vars` - No unused variables
- `@typescript-eslint/explicit-function-return-type` - Explicit return types on functions
- `@typescript-eslint/no-magic-numbers` - No hardcoded numbers (use constants)
- `curly` - Always use braces for control statements
- `eqeqeq` - Use strict equality (===)
- `no-throw-literal` - Only throw Error objects
- `no-console` - No direct console usage (use ErrorLogger)
- `import/order` - Alphabetically sorted imports
- `import/no-duplicates` - No duplicate imports

**Additional Plugins**:
- `eslint-plugin-import` - Import/export validation and organization

### Git Hooks

The project uses Husky for automated quality checks:

#### Pre-Commit Hook (~5-10s)
- ✅ ESLint on staged files
- ✅ TypeScript type check
- 📝 Documentation sync reminder (non-blocking)

#### Pre-Push Hook (~20-30s)
- ✅ Full test suite (~300 unit/integration tests)
- ✅ Coverage threshold enforcement
- ✅ Production build verification
- ✅ No focused tests (`.only()` check)

**Bypass** (emergency only): `git commit --no-verify` or `git push --no-verify`

## Architecture

This extension uses a **multi-provider architecture** that supports multiple VCS platforms through an abstraction layer.

### Project Structure

```
src/
├── extension.ts                     # Entry point, command registration, error handling
├── constants.ts                     # Configuration keys, commands, defaults
├── interfaces/
│   ├── ICacheService.ts             # Cache service interface
│   ├── IVcsProvider.ts              # VCS provider interface
│   ├── index.ts                     # Barrel exports
│   └── types.ts                     # Shared type definitions
├── providers/
│   ├── BlameDecorationProvider.ts   # Inline decoration provider (VCS-agnostic)
│   ├── BlameHoverProvider.ts        # Hover tooltip logic (VCS-agnostic)
│   └── vcs/
│       ├── GitHubProvider.ts        # GitHub VCS implementation
│       └── GitLabProvider.ts        # GitLab VCS implementation
├── services/
│   ├── GitService.ts                # VS Code Git API wrapper
│   ├── VcsProviderFactory.ts        # Provider registry & auto-detection
│   ├── TokenService.ts              # Multi-provider token management
│   └── CacheService.ts              # TTL cache with auto-invalidation
├── utils/
│   └── remoteParser.ts              # Git remote URL parser
└── types/
    ├── git.d.ts                     # VS Code Git extension types
    └── index.ts                     # Re-exports from interfaces

ref/                                 # Documentation
├── architecture.md                  # Detailed architecture docs
├── quality-assurance.md             # Testing & quality standards
├── release-process.md               # Versioning & publishing
├── configuration.md                 # Settings reference
├── patterns.md                      # Code patterns & conventions
├── multi-provider.md                # Provider implementation guide
└── api/
    ├── services.md                  # Services API documentation
    ├── providers.md                 # Providers API documentation
    └── utilities.md                 # Utilities API documentation
```

### Key Components

- **VcsProviderFactory**: Auto-detects VCS provider from git remote URL (GitLab or GitHub)
- **IVcsProvider**: Interface enabling multi-provider support (GitLab, GitHub, future: Bitbucket)
- **TokenService**: Secure multi-provider token storage via VS Code SecretStorage
- **CacheService**: TTL-based cache with provider isolation and automatic invalidation on git operations
- **BlameHoverProvider**: VCS-agnostic hover provider that delegates to detected provider

**Provider-Specific Caching**: Cache keys include provider ID (`gitlab:sha` vs `github:sha`) to prevent collisions when the same commit SHA exists in both providers.

For detailed architecture documentation, see [`ref/architecture.md`](ref/architecture.md).

## Code Guidelines

### TypeScript & JavaScript

- Use **TypeScript** for all new code
- Enable strict type checking
- Use ES modules only (`import`/`export`, no CommonJS `require`)
- Add JSDoc comments for all public interfaces and methods

### Import Guidelines

**Use TypeScript path aliases for cross-layer imports** - Enforced by ESLint `no-restricted-imports` rule.

**Available Path Aliases**:

| Alias | Resolves To | Example |
|-------|-------------|---------|
| `@src` | `src/` | Root src files (extension.ts) |
| `@constants` | `src/constants` | Configuration keys, commands |
| `@types` | `src/types` | Type definitions |
| `@interfaces` | `src/interfaces` | Interface definitions |
| `@services` | `src/services` | Service layer |
| `@providers` | `src/providers` | Provider implementations |
| `@utils` | `src/utils` | Utility functions |
| `@test-helpers` | `test/suite/e2e/helpers` | E2E test utilities |

**Rules**:

```typescript
✅ // DO: Use path aliases for cross-layer imports
import { CONFIG_KEYS } from "@constants";
import { GitService } from "@services/GitService";
import { IVcsProvider } from "@interfaces";

✅ // DO: Use relative imports within same folder
import { GitLabProvider } from "./GitLabProvider";

✅ // DO: Use relative imports for child folders
import { GitLabProvider } from "./vcs/GitLabProvider";

❌ // DON'T: Use parent directory imports (enforced by ESLint)
import { CONFIG_KEYS } from "../../constants";
import { GitService } from "../services/GitService";
```

**Why Path Aliases**:
1. **Refactor-safe**: Moving files doesn't break imports
2. **Clear dependencies**: Explicit architectural layers
3. **Better IDE support**: Improved auto-completion and navigation
4. **Enforced architecture**: ESLint prevents incorrect cross-layer imports

**Note**: `tsc-alias` resolves path aliases at compile time for test files. Pre-commit hook enforces `no-restricted-imports` rule.

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

For detailed examples, see [`CLAUDE.md`](CLAUDE.md) §Development Guidelines.

### Code Quality Standards

- **DRY (Don't Repeat Yourself)**: Extract repeated logic into reusable functions
- **No magic numbers/strings**: Use named constants
- **Self-documenting code**: Clear variable and function names
- **Test names are documentation**: Use descriptive test names

## Testing Guidelines

### Test Organization

Tests are organized by type:

```
test/
├── runTest.ts                       # Unit + integration test runner
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
        ├── errorHandling.e2e.ts
        ├── hoverShowsMrInfo.e2e.ts
        ├── inlineDecoration.e2e.ts
        └── helpers/                 # Test utilities
```

**Test Types**:
- **Unit Tests** (`test/suite/unit/`): Full mocking with Sinon, no real services
- **Integration Tests** (`test/suite/integration/`): Real VS Code APIs, simulated git operations
- **E2E Tests** (`test/suite/e2e/`): Full system with real Git extension and fixture repository

### Writing Tests

- Use **Mocha** for test framework
- Use **Sinon** for mocks, stubs, and spies
- Achieve **90%+ coverage** (enforced by CI)
- Write tests for:
  - Happy paths
  - Error cases
  - Edge cases (empty strings, null, undefined, etc.)
  - Provider-specific behavior

**Example Test Structure**:

```typescript
describe('ComponentName', () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('methodName', () => {
    it('should handle normal case', () => {
      // Test implementation
    });

    it('should handle error case', () => {
      // Test implementation
    });

    it('should handle edge case: empty input', () => {
      // Test implementation
    });
  });
});
```

### E2E Test Setup Pattern

All e2e test suites must follow this setup pattern:

```typescript
suiteSetup(async function () {
  this.timeout(60000);

  // 1. Setup fixture repository
  fixtureRepo = new FixtureRepository(fixtureBasePath);
  await fixtureRepo.setup();

  // 2. Wait for extension to activate
  await waitForExtensionActivation();

  // 3. Wait for Git extension to detect fixture repo
  const fixtureUri = vscode.Uri.file(fixtureRepo.getFilePath("src/auth.ts"));
  await waitForGitRepository(fixtureUri);

  // 4. Initialize test helpers
  hoverTrigger = new HoverTrigger();
});
```

**Why step 3 is critical:** Git extension loads repositories asynchronously after initialization. Without this wait, `getRepository()` returns `null` and tests fail.

## Modifying E2E Fixtures

E2E tests use git repository fixtures located in `test/suite/e2e/fixtures/`.

### Quick Reference

- **Documentation**: See [`test/suite/e2e/fixtures/README.md`](test/suite/e2e/fixtures/README.md) for detailed instructions
- **Verify fixtures**: `npm run fixture:verify`
- **Rebuild fixtures**: `npm run fixture:rebuild`
- **Clean fixtures**: `npm run fixture:clean`

### Fixture Management Scripts

#### `npm run fixture:clean`
Removes the `.git` directory from the fixture repo, forcing regeneration on next test run.

**Use when**:
- Testing fixture initialization logic
- Fixture `.git` is corrupted
- Want to start fresh

#### `npm run fixture:rebuild`
Cleans the `.git` directory and rebuilds the entire test environment (compile + copy fixtures).

**Use when**:
- Made manual changes to fixture files
- Want to ensure fixture is in sync with code
- Preparing for a clean test run

#### `npm run fixture:verify`
Runs validation tests to ensure fixture integrity matches `FIXTURE_COMMITS` definition.

**Use when**:
- After modifying fixture
- Before committing changes
- Debugging test failures related to fixtures

**Validation checks**:
- ✅ `.git` directory exists
- ✅ Commit count matches `FIXTURE_COMMITS.length`
- ✅ Commit messages match `FIXTURE_COMMITS[].message`
- ✅ Expected files exist (`FIXTURE_COMMITS[].files`)
- ✅ Remote URL matches expected value

### Important Notes

- **Fixture .git is committed**: The fixture `.git` directory is tracked in version control. Changes to fixture commits will modify the committed `.git` directory.
- **Use deterministic commit dates**: Always set `GIT_AUTHOR_DATE` and `GIT_COMMITTER_DATE` environment variables when creating commits
- **Update `FIXTURE_COMMITS` constant**: Keep `test/suite/e2e/helpers/fixtureRepo.ts` in sync with fixture state
- **Run validation before committing**: Use `npm run fixture:verify` to catch fixture/code drift

**Example - Adding a new commit**:
```bash
cd test/suite/e2e/fixtures/test-repo
echo "export const config = {};" > src/config.ts
git add .
GIT_AUTHOR_DATE="2024-01-20T10:00:00Z" \
GIT_COMMITTER_DATE="2024-01-20T10:00:00Z" \
git commit -m "feat: add configuration (#2)"

# Update FIXTURE_COMMITS in fixtureRepo.ts
# Then verify
npm run fixture:verify
```

For comprehensive guidance, see [`test/suite/e2e/fixtures/README.md`](test/suite/e2e/fixtures/README.md).

## Pull Request Guidelines

### Before Submitting

1. **Create a feature branch** from `main`
   ```bash
   git checkout -b feat/your-feature-name
   ```

2. **Write tests** for new functionality
   - Aim for 90%+ coverage on new code
   - Test both happy and error paths

3. **Update documentation**
   - Update `README.md` for user-facing changes
   - Update `ref/` documentation for architecture changes
   - Update `CLAUDE.md` for development context changes

4. **Run validation**
   ```bash
   npm run validate  # Runs lint, typecheck, coverage, build
   ```

5. **Keep commits focused**
   - One logical change per commit
   - Use conventional commit format (see below)

### Commit Message Format

**Format**: `type(scope): description`

**Types**:
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation only
- `test` - Adding/updating tests
- `refactor` - Code refactoring (no behavior change)
- `perf` - Performance improvement
- `chore` - Maintenance tasks
- `ci` - CI/CD changes

**Scopes**:
- `providers` - VCS providers (GitLab, GitHub)
- `services` - Services (Cache, Git, Token, Factory)
- `cache` - Cache-specific changes
- `ui` - User interface (hovers, commands)
- `config` - Configuration/settings
- `deps` - Dependencies
- `hooks` - Git hooks

**Examples**:
```bash
feat(providers): add Bitbucket provider support
fix(cache): prevent race condition in TTL expiry
docs(api): update IVcsProvider interface documentation
test(gitlab): add edge case for nested groups
refactor(services): extract common provider logic
```

For full specification, see [`ref/quality-assurance.md`](ref/quality-assurance.md).

### PR Checklist

- [ ] Tests pass locally (`npm test`)
- [ ] Coverage meets requirements (`npm run test:coverage`)
- [ ] Lint checks pass (`npm run lint`)
- [ ] Type checks pass (`npm run typecheck`)
- [ ] Production build succeeds (`npm run build`)
- [ ] Documentation updated (README, ref/, CLAUDE.md as needed)
- [ ] Commit messages follow conventional format
- [ ] PR description explains the change and reasoning

## Documentation Sync Requirement

**Before committing code changes**:

- [ ] New/modified public methods → Update `ref/api/`
- [ ] Architecture changes → Update `ref/architecture.md`
- [ ] New patterns → Update `ref/patterns.md`
- [ ] Configuration changes → Update `ref/configuration.md` and `CLAUDE.md`
- [ ] Quality/testing changes → Update `ref/quality-assurance.md`

The pre-commit hook will remind you if `src/` changed but `ref/` didn't.

## Adding a New VCS Provider

To add support for a new VCS provider (e.g., Bitbucket):

1. **Create provider class** in `src/providers/vcs/`
   - Implement `IVcsProvider` interface
   - Handle provider-specific API calls

2. **Register in factory** (`src/services/VcsProviderFactory.ts`)
   - Add provider detection logic
   - Register provider class

3. **Add tests** in `test/suite/providers/vcs/`
   - Test provider-specific behavior
   - Test API error handling
   - Test edge cases

4. **Update documentation**
   - `README.md` - Add to supported providers list
   - `ref/multi-provider.md` - Document implementation
   - `ref/configuration.md` - Add provider-specific settings

For detailed guide, see [`ref/multi-provider.md`](ref/multi-provider.md).

## Debugging

### Launch Configuration

The project includes `.vscode/launch.json` for debugging:

- **Run Extension** (F5): Launch Extension Development Host
- **Extension Tests**: Run tests with debugger attached

### Debug Tips

1. **Set breakpoints** in source files (not compiled `out/` files)
2. **Use `logger.info()`** for debugging output (logged to Output Channel)
3. **Check Output panel** → "GitLab Blame" for extension logs
4. **Use Developer Tools** in Extension Development Host (`Help > Toggle Developer Tools`)

## Release Process

**Current Process**: Automated tagging + publishing

1. Make changes and commit to main (via PR)
2. When ready to release:
   ```bash
   npm run version:patch   # or version:minor, version:major
   git push origin main    # Triggers automation
   ```
3. Automation handles:
   - Creates version tag (v1.3.1)
   - Runs full CI (including E2E tests)
   - Publishes to marketplace (if tests pass)
   - Creates GitHub Release

**Do NOT**:
- ❌ Manually create tags
- ❌ Manually push tags with `--tags`

For full details, see [`ref/release-process.md`](ref/release-process.md).

## Getting Help

- **Issues**: [GitHub Issues](https://github.com/SebastienLeonce/gitlab-blame/issues)
- **Discussions**: [GitHub Discussions](https://github.com/SebastienLeonce/gitlab-blame/discussions)
- **Documentation**: See [`ref/`](ref/) folder for detailed docs

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
