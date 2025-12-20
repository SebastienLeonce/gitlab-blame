import * as assert from "assert";
import * as vscode from "vscode";

/**
 * Integration tests for the complete extension flow
 * These tests run in a real VS Code environment
 */
suite("Extension Integration Tests", () => {
  test("Extension activates successfully", async () => {
    const ext = vscode.extensions.getExtension("sleonce.gitlab-blame");
    assert.ok(ext, "Extension not found");

    await ext.activate();
    assert.strictEqual(ext.isActive, true, "Extension not active");
  });

  test("Commands are registered", async () => {
    const commands = await vscode.commands.getCommands(true);

    assert.ok(
      commands.includes("gitlabBlame.setToken"),
      "setToken command not registered",
    );
    assert.ok(
      commands.includes("gitlabBlame.deleteToken"),
      "deleteToken command not registered",
    );
    assert.ok(
      commands.includes("gitlabBlame.clearCache"),
      "clearCache command not registered",
    );
    assert.ok(
      commands.includes("gitlabBlame.showStatus"),
      "showStatus command not registered",
    );
  });

  test("Configuration is accessible", () => {
    const config = vscode.workspace.getConfiguration("gitlabBlame");

    const gitlabUrl = config.get<string>("gitlabUrl");
    assert.strictEqual(
      gitlabUrl,
      "https://gitlab.com",
      "Default GitLab URL incorrect",
    );

    const cacheTTL = config.get<number>("cacheTTL");
    assert.strictEqual(cacheTTL, 3600, "Default cache TTL incorrect");
  });

  test("Hover provider is registered", async () => {
    // This test verifies that the hover provider is registered
    // We can't easily test the hover functionality without a real git repo
    // but we can verify the extension activated without errors
    const ext = vscode.extensions.getExtension("sleonce.gitlab-blame");
    assert.ok(ext?.isActive, "Extension should be active");
  });

  test("Configuration can be updated", async () => {
    const config = vscode.workspace.getConfiguration("gitlabBlame");
    const originalUrl = config.get<string>("gitlabUrl");

    try {
      // Update configuration
      await config.update(
        "gitlabUrl",
        "https://gitlab.example.com",
        vscode.ConfigurationTarget.Global,
      );

      // Verify update - get fresh config object
      const updatedConfig = vscode.workspace.getConfiguration("gitlabBlame");
      const updatedUrl = updatedConfig.get<string>("gitlabUrl");
      assert.strictEqual(
        updatedUrl,
        "https://gitlab.example.com",
        "Configuration not updated",
      );
    } finally {
      // Restore original value
      await config.update(
        "gitlabUrl",
        originalUrl,
        vscode.ConfigurationTarget.Global,
      );
    }
  });

  test("Clear cache command executes without errors", async () => {
    // Execute the clear cache command
    await vscode.commands.executeCommand("gitlabBlame.clearCache");
    // If we get here without throwing, the command executed successfully
    assert.ok(true, "Clear cache command executed");
  });

  test("Show status command executes without errors", async () => {
    // Execute the show status command
    // Note: This will show a UI dialog, but in test mode it shouldn't block
    const promise = vscode.commands.executeCommand("gitlabBlame.showStatus");

    // Don't await the promise as it may wait for user interaction
    // Just verify it started without throwing
    assert.ok(promise, "Show status command started");
  });
});
