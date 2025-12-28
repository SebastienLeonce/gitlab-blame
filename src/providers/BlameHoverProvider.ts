import * as vscode from "vscode";
import { VcsProviderId } from "@constants";
import { ICacheService } from "@interfaces/ICacheService";
import { IHoverContentService } from "@interfaces/IHoverContentService";
import { IVcsProvider } from "@interfaces/IVcsProvider";
import {
  BlameInfo,
  MergeRequest,
  RemoteInfo,
  VcsError,
} from "@interfaces/types";
import { logger } from "@services/ErrorLogger";
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
export class BlameHoverProvider
  implements vscode.HoverProvider, vscode.Disposable
{
  private pendingRequests = new Map<string, Promise<MergeRequest | null>>();
  private pendingStatsRequests = new Set<string>();

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
    md.supportThemeIcons = true;

    const mrResult = await this.getMergeRequestInfo(uri, blameInfo.sha, token);

    // Get provider for prefix
    const remoteUrl = this.gitService.getRemoteUrl(uri);
    const provider = remoteUrl
      ? this.vcsProviderFactory.detectProvider(remoteUrl)
      : undefined;

    const content = this.hoverContentService.formatRichHoverContent(
      mrResult.mr,
      provider?.id as VcsProviderId | undefined,
      { loading: mrResult.loading, statsLoading: mrResult.statsLoading },
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
  ): Promise<{
    mr: MergeRequest | null;
    loading: boolean;
    checked: boolean;
    statsLoading: boolean;
  }> {
    const remoteUrl = this.gitService.getRemoteUrl(uri);
    if (!remoteUrl) {
      return { mr: null, loading: false, checked: false, statsLoading: false };
    }

    const provider = this.vcsProviderFactory.detectProvider(remoteUrl);
    if (!provider) {
      return { mr: null, loading: false, checked: false, statsLoading: false };
    }

    const cached = this.cacheService.get(provider.id, sha);
    if (cached !== undefined) {
      // Cache hit (could be MR or null for "no MR")
      if (cached && !cached.stats) {
        const remoteInfo = provider.parseRemoteUrl(remoteUrl);
        if (remoteInfo) {
          this.triggerStatsFetch(provider, remoteInfo, cached, sha);
          return {
            mr: cached,
            loading: false,
            checked: true,
            statsLoading: true,
          };
        }
      }
      return { mr: cached, loading: false, checked: true, statsLoading: false };
    }

    const pendingKey = `${provider.id}:${sha}`;
    if (this.pendingRequests.has(pendingKey)) {
      return { mr: null, loading: true, checked: false, statsLoading: false };
    }

    if (!provider.hasToken()) {
      return { mr: null, loading: false, checked: false, statsLoading: false };
    }

    const remoteInfo = provider.parseRemoteUrl(remoteUrl);
    if (!remoteInfo) {
      return { mr: null, loading: false, checked: false, statsLoading: false };
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
        return {
          mr: null,
          loading: false,
          checked: false,
          statsLoading: false,
        };
      }

      // Trigger stats fetch for newly fetched MR
      if (mr && !mr.stats) {
        this.triggerStatsFetch(provider, remoteInfo, mr, sha);
        return { mr, loading: false, checked: true, statsLoading: true };
      }

      return { mr, loading: false, checked: true, statsLoading: false };
    } finally {
      this.pendingRequests.delete(pendingKey);
    }
  }

  /**
   * Trigger background stats fetch (fire-and-forget)
   */
  private triggerStatsFetch(
    provider: IVcsProvider,
    remoteInfo: RemoteInfo,
    mr: MergeRequest,
    sha: string,
  ): void {
    const statsKey = `${provider.id}:stats:${sha}`;

    if (this.pendingStatsRequests.has(statsKey)) {
      return;
    }

    this.pendingStatsRequests.add(statsKey);

    provider
      .getMergeRequestStats(remoteInfo.projectPath, mr.iid, remoteInfo.host)
      .then((result) => {
        if (result.success && result.data) {
          this.cacheService.updateStats(provider.id, sha, result.data);
        }
      })
      .catch((error: unknown) => {
        logger.info(
          `Stats fetch skipped for ${sha}: ${error instanceof Error ? error.message : "unknown"}`,
        );
      })
      .finally(() => {
        this.pendingStatsRequests.delete(statsKey);
      });
  }

  /**
   * Dispose of resources and clear pending requests
   */
  dispose(): void {
    this.pendingRequests.clear();
    this.pendingStatsRequests.clear();
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
