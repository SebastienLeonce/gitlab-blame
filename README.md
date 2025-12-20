# GitLab Blame MR Link

[![CI](https://github.com/SebastienLeonce/gitlab-blame/actions/workflows/ci.yml/badge.svg)](https://github.com/SebastienLeonce/gitlab-blame/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/sebastienleonce/gitlab-blame/branch/main/graph/badge.svg)](https://codecov.io/gh/sebastienleonce/gitlab-blame)

A lightweight VS Code extension that enhances git blame with GitLab Merge Request links. Hover over any line to see which MR introduced the change.

## Features

- **Inline Blame Hover** - See commit info (author, date, message, SHA) and MR link on hover
- **Multi-Instance GitLab Support** - Works with gitlab.com and self-hosted GitLab instances
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

### GitLab Personal Access Token

1. Generate a PAT in GitLab: **Settings > Access Tokens**
2. Required scope: `read_api`
3. Run command: `GitLab Blame: Set Personal Access Token`

### Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `gitlabBlame.gitlabUrl` | `https://gitlab.com` | GitLab instance URL |
| `gitlabBlame.cacheTTL` | `3600` | Cache timeout in seconds (0 to disable) |

**Example** (`settings.json`):

```json
{
  "gitlabBlame.gitlabUrl": "https://gitlab.mycompany.com",
  "gitlabBlame.cacheTTL": 7200
}
```

## Usage

1. Open a file in a git repository with a GitLab remote
2. Hover over any line
3. See commit details and click the MR link to open in browser

## Commands

| Command | Description |
|---------|-------------|
| `GitLab Blame: Set Personal Access Token` | Configure your GitLab PAT |
| `GitLab Blame: Delete Personal Access Token` | Remove stored token |
| `GitLab Blame: Clear Cache` | Clear cached MR data |
| `GitLab Blame: Show Status` | Display configuration and cache info |

Access commands via Command Palette (`Ctrl+Shift+P`).

## Supported Remote Formats

- SSH: `git@gitlab.com:group/project.git`
- HTTPS: `https://gitlab.com/group/project.git`
- Nested groups: `group/subgroup/project`

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

- **VcsProviderFactory**: Auto-detects VCS provider from git remote URL
- **IVcsProvider**: Interface enabling GitLab, GitHub, Bitbucket support
- **TokenService**: Secure multi-provider token storage via VS Code SecretStorage
- **CacheService**: TTL-based cache with automatic invalidation on git operations

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

### Does this work with GitHub or Bitbucket?

Not yet. The extension currently supports GitLab only, but the architecture is designed to support multiple VCS providers. GitHub and Bitbucket support is planned for future releases.

### Do I need a Personal Access Token?

Yes. The extension requires a GitLab Personal Access Token with `read_api` scope to fetch merge request information via the GitLab API.

### Does this work with self-hosted GitLab instances?

Yes! Configure your GitLab instance URL in settings:

```json
{
  "gitlabBlame.gitlabUrl": "https://gitlab.mycompany.com"
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
- Both SSH and HTTPS remote URLs

### How do I check if the extension is working?

Run the command: `GitLab Blame: Show Status`

This displays:
- Current configuration (GitLab URL, cache TTL)
- Token status (configured or missing)
- Cache statistics

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
