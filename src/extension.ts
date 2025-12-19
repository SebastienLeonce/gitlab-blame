import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext): void {
  console.log("GitLab Blame MR Link extension is now active");

  // Register command: Set Personal Access Token
  const setTokenCommand = vscode.commands.registerCommand(
    "gitlabBlame.setToken",
    async () => {
      const token = await vscode.window.showInputBox({
        prompt: "Enter your GitLab Personal Access Token",
        password: true,
        ignoreFocusOut: true,
        placeHolder: "glpat-xxxxxxxxxxxxxxxxxxxx",
      });

      if (token) {
        await context.secrets.store("gitlabBlame.token", token);
        void vscode.window.showInformationMessage(
          "GitLab token saved successfully",
        );
      }
    },
  );

  // Register command: Clear Cache
  const clearCacheCommand = vscode.commands.registerCommand(
    "gitlabBlame.clearCache",
    () => {
      // TODO: Implement cache clearing when CacheService is created
      void vscode.window.showInformationMessage("GitLab Blame cache cleared");
    },
  );

  context.subscriptions.push(setTokenCommand, clearCacheCommand);

  // TODO: Initialize services and register HoverProvider
  // - GitService
  // - GitLabService
  // - CacheService
  // - BlameHoverProvider
}

export function deactivate(): void {
  // Cleanup if needed
}
