import * as vscode from "vscode";

/**
 * Centralized error logging service
 * Provides consistent error format and VS Code Output Channel integration
 */
export class ErrorLogger {
  private static instance: ErrorLogger | undefined;
  private outputChannel: vscode.OutputChannel | undefined;

  private constructor() {}

  static getInstance(): ErrorLogger {
    if (!ErrorLogger.instance) {
      ErrorLogger.instance = new ErrorLogger();
    }
    return ErrorLogger.instance;
  }

  /**
   * Reset the singleton instance (for testing only)
   * @internal
   */
  static reset(): void {
    ErrorLogger.instance = undefined;
  }

  initialize(outputChannel: vscode.OutputChannel): void {
    this.outputChannel = outputChannel;
  }

  /**
   * Log error with consistent format: [Provider] Context: Message
   */
  error(provider: string, context: string, error: unknown): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const message = `[${provider}] ${context}: ${errorMessage}`;

    this.outputChannel?.appendLine(`ERROR: ${message}`);
  }

  /**
   * Log warning message
   */
  warn(provider: string, context: string, message: string): void {
    const formattedMessage = `[${provider}] ${context}: ${message}`;
    this.outputChannel?.appendLine(`WARN: ${formattedMessage}`);
  }

  /**
   * Log info message
   */
  info(message: string): void {
    this.outputChannel?.appendLine(`INFO: ${message}`);
  }
}

export const logger = ErrorLogger.getInstance();
