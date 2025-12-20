/**
 * Utilities for parsing git remote URLs to extract GitLab project information
 */

export interface GitLabRemoteInfo {
  host: string;
  projectPath: string;
}

/**
 * Extract GitLab host and project path from a git remote URL
 * Handles both SSH and HTTPS formats, including nested groups
 *
 * @param remoteUrl The git remote URL (SSH or HTTPS)
 * @returns GitLabRemoteInfo or null if the URL cannot be parsed
 *
 * @example
 * // SSH format
 * parseGitLabRemote('git@gitlab.com:group/project.git')
 * // => { host: 'https://gitlab.com', projectPath: 'group/project' }
 *
 * @example
 * // HTTPS format
 * parseGitLabRemote('https://gitlab.example.com/org/team/project.git')
 * // => { host: 'https://gitlab.example.com', projectPath: 'org/team/project' }
 *
 * @example
 * // SSH with nested groups
 * parseGitLabRemote('git@gitlab.pytheascapital.net:backend/services/api.git')
 * // => { host: 'https://gitlab.pytheascapital.net', projectPath: 'backend/services/api' }
 */
export function parseGitLabRemote(remoteUrl: string): GitLabRemoteInfo | null {
  // SSH format: git@gitlab.example.com:group/subgroup/project.git
  const sshMatch = remoteUrl.match(/^git@([^:]+):(.+?)(?:\.git)?$/);
  if (sshMatch) {
    const [, host, path] = sshMatch;
    return {
      host: `https://${host}`,
      projectPath: path.replace(/\.git$/, ""),
    };
  }

  // HTTPS format: https://gitlab.example.com/group/subgroup/project.git
  try {
    const url = new URL(remoteUrl);
    if (!url.pathname || url.pathname === "/") {
      return null;
    }

    const projectPath = url.pathname.slice(1).replace(/\.git$/, "");
    if (!projectPath) {
      return null;
    }

    return {
      host: `${url.protocol}//${url.host}`,
      projectPath,
    };
  } catch {
    return null;
  }
}

/**
 * Extract just the project path from a git remote URL
 * Convenience function when you only need the path
 *
 * @param remoteUrl The git remote URL
 * @returns The project path or null
 */
export function extractProjectPath(remoteUrl: string): string | null {
  const info = parseGitLabRemote(remoteUrl);
  return info?.projectPath ?? null;
}

/**
 * Check if a remote URL appears to be a GitLab URL
 * This is a heuristic check based on common GitLab URL patterns
 *
 * @param remoteUrl The git remote URL
 * @returns true if the URL looks like a GitLab remote
 */
export function isGitLabRemote(remoteUrl: string): boolean {
  // Check for gitlab in the hostname (SSH format)
  const sshMatch = remoteUrl.match(/^git@([^:]+):/);
  if (sshMatch) {
    const host = sshMatch[1].toLowerCase();
    return host.includes("gitlab");
  }

  // Check for gitlab in the hostname (HTTPS format)
  try {
    const url = new URL(remoteUrl);
    return url.hostname.toLowerCase().includes("gitlab");
  } catch {
    return false;
  }
}
