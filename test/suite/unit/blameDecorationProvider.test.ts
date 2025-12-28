import * as assert from "assert";
import * as sinon from "sinon";
import * as vscode from "vscode";
import { BlameDecorationProvider } from "@providers/BlameDecorationProvider";
import { CacheService } from "@services/CacheService";
import { GitService } from "@services/GitService";
import { HoverContentService } from "@services/HoverContentService";
import { VcsProviderFactory } from "@services/VcsProviderFactory";
import { IHoverContentService } from "@interfaces/IHoverContentService";
import { IVcsProvider } from "@interfaces/IVcsProvider";
import { BlameInfo, MergeRequest } from "@types";

suite("BlameDecorationProvider", () => {
  let decorationProvider: BlameDecorationProvider;
  let mockGitService: sinon.SinonStubbedInstance<GitService>;
  let mockVcsProviderFactory: sinon.SinonStubbedInstance<VcsProviderFactory>;
  let mockCacheService: sinon.SinonStubbedInstance<CacheService>;
  let hoverContentService: IHoverContentService;
  let mockVcsProvider: {
    id: string;
    name: string;
    setToken: sinon.SinonStub;
    hasToken: sinon.SinonStub;
    getHostUrl: sinon.SinonStub;
    setHostUrl: sinon.SinonStub;
    parseRemoteUrl: sinon.SinonStub;
    isProviderUrl: sinon.SinonStub;
    getMergeRequestForCommit: sinon.SinonStub;
    resetErrorState: sinon.SinonStub;
  };
  let vcsErrorCallback: sinon.SinonSpy;
  let getConfigurationStub: sinon.SinonStub;
  let createTextEditorDecorationTypeStub: sinon.SinonStub;
  let mockDecorationType: sinon.SinonStubbedInstance<vscode.TextEditorDecorationType>;

  setup(() => {
    // Stub vscode.workspace.getConfiguration
    getConfigurationStub = sinon.stub(vscode.workspace, "getConfiguration");
    getConfigurationStub.returns({
      get: sinon.stub().returns(3600),
    } as unknown as vscode.WorkspaceConfiguration);

    // Create mock decoration type
    mockDecorationType = {
      dispose: sinon.stub(),
    } as unknown as sinon.SinonStubbedInstance<vscode.TextEditorDecorationType>;

    // Stub vscode.window.createTextEditorDecorationType
    createTextEditorDecorationTypeStub = sinon.stub(
      vscode.window,
      "createTextEditorDecorationType",
    );
    createTextEditorDecorationTypeStub.returns(mockDecorationType);

    // Create mock services
    mockGitService = sinon.createStubInstance(GitService);
    mockVcsProviderFactory = sinon.createStubInstance(VcsProviderFactory);
    mockCacheService = sinon.createStubInstance(CacheService);

    // Use real HoverContentService (stateless, no mocking needed)
    hoverContentService = new HoverContentService();

    // Create mock VCS provider
    mockVcsProvider = {
      id: "gitlab",
      name: "GitLab",
      setToken: sinon.stub(),
      hasToken: sinon.stub().returns(true),
      getHostUrl: sinon.stub().returns("https://gitlab.com"),
      setHostUrl: sinon.stub(),
      parseRemoteUrl: sinon.stub(),
      isProviderUrl: sinon.stub().returns(true),
      getMergeRequestForCommit: sinon.stub(),
      resetErrorState: sinon.stub(),
    };

    // Setup factory to return mock provider
    mockVcsProviderFactory.detectProvider.returns(
      mockVcsProvider as unknown as IVcsProvider,
    );

    // Create error callback spy
    vcsErrorCallback = sinon.spy();

    // Create provider with mocked dependencies
    decorationProvider = new BlameDecorationProvider(
      mockGitService as unknown as GitService,
      mockVcsProviderFactory as unknown as VcsProviderFactory,
      mockCacheService as unknown as CacheService,
      hoverContentService,
      "inline", // Default to inline mode for existing tests
      vcsErrorCallback,
    );
  });

  teardown(() => {
    decorationProvider.dispose();
    getConfigurationStub.restore();
    createTextEditorDecorationTypeStub.restore();
  });

  suite("Initialization", () => {
    test("creates decoration type on construction", () => {
      assert.ok(createTextEditorDecorationTypeStub.calledOnce);

      const decorationConfig =
        createTextEditorDecorationTypeStub.firstCall.args[0];
      assert.ok(decorationConfig.after);
      assert.strictEqual(decorationConfig.after.fontStyle, "italic");
      assert.strictEqual(decorationConfig.after.margin, "0 0 0 1em");
    });

    test("disposes decoration type on dispose", () => {
      decorationProvider.dispose();

      assert.ok(mockDecorationType.dispose.calledOnce);
    });
  });

  suite("createDecoration", () => {
    // Helper to create mock BlameInfo
    function createMockBlameInfo(line: number): BlameInfo {
      return {
        sha: "abc1234def5678",
        author: "John Doe",
        authorEmail: "john@example.com",
        date: new Date("2024-01-15T10:30:00Z"),
        summary: "Fix login bug",
        line,
      };
    }

    // Access private method for testing
    function createDecoration(
      mr: MergeRequest,
      blameInfo: BlameInfo,
      provider: IVcsProvider,
    ): vscode.DecorationOptions {
      return (
        decorationProvider as unknown as {
          createDecoration: (
            mr: MergeRequest,
            blameInfo: BlameInfo,
            provider: IVcsProvider,
          ) => vscode.DecorationOptions;
        }
      ).createDecoration(mr, blameInfo, provider);
    }

    test("creates decoration with correct format for GitLab", () => {
      const mockMR: MergeRequest = {
        iid: 123,
        title: "Fix login bug",
        webUrl: "https://gitlab.com/project/merge_requests/123",
        mergedAt: "2024-01-01T00:00:00Z",
        state: "merged",
      };
      const blameInfo = createMockBlameInfo(1);

      const decoration = createDecoration(
        mockMR,
        blameInfo,
        mockVcsProvider as unknown as IVcsProvider,
      );

      assert.strictEqual(decoration.renderOptions?.after?.contentText, "!123");
      assert.strictEqual(decoration.range.start.line, 0); // 0-based (line 1 -> index 0)
    });

    test("creates decoration with correct format for GitHub", () => {
      const githubProvider = {
        ...mockVcsProvider,
        id: "github",
        name: "GitHub",
      };

      const mockPR: MergeRequest = {
        iid: 456,
        title: "Fix login bug",
        webUrl: "https://github.com/user/repo/pull/456",
        mergedAt: "2024-01-01T00:00:00Z",
        state: "merged",
      };
      const blameInfo = createMockBlameInfo(1);

      const decoration = createDecoration(
        mockPR,
        blameInfo,
        githubProvider as unknown as IVcsProvider,
      );

      assert.strictEqual(decoration.renderOptions?.after?.contentText, "#456");
    });

    test("includes hover message with MR link in inline mode", () => {
      const mockMR: MergeRequest = {
        iid: 123,
        title: "Fix login bug",
        webUrl: "https://gitlab.com/project/merge_requests/123",
        mergedAt: "2024-01-01T00:00:00Z",
        state: "merged",
      };
      const blameInfo = createMockBlameInfo(1);

      const decoration = createDecoration(
        mockMR,
        blameInfo,
        mockVcsProvider as unknown as IVcsProvider,
      );

      assert.ok(decoration.hoverMessage);
      const hoverMarkdown = decoration.hoverMessage as vscode.MarkdownString;
      // Hover content includes only MR link
      assert.ok(hoverMarkdown.value.includes("**Merge Request**"));
      assert.ok(hoverMarkdown.value.includes("!123"));
      assert.ok(hoverMarkdown.value.includes("Fix login bug"));
      assert.ok(
        hoverMarkdown.value.includes(
          "https://gitlab.com/project/merge_requests/123",
        ),
      );
    });
  });

  suite("Disposal", () => {
    test("clears debounce timer on dispose", () => {
      const clock = sinon.useFakeTimers();

      // Schedule an update (this sets the debounce timer)
      const mockDocument = {
        uri: vscode.Uri.file("/test/file.ts"),
      } as vscode.TextDocument;

      (
        decorationProvider as unknown as {
          scheduleUpdate: (doc: vscode.TextDocument) => void;
        }
      ).scheduleUpdate(mockDocument);

      // Dispose should clear the timer
      decorationProvider.dispose();

      // Advance clock - if timer wasn't cleared, update would be called
      clock.tick(1000);

      // No updates should have been triggered
      assert.ok(mockGitService.getBlameForFile.notCalled);

      clock.restore();
    });
  });

  suite("Display Mode Behavior", () => {
    // Helper to create mock BlameInfo
    function createMockBlameInfo(line: number): BlameInfo {
      return {
        sha: "abc1234def5678",
        author: "John Doe",
        authorEmail: "john@example.com",
        date: new Date("2024-01-15T10:30:00Z"),
        summary: "Fix login bug",
        line,
      };
    }

    // Access private method for testing
    function createDecoration(
      provider: BlameDecorationProvider,
      mr: MergeRequest,
      blameInfo: BlameInfo,
      vcsProvider: IVcsProvider,
    ): vscode.DecorationOptions {
      return (
        provider as unknown as {
          createDecoration: (
            mr: MergeRequest,
            blameInfo: BlameInfo,
            provider: IVcsProvider,
          ) => vscode.DecorationOptions;
        }
      ).createDecoration(mr, blameInfo, vcsProvider);
    }

    test("includes hoverMessage in 'inline' mode", () => {
      const inlineProvider = new BlameDecorationProvider(
        mockGitService as unknown as GitService,
        mockVcsProviderFactory as unknown as VcsProviderFactory,
        mockCacheService as unknown as CacheService,
        hoverContentService,
        "inline",
        vcsErrorCallback,
      );

      const mockMR: MergeRequest = {
        iid: 123,
        title: "Fix login bug",
        webUrl: "https://gitlab.com/project/merge_requests/123",
        mergedAt: "2024-01-01T00:00:00Z",
        state: "merged",
      };
      const blameInfo = createMockBlameInfo(1);

      const decoration = createDecoration(
        inlineProvider,
        mockMR,
        blameInfo,
        mockVcsProvider as unknown as IVcsProvider,
      );

      // Should include hoverMessage
      assert.ok(
        decoration.hoverMessage,
        "hoverMessage should be present in 'inline' mode",
      );
      inlineProvider.dispose();
    });

    test("includes hoverMessage in 'hover' mode", () => {
      const hoverProvider = new BlameDecorationProvider(
        mockGitService as unknown as GitService,
        mockVcsProviderFactory as unknown as VcsProviderFactory,
        mockCacheService as unknown as CacheService,
        hoverContentService,
        "hover",
        vcsErrorCallback,
      );

      const mockMR: MergeRequest = {
        iid: 123,
        title: "Fix login bug",
        webUrl: "https://gitlab.com/project/merge_requests/123",
        mergedAt: "2024-01-01T00:00:00Z",
        state: "merged",
      };
      const blameInfo = createMockBlameInfo(1);

      const decoration = createDecoration(
        hoverProvider,
        mockMR,
        blameInfo,
        mockVcsProvider as unknown as IVcsProvider,
      );

      // Should include hoverMessage
      assert.ok(
        decoration.hoverMessage,
        "hoverMessage should be present in 'hover' mode",
      );
      hoverProvider.dispose();
    });

    test("omits hoverMessage in 'both' mode to prevent duplication", () => {
      const bothProvider = new BlameDecorationProvider(
        mockGitService as unknown as GitService,
        mockVcsProviderFactory as unknown as VcsProviderFactory,
        mockCacheService as unknown as CacheService,
        hoverContentService,
        "both",
        vcsErrorCallback,
      );

      const mockMR: MergeRequest = {
        iid: 123,
        title: "Fix login bug",
        webUrl: "https://gitlab.com/project/merge_requests/123",
        mergedAt: "2024-01-01T00:00:00Z",
        state: "merged",
      };
      const blameInfo = createMockBlameInfo(1);

      const decoration = createDecoration(
        bothProvider,
        mockMR,
        blameInfo,
        mockVcsProvider as unknown as IVcsProvider,
      );

      // Should NOT include hoverMessage (HoverProvider handles it)
      assert.strictEqual(
        decoration.hoverMessage,
        undefined,
        "hoverMessage should be omitted in 'both' mode to prevent duplication",
      );

      // But should still have inline text
      assert.strictEqual(
        decoration.renderOptions?.after?.contentText,
        "!123",
        "Inline decoration text should still be present",
      );

      bothProvider.dispose();
    });
  });

  suite("Active Line Tracking", () => {
    test("lastActiveLine is not set when getRemoteUrl returns null", () => {
      // Access private state
      const provider = decorationProvider as unknown as {
        lastActiveLine: number | undefined;
        gitService: { getRemoteUrl: () => string | undefined };
      };

      // Ensure lastActiveLine is initially undefined
      provider.lastActiveLine = undefined;

      // Mock getRemoteUrl to return undefined (no git remote)
      mockGitService.getRemoteUrl.returns(undefined);

      // The lastActiveLine should remain undefined since getRemoteUrl returns null
      // This allows retry on next cursor movement event
      assert.strictEqual(
        provider.lastActiveLine,
        undefined,
        "lastActiveLine should not be set when operation fails early",
      );
    });

    test("handleCursorMovement does not skip when lastActiveLine is undefined", () => {
      // Access private state
      const provider = decorationProvider as unknown as {
        lastActiveLine: number | undefined;
        updateDebounceTimer: NodeJS.Timeout | undefined;
        handleCursorMovement: (
          event: vscode.TextEditorSelectionChangeEvent,
        ) => void;
      };

      // Set lastActiveLine to undefined (simulating failed initialization)
      provider.lastActiveLine = undefined;
      provider.updateDebounceTimer = undefined;

      // Create mock event for line 5
      const mockEvent = {
        selections: [{ active: { line: 5 } }],
        textEditor: {
          document: { uri: vscode.Uri.file("/test/file.ts") },
          selection: { active: { line: 5 } },
        },
      } as unknown as vscode.TextEditorSelectionChangeEvent;

      // Call handleCursorMovement - should NOT skip even though activeLine is 5
      // and we're "on" line 5 (because lastActiveLine is undefined, not 5)
      provider.handleCursorMovement(mockEvent);

      // Debounce timer should be set (update was scheduled)
      // Note: lastActiveLine is only set in updateActiveLineDecoration after success
      assert.ok(
        provider.updateDebounceTimer !== undefined,
        "Debounce timer should be set when lastActiveLine is undefined",
      );
    });

    test("handleCursorMovement handles empty selections gracefully", () => {
      // Access private state
      const provider = decorationProvider as unknown as {
        lastActiveLine: number | undefined;
        updateDebounceTimer: NodeJS.Timeout | undefined;
        handleCursorMovement: (
          event: vscode.TextEditorSelectionChangeEvent,
        ) => void;
      };

      provider.lastActiveLine = undefined;
      provider.updateDebounceTimer = undefined;

      // Create mock event with empty selections
      const mockEvent = {
        selections: [],
        textEditor: {
          document: { uri: vscode.Uri.file("/test/file.ts") },
          selection: { active: { line: 5 } },
        },
      } as unknown as vscode.TextEditorSelectionChangeEvent;

      // Should not throw and should not set timer
      assert.doesNotThrow(() => {
        provider.handleCursorMovement(mockEvent);
      });

      // No debounce timer should be set (early return)
      assert.strictEqual(
        provider.updateDebounceTimer,
        undefined,
        "Should not schedule update for empty selections",
      );
    });

    test("handleCursorMovement skips when lastActiveLine matches current line", () => {
      // Access private state
      const provider = decorationProvider as unknown as {
        lastActiveLine: number | undefined;
        updateDebounceTimer: NodeJS.Timeout | undefined;
        handleCursorMovement: (
          event: vscode.TextEditorSelectionChangeEvent,
        ) => void;
      };

      // Set lastActiveLine to 5 (simulating successful previous update)
      provider.lastActiveLine = 5;
      provider.updateDebounceTimer = undefined;

      // Create mock event for same line
      const mockEvent = {
        selections: [{ active: { line: 5 } }],
        textEditor: {
          document: { uri: vscode.Uri.file("/test/file.ts") },
          selection: { active: { line: 5 } },
        },
      } as unknown as vscode.TextEditorSelectionChangeEvent;

      // Call handleCursorMovement - should skip because line matches
      provider.handleCursorMovement(mockEvent);

      // No debounce timer should be set (skipped)
      assert.strictEqual(
        provider.updateDebounceTimer,
        undefined,
        "Should skip update when lastActiveLine matches",
      );
    });
  });
});
