# GitLab Blame MR Link - VS Code Extension

## Problem Statement

Existing free VS Code git blame extensions show commit information (author, date, message, SHA) but **do not show which GitLab Merge Request introduced the change**. This requires manually navigating to GitLab's commit page to find the associated MR.

## Goal

Create a lightweight, free VS Code extension that:
- Shows git blame information inline (like existing extensions)
- Fetches and displays the **GitLab MR link** that introduced each commit
- Works with self-hosted GitLab instances (e.g., `gitlab.pytheascapital.net`)

## Technical Approach

### GitLab API Endpoint

GitLab provides a dedicated endpoint to find MRs associated with a commit:

```
GET /projects/:id/repository/commits/:sha/merge_requests
```

**Note**: `:id` can be either the numeric project ID (e.g., `12345`) or the URL-encoded project path (e.g., `group%2Fsubgroup%2Fproject`). This extension uses the URL-encoded path extracted from the git remote.

**Response example:**
```json
[
  {
    "id": 12345,
    "iid": 123,
    "title": "Feature: Add user authentication",
    "web_url": "https://gitlab.example.com/group/project/-/merge_requests/123",
    "state": "merged",
    "merged_at": "2025-01-15T10:30:00Z"
  }
]
```

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     VS Code Extension                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │  VS Code     │───▶│   Cache      │───▶│   GitLab     │  │
│  │  Git API     │    │   Service    │    │   Service    │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│         │                   │                    │          │
│         ▼                   ▼                    ▼          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │  Blame Hover │    │  Workspace   │    │  Secret      │  │
│  │  Provider    │    │  State       │    │  Storage     │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Core Components

| Component | Responsibility |
|-----------|----------------|
| **VS Code Git API** | Get blame info via `vscode.git` extension (no process spawning) |
| **GitLab Service** | Fetch MR data from GitLab API |
| **Cache Service** | Store commit→MR mappings with TTL and invalidation |
| **Blame Hover Provider** | Render hover with commit info + MR link |
| **Secret Storage** | Securely store GitLab Personal Access Token |

## Implementation Plan

### Phase 1: Project Setup ✅
- [x] Initialize git repository (`git init`)
- [x] Initialize VS Code extension with `yo code`
- [x] Configure TypeScript, ESLint, bundler (esbuild)
- [x] Set up extension manifest (`package.json`)
- [x] Define minimum VS Code version: `^1.84.0`
- [x] Configure activation events
- [x] Create `.gitignore` for node_modules, dist, etc.

### Phase 2: Git Integration (via VS Code Git API)
- [ ] Get `vscode.git` extension API
- [ ] Implement blame retrieval using git extension
- [ ] Map line numbers to commit SHAs
- [ ] Handle case where git extension is disabled
- [ ] Handle uncommitted changes gracefully

### Phase 3: GitLab API Integration
- [ ] Implement GitLab API client
- [ ] Extract project path from git remote URL (handle nested groups)
- [ ] Fetch MRs for commits via API
- [ ] Implement MR selection logic (first merged MR by `merged_at`)
- [ ] Handle authentication (PAT in VS Code SecretStorage)

### Phase 4: Caching
- [ ] Implement in-memory cache (commit SHA → MR data)
- [ ] Add TTL-based expiration
- [ ] Implement cache invalidation on git operations (pull, fetch)
- [ ] Consider workspace state persistence for cross-session cache

### Phase 5: UI/UX
- [ ] Implement HoverProvider for blame + MR info
- [ ] Add loading indicator for pending API requests
- [ ] Make MR links clickable (open in browser)
- [ ] Handle graceful degradation (show commit info when MR unavailable)

### Phase 6: Configuration
- [ ] GitLab instance URL (support self-hosted)
- [ ] Cache TTL settings
- [ ] PAT management commands

### Phase 7: Testing
- [ ] Set up test infrastructure (Mocha + @vscode/test-electron)
- [ ] Write unit tests for core logic
- [ ] Write integration tests with mocked API
- [ ] Add CI pipeline for automated testing

## File Structure

```
gitlab-blame/
├── src/
│   ├── extension.ts              # Entry point, activation
│   ├── providers/
│   │   └── BlameHoverProvider.ts # HoverProvider implementation
│   ├── services/
│   │   ├── GitService.ts         # VS Code Git API wrapper
│   │   ├── GitLabService.ts      # GitLab API client
│   │   └── CacheService.ts       # In-memory caching with TTL
│   ├── platforms/
│   │   ├── Platform.ts           # Interface for platform abstraction
│   │   └── GitLabPlatform.ts     # GitLab implementation
│   ├── utils/
│   │   ├── config.ts             # Settings management
│   │   └── remoteParser.ts       # Parse git remote URLs
│   └── types/
│       └── index.ts              # TypeScript interfaces
├── test/
│   ├── suite/
│   │   ├── remoteParser.test.ts  # Unit tests
│   │   ├── cacheService.test.ts  # Unit tests
│   │   └── mrSelection.test.ts   # Unit tests
│   └── runTest.ts                # Test runner
├── package.json
├── tsconfig.json
└── README.md
```

## Configuration Schema

```json
{
  "gitlabBlame.gitlabUrl": {
    "type": "string",
    "default": "https://gitlab.com",
    "description": "GitLab instance URL"
  },
  "gitlabBlame.cacheTTL": {
    "type": "number",
    "default": 3600,
    "description": "Cache TTL in seconds (0 to disable)"
  }
}
```

## Extension Manifest (package.json)

```json
{
  "name": "gitlab-blame",
  "displayName": "GitLab Blame MR Link",
  "description": "Show GitLab Merge Request links in git blame hovers",
  "version": "0.1.0",
  "engines": {
    "vscode": "^1.84.0"
  },
  "activationEvents": [
    "onStartupFinished"
  ],
  "extensionDependencies": [
    "vscode.git"
  ],
  "contributes": {
    "commands": [
      {
        "command": "gitlabBlame.setToken",
        "title": "GitLab Blame: Set Personal Access Token"
      },
      {
        "command": "gitlabBlame.clearCache",
        "title": "GitLab Blame: Clear Cache"
      }
    ],
    "configuration": {
      "title": "GitLab Blame",
      "properties": {
        "gitlabBlame.gitlabUrl": {
          "type": "string",
          "default": "https://gitlab.com",
          "description": "GitLab instance URL"
        },
        "gitlabBlame.cacheTTL": {
          "type": "number",
          "default": 3600,
          "description": "Cache TTL in seconds"
        }
      }
    }
  }
}
```

## Key Code Snippets

### VS Code Git API Usage

```typescript
import * as vscode from 'vscode';
import { GitExtension, Repository, API as GitAPI } from './types/git';

function getGitAPI(): GitAPI | undefined {
  const gitExtension = vscode.extensions.getExtension<GitExtension>('vscode.git');
  if (!gitExtension?.isActive) {
    return undefined;
  }
  return gitExtension.exports.getAPI(1);
}

async function getBlameForLine(
  repo: Repository,
  uri: vscode.Uri,
  line: number
): Promise<BlameInfo | undefined> {
  // Use git extension's blame capability
  const blame = await repo.blame(uri.fsPath);
  return blame[line];
}
```

### GitLab API Client with MR Selection

```typescript
interface MergeRequest {
  iid: number;
  title: string;
  webUrl: string;
  mergedAt: string | null;
  state: string;
}

async function getMRForCommit(
  gitlabUrl: string,
  projectPath: string,
  commitSha: string,
  token: string
): Promise<MergeRequest | null> {
  const encodedPath = encodeURIComponent(projectPath);
  const url = `${gitlabUrl}/api/v4/projects/${encodedPath}/repository/commits/${commitSha}/merge_requests`;

  const response = await fetch(url, {
    headers: { 'PRIVATE-TOKEN': token }
  });

  if (!response.ok) return null;

  const mrs: GitLabMR[] = await response.json();
  if (mrs.length === 0) return null;

  // Select first merged MR by merged_at date
  const mergedMRs = mrs.filter(mr => mr.state === 'merged' && mr.merged_at);
  if (mergedMRs.length === 0) {
    // Fallback: return first MR if none are merged
    return mapToMergeRequest(mrs[0]);
  }

  const firstMerged = mergedMRs.sort((a, b) =>
    new Date(a.merged_at!).getTime() - new Date(b.merged_at!).getTime()
  )[0];

  return mapToMergeRequest(firstMerged);
}

function mapToMergeRequest(mr: GitLabMR): MergeRequest {
  return {
    iid: mr.iid,
    title: mr.title,
    webUrl: mr.web_url,
    mergedAt: mr.merged_at,
    state: mr.state
  };
}
```

### Extract Project Path from Remote (Handles Nested Groups)

```typescript
function extractGitLabProject(remoteUrl: string): string | null {
  // SSH: git@gitlab.example.com:group/subgroup/project.git
  // HTTPS: https://gitlab.example.com/group/subgroup/project.git

  // SSH format
  const sshMatch = remoteUrl.match(/@[^:]+:(.+?)(?:\.git)?$/);
  if (sshMatch) {
    return sshMatch[1].replace(/\.git$/, '');
  }

  // HTTPS format
  try {
    const url = new URL(remoteUrl);
    const path = url.pathname.slice(1); // Remove leading /
    return path.replace(/\.git$/, '');
  } catch {
    return null;
  }
}
```

### Cache Service with Invalidation

```typescript
interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

class CacheService {
  private cache = new Map<string, CacheEntry<MergeRequest | null>>();
  private ttlMs: number;

  constructor(ttlSeconds: number) {
    this.ttlMs = ttlSeconds * 1000;
  }

  get(sha: string): MergeRequest | null | undefined {
    const entry = this.cache.get(sha);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(sha);
      return undefined;
    }
    return entry.value;
  }

  set(sha: string, mr: MergeRequest | null): void {
    this.cache.set(sha, {
      value: mr,
      expiresAt: Date.now() + this.ttlMs
    });
  }

  clear(): void {
    this.cache.clear();
  }

  // Called on git pull/fetch to invalidate potentially stale entries
  invalidateAll(): void {
    this.clear();
  }
}
```

## Testing Strategy

### Test Infrastructure

- **Framework**: Mocha (VS Code's default) + `@vscode/test-electron`
- **Assertions**: Chai or Node's built-in assert
- **Mocking**: Sinon for API mocks

### Test Coverage Matrix

| Component | Test Type | What to Test |
|-----------|-----------|--------------|
| `remoteParser.ts` | Unit | SSH URLs, HTTPS URLs, nested groups, edge cases |
| `CacheService.ts` | Unit | TTL expiration, invalidation, get/set |
| `GitLabService.ts` | Integration | API responses (mocked), error handling, MR selection |
| `BlameHoverProvider.ts` | Integration | Hover content generation |
| Extension activation | E2E | Extension loads, commands registered |

### Example Unit Test

```typescript
import * as assert from 'assert';
import { extractGitLabProject } from '../utils/remoteParser';

suite('Remote Parser', () => {
  test('parses SSH URL', () => {
    const result = extractGitLabProject('git@gitlab.com:group/project.git');
    assert.strictEqual(result, 'group/project');
  });

  test('parses HTTPS URL', () => {
    const result = extractGitLabProject('https://gitlab.com/group/project.git');
    assert.strictEqual(result, 'group/project');
  });

  test('handles nested groups', () => {
    const result = extractGitLabProject('git@gitlab.com:org/team/project.git');
    assert.strictEqual(result, 'org/team/project');
  });

  test('handles URL without .git suffix', () => {
    const result = extractGitLabProject('https://gitlab.com/group/project');
    assert.strictEqual(result, 'group/project');
  });
});
```

### Example Integration Test (Mocked API)

```typescript
import * as sinon from 'sinon';
import { GitLabService } from '../services/GitLabService';

suite('GitLab Service', () => {
  let fetchStub: sinon.SinonStub;

  setup(() => {
    fetchStub = sinon.stub(global, 'fetch');
  });

  teardown(() => {
    fetchStub.restore();
  });

  test('selects first merged MR by date', async () => {
    fetchStub.resolves({
      ok: true,
      json: async () => [
        { iid: 2, title: 'Second', state: 'merged', merged_at: '2025-01-02T00:00:00Z', web_url: '...' },
        { iid: 1, title: 'First', state: 'merged', merged_at: '2025-01-01T00:00:00Z', web_url: '...' }
      ]
    });

    const service = new GitLabService('https://gitlab.com', 'token');
    const mr = await service.getMRForCommit('group/project', 'abc123');

    assert.strictEqual(mr?.iid, 1); // First merged by date
  });

  test('returns null when no MRs found', async () => {
    fetchStub.resolves({ ok: true, json: async () => [] });

    const service = new GitLabService('https://gitlab.com', 'token');
    const mr = await service.getMRForCommit('group/project', 'abc123');

    assert.strictEqual(mr, null);
  });
});
```

## Complexity Assessment

| Component | Effort | Risk |
|-----------|--------|------|
| Extension scaffold | Low | Low |
| VS Code Git API integration | Low | Low (well-documented API) |
| GitLab API integration | Low | Medium (auth issues) |
| MR selection logic | Low | Low |
| Caching with invalidation | Medium | Low |
| UI/Hover Provider | Low | Low |
| Testing setup | Medium | Low |
| Error handling | Medium | Medium |
| **Total** | **~3-4 days** | **Low-Medium** |

## Dependencies

```json
{
  "devDependencies": {
    "@types/vscode": "^1.84.0",
    "@types/node": "^20.0.0",
    "@types/mocha": "^10.0.0",
    "@types/sinon": "^17.0.0",
    "@vscode/test-electron": "^2.3.0",
    "typescript": "^5.3.0",
    "esbuild": "^0.19.0",
    "@vscode/vsce": "^2.22.0",
    "mocha": "^10.2.0",
    "sinon": "^17.0.0"
  }
}
```

## Potential Challenges

1. **Rate Limiting**: GitLab API has rate limits. Mitigated by aggressive caching and lazy loading on hover.
2. **Large Files**: Files with many unique commits = many API calls. Lazy loading on hover prevents this.
3. **Authentication UX**: Need smooth flow for PAT input and storage.
4. **VS Code Git Extension Disabled**: Fallback needed — show error message prompting user to enable it.

## Planning Session Outcomes (2025-12-19)

### Requirements Clarified

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Git Platform | GitLab first, extensible | User's primary platform, design for future GitHub support |
| MR Info Display | Basic (title + link) | Keep it simple, can extend later |
| Integration Mode | Augment existing hover | VS Code merges multiple HoverProviders automatically |
| Auth Method | Personal Access Token via SecretStorage | Secure, simple UX |
| No MR Behavior | Show commit info only | Still provides value when MR not found |
| GitLab Instance | Single per workspace | Simpler config, covers 90% of use cases |
| Fetch Strategy | On hover (lazy loading) | Lower API usage, acceptable latency with cache |
| Git Access | VS Code Git API | Cleaner, no process spawning, well-documented |
| MR Selection | First merged MR | When multiple MRs, select by earliest `merged_at` |
| Testing | Include in plan | Unit + integration tests with Mocha |

### Hover Content Format

**With MR**:
```markdown
**Merge Request**: [!123 Fix login bug](https://gitlab.com/org/repo/-/merge_requests/123)

`abc1234` by John Doe • 2 days ago
```

**Without MR**:
```markdown
`abc1234` by John Doe • 2 days ago

*No associated merge request*
```

**Loading state**:
```markdown
`abc1234` by John Doe • 2 days ago

*Loading merge request...*
```

### Error Handling Strategy

| Scenario | Behavior |
|----------|----------|
| No PAT configured | Show notification with "Set Token" action button |
| API rate limited (429) | Cache failure, show commit info only, log warning |
| Network error | Show commit info only, retry on next hover |
| Invalid PAT (401/403) | Show error notification once per session |
| Commit not found in GitLab | Show commit info only (local-only commit) |
| Uncommitted changes | Skip — lines with `0000000` hash show no hover |
| VS Code Git extension disabled | Show error: "Enable VS Code Git extension" |
| Multiple MRs for commit | Select first merged MR by `merged_at` date |

### Cache Invalidation Strategy

| Event | Action |
|-------|--------|
| TTL expired | Entry removed on next access |
| User runs "Clear Cache" command | All entries cleared |
| Git pull/fetch detected | All entries cleared (repo state changed) |
| VS Code reload | In-memory cache lost (acceptable) |

### Critical Trade-offs Identified

| Decision | Alternative | Rationale |
|----------|-------------|-----------|
| VS Code Git API | Spawn `git blame` | Cleaner, no security risks, no process management |
| Service classes | Functional modules | Classes allow dependency injection, easier testing |
| On-hover fetch | Pre-fetch | Lower API usage, acceptable latency with cache |
| Single GitLab host | Auto-detect | Simpler UX, covers 90% of use cases |
| In-memory cache | Persistent cache | Simpler, sufficient for session-based usage |
| First merged MR | Show all MRs | Simpler UX, single link is cleaner |

### Known Limitations

1. **Squash merges**: May still work — GitLab often returns MR for squashed commits (needs testing)
2. **Multiple remotes**: Only uses `origin` by default (configurable in future)
3. **Very large files**: Many unique commits means many hover-triggered API calls (mitigated by cache)

### Extensibility Points

The `Platform` interface is the key abstraction:
```typescript
interface Platform {
  name: string;
  detectFromRemote(remoteUrl: string): boolean;
  getMergeRequestForCommit(projectId: string, sha: string): Promise<MergeRequestInfo | null>;
}
```

Adding GitHub: Create `GitHubPlatform` implementing this interface.

---

## Next Steps

1. Initialize the project with VS Code extension generator
2. Copy VS Code Git extension types (`git.d.ts`)
3. Implement core types and Platform interface
4. Create GitService wrapping VS Code Git API
5. Create GitLabService with API client and MR selection logic
6. Implement CacheService with TTL and invalidation
7. Implement BlameHoverProvider
8. Add PAT storage command with SecretStorage
9. Set up test infrastructure
10. Write unit tests for remoteParser, CacheService, MR selection
11. Write integration tests for GitLabService
12. Test with real GitLab repository
13. Polish and publish to VS Code Marketplace

---

## References

- [VS Code Extension API](https://code.visualstudio.com/api/references/vscode-api)
- [VS Code Git Extension Types](https://github.com/microsoft/vscode/blob/main/extensions/git/src/api/git.d.ts)
- [VS Code Extension Testing](https://code.visualstudio.com/api/working-with-extensions/testing-extension)
- [GitLab Commits API](https://docs.gitlab.com/ee/api/commits.html)
- [Better Git Line Blame](https://github.com/mk12/vscode-better-git-line-blame) - Reference implementation
