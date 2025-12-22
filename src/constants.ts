/**
 * Configuration keys used throughout the extension
 */
export const CONFIG_KEYS = {
  GITLAB_URL: "gitlabBlame.gitlabUrl",
  GITHUB_URL: "gitlabBlame.githubUrl",
  CACHE_TTL: "gitlabBlame.cacheTTL",
} as const;

/**
 * Secret storage keys for tokens
 */
export const SECRET_KEYS = {
  GITLAB_TOKEN: "gitlabBlame.token",
  GITHUB_TOKEN: "gitlabBlame.githubToken",
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
  GITHUB_URL: "https://github.com",
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

/**
 * HTTP status codes used in VCS API error handling
 */
export const HTTP_STATUS = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  TOO_MANY_REQUESTS: 429,
} as const;

/**
 * Git blame constants
 */
export const BLAME_CONSTANTS = {
  /** Git blame uses 1-based line numbering */
  LINE_NUMBER_OFFSET: 1,
} as const;

/**
 * Time conversion constants
 */
export const TIME_CONSTANTS = {
  /** Milliseconds in one second */
  MS_PER_SECOND: 1000,
  /** Seconds in one minute */
  SECONDS_PER_MINUTE: 60,
  /** Minutes in one hour */
  MINUTES_PER_HOUR: 60,
  /** Hours in one day */
  HOURS_PER_DAY: 24,
  /** Days in one week */
  DAYS_PER_WEEK: 7,
  /** Average days in one month */
  DAYS_PER_MONTH: 30,
  /** Days in one year */
  DAYS_PER_YEAR: 365,
  /** Months in one year */
  MONTHS_PER_YEAR: 12,
  /** Weeks per month (approximate) */
  WEEKS_PER_MONTH: 4,
} as const;

/**
 * UI display constants
 */
export const UI_CONSTANTS = {
  /** Maximum length for MR/PR title display */
  MAX_TITLE_LENGTH: 50,
  /** Maximum number of MRs/PRs to show in picker */
  MAX_PICKER_ITEMS: 7,
  /** Markdown ellipsis length ("...") */
  ELLIPSIS_LENGTH: 3,
  /** Short SHA display length (first N characters) */
  SHORT_SHA_LENGTH: 7,
} as const;
