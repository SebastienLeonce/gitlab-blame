# Git Blame MR/PR Link

[![CI](https://github.com/SebastienLeonce/gitlab-blame/actions/workflows/ci.yml/badge.svg)](https://github.com/SebastienLeonce/gitlab-blame/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/sebastienleonce/gitlab-blame/branch/main/graph/badge.svg)](https://codecov.io/gh/sebastienleonce/gitlab-blame)

[![VS Code Marketplace](https://img.shields.io/vscode-marketplace/v/sebastien-dev.gitlab-blame.svg?label=VS%20Code%20Marketplace&logo=visual-studio-code)](https://marketplace.visualstudio.com/items?itemName=sebastien-dev.gitlab-blame)
[![Installs](https://img.shields.io/vscode-marketplace/i/sebastien-dev.gitlab-blame.svg)](https://marketplace.visualstudio.com/items?itemName=sebastien-dev.gitlab-blame)
[![Rating](https://img.shields.io/vscode-marketplace/r/sebastien-dev.gitlab-blame.svg)](https://marketplace.visualstudio.com/items?itemName=sebastien-dev.gitlab-blame)

[![Open VSX](https://img.shields.io/open-vsx/v/sebastien-dev/gitlab-blame?label=Open%20VSX)](https://open-vsx.org/extension/sebastien-dev/gitlab-blame)
![Open VSX installs](https://img.shields.io/open-vsx/dt/sebastien-dev/gitlab-blame)
![Open VSX rating](https://img.shields.io/open-vsx/rating/sebastien-dev/gitlab-blame)

Instantly see which Merge Request or Pull Request introduced any line of code - right in your git blame hover.

<!-- TODO: Add screenshot showing blame hover with MR/PR link -->
![Hover Example](images/screenshot-hover.png)

## 🎯 What It Does

**The Problem**: Git blame shows who changed code and when, but not **why** - the context behind the change lives in Merge Requests (GitLab) or Pull Requests (GitHub).

**The Solution**: This extension adds clickable MR/PR links directly to VS Code's blame hovers.

**The Benefit**: Navigate from code → discussion/review/approval in one click. Understand the full context of any change without leaving your editor.

## ✨ Features

- 🔗 **Direct MR/PR Links** - Click to open in browser from blame hover or inline annotations
- 📊 **Change Statistics** - See additions, deletions, and file counts in hover (lazy-loaded for performance)
- 📍 **Inline Annotations** - Show MR/PR links at end-of-line - configurable display modes
- 🌍 **Multi-Provider** - Works with **GitLab** and **GitHub** (including self-hosted/Enterprise)
- 🚀 **Smart Caching** - TTL-based caching with auto-invalidation on git operations
- 🔒 **Secure Tokens** - Encrypted storage via VS Code SecretStorage
- ⚡ **Zero Dependencies** - Small bundle, fast activation, native APIs only
- 🎯 **Auto-Detection** - Automatically detects GitLab or GitHub from your git remote

## 📦 Installation

### VS Code Marketplace

1. Open **Extensions** view (`Ctrl+Shift+X` / `Cmd+Shift+X`)
2. Search for **"Git Blame MR/PR Link"**
3. Click **Install**

Or [install directly from marketplace →](https://marketplace.visualstudio.com/items?itemName=sebastien-dev.gitlab-blame)

### Open VSX Registry

For **VSCodium**, **Gitpod**, **Theia**, or other VS Code alternatives:

1. Open **Extensions** view
2. Search for **"Git Blame MR/PR Link"**
3. Click **Install**

Or install via command line:
```bash
codium --install-extension sebastien-dev.gitlab-blame
```

Or [install from Open VSX →](https://open-vsx.org/extension/sebastien-dev/gitlab-blame)

### Manual Installation

1. Download `.vsix` from [releases](https://github.com/SebastienLeonce/gitlab-blame/releases)
2. Run:
   ```bash
   code --install-extension gitlab-blame-*.vsix
   # Or for VSCodium:
   codium --install-extension gitlab-blame-*.vsix
   ```

## ⚙️ Quick Setup

### 1. Generate Personal Access Token

The extension **automatically detects** whether you're using GitLab or GitHub from your git remote.

#### GitLab
1. Go to **Settings → Access Tokens** in GitLab
2. Create token with `read_api` scope
3. Copy the token

#### GitHub
1. Go to **Settings → Developer settings → Personal access tokens → Tokens (classic)**
2. Create token with:
   - `repo` scope (for private repositories)
   - OR `public_repo` scope (for public repositories only)
3. Copy the token

### 2. Configure Extension

1. Open Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
2. Run: **`Git Blame: Set Personal Access Token`**
3. Paste your token (auto-detects GitLab or GitHub)
4. Done! 🎉

### 3. Use It

1. Open any file in a git repository
2. Hover over any line
3. See commit details + clickable MR/PR link

<!-- TODO: Add GIF demonstrating hover → click → browser -->
![Demo GIF](images/demo.gif)

## 🔧 Settings

Configure in VS Code settings (`settings.json`):

| Setting | Default | Description |
|---------|---------|-------------|
| `gitlabBlame.displayMode` | `inline` | How to display MR/PR info: `hover` (tooltip only), `inline` (end-of-line annotations), or `both` |
| `gitlabBlame.gitlabUrl` | `https://gitlab.com` | GitLab instance URL |
| `gitlabBlame.githubUrl` | `https://github.com` | GitHub instance URL |
| `gitlabBlame.cacheTTL` | `3600` | Cache timeout in seconds (0 to disable) |

**Example for GitLab Enterprise**:
```json
{
  "gitlabBlame.gitlabUrl": "https://gitlab.mycompany.com"
}
```

**Example for GitHub Enterprise**:
```json
{
  "gitlabBlame.githubUrl": "https://github.enterprise.com"
}
```

## 💡 Commands

Access via Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`):

| Command | Description | Auto-Detection |
|---------|-------------|----------------|
| `Git Blame: Set Personal Access Token` | Configure your PAT | ✓ Detects GitLab/GitHub from git remote |
| `Git Blame: Delete Personal Access Token` | Remove stored token | ✓ Detects GitLab/GitHub from git remote |
| `Git Blame: Toggle Display Mode` | Cycle through display modes (hover → inline → both) | N/A |
| `Git Blame: Clear Cache` | Clear cached MR/PR data | N/A |
| `Git Blame: Show Status` | Display configuration and cache info | Shows both providers |

## 🌐 Supported Remote Formats

### GitLab
- **SSH**: `git@gitlab.com:group/project.git`
- **HTTPS**: `https://gitlab.com/group/project.git`
- **Nested groups**: `group/subgroup/project.git`

### GitHub
- **SSH**: `git@github.com:owner/repo.git`
- **HTTPS**: `https://github.com/owner/repo.git`

**Note**: The extension uses the `origin` remote only.

## ❓ FAQ

### Does this work with GitHub?

**Yes!** GitHub and GitHub Enterprise are fully supported. The extension automatically detects whether you're using GitLab or GitHub based on your git remote URL.

### Does this work with self-hosted instances?

**Yes!** Both GitLab (self-hosted) and GitHub Enterprise Server are supported. Just configure the URL in settings:

```json
{
  "gitlabBlame.gitlabUrl": "https://gitlab.mycompany.com"
  // or
  "gitlabBlame.githubUrl": "https://github.enterprise.com"
}
```

### Will this slow down my editor?

**No.** The extension:
- Only makes API calls when you hover over a line
- Uses TTL-based caching to minimize API calls
- Supports request cancellation if you move away
- Has zero runtime dependencies (small bundle size)
- Auto-invalidates cache on git operations

### Why isn't the MR/PR link showing?

**Common causes**:

1. **No token configured** → Run `Git Blame: Set Personal Access Token`
2. **Commit not in any MR/PR** → Direct commits to main won't have links
3. **Stale cache** → Run `Git Blame: Clear Cache`
4. **Wrong remote format** → Run `git remote -v` to verify URL

Use `Git Blame: Show Status` to check token and configuration.

### Can I use this with private repositories?

**Yes!** Make sure your token has the correct scope:
- **GitLab**: `read_api`
- **GitHub**: `repo` (for private repos) or `public_repo` (for public only)

The extension supports:
- Private repositories
- Nested GitLab groups (`group/subgroup/project`)
- GitHub organizations
- Both SSH and HTTPS remote URLs

### Does this support multiple git remotes?

**No, currently only `origin` is supported.** If you have multiple remotes (`origin`, `upstream`, `fork`), the extension only uses `origin`.

**Workaround**: Rename your desired remote to `origin`:
```bash
git remote rename origin old-origin
git remote rename your-remote origin
```

### How do I verify it's working?

Run: **`Git Blame: Show Status`**

This shows:
- ✓ Token status for each provider (GitLab + GitHub)
- Configuration (URLs, cache TTL)
- Cache statistics
- Git extension connection status

## 🐛 Troubleshooting

### Authentication Errors

**Error: "Token not found" or "Authentication failed"**

1. Verify token is set: `Git Blame: Show Status`
2. Check token has correct scope (`read_api` for GitLab, `repo` for GitHub)
3. For self-hosted instances, verify URL setting matches your instance

### Performance Issues

**Hovers are slow**

1. Increase cache TTL: `"gitlabBlame.cacheTTL": 7200` (2 hours)
2. Check network latency to your instance
3. Clear cache if it's become stale: `Git Blame: Clear Cache`

### Still Having Issues?

- Check [GitHub Issues](https://github.com/SebastienLeonce/gitlab-blame/issues)
- Open a new issue with:
  - Extension version
  - VS Code version
  - Provider (GitLab/GitHub)
  - Error message from Output panel (`Output → GitLab Blame`)

## 🤝 Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for:
- Development setup
- Architecture overview
- Testing guidelines
- Pull request process

Quick start:
```bash
git clone https://github.com/SebastienLeonce/gitlab-blame.git
cd gitlab-blame
npm install
npm run watch  # Start development
# Press F5 in VS Code to launch Extension Development Host
```

## 📝 Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history and release notes.

## 📄 License

MIT - See [LICENSE](LICENSE)

---

**Made with ❤️ for developers who want context, not just commits.**
