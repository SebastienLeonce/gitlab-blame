# Changelog

All notable changes to the "Git Blame MR/PR Link" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Automated Tagging** - Tags created automatically when package.json version changes
  - Auto-tag workflow (`.github/workflows/auto-tag.yml`) detects version changes on main branch
  - Creates and pushes version tags without manual intervention
  - Waits for CI to pass before creating tags
  - Triggers publish workflow automatically
- **E2E Tests in CI** - E2E tests now run on every PR and push to main
  - Added to `ci.yml` workflow alongside unit tests
  - Also runs in publish workflow as final validation
  - Blocks both PR merges and releases if failing
- **Enhanced Quality Gates** - Improved CI/CD pipeline
  - Concurrency control prevents conflicting releases
  - Version validation ensures tag/package.json match
  - Enhanced error reporting with recovery instructions
  - Pre-push hook warns about automatic tagging

### Changed
- **Developer Workflow Simplified** - No manual tag pushing required
  - Before: `npm run version:patch && git push origin main && git push origin v1.3.1`
  - After: `npm run version:patch && git push origin main`
- **Release Documentation** - Updated for automated workflow
  - `ref/release-process.md` now describes automated tagging with troubleshooting guide
  - `CONTRIBUTING.md` updated with new developer workflow
  - `CLAUDE.md` updated with release protocol and recovery procedures
- **Publish Workflow Enhanced** - Now includes E2E tests before publishing

### Fixed

### Security

## [1.3.0] - 2025-12-24

### Added
- **Inline MR/PR Annotations** - New display mode showing MR/PR links as end-of-line decorations
  - Three display modes: `hover` (tooltip only), `inline` (annotations only), `both`
  - Toggle via command palette: "Git Blame: Toggle Display Mode"
  - Configurable via `gitlabBlame.displayMode` setting

### Changed
- Default display mode changed to `inline` for immediate visibility

### Technical
- Added package-lock.json sync validation to pre-commit hooks

## [1.2.0] - 2025-12-22

### Added
- **Centralized ErrorLogger Service** - New singleton service for consistent error logging across all components
  - Provides `error()`, `warn()`, and `info()` methods with standardized format: `[Provider] Context: Message`
  - Integrates with VS Code Output Channel for centralized logging
  - Includes `reset()` method for test isolation
  - All logging now uses ErrorLogger instead of direct `console.*` calls

### Changed
- **Enhanced Code Quality** - Strengthened ESLint configuration with additional rules:
  - `no-console`: Enforced to prevent direct console usage (all logging through ErrorLogger)
  - `no-magic-numbers`: Enforced to improve code readability
  - `import/order`: Enforced for consistent import organization
- **Constants Extraction** - Extracted magic numbers to named constants:
  - `HTTP_STATUS`: HTTP status code constants (200, 401, 403, 404, 429)
  - `TIME_CONSTANTS`: Time conversion constants (milliseconds per second/minute/hour)
  - `UI_CONSTANTS`: UI-related constants (hover text limits, cache clearing messages)
  - `BLAME_CONSTANTS`: Git blame parsing constants (minimum SHA length, uncommitted SHA)
- **Error Handling Improvements** - Standardized error logging in `extension.ts` and `handleVcsError()`
- **Documentation Updates** - Updated all code examples in `ref/patterns.md`, `ref/api/services.md`, and `CONTRIBUTING.md` to use ErrorLogger instead of `console.*`

### Technical
- Added dev dependencies: `eslint-plugin-import` and `eslint-import-resolver-typescript`
- All code follows consistent logging patterns with centralized error management
- Improved code maintainability with named constants and organized imports

## [1.1.0] - 2025-12-21

### Changed
- **Extension Branding** - Display name changed from "GitLab Blame MR Link" to "Git Blame MR/PR Link" to better reflect multi-provider support
- **Command Titles** - Updated from "GitLab Blame:" to "Git Blame:" prefix for provider-neutral branding
- **Gallery Banner** - Changed from GitLab orange to neutral dark gray (#2D2D2D) for multi-provider identity
- **Marketplace Optimization** - Completely restructured README.md for marketplace presentation:
  - Reduced from 362 to 274 lines with user-focused content
  - Added problem-solution-benefit hook
  - Added emoji section headers for improved scannability
  - Removed development documentation (moved to CONTRIBUTING.md)
  - Added visual placeholders for screenshots and demo GIF
- **Keywords** - Added GitHub-related keywords (github, pull request, pr, mr, link) for better discoverability
- **Description** - Updated to explicitly mention both GitLab and GitHub support

### Added
- **CONTRIBUTING.md** - Comprehensive development documentation including:
  - Development setup and prerequisites
  - Architecture overview
  - Testing guidelines and coverage requirements
  - Code quality standards and git hooks
  - Pull request process and commit message format
- **Visual Assets Folder** - Created `images/` directory with:
  - README.md with screenshot creation instructions
  - Placeholder files for screenshot-hover.png and demo.gif

### Technical
- Extension ID preserved as `gitlab-blame` (no breaking changes for existing users)
- All functionality remains backward compatible
- Improved marketplace discoverability for GitHub users

## [1.0.1] - 2025-12-21

### Added
- **Open VSX Registry Support** - Extension now published to Open VSX for VSCodium, Gitpod, and Theia users
- Dual marketplace publishing automation via GitHub Actions
- Open VSX installation instructions in README

### Changed
- Migrated from `vsce` CLI to HaaLeo/publish-vscode-extension GitHub Action for more reliable publishing
- Removed `extensionDependencies` declaration for better VSCodium compatibility (code already handles missing extensions)

### Fixed
- Potential activation issues on VSCodium and other Open VSX clients

## [1.0.0] - 2025-12-21

### Added
- **GitHub Provider Support** - Full GitHub and GitHub Enterprise support with smart fallback PR detection
  - Primary detection via `/commits/{sha}/pulls` API endpoint
  - Fallback to commit message parsing for `(#123)` and `Merge pull request` patterns
  - Automatic provider detection from git remote URLs
- Claude Code release automation skill for streamlined release process
- Comprehensive public API test coverage (90%+ across all metrics)

### Changed
- **BREAKING**: Extension now supports multiple VCS providers (GitLab + GitHub)
- Enhanced quality gates with enforced coverage thresholds (90% lines/functions/statements, 85% branches)
- Updated marketplace branding to reflect multi-provider architecture

### Fixed
- Marketplace links updated to correct publisher name (`sebastien-dev`)

## [0.2.2] - 2025-12-20

### Fixed
- Extension ID compatibility after publisher name change
- CI coverage checks temporarily disabled to unblock releases

### Changed
- Improved release process documentation with manual tagging workflow

## [0.2.0] - 2025-12-20

### Added
- Automated marketplace publishing workflow triggered by git tags
- Extension icon with GitLab branding for marketplace listing
- Version management scripts (version:patch, version:minor, version:major)
- GitHub Actions workflow for automated releases
- Automatic changelog generation in GitHub releases

### Changed
- Enhanced package.json metadata for better marketplace discoverability
  - Added keywords (gitlab, git, blame, merge request, vcs, hover, scm)
  - Changed category to "SCM Providers"
  - Added GitLab-themed gallery banner
  - Added marketplace Q&A, bugs, and homepage links

## [0.1.0] - 2024-12-20

### Added
- Initial release of GitLab Blame MR Link extension
- GitLab Merge Request links in git blame hover tooltips
- Multi-provider VCS architecture (ready for GitHub/Bitbucket support)
- Token management commands (`Set Token`, `Delete Token`)
- Cache management with configurable TTL (`Clear Cache` command)
- Status command to view extension configuration
- Support for self-hosted GitLab instances
- Automatic provider detection from git remote URL
- Zero runtime dependencies for optimal performance

### Changed
- Migrated from single-provider to multi-provider architecture
- Improved blame parser for VS Code Git API standard format
- Enhanced test coverage with comprehensive service tests

### Fixed
- Test coverage configuration for bundled output with sourcemaps
- Codecov badge URL to use lowercase username
- Extension ID to match new publisher name
- Build configuration to exclude test coverage and environment files from package
