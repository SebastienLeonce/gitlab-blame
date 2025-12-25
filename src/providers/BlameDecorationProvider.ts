import * as vscode from "vscode";
import {
  BLAME_CONSTANTS,
  VCS_PROVIDERS,
  DisplayMode,
  DISPLAY_MODES,
  UI_CONSTANTS,
} from "@constants";
import { ICacheService } from "@interfaces/ICacheService";
import { IVcsProvider } from "@interfaces/IVcsProvider";
import { MergeRequest } from "@interfaces/types";
import { GitService } from "@services/GitService";
import { VcsProviderFactory } from "@services/VcsProviderFactory";
import { VcsErrorHandler } from "./BlameHoverProvider";

/**
 * Provides inline blame decorations showing MR/PR links at end-of-line
 * Works with any VCS provider (GitLab, GitHub, etc.) via VcsProviderFactory
 */
export class BlameDecorationProvider {
  private decorationType: vscode.TextEditorDecorationType;
  private disposables: vscode.Disposable[] = [];
  private updateDebounceTimer: NodeJS.Timeout | undefined;

  // Active line tracking (decoration only visible on cursor line)
  private lastActiveLine: number | undefined;

  constructor(
    private gitService: GitService,
    private vcsProviderFactory: VcsProviderFactory,
    private cacheService: ICacheService,
    private displayMode: DisplayMode,
    private onVcsError?: VcsErrorHandler,
  ) {
    this.decorationType = this.createDecorationType();
  }

  /**
   * Activate decoration provider (register event listeners and update active editor)
   */
  /* c8 ignore start - VS Code API integration tested by e2e tests (inlineDecoration.e2e.ts) */
  activate(): void {
    this.registerEventListeners();
    void this.initialUpdateWithRetry();
  }

  /**
   * Initial update with retry logic for git initialization race condition
   * Git repositories may not be loaded immediately after api.state === "initialized"
   */
  private async initialUpdateWithRetry(attempt = 1): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }

    const remoteUrl = this.gitService.getRemoteUrl(editor.document.uri);
    if (!remoteUrl && attempt < UI_CONSTANTS.MAX_INIT_RETRIES) {
      // Git not ready yet, retry after delay
      setTimeout(() => {
        void this.initialUpdateWithRetry(attempt + 1);
      }, UI_CONSTANTS.INIT_RETRY_DELAY_MS);
      return;
    }

    await this.updateDecorations(editor.document);
  }
  /* c8 ignore stop */

  /**
   * Create decoration type with styling
   */
  private createDecorationType(): vscode.TextEditorDecorationType {
    return vscode.window.createTextEditorDecorationType({
      after: {
        color: new vscode.ThemeColor("editorCodeLens.foreground"),
        fontStyle: "italic",
        margin: "0 0 0 1em",
      },
    });
  }

  /**
   * Register event listeners for decoration updates
   */
  /* c8 ignore start - VS Code event listeners tested by e2e tests (inlineDecoration.e2e.ts) */
  private registerEventListeners(): void {
    // Update decorations when active editor changes
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor(() => {
        void this.updateActiveEditor();
      }),
    );

    // Update decorations when document content changes (debounced)
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument((event) => {
        this.scheduleUpdate(event.document);
      }),
    );

    // Track cursor movement to update active line decoration
    this.disposables.push(
      vscode.window.onDidChangeTextEditorSelection((event) => {
        this.handleCursorMovement(event);
      }),
    );
  }

  /**
   * Handle cursor movement - update decoration to follow cursor
   */
  private handleCursorMovement(
    event: vscode.TextEditorSelectionChangeEvent,
  ): void {
    // Defensive check for empty selections
    const selections = event.selections;
    if (!selections.length) {
      return;
    }

    const activeLine = selections[0].active.line;

    // Skip if line unchanged (only skip if previous update was successful)
    if (this.lastActiveLine === activeLine) {
      return;
    }

    // Debounce to avoid flickering during rapid cursor movement
    if (this.updateDebounceTimer) {
      clearTimeout(this.updateDebounceTimer);
    }

    this.updateDebounceTimer = setTimeout(() => {
      void this.updateActiveLineDecoration(event.textEditor);
    }, UI_CONSTANTS.CURSOR_DEBOUNCE_MS);
  }

  /**
   * Schedule a debounced decoration update for a document
   */
  private scheduleUpdate(document: vscode.TextDocument): void {
    if (this.updateDebounceTimer) {
      clearTimeout(this.updateDebounceTimer);
    }

    this.updateDebounceTimer = setTimeout(() => {
      void this.updateDecorations(document);
    }, UI_CONSTANTS.DOCUMENT_DEBOUNCE_MS);
  }

  /**
   * Update decorations for the active editor
   */
  private async updateActiveEditor(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }

    await this.updateDecorations(editor.document);
  }

  /**
   * Update decorations for a document (active line only)
   */
  private async updateDecorations(
    document: vscode.TextDocument,
  ): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document !== document) {
      return; // Document not visible
    }

    // Update decoration for active line only
    await this.updateActiveLineDecoration(editor);
  }
  /* c8 ignore stop */

  /**
   * Update decoration for the active line (cursor position)
   * Clears any previous decoration and shows MR/PR link only on current line
   */
  /* c8 ignore start - VS Code decoration API tested by e2e tests (inlineDecoration.e2e.ts) */
  private async updateActiveLineDecoration(
    editor: vscode.TextEditor,
  ): Promise<void> {
    const document = editor.document;
    const activeLine = editor.selection.active.line;

    // Clear all existing decorations first (active line only mode)
    editor.setDecorations(this.decorationType, []);

    // Get remote URL and detect provider
    const remoteUrl = this.gitService.getRemoteUrl(document.uri);
    if (!remoteUrl) {
      return;
    }

    const provider = this.vcsProviderFactory.detectProvider(remoteUrl);
    if (!provider || !provider.hasToken()) {
      return;
    }

    const remoteInfo = provider.parseRemoteUrl(remoteUrl);
    if (!remoteInfo) {
      return;
    }

    // Get blame for active line only (fast)
    const blameInfo = await this.gitService.getBlameForLine(
      document.uri,
      activeLine,
    );
    if (!blameInfo) {
      return;
    }

    // Check cache first (fastest path)
    const cached = this.cacheService.get(provider.id, blameInfo.sha);
    if (cached !== undefined) {
      // Cache hit - instant render
      if (cached) {
        const decoration = this.createDecoration(
          blameInfo.line,
          cached,
          provider,
        );
        editor.setDecorations(this.decorationType, [decoration]);
      }
      // Mark line as processed (cache hit is a successful completion)
      this.lastActiveLine = activeLine;
      return;
    }

    // Cache miss - fetch from API
    const result = await provider.getMergeRequestForCommit(
      remoteInfo.projectPath,
      blameInfo.sha,
      remoteInfo.host,
    );

    if (!result.success && result.error) {
      if (this.onVcsError) {
        this.onVcsError(result.error, provider);
      }
      // Cache null to avoid repeated errors
      this.cacheService.set(provider.id, blameInfo.sha, null);
      return;
    }

    const mr = result.data ?? null;
    this.cacheService.set(provider.id, blameInfo.sha, mr);

    if (mr) {
      const decoration = this.createDecoration(blameInfo.line, mr, provider);
      editor.setDecorations(this.decorationType, [decoration]);
    }

    // Mark line as processed after successful API fetch
    this.lastActiveLine = activeLine;
  }
  /* c8 ignore stop */

  /**
   * Create decoration for a single line
   */
  private createDecoration(
    lineNum: number,
    mr: MergeRequest,
    provider: IVcsProvider,
  ): vscode.DecorationOptions {
    // Format MR/PR number with provider-specific prefix
    const prefix = provider.id === VCS_PROVIDERS.GITLAB ? "!" : "#";
    const mrText = `${prefix}${mr.iid}`;

    // VS Code uses 0-based line numbers
    const line = lineNum - BLAME_CONSTANTS.LINE_NUMBER_OFFSET;
    const range = new vscode.Range(
      line,
      Number.MAX_SAFE_INTEGER, // End of line
      line,
      Number.MAX_SAFE_INTEGER,
    );

    const decoration: vscode.DecorationOptions = {
      range,
      renderOptions: {
        after: {
          contentText: mrText,
        },
      },
    };

    // Only add hover message when HoverProvider is NOT active
    // In "both" mode, HoverProvider handles tooltips to avoid duplication
    if (this.displayMode !== DISPLAY_MODES.BOTH) {
      const hoverMarkdown = new vscode.MarkdownString();
      hoverMarkdown.isTrusted = true;
      hoverMarkdown.appendMarkdown(
        `[${mrText}: ${this.escapeMarkdown(mr.title)}](${mr.webUrl})`,
      );
      decoration.hoverMessage = hoverMarkdown;
    }

    return decoration;
  }

  /**
   * Escape special markdown characters
   */
  private escapeMarkdown(text: string): string {
    return text.replace(/[\\`*_{}[\]()#+\-.!]/g, "\\$&");
  }

  /**
   * Dispose of all resources
   */
  dispose(): void {
    this.decorationType.dispose();

    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables = [];

    if (this.updateDebounceTimer) {
      clearTimeout(this.updateDebounceTimer);
    }
  }
}
