---
description: Automate release process - bump version, update CHANGELOG, push tags. Use when user asks to create/publish a release, or says "/release"
---

# Release Automation

Automate the release process for the GitLab Blame MR Link VS Code extension.

## When to Use This Skill

Activate this skill when the user:
- Says "/release" explicitly
- Asks to "create a release"
- Asks to "publish a new version"
- Mentions "bump version" or "release to marketplace"

## What This Skill Does

1. **Pre-release validation**
   - Runs lint, typecheck, and build
   - Ensures all tests pass with coverage thresholds

2. **CHANGELOG update**
   - Prompts for release notes or auto-generates from commits
   - Updates CHANGELOG.md with new version section

3. **Version bump**
   - Asks for release type (patch/minor/major)
   - Runs appropriate npm version script
   - Creates commit and git tag

4. **Push to remote**
   - Pushes version bump commit to main
   - Pushes tag to trigger CI/CD workflow

5. **Monitoring**
   - Provides GitHub Actions workflow URL
   - Lists what the CI will do

## Usage Examples

User says:
- `/release patch` → Create patch release
- `/release minor` → Create minor release
- `/release` → Ask for release type
- `Create a release` → Full interactive release process

## Step-by-Step Instructions

When this skill is invoked:

### 1. Check Git Status
- Ensure working directory is clean
- Ensure on main branch
- Show any uncommitted changes
- If not clean, offer to show status or stash

### 2. Validation
- Ask if user wants to run validation
- If yes, run `npm run validate`
- If validation fails, recommend fixing issues before proceeding

### 3. Update CHANGELOG
- Read CHANGELOG.md
- Check recent commits since last release: `git log v{last-version}..HEAD --pretty=format:"- %s (%h)"`
- Ask user for release notes OR show auto-generated list
- Add new version section with current date
- Show preview and confirm with user

### 4. Determine Version Type
- If provided as argument (patch/minor/major), use that
- Otherwise, ask user to choose
- Show current version → new version preview

### 5. Execute Version Bump
- Commit CHANGELOG first (if modified)
- Run `npm run version:{type}` (creates commit + tag)
- Show success message

### 6. Push to Remote
- Push commit: `git push origin main`
- Push tag: `git push origin v{version}`

### 7. Provide Monitoring Info
- Show GitHub Actions URL: https://github.com/SebastienLeonce/gitlab-blame/actions
- List CI workflow steps:
  1. Verify version matches tag
  2. Run typecheck, lint, build
  3. Run tests
  4. Publish to Open VSX Registry
  5. Publish to VS Code Marketplace
  6. Create GitHub Release with changelog
- Mention typical completion time (~2-3 minutes)
- After workflow completes, verify on both marketplaces:
  - VS Code Marketplace: https://marketplace.visualstudio.com/items?itemName=sebastien-dev.gitlab-blame
  - Open VSX Registry: https://open-vsx.org/extension/sebastien-dev/gitlab-blame

## Error Handling

- **Working directory not clean** → Offer to show `git status` or stash changes
- **Not on main branch** → Warn and offer to `git checkout main`
- **Validation fails** → Offer to skip (--skip-validation) or fix
- **Network error during push** → Suggest retry
- **Tag already exists** → Offer to delete and recreate OR bump to next version

## Context Files

Reference these files when executing this skill:
- `ref/release-process.md` - Full release documentation
- `.github/workflows/publish.yml` - CI/CD workflow details
- `package.json` - Current version and scripts
- `CHANGELOG.md` - Release history

## Important Notes

- **Manual tagging workflow** - tags trigger publish, not automatic version detection
- **Semantic versioning**: patch = bug fixes, minor = features, major = breaking changes
- **Quality gates** - Pre-push hooks enforce coverage thresholds and test success

## Example Flow

```
User: /release patch

Claude:
1. ✅ Git status clean, on main branch
2. 🔍 Checking recent commits...
   Found 3 commits since v0.2.2:
   - fix(hover): truncate long MR titles
   - test(provider): add coverage for error cases
   - docs(readme): update installation steps

3. 📝 Updating CHANGELOG.md...
   [Shows preview]

4. ⬆️  Bumping version 0.2.2 → 0.2.3...

5. 🚀 Pushing to remote...
   - Commit pushed ✅
   - Tag v0.2.3 pushed ✅

6. 📊 Monitor release: https://github.com/.../actions
   CI will publish to marketplace in ~2-3 minutes
```
