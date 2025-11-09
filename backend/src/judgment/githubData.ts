import { githubRequest, type GitHubResponse } from '../lib/githubClient.js';

export type JudgmentTargetType = 'pull_request' | 'issue' | 'commit';

export interface FetchLimits {
  maxReviews?: number;
  maxComments?: number;
  maxFiles?: number;
  maxCommits?: number;
  maxCommitComments?: number;
  patchCharacterLimit?: number;
}

interface FetchBaseParams {
  token: string;
  owner: string;
  repo: string;
  limits?: FetchLimits;
}

export interface PullRequestContext {
  type: 'pull_request';
  repository: string;
  identifier: string;
  pullRequest: NormalizedPullRequest;
  reviews: NormalizedReview[];
  files: NormalizedFileChange[];
  comments: NormalizedIssueComment[];
  commits: NormalizedPullRequestCommit[];
}

export interface IssueContext {
  type: 'issue';
  repository: string;
  identifier: string;
  issue: NormalizedIssue;
  comments: NormalizedIssueComment[];
}

export interface CommitContext {
  type: 'commit';
  repository: string;
  identifier: string;
  commit: NormalizedCommit;
  comments: NormalizedCommitComment[];
}

export type GitHubContext = PullRequestContext | IssueContext | CommitContext;

export interface NormalizedPullRequest {
  number: number;
  title: string;
  state: string;
  draft: boolean;
  body: string | null;
  createdAt: string;
  updatedAt: string;
  merged: boolean;
  mergeable: boolean | null;
  additions: number;
  deletions: number;
  changedFiles: number;
  authorLogin: string | null;
  baseBranch: string | null;
  headBranch: string | null;
  labels: string[];
  requestedReviewers: string[];
}

export interface NormalizedReview {
  id: number;
  state: string;
  body: string | null;
  submittedAt: string | null;
  authorLogin: string | null;
}

export interface NormalizedFileChange {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
}

export interface NormalizedIssue {
  number: number;
  title: string;
  state: string;
  body: string | null;
  authorLogin: string | null;
  assignees: string[];
  labels: string[];
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
}

export interface NormalizedIssueComment {
  id: number;
  body: string;
  authorLogin: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface NormalizedPullRequestCommit {
  sha: string;
  message: string;
  authorLogin: string | null;
  authorName: string | null;
  authoredDate: string | null;
  committedDate: string | null;
}

export interface NormalizedCommit {
  sha: string;
  message: string;
  authorName: string | null;
  authorEmail: string | null;
  authoredDate: string | null;
  committerName: string | null;
  committerEmail: string | null;
  committedDate: string | null;
  stats: {
    additions: number;
    deletions: number;
    total: number;
  } | null;
  files: NormalizedFileChange[];
}

export interface NormalizedCommitComment {
  id: number;
  body: string;
  authorLogin: string | null;
  path: string | null;
  position: number | null;
  createdAt: string;
  updatedAt: string | null;
}

export class GitHubDataError extends Error {
  public readonly statusCode: number;
  public readonly githubError: unknown;

  constructor(message: string, response: GitHubResponse) {
    super(message);
    this.name = 'GitHubDataError';
    this.statusCode = response.statusCode;
    this.githubError = response.githubError ?? response.rawBody;
  }
}

const DEFAULT_LIMITS: Required<FetchLimits> = {
  maxReviews: 40,
  maxComments: 50,
  maxFiles: 60,
  maxCommits: 50,
  maxCommitComments: 30,
  patchCharacterLimit: 8000,
};

export async function fetchPullRequestContext(
  params: FetchBaseParams & { pullNumber: number }
): Promise<PullRequestContext> {
  const { token, owner, repo, pullNumber, limits } = params;
  const resolvedLimits = { ...DEFAULT_LIMITS, ...limits };
  const identifier = `PR-${pullNumber}`;

  const [pull, reviews, files, comments, commits] = await Promise.all([
    fetchGitHubJson<any>({ path: `/repos/${owner}/${repo}/pulls/${pullNumber}`, token }),
    fetchGitHubJson<any[]>({
      path: `/repos/${owner}/${repo}/pulls/${pullNumber}/reviews`,
      token,
    }),
    fetchGitHubJson<any[]>({
      path: `/repos/${owner}/${repo}/pulls/${pullNumber}/files`,
      token,
      query: { per_page: resolvedLimits.maxFiles },
    }),
    fetchGitHubJson<any[]>({
      path: `/repos/${owner}/${repo}/issues/${pullNumber}/comments`,
      token,
      query: { per_page: resolvedLimits.maxComments },
    }),
    fetchGitHubJson<any[]>({
      path: `/repos/${owner}/${repo}/pulls/${pullNumber}/commits`,
      token,
      query: { per_page: resolvedLimits.maxCommits },
    }),
  ]);

  return {
    type: 'pull_request',
    repository: `${owner}/${repo}`,
    identifier,
    pullRequest: normalizePullRequest(pull),
    reviews: reviews.slice(0, resolvedLimits.maxReviews).map(normalizeReview),
    files: files.slice(0, resolvedLimits.maxFiles).map((file) =>
      normalizeFileChange(file, resolvedLimits.patchCharacterLimit)
    ),
    comments: comments.slice(0, resolvedLimits.maxComments).map(normalizeIssueComment),
    commits: commits.slice(0, resolvedLimits.maxCommits).map(normalizePullRequestCommit),
  };
}

export async function fetchIssueContext(
  params: FetchBaseParams & { issueNumber: number }
): Promise<IssueContext> {
  const { token, owner, repo, issueNumber, limits } = params;
  const resolvedLimits = { ...DEFAULT_LIMITS, ...limits };
  const identifier = `ISSUE-${issueNumber}`;

  const [issue, comments] = await Promise.all([
    fetchGitHubJson<any>({ path: `/repos/${owner}/${repo}/issues/${issueNumber}`, token }),
    fetchGitHubJson<any[]>({
      path: `/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
      token,
      query: { per_page: resolvedLimits.maxComments },
    }),
  ]);

  return {
    type: 'issue',
    repository: `${owner}/${repo}`,
    identifier,
    issue: normalizeIssue(issue),
    comments: comments.slice(0, resolvedLimits.maxComments).map(normalizeIssueComment),
  };
}

export async function fetchCommitContext(
  params: FetchBaseParams & { sha: string }
): Promise<CommitContext> {
  const { token, owner, repo, sha, limits } = params;
  const resolvedLimits = { ...DEFAULT_LIMITS, ...limits };
  const identifier = `COMMIT-${sha.substring(0, 7)}`;

  const [commit, comments] = await Promise.all([
    fetchGitHubJson<any>({ path: `/repos/${owner}/${repo}/commits/${sha}`, token }),
    fetchGitHubJson<any[]>({
      path: `/repos/${owner}/${repo}/commits/${sha}/comments`,
      token,
      query: { per_page: resolvedLimits.maxCommitComments },
    }),
  ]);

  return {
    type: 'commit',
    repository: `${owner}/${repo}`,
    identifier,
    commit: normalizeCommit(commit, resolvedLimits.patchCharacterLimit, resolvedLimits.maxFiles),
    comments: comments.slice(0, resolvedLimits.maxCommitComments).map(normalizeCommitComment),
  };
}

interface GitHubRequestConfig {
  path: string;
  token: string;
  query?: Record<string, string | number | boolean | undefined>;
}

async function fetchGitHubJson<T>(config: GitHubRequestConfig): Promise<T> {
  const response = await githubRequest<T>({
    path: config.path,
    token: config.token,
    query: config.query,
  });

  if (!response.ok || !response.data) {
    throw new GitHubDataError(`GitHub request failed for ${config.path}`, response);
  }

  return response.data;
}

function normalizePullRequest(pr: any): NormalizedPullRequest {
  return {
    number: pr.number,
    title: pr.title,
    state: pr.state,
    draft: Boolean(pr.draft),
    body: pr.body ?? null,
    createdAt: pr.created_at,
    updatedAt: pr.updated_at,
    merged: Boolean(pr.merged_at),
    mergeable: pr.mergeable ?? null,
    additions: pr.additions ?? 0,
    deletions: pr.deletions ?? 0,
    changedFiles: pr.changed_files ?? 0,
    authorLogin: pr.user?.login ?? null,
    baseBranch: pr.base?.ref ?? null,
    headBranch: pr.head?.ref ?? null,
    labels: Array.isArray(pr.labels) ? pr.labels.map((label: any) => label.name ?? '').filter(Boolean) : [],
    requestedReviewers: Array.isArray(pr.requested_reviewers)
      ? pr.requested_reviewers.map((reviewer: any) => reviewer?.login).filter(Boolean)
      : [],
  };
}

function normalizeReview(review: any): NormalizedReview {
  return {
    id: review.id,
    state: review.state,
    body: review.body ?? null,
    submittedAt: review.submitted_at ?? null,
    authorLogin: review.user?.login ?? null,
  };
}

function normalizeFileChange(file: any, patchLimit: number): NormalizedFileChange {
  let patch: string | undefined;
  if (typeof file.patch === 'string') {
    patch = file.patch.length > patchLimit ? `${file.patch.slice(0, patchLimit)}\n... [truncated]` : file.patch;
  }

  return {
    filename: file.filename,
    status: file.status,
    additions: file.additions ?? 0,
    deletions: file.deletions ?? 0,
    changes: file.changes ?? 0,
    ...(patch ? { patch } : {}),
  };
}

function normalizeIssue(issue: any): NormalizedIssue {
  return {
    number: issue.number,
    title: issue.title,
    state: issue.state,
    body: issue.body ?? null,
    authorLogin: issue.user?.login ?? null,
    assignees: Array.isArray(issue.assignees)
      ? issue.assignees.map((assignee: any) => assignee?.login).filter(Boolean)
      : [],
    labels: Array.isArray(issue.labels) ? issue.labels.map((label: any) => label.name ?? '').filter(Boolean) : [],
    createdAt: issue.created_at,
    updatedAt: issue.updated_at,
    closedAt: issue.closed_at ?? null,
  };
}

function normalizeIssueComment(comment: any): NormalizedIssueComment {
  return {
    id: comment.id,
    body: comment.body ?? '',
    authorLogin: comment.user?.login ?? null,
    createdAt: comment.created_at,
    updatedAt: comment.updated_at ?? null,
  };
}

function normalizePullRequestCommit(commit: any): NormalizedPullRequestCommit {
  return {
    sha: commit.sha,
    message: commit.commit?.message ?? '',
    authorLogin: commit.author?.login ?? null,
    authorName: commit.commit?.author?.name ?? null,
    authoredDate: commit.commit?.author?.date ?? null,
    committedDate: commit.commit?.committer?.date ?? null,
  };
}

function normalizeCommit(commit: any, patchLimit: number, fileLimit: number): NormalizedCommit {
  return {
    sha: commit.sha,
    message: commit.commit?.message ?? '',
    authorName: commit.commit?.author?.name ?? null,
    authorEmail: commit.commit?.author?.email ?? null,
    authoredDate: commit.commit?.author?.date ?? null,
    committerName: commit.commit?.committer?.name ?? null,
    committerEmail: commit.commit?.committer?.email ?? null,
    committedDate: commit.commit?.committer?.date ?? null,
    stats: commit.stats
      ? {
          additions: commit.stats.additions ?? 0,
          deletions: commit.stats.deletions ?? 0,
          total: commit.stats.total ?? 0,
        }
      : null,
    files: Array.isArray(commit.files)
      ? commit.files
          .slice(0, fileLimit)
          .map((file: any) => normalizeFileChange(file, patchLimit))
      : [],
  };
}

function normalizeCommitComment(comment: any): NormalizedCommitComment {
  return {
    id: comment.id,
    body: comment.body ?? '',
    authorLogin: comment.user?.login ?? null,
    path: comment.path ?? null,
    position: typeof comment.position === 'number' ? comment.position : null,
    createdAt: comment.created_at,
    updatedAt: comment.updated_at ?? null,
  };
}
