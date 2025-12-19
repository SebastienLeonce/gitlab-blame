# Providers API Reference

## BlameHoverProvider

**Location**: `src/providers/BlameHoverProvider.ts`

Implements VS Code's `HoverProvider` interface to display git blame information with GitLab MR links.

### Constants

#### `MR_TITLE_MAX_LENGTH = 50`

Maximum length for MR link text in hover. Titles exceeding this are truncated with "..." and show full title on hover via Markdown link title attribute.

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

Long MR titles are truncated (hover to see full title):
```
**Merge Request**: [!456 Implement very long feature na...](https://... "Full title here")

`abc1234` by Author Name • 2 days ago
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

#### `escapeMarkdownTitle(text: string): string`

Escapes characters for Markdown link title attribute (used in tooltips).

**Escaped characters**: `"` `\`

#### `formatMrLink(mr: MergeRequest): string`

Formats an MR as a clickable Markdown link with truncation for long titles.

**Behavior**:
- If `!{iid} {title}` ≤ 50 characters: Shows full text as link
- If longer: Truncates title with "..." and adds full title as hover tooltip

**Examples**:
```typescript
// Short title (no truncation)
formatMrLink({ iid: 123, title: "Fix bug", webUrl: "..." });
// => "[!123 Fix bug](https://...)"

// Long title (truncated with tooltip)
formatMrLink({ iid: 456, title: "Implement very long feature name that exceeds limit", webUrl: "..." });
// => "[!456 Implement very long feature na...](https://... "Implement very long feature name that exceeds limit")"
```

The tooltip shows the full title when hovering over truncated links.

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
