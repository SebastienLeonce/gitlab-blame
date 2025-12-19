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

## Personal Access Token

Stored securely in VS Code's `SecretStorage`. Not visible in settings.

### Creating a Token

1. Open GitLab → **Settings** → **Access Tokens**
2. Create token with scope: `read_api`
3. Copy the token (starts with `glpat-`)

### Setting the Token

**Via Command Palette**:
1. Press `Ctrl+Shift+P` / `Cmd+Shift+P`
2. Run `GitLab Blame: Set Personal Access Token`
3. Paste token and press Enter

**Programmatically** (for testing):
```typescript
await context.secrets.store("gitlabBlame.token", "glpat-xxx");
```

### Deleting the Token

1. Press `Ctrl+Shift+P` / `Cmd+Shift+P`
2. Run `GitLab Blame: Delete Personal Access Token`
3. Confirm deletion

### Token Requirements

| Scope | Required | Purpose |
|-------|----------|---------|
| `read_api` | Yes | Access MR information |
| `read_repository` | No | Not needed |

**Minimum Permission**: `read_api` scope is sufficient to fetch MR data.

---

## Extension Commands

Commands available via Command Palette (`Ctrl+Shift+P`):

| Command | ID | Description |
|---------|-----|-------------|
| Set Personal Access Token | `gitlabBlame.setToken` | Configure GitLab PAT |
| Delete Personal Access Token | `gitlabBlame.deleteToken` | Remove stored token |
| Clear Cache | `gitlabBlame.clearCache` | Manual cache invalidation |
| Show Status | `gitlabBlame.showStatus` | Display current configuration |

### Show Status Output

Displays:
- GitLab URL (configured instance)
- Token status (Configured/Not configured)
- Cache TTL (in seconds)
- Cache entries (current count)
- Git extension status (Connected/Not connected)

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

## Multi-Instance GitLab

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

**Note**: The extension uses the remote URL from the repository to determine which GitLab host to call, but falls back to `gitlabUrl` setting when remote parsing fails.
