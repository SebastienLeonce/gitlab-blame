# Changelog

All notable changes to the "GitLab Blame MR Link" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

### Changed

### Fixed

### Security

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
