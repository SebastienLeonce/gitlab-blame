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

### Git Blame Porcelain Parsing

```typescript
// Parse git blame --porcelain output
const lines = output.split("\n");
let currentSha: string | undefined;

for (const line of lines) {
  // SHA line: <sha> <orig-line> <final-line> [<num-lines>]
  const shaMatch = line.match(/^([a-f0-9]{40}) \d+ (\d+)/);
  if (shaMatch) {
    currentSha = shaMatch[1];
    continue;
  }

  // Key-value lines
  if (line.startsWith("author ")) {
    const author = line.substring(7);
  }

  // Content line (ends the block)
  if (line.startsWith("\t")) {
    // Process complete entry
  }
}
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
