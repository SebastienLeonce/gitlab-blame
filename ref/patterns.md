# Code Patterns & Conventions

## Project Conventions

### TypeScript Style

- **Strict mode**: All TypeScript strict checks enabled
- **ES2022 target**: Modern JavaScript features available
- **ESLint**: TypeScript-aware linting rules

### Import Style

```typescript
// VS Code API first
import * as vscode from "vscode";

// Internal types
import { MergeRequest, BlameInfo } from "../types";

// Internal services/utilities
import { GitService } from "../services/GitService";
```

### Async/Await

All async operations use `async/await` syntax, not callbacks or raw promises.

```typescript
async function example(): Promise<Result | undefined> {
  try {
    const data = await fetchData();
    return processData(data);
  } catch (error) {
    console.error("Error:", error);
    return undefined;
  }
}
```

---

## Common Patterns

### VS Code Extension Lifecycle

```typescript
// src/extension.ts

let service: Service | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  // Initialize services
  service = new Service();
  await service.initialize();

  // Register providers
  context.subscriptions.push(
    vscode.languages.registerHoverProvider({ scheme: "file" }, provider)
  );

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand("ext.command", handler)
  );

  // Listen for events
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(handleConfigChange)
  );
}

export function deactivate(): void {
  service?.dispose();
  service = undefined;
}
```

### Service Initialization Pattern

Services use async initialization with error handling:

```typescript
class MyService {
  private initialized = false;
  private initError: string | undefined;

  async initialize(): Promise<boolean> {
    try {
      // Setup logic
      this.initialized = true;
      return true;
    } catch (error) {
      this.initError = error instanceof Error ? error.message : "Unknown error";
      return false;
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getInitializationError(): string | undefined {
    return this.initError;
  }
}
```

### Error Message Deduplication

Avoid showing the same error multiple times:

```typescript
class ServiceWithErrors {
  private hasShownError = false;

  private showError(): void {
    if (this.hasShownError) return;

    this.hasShownError = true;
    vscode.window.showErrorMessage("Error occurred", "Action")
      .then(action => {
        if (action === "Action") {
          // Handle action
        }
      });
  }

  resetErrorFlag(): void {
    this.hasShownError = false;
  }
}
```

### Configuration Reading

```typescript
// Read configuration with defaults
const config = vscode.workspace.getConfiguration("gitlabBlame");
const value = config.get<string>("setting", "defaultValue");

// Listen for changes
vscode.workspace.onDidChangeConfiguration(e => {
  if (e.affectsConfiguration("gitlabBlame.setting")) {
    const newValue = config.get<string>("setting", "defaultValue");
    // Update internal state
  }
});
```

### Secret Storage

```typescript
// Store token securely
await context.secrets.store("extension.token", token);

// Retrieve token
const token = await context.secrets.get("extension.token");

// Delete token
await context.secrets.delete("extension.token");

// Listen for changes
context.secrets.onDidChange(e => {
  if (e.key === "extension.token") {
    // Token changed externally
  }
});
```

### Request Deduplication

Prevent duplicate API calls for the same resource:

```typescript
class ApiClient {
  private pendingRequests = new Map<string, Promise<Result>>();

  async fetchData(key: string): Promise<Result> {
    // Return existing promise if request in progress
    const pending = this.pendingRequests.get(key);
    if (pending) return pending;

    // Start new request
    const promise = this.doFetch(key);
    this.pendingRequests.set(key, promise);

    try {
      return await promise;
    } finally {
      this.pendingRequests.delete(key);
    }
  }
}
```

### TTL Cache Pattern

```typescript
interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

class TTLCache<T> {
  private cache = new Map<string, CacheEntry<T>>();

  constructor(private ttlMs: number) {}

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value;
  }

  set(key: string, value: T): void {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + this.ttlMs
    });
  }
}
```

### Cancellation Support

```typescript
async provideHover(
  document: vscode.TextDocument,
  position: vscode.Position,
  token: vscode.CancellationToken
): Promise<vscode.Hover | null> {
  // Check before expensive operation
  if (token.isCancellationRequested) return null;

  const data = await fetchData();

  // Check after async operation
  if (token.isCancellationRequested) return null;

  return new vscode.Hover(buildContent(data));
}

// Race with cancellation
const result = await Promise.race([
  actualOperation(),
  new Promise<null>(resolve => {
    token.onCancellationRequested(() => resolve(null));
  })
]);
```

### Markdown Escaping

```typescript
function escapeMarkdown(text: string): string {
  return text.replace(/[\\`*_{}[\]()#+\-.!]/g, "\\$&");
}

// Usage
const md = new vscode.MarkdownString();
md.isTrusted = true;
md.appendMarkdown(`**Title**: ${escapeMarkdown(userInput)}`);
```

### Git Blame Standard Format Parsing

VS Code's Git API returns standard blame format (not porcelain):

```
<sha> (<author> <date> <time> <timezone> <line>) <content>
```

**Example output**:
```
d01a7c049 (lsidoree         2025-07-09 17:57:39 +0200   1) import {
^abc1234  (Another Author   2024-01-15 10:30:00 +0000  42) const x = 1;
```

**Parsing implementation**:
```typescript
// Parse standard git blame output
const lines = output.split("\n");

// Regex matches: ^?<sha> (<author> <date> <time> <timezone> <line>) <content>
const blameRegex =
  /^\^?([a-f0-9]+)\s+\((.+?)\s+(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})\s+([+-]\d{4})\s+(\d+)\)\s?(.*)$/;

for (const line of lines) {
  const match = line.match(blameRegex);
  if (!match) continue;

  const [, sha, author, date, time, timezone, lineNumStr] = match;
  const lineNum = parseInt(lineNumStr, 10);

  // Skip uncommitted changes (all zeros SHA)
  if (/^0+$/.test(sha)) continue;

  // Parse date and time
  const dateTime = new Date(`${date}T${time}`);

  result.set(lineNum, {
    sha,
    author: author.trim(),
    authorEmail: "", // Standard format doesn't include email
    date: dateTime,
    summary: "",     // Standard format doesn't include commit message
    line: lineNum,
  });
}
```

**Note**: The `^` prefix on SHA indicates boundary commits. Standard format doesn't include author email or commit message—only porcelain format does.

---

## Provider Abstraction Patterns

### Interface-Based Provider Design

Define a common interface for all VCS providers:

```typescript
// src/interfaces/IVcsProvider.ts
interface IVcsProvider {
  readonly id: string;
  readonly name: string;

  setToken(token: string | undefined): void;
  hasToken(): boolean;
  parseRemoteUrl(remoteUrl: string): RemoteInfo | null;
  isProviderUrl(remoteUrl: string): boolean;
  getMergeRequestForCommit(
    projectPath: string,
    commitSha: string,
    hostUrl?: string,
  ): Promise<VcsResult<MergeRequest | null>>;
  resetErrorState(): void;
}

// Implement for each provider
class GitLabProvider implements IVcsProvider {
  readonly id = "gitlab";
  readonly name = "GitLab";
  // ... implementation
}
```

### Provider Factory Pattern

Auto-detect provider from remote URL:

```typescript
class VcsProviderFactory {
  private providers = new Map<string, IVcsProvider>();

  registerProvider(provider: IVcsProvider): void {
    this.providers.set(provider.id, provider);
  }

  detectProvider(remoteUrl: string): IVcsProvider | undefined {
    for (const provider of this.providers.values()) {
      if (provider.isProviderUrl(remoteUrl)) {
        return provider;
      }
    }
    return undefined;
  }
}

// Usage
const factory = new VcsProviderFactory();
factory.registerProvider(new GitLabProvider());
factory.registerProvider(new GitHubProvider());

const provider = factory.detectProvider("git@gitlab.com:group/project.git");
// Returns GitLabProvider
```

### VcsResult Error Handling

Services return results, not UI:

```typescript
// Define result type
interface VcsResult<T> {
  success: boolean;
  data?: T;
  error?: VcsError;
}

interface VcsError {
  type: VcsErrorType;
  message: string;
  statusCode?: number;
  shouldShowUI?: boolean; // Flag for UI layer decision
}

// Provider returns result
async getMergeRequestForCommit(
  projectPath: string,
  sha: string
): Promise<VcsResult<MergeRequest | null>> {
  if (!this.token) {
    return {
      success: false,
      error: {
        type: VcsErrorType.NoToken,
        message: "No token configured",
        shouldShowUI: !this.hasShownError, // Show once
      },
    };
  }

  try {
    const mr = await this.fetchMR(projectPath, sha);
    return { success: true, data: mr };
  } catch (error) {
    return {
      success: false,
      error: {
        type: VcsErrorType.NetworkError,
        message: error.message,
        shouldShowUI: false,
      },
    };
  }
}

// Extension handles UI
function handleVcsError(error: VcsError, provider: IVcsProvider): void {
  if (!error.shouldShowUI) return;

  switch (error.type) {
    case VcsErrorType.NoToken:
      vscode.window.showWarningMessage(
        `${provider.name}: No token configured`,
        "Set Token"
      );
      break;
    case VcsErrorType.InvalidToken:
      vscode.window.showErrorMessage(
        `${provider.name}: Invalid token`,
        "Set Token"
      );
      break;
  }
}
```

### Error Callback Delegation

Pass error handler to provider consumers:

```typescript
// Define callback type
type VcsErrorHandler = (error: VcsError, provider: IVcsProvider) => void;

// Accept callback in constructor
class BlameHoverProvider {
  constructor(
    private gitService: GitService,
    private factory: VcsProviderFactory,
    private cache: ICacheService,
    private onVcsError?: VcsErrorHandler,
  ) {}

  private async fetchMR(provider: IVcsProvider, ...): Promise<MergeRequest | null> {
    const result = await provider.getMergeRequestForCommit(...);

    if (!result.success && result.error && this.onVcsError) {
      this.onVcsError(result.error, provider);
    }

    return result.data ?? null;
  }
}

// Extension provides handler
const hoverProvider = new BlameHoverProvider(
  gitService,
  factory,
  cache,
  handleVcsError, // UI logic lives here
);
```

---

## Error Handling Patterns

### Graceful Degradation

```typescript
async function getData(): Promise<Data | undefined> {
  try {
    return await fetchFromApi();
  } catch (error) {
    console.error("API error:", error);
    return undefined; // Return undefined, don't throw
  }
}
```

### User-Facing Errors

```typescript
// Show actionable errors
void vscode.window
  .showErrorMessage("Error message", "Action 1", "Action 2")
  .then(action => {
    if (action === "Action 1") {
      vscode.commands.executeCommand("extension.action1");
    }
  });

// Use void for fire-and-forget promises
void vscode.window.showInformationMessage("Done!");
```

### HTTP Status Code Handling

```typescript
private handleApiError(statusCode: number): void {
  switch (statusCode) {
    case 401:
    case 403:
      // Authentication error - show token prompt
      break;
    case 404:
      // Not found - silently ignore
      break;
    case 429:
      // Rate limited - log warning
      console.warn("Rate limited");
      break;
    default:
      console.error(`API error ${statusCode}`);
  }
}
```

---

## Testing Patterns

### Test File Structure

```
test/
├── runTest.ts           # VS Code test runner setup
└── suite/
    ├── index.ts         # Test suite loader
    └── *.test.ts        # Individual test files
```

### Mocking with Sinon

```typescript
import * as sinon from "sinon";

suite("MyService", () => {
  let sandbox: sinon.SinonSandbox;

  setup(() => {
    sandbox = sinon.createSandbox();
  });

  teardown(() => {
    sandbox.restore();
  });

  test("should handle error", () => {
    sandbox.stub(dependency, "method").throws(new Error("Test error"));
    // Test error handling
  });
});
```
