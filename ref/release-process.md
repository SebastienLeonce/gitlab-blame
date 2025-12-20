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

### Current Release Process (Manual Tagging)

The project uses **manual tagging** with automated publishing:

1. **Developer bumps version** using npm scripts (creates commit and tag locally)
2. **Developer pushes commit** to main branch
3. **Developer pushes tag** to remote (`git push origin v<version>`)
4. **GitHub Actions detects tag push** and triggers publish workflow
5. **CI runs quality checks** (lint, typecheck, test, build)
6. **CI publishes to VS Code Marketplace** (if checks pass)
7. **CI creates GitHub Release** with changelog

**Workflow Summary**:
```bash
npm run version:patch         # Bump version (creates commit + tag)
git push origin main          # Push version bump commit
git push origin v<version>    # Push tag → triggers publish workflow
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
# Push the version bump commit
git push origin main

# Push the tag to trigger publish workflow
git push origin v<version>
```

**Example for v0.2.1**:
```bash
npm run version:patch  # Creates v0.2.1 tag locally
git push origin main
git push origin v0.2.1  # Triggers GitHub Actions publish workflow
```

**Alternative - Push commit and tag together**:
```bash
git push origin main --follow-tags
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

## Optional: Automatic Tagging (Future Enhancement)

Currently, tags are created **manually** using `npm version`. If you want to automate tag creation when `package.json` version changes, you can add a GitHub Actions workflow.

### How Automatic Tagging Would Work

1. Developer runs `npm run version:patch` (creates commit, bumps version)
2. Developer pushes commit: `git push origin main`
3. **GitHub Actions detects `package.json` change**
4. **Workflow compares versions** (current vs previous commit)
5. **If version changed, workflow creates and pushes tag**
6. **Tag push triggers publish workflow** (existing `publish.yml`)

### Example Auto-Tag Workflow

Create `.github/workflows/version-tag.yml`:

```yaml
name: Auto Tag on Version Change

on:
  push:
    branches: [main]
    paths:
      - 'package.json'  # Only run when package.json changes

jobs:
  check-version:
    runs-on: ubuntu-latest
    permissions:
      contents: write  # Required to create tags

    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 2  # Fetch current + previous commit

      - name: Check if version changed
        id: version_check
        run: |
          CURRENT=$(node -p "require('./package.json').version")
          git checkout HEAD~1 -- package.json
          PREVIOUS=$(node -p "require('./package.json').version")
          git checkout HEAD -- package.json

          if [ "$CURRENT" != "$PREVIOUS" ]; then
            echo "changed=true" >> $GITHUB_OUTPUT
            echo "version=$CURRENT" >> $GITHUB_OUTPUT
          fi

      - name: Create and push tag
        if: steps.version_check.outputs.changed == 'true'
        run: |
          TAG="v${{ steps.version_check.outputs.version }}"
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git tag -a "$TAG" -m "Release $TAG"
          git push origin "$TAG"
```

### Pros and Cons

**Pros**:
- ✅ Developers only need to run `npm version` and push
- ✅ No need to manually push tags
- ✅ Consistent tagging process

**Cons**:
- ❌ Less control over when tags are created
- ❌ Tags created even for accidental version bumps
- ❌ Requires careful management of `package.json` changes

**Current Decision**: Using **manual tagging** for better control.

---

## References

- [Semantic Versioning](https://semver.org/)
- [Publishing Extensions (VS Code)](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [vsce CLI Documentation](https://github.com/microsoft/vscode-vsce)
- [Keep a Changelog](https://keepachangelog.com/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [GitHub Actions - Workflow Syntax](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions)
