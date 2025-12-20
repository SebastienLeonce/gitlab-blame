/**
 * Configuration keys used throughout the extension
 */
export const CONFIG_KEYS = {
  GITLAB_URL: "gitlabBlame.gitlabUrl",
  CACHE_TTL: "gitlabBlame.cacheTTL",
} as const;

/**
 * Secret storage keys for tokens
 */
export const SECRET_KEYS = {
  GITLAB_TOKEN: "gitlabBlame.token",
} as const;

/**
 * Extension command identifiers
 */
export const COMMANDS = {
  SET_TOKEN: "gitlabBlame.setToken",
  DELETE_TOKEN: "gitlabBlame.deleteToken",
  CLEAR_CACHE: "gitlabBlame.clearCache",
  SHOW_STATUS: "gitlabBlame.showStatus",
} as const;

/**
 * Default configuration values
 */
export const DEFAULTS = {
  GITLAB_URL: "https://gitlab.com",
  CACHE_TTL_SECONDS: 3600,
} as const;

/**
 * VCS provider identifiers
 */
export const VCS_PROVIDERS = {
  GITLAB: "gitlab",
  GITHUB: "github",
  BITBUCKET: "bitbucket",
} as const;

export type VcsProviderId = (typeof VCS_PROVIDERS)[keyof typeof VCS_PROVIDERS];
