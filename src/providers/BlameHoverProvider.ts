import * as vscode from "vscode";
import { VcsProviderId } from "@constants";
import { ICacheService } from "@interfaces/ICacheService";
import { IHoverContentService } from "@interfaces/IHoverContentService";
import { IVcsProvider } from "@interfaces/IVcsProvider";
import { BlameInfo, MergeRequest, VcsError } from "@interfaces/types";
import { GitService } from "@services/GitService";
import { VcsProviderFactory } from "@services/VcsProviderFactory";

/**
 * Callback for handling VCS errors with UI
 */
export type VcsErrorHandler = (error: VcsError, provider: IVcsProvider) => void;

/**
 * Provides hover information for git blame with MR/PR links
 * Works with any VCS provider (GitLab, GitHub, etc.) via VcsProviderFactory
 */
export class BlameHoverProvider implements vscode.HoverProvider {
  private pendingRequests = new Map<string, Promise<MergeRequest | null>>();

  constructor(
    private gitService: GitService,
    private vcsProviderFactory: VcsProviderFactory,
    private cacheService: ICacheService,
    private hoverContentService: IHoverContentService,
    private onVcsError?: VcsErrorHandler,
  ) {}

  async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
  ): Promise<vscode.Hover | null> {
    const blameInfo = await this.gitService.getBlameForLine(
      document.uri,
      position.line,
    );

    if (!blameInfo) {
      // No blame info (uncommitted line or error)
      return null;
    }

    if (token.isCancellationRequested) {
      return null;
    }

    const content = await this.buildHoverContent(
      document.uri,
      blameInfo,
      token,
    );

    if (!content) {
      return null;
    }

    return new vscode.Hover(content);
  }

  /**
   * Build the hover content with MR link only
   * Returns null if no MR found and not loading (suppress hover)
   */
  private async buildHoverContent(
    uri: vscode.Uri,
    blameInfo: BlameInfo,
    token: vscode.CancellationToken,
  ): Promise<vscode.MarkdownString | null> {
    const md = new vscode.MarkdownString();
    md.isTrusted = true;
    md.supportHtml = true;

    const mrResult = await this.getMergeRequestInfo(uri, blameInfo.sha, token);

    // Get provider for prefix
    const remoteUrl = this.gitService.getRemoteUrl(uri);
    const provider = remoteUrl
      ? this.vcsProviderFactory.detectProvider(remoteUrl)
      : undefined;

    const content = this.hoverContentService.formatRichHoverContent(
      mrResult.mr,
      provider?.id as VcsProviderId | undefined,
      { loading: mrResult.loading },
    );

    if (!content) {
      return null;
    }

    md.appendMarkdown(content);
    return md;
  }

  /**
   * Get MR info from cache or fetch from API
   */
  private async getMergeRequestInfo(
    uri: vscode.Uri,
    sha: string,
    token: vscode.CancellationToken,
  ): Promise<{ mr: MergeRequest | null; loading: boolean; checked: boolean }> {
    const remoteUrl = this.gitService.getRemoteUrl(uri);
    if (!remoteUrl) {
      return { mr: null, loading: false, checked: false };
    }

    const provider = this.vcsProviderFactory.detectProvider(remoteUrl);
    if (!provider) {
      return { mr: null, loading: false, checked: false };
    }

    const cached = this.cacheService.get(provider.id, sha);
    if (cached !== undefined) {
      // Cache hit (could be MR or null for "no MR")
      return { mr: cached, loading: false, checked: true };
    }

    const pendingKey = `${provider.id}:${sha}`;
    if (this.pendingRequests.has(pendingKey)) {
      return { mr: null, loading: true, checked: false };
    }

    if (!provider.hasToken()) {
      return { mr: null, loading: false, checked: false };
    }

    const remoteInfo = provider.parseRemoteUrl(remoteUrl);
    if (!remoteInfo) {
      return { mr: null, loading: false, checked: false };
    }

    const requestPromise = this.fetchAndCacheMR(
      provider,
      remoteInfo.projectPath,
      sha,
      remoteInfo.host,
    );
    this.pendingRequests.set(pendingKey, requestPromise);

    try {
      const mr = await Promise.race([
        requestPromise,
        new Promise<null>((resolve) => {
          token.onCancellationRequested(() => resolve(null));
        }),
      ]);

      if (token.isCancellationRequested) {
        return { mr: null, loading: false, checked: false };
      }

      return { mr, loading: false, checked: true };
    } finally {
      this.pendingRequests.delete(pendingKey);
    }
  }

  /**
   * Fetch MR from API and cache the result
   */
  private async fetchAndCacheMR(
    provider: IVcsProvider,
    projectPath: string,
    sha: string,
    host: string,
  ): Promise<MergeRequest | null> {
    const result = await provider.getMergeRequestForCommit(
      projectPath,
      sha,
      host,
    );

    if (!result.success && result.error) {
      if (this.onVcsError) {
        this.onVcsError(result.error, provider);
      }
      // Cache null to avoid repeated errors
      this.cacheService.set(provider.id, sha, null);
      return null;
    }

    const mr = result.data ?? null;
    this.cacheService.set(provider.id, sha, mr);
    return mr;
  }
}
