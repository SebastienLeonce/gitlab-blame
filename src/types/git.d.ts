/**
 * Type definitions for VS Code Git Extension API
 * Subset of types needed for gitlab-blame extension
 * Source: https://github.com/microsoft/vscode/blob/main/extensions/git/src/api/git.d.ts
 */

import { Uri, Event, Disposable } from "vscode";

export interface GitExtension {
  readonly enabled: boolean;
  readonly onDidChangeEnablement: Event<boolean>;

  /**
   * Get the Git API for a specific version
   * @param version API version (1 is the current stable version)
   */
  getAPI(version: 1): API;
}

export interface API {
  readonly state: "uninitialized" | "initialized";
  readonly onDidChangeState: Event<"uninitialized" | "initialized">;
  readonly onDidOpenRepository: Event<Repository>;
  readonly onDidCloseRepository: Event<Repository>;
  readonly repositories: Repository[];

  /**
   * Get the repository for a given URI
   */
  getRepository(uri: Uri): Repository | null;
}

export interface Repository {
  readonly rootUri: Uri;
  readonly inputBox: InputBox;
  readonly state: RepositoryState;

  /**
   * Get blame information for a file
   * @param path Absolute path to the file
   * @returns Blame output as a string (git blame --porcelain format)
   */
  blame(path: string): Promise<string>;

  /**
   * Get a specific commit
   */
  getCommit(ref: string): Promise<Commit>;

  /**
   * Get the configuration value
   */
  getConfig(key: string): Promise<string>;
}

export interface RepositoryState {
  readonly HEAD: Ref | undefined;
  readonly refs: Ref[];
  readonly remotes: Remote[];
  readonly onDidChange: Event<void>;
}

export interface Ref {
  readonly type: RefType;
  readonly name?: string;
  readonly commit?: string;
  readonly remote?: string;
}

export const enum RefType {
  Head = 0,
  RemoteHead = 1,
  Tag = 2,
}

export interface Remote {
  readonly name: string;
  readonly fetchUrl?: string;
  readonly pushUrl?: string;
  readonly isReadOnly: boolean;
}

export interface Commit {
  readonly hash: string;
  readonly message: string;
  readonly parents: string[];
  readonly authorDate?: Date;
  readonly authorName?: string;
  readonly authorEmail?: string;
  readonly commitDate?: Date;
}

export interface InputBox {
  value: string;
}
