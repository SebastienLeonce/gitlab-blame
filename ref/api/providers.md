# Providers API Reference

## BlameHoverProvider

**Location**: `src/providers/BlameHoverProvider.ts`

Implements VS Code's `HoverProvider` interface to display git blame information with GitLab MR links.

### Constructor

```typescript
constructor(
  gitService: GitService,
  gitLabService: GitLabService,
  cacheService: CacheService
)
```

### Interface Implementation

#### `provideHover(document, position, token): Promise<Hover | null>`

Called by VS Code when user hovers over text in a file.

**Parameters**:
- `document`: The text document
- `position`: Cursor position
- `token`: Cancellation token

**Returns**: `vscode.Hover` with blame info or `null`.

### Internal Methods

#### `buildHoverContent(uri, blameInfo, token): Promise<MarkdownString>`

Constructs the hover tooltip content.

**Content Structure**:
```
**Merge Request**: [!123 MR Title](https://gitlab.com/...)

`abc1234` by Author Name • 2 days ago

*Commit message summary*
```

If no MR found:
```
`abc1234` by Author Name • 2 days ago

*Commit message summary*

*No associated merge request*
```

#### `getMergeRequestInfo(uri, sha, token): Promise<MRResult>`

Fetches MR info from cache or API.

**Returns**:
```typescript
{
  mr: MergeRequest | null,  // The MR if found
  loading: boolean,          // True if request in progress
  checked: boolean           // True if we actually checked
}
```

**Deduplication**: Uses `pendingRequests` Map to prevent duplicate API calls when multiple hovers request the same SHA.

#### `fetchAndCacheMR(projectPath, sha, gitlabHost): Promise<MergeRequest | null>`

Makes API call and stores result in cache.

**Important**: Caches `null` results to avoid repeated API calls for commits without MRs.

#### `formatRelativeDate(date: Date): string`

Formats dates as relative time.

**Examples**:
- "just now"
- "5 minutes ago"
- "2 hours ago"
- "3 days ago"
- "2 weeks ago"
- "4 months ago"
- "1 year ago"

#### `escapeMarkdown(text: string): string`

Escapes special markdown characters to prevent formatting issues.

**Escaped characters**: `\` `` ` `` `*` `_` `{` `}` `[` `]` `(` `)` `#` `+` `-` `.` `!`

### Usage Example

The provider is registered in `extension.ts`:

```typescript
const hoverProvider = new BlameHoverProvider(
  gitService,
  gitLabService,
  cacheService
);

context.subscriptions.push(
  vscode.languages.registerHoverProvider(
    { scheme: "file" },
    hoverProvider
  )
);
```

The `{ scheme: "file" }` selector means the provider is active for all files in the filesystem (not virtual documents, untitled files, etc.).
