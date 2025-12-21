# GitLab Blame MR Link

[![CI](https://github.com/SebastienLeonce/gitlab-blame/actions/workflows/ci.yml/badge.svg)](https://github.com/SebastienLeonce/gitlab-blame/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/sebastienleonce/gitlab-blame/branch/main/graph/badge.svg)](https://codecov.io/gh/sebastienleonce/gitlab-blame)
[![VS Code Marketplace](https://img.shields.io/vscode-marketplace/v/sebastien-dev.gitlab-blame.svg?label=VS%20Code%20Marketplace&logo=visual-studio-code)](https://marketplace.visualstudio.com/items?itemName=sebastien-dev.gitlab-blame)
[![Installs](https://img.shields.io/vscode-marketplace/i/sebastien-dev.gitlab-blame.svg)](https://marketplace.visualstudio.com/items?itemName=sebastien-dev.gitlab-blame)
[![Rating](https://img.shields.io/vscode-marketplace/r/sebastien-dev.gitlab-blame.svg)](https://marketplace.visualstudio.com/items?itemName=sebastien-dev.gitlab-blame)

A lightweight VS Code extension that enhances git blame with Merge Request/Pull Request links. Hover over any line to see which MR/PR introduced the change.

## Features

- **Multi-Provider Support** - Works with **GitLab** and **GitHub** (including Enterprise)
- **Inline Blame Hover** - See commit info (author, date, message, SHA) and MR/PR link on hover
- **Auto-Detection** - Automatically detects GitLab or GitHub from your git remote
- **Multi-Instance Support** - Works with gitlab.com, github.com, and self-hosted instances
- **Smart Caching** - TTL-based caching with automatic invalidation on git operations
- **Secure Token Storage** - Uses VS Code SecretStorage for Personal Access Tokens
- **Zero Dependencies** - Uses native VS Code and Fetch APIs

## Installation

### From VS Code Marketplace

Search for "GitLab Blame MR Link" in the Extensions view (`Ctrl+Shift+X`).

### Manual Installation

1. Download the `.vsix` file from releases
2. Run `code --install-extension gitlab-blame-mr-link-*.vsix`

## Configuration

### Personal Access Token

The extension **automatically detects** whether you're using GitLab or GitHub based on your git remote URL.

#### For GitLab

1. Generate a PAT in GitLab: **Settings > Access Tokens**
2. Required scope: `read_api`
3. Run command: `GitLab Blame: Set Personal Access Token`

#### For GitHub

1. Generate a PAT in GitHub: **Settings > Developer settings > Personal access tokens > Tokens (classic)**
2. Required scopes:
   - `repo` (for private repositories)
   - OR `public_repo` (for public repositories only)
3. Run command: `GitLab Blame: Set Personal Access Token`

**Note**: The command auto-detects which provider you're using from your current workspace and shows the appropriate prompt.

### Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `gitlabBlame.gitlabUrl` | `https://gitlab.com` | GitLab instance URL |
| `gitlabBlame.githubUrl` | `https://github.com` | GitHub URL (auto-converted to API URL) |
| `gitlabBlame.cacheTTL` | `3600` | Cache timeout in seconds (0 to disable) |

**Example** (`settings.json`):

```json
{
  "gitlabBlame.gitlabUrl": "https://gitlab.mycompany.com",
  "gitlabBlame.githubUrl": "https://github.com",
  "gitlabBlame.cacheTTL": 7200
}
```

**GitHub Enterprise**:
```json
{
  "gitlabBlame.githubUrl": "https://github.enterprise.com"
}
```

## Usage

1. Open a file in a git repository with a GitLab or GitHub remote
2. Hover over any line
3. See commit details and click the MR/PR link to open in browser

The extension automatically detects whether you're using GitLab or GitHub based on your git remote URL.

## Commands

| Command | Description | Auto-Detection |
|---------|-------------|----------------|
| `GitLab Blame: Set Personal Access Token` | Configure your PAT | ✓ Detects GitLab/GitHub from git remote |
| `GitLab Blame: Delete Personal Access Token` | Remove stored token | ✓ Detects GitLab/GitHub from git remote |
| `GitLab Blame: Clear Cache` | Clear cached MR/PR data | N/A |
| `GitLab Blame: Show Status` | Display configuration and cache info for all providers | Shows GitLab + GitHub status |

Access commands via Command Palette (`Ctrl+Shift+P`).

## Supported Remote Formats

### GitLab
- SSH: `git@gitlab.com:group/project.git`
- HTTPS: `https://gitlab.com/group/project.git`
- Nested groups: `group/subgroup/project`

### GitHub
- SSH: `git@github.com:owner/repo.git`
- HTTPS: `https://github.com/owner/repo.git`

**Note**: The extension uses the `origin` remote. If you have multiple remotes, ensure `origin` points to your primary VCS.

## Development

### Prerequisites

- Node.js 18.x or 20.x
- VS Code 1.84.0+

### Setup

```bash
npm install
```

### Build & Run

```bash
npm run watch     # Development with sourcemaps
npm run build     # Production build
```

Press `F5` in VS Code to launch the extension in debug mode.

### Test

```bash
npm run pretest   # Compile tests
npm test          # Run tests
```

### Lint

```bash
npm run lint      # Check for issues
npm run lint:fix  # Auto-fix issues
```

## Architecture

This extension uses a **multi-provider architecture** that supports multiple VCS platforms through an abstraction layer.

```
src/
├── extension.ts                     # Entry point, command registration
├── interfaces/
│   ├── ICacheService.ts             # Cache service interface
│   ├── IVcsProvider.ts              # VCS provider interface
│   └── types.ts                     # Shared type definitions
├── providers/
│   ├── BlameHoverProvider.ts        # Hover provider (VCS-agnostic)
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
    └── git.d.ts                     # VS Code Git extension types
```

### Key Components

- **VcsProviderFactory**: Auto-detects VCS provider from git remote URL (GitLab or GitHub)
- **IVcsProvider**: Interface enabling multi-provider support (GitLab, GitHub, future: Bitbucket)
- **TokenService**: Secure multi-provider token storage via VS Code SecretStorage
- **CacheService**: TTL-based cache with provider isolation and automatic invalidation

**Provider-Specific Caching**: Cache keys include provider ID (`gitlab:sha` vs `github:sha`) to prevent collisions when the same commit SHA exists in both providers.

For detailed architecture documentation, see [`ref/architecture.md`](ref/architecture.md).

## Troubleshooting

### MR link not showing in hover

**Possible causes:**

1. **No Personal Access Token configured**
   - Run: `GitLab Blame: Set Personal Access Token`
   - Ensure token has `read_api` scope

2. **Commit not associated with any MR**
   - Some commits may not be part of a merge request
   - Direct commits to main branch won't have MR links

3. **Cache contains stale data**
   - Run: `GitLab Blame: Clear Cache`
   - Cache auto-invalidates on git operations

4. **Remote URL not recognized**
   - Check that your git remote uses GitLab
   - Supported formats: SSH (`git@gitlab.com:group/project.git`) or HTTPS (`https://gitlab.com/group/project.git`)
   - Run `git remote -v` to verify

### Authentication errors

**Error: "Token not found" or "Authentication failed"**

1. Verify token is set: Run `GitLab Blame: Show Status`
2. Check token scope includes `read_api`
3. For self-hosted GitLab, verify `gitlabBlame.gitlabUrl` setting matches your instance

### Performance issues

**Hovers are slow to appear**

1. Increase cache TTL: Set `gitlabBlame.cacheTTL` to a higher value (e.g., `7200` for 2 hours)
2. Check network latency to your GitLab instance
3. Consider using a local cache proxy if on a slow network

## FAQ

### Does this work with GitHub?

**Yes!** GitHub support is fully implemented. The extension automatically detects whether you're using GitLab or GitHub based on your git remote URL. Both github.com and GitHub Enterprise Server are supported.

### Do I need a Personal Access Token?

Yes. The extension requires a GitLab Personal Access Token with `read_api` scope to fetch merge request information via the GitLab API.

### Does this work with self-hosted instances?

Yes! Both GitLab and GitHub Enterprise are supported.

**GitLab**:
```json
{
  "gitlabBlame.gitlabUrl": "https://gitlab.mycompany.com"
}
```

**GitHub Enterprise**:
```json
{
  "gitlabBlame.githubUrl": "https://github.enterprise.com"
}
```

### Will this slow down my editor?

No. The extension:
- Uses efficient TTL-based caching to minimize API calls
- Only makes API calls when you hover over a line
- Supports cancellation if you move away before the request completes
- Has zero runtime dependencies (small bundle size)

### Can I use this in private/nested repositories?

Yes. The extension supports:
- Private repositories (with proper token permissions)
- Nested GitLab groups (e.g., `group/subgroup/project`)
- GitHub organizations and user repositories
- Both SSH and HTTPS remote URLs

### Does this support multiple remotes?

**No, only the `origin` remote is used.** If your repository has multiple remotes (e.g., `origin`, `upstream`, `fork`), the extension will only use the `origin` remote to determine which VCS provider to use and where to fetch MR/PR information.

**Workaround**: If you need to use a different remote, rename it to `origin`:
```bash
git remote rename origin old-origin
git remote rename your-remote origin
```

### How do I check if the extension is working?

Run the command: `GitLab Blame: Show Status`

This displays:
- Current configuration for **all providers** (GitLab URL, GitHub URL, cache TTL)
- Token status (configured ✓ or missing ✗) for each provider
- Cache statistics (entries, TTL)
- Git extension connection status

## Contributing

Contributions are welcome! Here's how to get started:

### Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/SebastienLeonce/gitlab-blame.git
   cd gitlab-blame
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build and test**
   ```bash
   npm run watch      # Start watch mode
   # Press F5 in VS Code to launch Extension Development Host
   ```

### Running Tests

```bash
npm run pretest    # Compile tests
npm test           # Run test suite
npm run test:coverage  # Generate coverage report
```

### Code Quality

Before submitting a PR:

```bash
npm run typecheck  # TypeScript type checking
npm run lint       # Check for lint issues
npm run lint:fix   # Auto-fix lint issues
npm run build      # Verify production build works
```

### Pull Request Guidelines

1. **Create a feature branch** from `main`
2. **Write tests** for new functionality
3. **Update documentation** if adding features or changing behavior
4. **Ensure all tests pass** and lint checks succeed
5. **Keep commits focused** - one logical change per commit

### Documentation

When making significant changes, update:
- `README.md` - User-facing documentation
- `ref/` folder - Architecture, API, and pattern documentation
- `CLAUDE.md` - Project context for development

See [`ref/`](ref/) for detailed API and architecture documentation.

## License

MIT
