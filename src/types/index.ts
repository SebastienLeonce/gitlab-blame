export interface MergeRequest {
  iid: number;
  title: string;
  webUrl: string;
  mergedAt: string | null;
  state: string;
}

export interface BlameInfo {
  sha: string;
  author: string;
  authorEmail: string;
  date: Date;
  summary: string;
  line: number;
}

export interface GitLabMR {
  id: number;
  iid: number;
  title: string;
  web_url: string;
  state: string;
  merged_at: string | null;
  author?: {
    name: string;
    username: string;
  };
}
