# Configuration Reference

## VS Code Settings

Configure via **Settings** → **Extensions** → **GitLab Blame** or edit `settings.json` directly.

### `gitlabBlame.gitlabUrl`

| Property | Value |
|----------|-------|
| Type | `string` |
| Default | `"https://gitlab.com"` |
| Scope | User/Workspace |

GitLab instance URL for API calls.

**Examples**:
```json
{
  "gitlabBlame.gitlabUrl": "https://gitlab.com"
}
```

```json
{
  "gitlabBlame.gitlabUrl": "https://gitlab.mycompany.com"
}
```

**Note**: Must include protocol (`https://`). Do not include trailing slash.

---

### `gitlabBlame.githubUrl`

| Property | Value |
|----------|-------|
| Type | `string` |
| Default | `"https://github.com"` |
| Scope | User/Workspace |

GitHub URL (automatically converted to API URL for API calls).

**Examples**:
```json
{
  "gitlabBlame.githubUrl": "https://github.com"
}
```

```json
{
  "gitlabBlame.githubUrl": "https://github.enterprise.com"
}
```

**Note**: Must include protocol (`https://`). Do not include trailing slash. For GitHub Enterprise Server without "github" in hostname, this setting enables provider detection.

**GitHub Enterprise Detection**:
- **GitHub.com**: Default URL works automatically
- **GitHub Enterprise with "github" in hostname**: Auto-detected (e.g., `github.enterprise.com`)
- **GitHub Enterprise without "github" in hostname**: Configure this setting to your API URL (e.g., `https://api.git.company.com`)

---

### `gitlabBlame.cacheTTL`

| Property | Value |
|----------|-------|
| Type | `number` |
| Default | `3600` |
| Unit | seconds |
| Scope | User/Workspace |

Cache time-to-live for MR lookups.

**Examples**:
```json
{
  "gitlabBlame.cacheTTL": 3600
}
```

```json
{
  "gitlabBlame.cacheTTL": 0
}
```

**Special Values**:
- `0`: Disable caching entirely (API call on every hover)
- `3600`: Default (1 hour cache)
- `86400`: 24-hour cache

**Auto-invalidation**: Cache clears automatically on git operations regardless of TTL.

---

### `gitlabBlame.displayMode`

| Property | Value |
|----------|-------|
| Type | `string` (enum) |
| Default | `"inline"` |
| Allowed Values | `"hover"`, `"inline"`, `"both"` |
| Scope | User/Workspace |

How to display Merge Request/Pull Request information.

**Display Modes**:
- `hover`: Show MR/PR links only in hover tooltips
- `inline`: Show MR/PR links as end-of-line decorations (default)
- `both`: Show both inline annotations and hover tooltips

**Examples**:
```json
{
  "gitlabBlame.displayMode": "hover"
}
```

```json
{
  "gitlabBlame.displayMode": "inline"
}
```

```json
{
  "gitlabBlame.displayMode": "both"
}
```

**Inline Display Format**:
- **GitLab**: `!123` (exclamation mark + MR number)
- **GitHub**: `#456` (hash + PR number)

**Behavior**:
- Inline annotations only show for lines with associated MR/PR (not all lines)
- Hovering over inline annotation shows tooltip with full MR/PR details
- Changing display mode requires window reload to apply changes

**Performance**:
- Inline mode uses batch fetching for better performance
- Shares same cache as hover mode (no duplicate API calls)
- Debounced updates (500ms) on file edits to avoid excessive refreshes

---

## Personal Access Tokens

Tokens are stored securely in VS Code's `SecretStorage`. Not visible in settings. The extension supports multiple VCS providers with separate tokens.

### Auto-Detection

The extension **automatically detects which provider you're using** based on your git remote URL:
- If your remote is `git@github.com:...` or `https://github.com/...` → GitHub token will be requested
- If your remote is `git@gitlab.com:...` or `https://gitlab.com/...` → GitLab token will be requested

### Creating a GitLab Token

1. Open GitLab → **Settings** → **Access Tokens**
2. Create token with scope: `read_api`
3. Copy the token (starts with `glpat-`)

### Creating a GitHub Token

1. Open GitHub → **Settings** → **Developer settings** → **Personal access tokens** → **Tokens (classic)**
2. Generate new token with scopes:
   - `repo` (for private repositories)
   - OR `public_repo` (for public repositories only)
3. Copy the token (starts with `ghp_`)

### Setting a Token

**Via Command Palette** (Auto-Detection):
1. Press `Ctrl+Shift+P` / `Cmd+Shift+P`
2. Run `GitLab Blame: Set Personal Access Token`
3. **Extension auto-detects provider from current workspace**
4. Shows provider-specific prompt (e.g., "Enter your GitHub Personal Access Token")
5. Paste token and press Enter

If no workspace is open or provider cannot be detected, you'll be asked to select the provider.

**Programmatically** (for testing):
```typescript
// GitLab
await context.secrets.store("gitlabBlame.token", "glpat-xxx");

// GitHub
await context.secrets.store("gitlabBlame.githubToken", "ghp-xxx");
```

### Deleting a Token

1. Press `Ctrl+Shift+P` / `Cmd+Shift+P`
2. Run `GitLab Blame: Delete Personal Access Token`
3. **Extension auto-detects provider from current workspace**
4. Confirm deletion

If no workspace is open, you'll be asked to select which provider's token to delete.

### Token Requirements

#### GitLab

| Scope | Required | Purpose |
|-------|----------|---------|
| `read_api` | Yes | Access MR information |
| `read_repository` | No | Not needed |

#### GitHub

| Scope | Required | Purpose |
|-------|----------|---------|
| `repo` | For private repos | Access PR information in private repos |
| `public_repo` | For public repos only | Access PR information in public repos |

**Token Format**:
- GitLab: Starts with `glpat-`
- GitHub: Starts with `ghp_` (classic tokens)

---

## Extension Commands

Commands available via Command Palette (`Ctrl+Shift+P`):

| Command | ID | Description |
|---------|-----|-------------|
| Set Personal Access Token | `gitlabBlame.setToken` | Configure VCS token (auto-detects provider) |
| Delete Personal Access Token | `gitlabBlame.deleteToken` | Remove stored token (auto-detects provider) |
| Toggle Display Mode | `gitlabBlame.toggleDisplayMode` | Cycle through display modes (hover → inline → both → hover) |
| Clear Cache | `gitlabBlame.clearCache` | Manual cache invalidation |
| Show Status | `gitlabBlame.showStatus` | Display current configuration |

**Auto-Detection**: `setToken` and `deleteToken` commands automatically detect which provider (GitLab or GitHub) based on your current workspace's git remote URL. If no workspace is open or detection fails, you'll be prompted to select the provider.

**Toggle Display Mode**: Cycles through the three display modes in order: `hover` → `inline` → `both` → `hover`. Prompts for window reload after changing mode.

### Show Status Output

Displays status for **all configured providers**:
- **GitLab**:
  - URL (configured instance)
  - Token status (✓ or ✗)
- **GitHub**:
  - URL (configured instance)
  - Token status (✓ or ✗)
- **Cache**:
  - TTL (in seconds)
  - Entries (current count)
- **Git Extension**: Connected/Not connected status

---

## Extension Dependencies

### Required

| Extension | ID | Purpose |
|-----------|-----|---------|
| Git | `vscode.git` | Built-in, provides blame API |

The extension declares this dependency in `package.json`:

```json
{
  "extensionDependencies": ["vscode.git"]
}
```

---

## Activation

| Event | ID | Behavior |
|-------|-----|----------|
| Startup Finished | `onStartupFinished` | Activates after VS Code fully loads |

The extension activates automatically when VS Code finishes starting. No manual activation needed.

---

## Build & Development Configuration

### TypeScript (`tsconfig.json`)

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2022",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true
  }
}
```

### ESBuild

Production build command:
```bash
esbuild ./src/extension.ts --bundle --outfile=dist/extension.js \
  --external:vscode --format=cjs --platform=node --minify
```

Development watch:
```bash
esbuild ./src/extension.ts --bundle --outfile=dist/extension.js \
  --external:vscode --format=cjs --platform=node --sourcemap --watch
```

---

## Environment Requirements

| Requirement | Version |
|-------------|---------|
| VS Code | 1.84.0+ |
| Node.js (dev) | 18.x or 20.x |
| GitLab API | v4 |

---

## Multi-Instance Configuration

### Multiple GitLab Instances

To use with multiple GitLab instances:

1. Set `gitlabBlame.gitlabUrl` in **workspace settings** (not user settings)
2. Each workspace can have its own GitLab URL
3. Token must have access to the configured GitLab instance

**Example workspace settings** (`.vscode/settings.json`):
```json
{
  "gitlabBlame.gitlabUrl": "https://gitlab.internal.company.com"
}
```

### Multiple GitHub Instances

For GitHub Enterprise Server:

1. Set `gitlabBlame.githubUrl` in **workspace settings**
2. Each workspace can have its own GitHub API URL
3. Token must have access to the configured GitHub instance

**Example workspace settings** (`.vscode/settings.json`):
```json
{
  "gitlabBlame.githubUrl": "https://api.github.enterprise.com"
}
```

### Multi-Provider Workspaces

The extension automatically detects the correct provider from your git remote URL, so you can work with both GitLab and GitHub repositories without changing settings:

```json
{
  "gitlabBlame.gitlabUrl": "https://gitlab.com",
  "gitlabBlame.githubUrl": "https://github.com"
}
```

**How it works**:
- Extension reads git remote URL from `origin`
- Detects provider (GitLab vs GitHub) based on hostname
- Uses appropriate token and API for that provider

---

## Known Limitations

### Origin Remote Only

The extension **only uses the `origin` remote** when fetching remote URLs. If your repository has multiple remotes, only `origin` will be used for MR/PR lookups.

**Why**: Simplifies behavior and covers 95%+ of use cases. Git conventions treat `origin` as the primary remote.

**Workaround**: If you need to use a different remote, rename it to `origin`:
```bash
git remote rename origin old-origin
git remote rename your-remote origin
```

**Future Enhancement**: A `gitlabBlame.remoteName` setting may be added in the future to override this behavior based on user feedback.
