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
npm test                  # Run test suite (229 tests)
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
- ✅ Full test suite (229 tests)
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

Tests mirror the source structure:

```
test/
├── suite/
│   ├── extension.test.ts
│   ├── providers/
│   │   ├── BlameHoverProvider.test.ts
│   │   └── vcs/
│   │       ├── GitHubProvider.test.ts
│   │       └── GitLabProvider.test.ts
│   ├── services/
│   │   ├── CacheService.test.ts
│   │   ├── GitService.test.ts
│   │   └── VcsProviderFactory.test.ts
│   └── utils/
│       └── remoteParser.test.ts
└── runTest.ts
```

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
3. **Check Output panel** → "Git Blame MR/PR Link" for extension logs
4. **Use Developer Tools** in Extension Development Host (`Help > Toggle Developer Tools`)

## Release Process

See [`ref/release-process.md`](ref/release-process.md) for detailed release instructions.

**Quick summary**:

```bash
# Bump version
npm run version:patch   # 1.0.0 → 1.0.1
npm run version:minor   # 1.0.0 → 1.1.0
npm run version:major   # 1.0.0 → 2.0.0

# Package extension
npm run package         # Creates .vsix file

# Publish to marketplace
npm run publish         # Publishes to VS Code Marketplace and Open VSX
```

## Getting Help

- **Issues**: [GitHub Issues](https://github.com/SebastienLeonce/gitlab-blame/issues)
- **Discussions**: [GitHub Discussions](https://github.com/SebastienLeonce/gitlab-blame/discussions)
- **Documentation**: See [`ref/`](ref/) folder for detailed docs

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
