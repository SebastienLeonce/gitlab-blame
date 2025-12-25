---
description: Automate release process - bump version, update CHANGELOG, push commits. Auto-tag workflow handles tagging. Use when user asks to create/publish a release, or says "/release"
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
   - Creates commit (tag is created locally but NOT pushed)

4. **Push to remote**
   - Pushes ONLY the version bump commit to main
   - ⚠️ **CRITICAL**: Does NOT push tags manually
   - Auto-tag workflow automatically detects version change and creates tag after CI passes

5. **Monitoring**
   - Provides GitHub Actions workflow URL
   - Lists what the automated workflows will do

## Usage Examples

User says:
- `/release patch` → Create patch release
- `/release minor` → Create minor release
- `/release` → Ask for release type
- `Create a release` → Full interactive release process

## ⚠️ CRITICAL RULE: Never Push Tags Manually

**This project uses automated tagging starting from v1.4.0.**

✅ **ALWAYS DO**:
- Push only commits: `git push origin main`
- Let auto-tag workflow create and push tags
- Wait for CI to pass before tag creation

❌ **NEVER DO**:
- `git push origin v1.x.x` (manual tag push)
- `git push --tags` (push all tags)
- Any manual tag creation after version bump

**Why**: The auto-tag workflow ensures CI passes before creating tags, preventing broken releases.

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
- **ONLY run this command**: `git push origin main`
- ⚠️ **DO NOT** run: `git push origin v{version}` or `git push --tags`
- **Automatic**: Auto-tag workflow detects version change and creates tag (after CI passes)
- **Automatic**: Tag triggers publish workflow
- Confirm to user: "Pushed commits to main. Auto-tag workflow will create tag after CI passes (~1-2 min)"

### 7. Provide Monitoring Info
- Show GitHub Actions URL: https://github.com/SebastienLeonce/gitlab-blame/actions
- Explain automation:
  1. Auto-tag workflow detects version change (~30 seconds)
  2. Creates and pushes tag v{version}
  3. Tag triggers publish workflow
  4. Publish workflow runs:
     - Verify version matches tag
     - Run typecheck, lint, build
     - Run unit + E2E tests
     - Publish to Open VSX Registry
     - Publish to VS Code Marketplace
     - Create GitHub Release with changelog
- Mention typical completion time (~5-8 minutes total)
- After workflow completes, verify on both marketplaces:
  - VS Code Marketplace: https://marketplace.visualstudio.com/items?itemName=sebastien-dev.gitlab-blame
  - Open VSX Registry: https://open-vsx.org/extension/sebastien-dev/gitlab-blame

## Error Handling

- **Working directory not clean** → Offer to show `git status` or stash changes
- **Not on main branch** → Warn and offer to `git checkout main`
- **Validation fails** → Offer to skip (--skip-validation) or fix
- **Network error during push** → Suggest retry
- **Tag already exists** → Offer to delete and recreate OR bump to next version

## Troubleshooting

### Auto-Tag Workflow Fails
- **Symptom**: Version bumped and pushed, but no tag created
- **Cause**: CI workflow may have failed
- **Fix**: Check GitHub Actions for CI failure, fix issues, push again

### Manual Tag Fallback
If automatic tagging fails:
```bash
# Manually create and push tag
git tag v{version}
git push origin v{version}
```

### E2E Tests Fail After Tag Creation
- **Symptom**: Tag created, but publish workflow fails
- **Recovery**: Create new patch version with fix
```bash
npm run version:patch
git push origin main
```

## Context Files

Reference these files when executing this skill:
- `ref/release-process.md` - Full release documentation
- `.github/workflows/publish.yml` - CI/CD workflow details
- `package.json` - Current version and scripts
- `CHANGELOG.md` - Release history

## Important Notes

- **Automatic tagging workflow** - Tags created automatically when version bumps pushed to main
- **Semantic versioning**: patch = bug fixes, minor = features, major = breaking changes
- **Quality gates** - E2E tests run in CI and must pass before publishing

## Example Flow

```
User: /release patch

Claude:
1. ✅ Git status clean, on main branch
2. 🔍 Checking recent commits...
   Found 3 commits since v1.3.0:
   - fix(hover): truncate long MR titles
   - test(provider): add coverage for error cases
   - docs(readme): update installation steps

3. 📝 Updating CHANGELOG.md...
   [Shows preview]

4. ⬆️  Bumping version 1.3.0 → 1.3.1...
   - Commit created: chore(release): bump to v1.3.1

5. 🚀 Pushing to main...
   - Running: git push origin main
   - ✅ Commits pushed successfully

6. 🤖 Automated workflow now running:
   - Auto-tag workflow will detect version change (~1-2 min)
   - Workflow will create and push tag v1.3.1 after CI passes
   - Tag will trigger publish workflow

7. 📊 Monitor progress: https://github.com/.../actions
   - Watch for "Auto-tag" workflow to complete
   - Then "Publish" workflow will start
   - Total time: ~5-10 minutes

   After completion, verify at:
   - VS Code Marketplace: marketplace.visualstudio.com/...
   - Open VSX Registry: open-vsx.org/...
```
