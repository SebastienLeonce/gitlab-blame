# Changelog

All notable changes to the "Git Blame MR/PR Link" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

### Changed

### Fixed

### Security

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
