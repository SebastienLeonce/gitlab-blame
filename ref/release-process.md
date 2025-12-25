# Release Process

This document describes the versioning, release, and publishing workflow for the GitLab Blame MR Link extension.

---

## Versioning Strategy

The extension follows **Semantic Versioning (SemVer)**: `MAJOR.MINOR.PATCH`

- **MAJOR** (1.0.0) - Breaking changes, incompatible API changes
- **MINOR** (0.2.0) - New features, backwards-compatible functionality
- **PATCH** (0.2.1) - Bug fixes, backwards-compatible fixes

**Current Version**: See `package.json` → `"version"`

---

## Release Workflow

### Current Release Process (Automated Tagging)

The project uses **automated tagging** with automated publishing:

1. **Developer bumps version** using npm scripts (creates commit and tag locally)
2. **Developer pushes commit** to main branch
3. **Auto-tag workflow detects version change** and waits for CI to pass
4. **Auto-tag workflow creates and pushes tag** automatically
5. **GitHub Actions detects tag push** and triggers publish workflow
6. **CI runs quality checks** (lint, typecheck, test, E2E tests, build)
7. **CI publishes to VS Code Marketplace** (if checks pass)
8. **CI creates GitHub Release** with changelog

**Workflow Summary**:
```bash
npm run version:patch         # Bump version (creates commit + tag)
git push origin main          # Push version bump commit → automatic tagging
```

---

## How to Create a Release

### 1. Choose Release Type

Decide which version component to bump:

| Change Type | Command | Example | When to Use |
|-------------|---------|---------|-------------|
| **Patch** | `npm run version:patch` | 0.2.0 → 0.2.1 | Bug fixes, typos, minor corrections |
| **Minor** | `npm run version:minor` | 0.2.1 → 0.3.0 | New features, enhancements |
| **Major** | `npm run version:major` | 0.3.0 → 1.0.0 | Breaking changes, API changes |

### 2. Run Version Script

```bash
# For a patch release (most common)
npm run version:patch

# For a minor release (new features)
npm run version:minor

# For a major release (breaking changes)
npm run version:major
```

**What happens**:
- `package.json` version is bumped
- Git commit is created: `chore(release): bump to v<version>`
- Git tag is created locally: `v<version>`

### 3. Push to Remote

```bash
# Push the version bump commit (automatic tagging will trigger)
git push origin main
```

**What happens automatically**:
1. Auto-tag workflow detects `package.json` version change
2. Workflow waits for CI to pass (up to 10 minutes)
3. Workflow creates and pushes tag: `v<version>`
4. Tag push triggers publish workflow

**Example for v0.2.1**:
```bash
npm run version:patch  # Creates v0.2.1 tag locally
git push origin main   # Triggers automatic tagging → publish workflow
```

**Manual tag fallback** (if automatic tagging fails):
```bash
git push origin v0.2.1  # Manually push tag
```

### 4. GitHub Actions Publish Workflow

When you push a tag (`v*.*.*`), the **publish.yml** workflow automatically:

1. ✅ **Verifies version match** - Ensures git tag matches `package.json` version
2. ✅ **Runs quality checks**:
   - TypeScript type check (`npm run typecheck`)
   - ESLint (`npm run lint`)
   - Production build (`npm run build`)
   - Test suite (`npm test`)
3. ✅ **Packages extension** - Creates `.vsix` file
4. ✅ **Publishes to VS Code Marketplace** - Requires `VSCE_PAT` secret
5. ✅ **Generates changelog** - From commits since last tag
6. ✅ **Creates GitHub Release** - With changelog and `.vsix` attachment

**Workflow file**: `.github/workflows/publish.yml`

**Required secrets**:
- `VSCE_PAT` - VS Code Marketplace Personal Access Token

---

## Manual Publishing (Without CI)

If CI is not set up or you need to publish manually:

### Prerequisites

1. **VS Code Publisher Account**
   - Create account at https://marketplace.visualstudio.com/manage
   - Create publisher ID (e.g., `sebastien-dev`)

2. **Personal Access Token (PAT)**
   - Generate from Azure DevOps: https://dev.azure.com
   - Scopes required: `Marketplace (Manage)`
   - Store securely (never commit to git)

3. **Configure vsce**
   ```bash
   vsce login <publisher-id>
   # Enter your PAT when prompted
   ```

### Package Extension

Create a `.vsix` file for local testing or manual distribution:

```bash
npm run package
```

**Output**: `gitlab-blame-<version>.vsix`

**Install locally**:
```bash
code --install-extension gitlab-blame-<version>.vsix
```

### Publish to Marketplace

Publish the extension to VS Code Marketplace:

```bash
npm run publish
```

**What happens**:
- Builds production bundle
- Packages extension
- Uploads to VS Code Marketplace
- Extension becomes available after review (first publish) or immediately (updates)

---

## Pre-Release Checklist

Before creating a release, ensure:

- [ ] All changes are committed
- [ ] Tests pass: `npm test`
- [ ] Coverage meets thresholds: `npm run test:coverage`
- [ ] Linting passes: `npm run lint`
- [ ] TypeScript compiles: `npm run typecheck`
- [ ] Production build succeeds: `npm run build`
- [ ] Documentation is updated (ref/ folder, CLAUDE.md, README.md)
- [ ] CHANGELOG.md is updated (if exists)

**Tip**: Run all checks at once:
```bash
npm run validate
```

---

## Git Hooks and Releases

### Pre-Commit Hook

When bumping version, pre-commit hook may trigger if docs need updating:
- Update `CLAUDE.md` if version or commands changed
- Update `README.md` if user-facing changes
- Update `ref/` docs if architecture/API changed

### Pre-Push Hook

Pre-push hook runs when pushing version bump:
- All tests must pass
- Coverage must meet thresholds (90%/85%)
- Production build must succeed

**Bypass** (emergency only):
```bash
git push --no-verify origin main
```

---

## Release Notes

### Conventional Commits

Use conventional commits for automatic changelog generation:

```bash
feat(providers): add GitHub provider support
fix(cache): prevent race condition in TTL expiry
docs(readme): update installation instructions
```

**Types**: `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `chore`, `ci`

### CHANGELOG.md (Optional)

If maintaining a changelog, follow [Keep a Changelog](https://keepachangelog.com/) format:

```markdown
## [0.2.1] - 2025-01-20

### Fixed
- Corrected publisher name in package.json

### Changed
- Improved git hook error messages
```

---

## CI/CD Configuration

### Expected CI Workflow

The CI pipeline should:

1. **Detect Version Change**
   ```yaml
   # Check if package.json version changed
   git diff HEAD~1 package.json | grep '"version"'
   ```

2. **Create Git Tag**
   ```yaml
   # Extract version from package.json
   VERSION=$(node -p "require('./package.json').version")

   # Create and push tag
   git tag "v$VERSION"
   git push origin "v$VERSION"
   ```

3. **Run Quality Checks**
   ```yaml
   npm run validate  # lint + typecheck + test:coverage + build
   ```

4. **Package Extension**
   ```yaml
   npm run package
   ```

5. **Publish to Marketplace** (Optional)
   ```yaml
   # Requires VSCE_PAT secret
   npm run publish
   ```

6. **Create GitHub Release** (Optional)
   ```yaml
   # Use gh CLI or GitHub Actions
   gh release create "v$VERSION" \
     --title "v$VERSION" \
     --notes "Release notes here" \
     gitlab-blame-*.vsix
   ```

### Environment Variables

CI needs these secrets configured:

| Variable | Purpose | How to Get |
|----------|---------|------------|
| `VSCE_PAT` | VS Code Marketplace token | https://dev.azure.com → User Settings → Personal Access Tokens |
| `GITHUB_TOKEN` | GitHub releases (optional) | Automatically provided by GitHub Actions |

---

## Troubleshooting

### "Tag already exists"

If CI creates a tag but push fails:
```bash
# Delete local tag
git tag -d v<version>

# Delete remote tag
git push origin :refs/tags/v<version>

# Let CI recreate it
git push origin main
```

### "Publish failed: Authentication required"

Configure vsce with your PAT:
```bash
vsce login <publisher-id>
```

Or set environment variable:
```bash
export VSCE_PAT=your-token-here
npm run publish
```

### "Coverage threshold not met"

Pre-push hook blocks releases with low coverage:
- Fix tests and improve coverage
- OR temporarily bypass: `git push --no-verify` (not recommended)
- OR adjust thresholds in `package.json` → `c8` config

### "Tests failing in CI"

Integration tests may fail in CI environment:
- Skip integration tests: modify test suite to exclude `integration.test.ts`
- OR run only unit tests in CI: `npm run test:unit` (if configured)

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 0.2.1 | 2025-12-20 | Fixed publisher name, added git hooks |
| 0.2.0 | 2025-12-19 | Initial release with GitLab support |

See `CHANGELOG.md` for detailed version history.

---

## Automated Tagging Workflow

### How It Works

Starting from v1.4.0, tags are created **automatically** when `package.json` version changes:

1. Developer runs `npm run version:patch` (creates commit with version bump)
2. Developer pushes to main: `git push origin main`
3. Auto-tag workflow (`.github/workflows/auto-tag.yml`) detects package.json change
4. Workflow waits for CI to pass (up to 10 min)
5. Workflow creates and pushes tag: `v1.3.1`
6. Tag triggers publish workflow
7. Publish workflow runs E2E tests + quality checks
8. If all pass, publishes to marketplaces

### Developer Workflow

**Before (Manual)**:
```bash
npm run version:patch
git push origin main
git push origin v1.3.1  # Manual tag push
```

**After (Automatic)**:
```bash
npm run version:patch
git push origin main  # That's it! Tag created automatically
```

### E2E Tests in CI

E2E tests now run in two places:
1. **CI workflow** (`ci.yml`) - Every PR/push to main (catches issues early)
2. **Publish workflow** (`publish.yml`) - Final validation before publishing

Both workflows use the same E2E test suite (~22 tests, 2-3 minutes execution time).

---

## Troubleshooting

### Publish Failed After Tag Creation

**Symptoms**: Tag v1.3.1 created, but publish workflow failed.

**Recovery** (Recommended):
```bash
# Fix the issue
git add .
git commit -m "fix(test): resolve E2E test flakiness"
git push origin main

# Bump to new patch version
npm run version:patch  # v1.3.2
git push origin main
```

**Why new version is better**:
- ✅ Clean git history (no force-push)
- ✅ Clear audit trail
- ✅ No tag deletion (avoids confusion)
- ✅ SemVer compliant

**Alternative** (Not Recommended):
```bash
# Delete failed tag and retry
git tag -d v1.3.1
git push origin :refs/tags/v1.3.1
# Fix issues, then manual tag
git tag v1.3.1
git push origin v1.3.1
```

### E2E Tests Fail in CI

**Policy**: E2E failures block both PR merges and releases.

```bash
# Reproduce locally
npm run test:e2e

# Fix and push
git add .
git commit -m "fix(e2e): resolve test issue"
git push origin main
```

### Multiple Rapid Releases

**Best Practice**: Wait for CI to complete before next version bump (~2-5 min).

Check status: https://github.com/SebastienLeonce/gitlab-blame/actions

**Why wait**:
- Auto-tag workflow needs time to complete
- Multiple concurrent publishes can cause conflicts
- Marketplace may reject rapid updates

### Auto-Tag Workflow Fails

**Symptoms**: Version bumped and pushed, but no tag created.

**Cause**: CI workflow may have failed before auto-tag could run.

**Fix**:
```bash
# Check GitHub Actions for CI failure
# Fix issues and push again
git add .
git commit -m "fix: resolve CI failure"
git push origin main
```

**Manual fallback**:
```bash
# If auto-tag continues to fail
git push origin v1.3.1  # Manually push tag
```

---

## References

- [Semantic Versioning](https://semver.org/)
- [Publishing Extensions (VS Code)](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [vsce CLI Documentation](https://github.com/microsoft/vscode-vsce)
- [Keep a Changelog](https://keepachangelog.com/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [GitHub Actions - Workflow Syntax](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions)
