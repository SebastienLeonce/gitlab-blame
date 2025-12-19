# GitLab Blame MR Link

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

```
src/
├── extension.ts              # Entry point
├── services/
│   ├── GitService.ts         # VS Code Git API wrapper
│   ├── GitLabService.ts      # GitLab API client
│   └── CacheService.ts       # TTL cache with invalidation
├── providers/
│   └── BlameHoverProvider.ts # Hover tooltip implementation
├── utils/
│   └── remoteParser.ts       # Git remote URL parser
└── types/
    └── index.ts              # TypeScript interfaces
```

## License

MIT
