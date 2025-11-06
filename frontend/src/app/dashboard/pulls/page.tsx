'use client';

import { useMemo, useState } from 'react';
import { GitPullRequest, GitMerge, Loader2, MessageSquare, User } from 'lucide-react';
import { useGitHubFetch } from '@/hooks/useGitHubFetch';

interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  html_url: string;
  state: 'open' | 'closed';
  merged_at?: string | null;
  user?: {
    login?: string;
    html_url?: string;
  };
  created_at: string;
  updated_at: string;
  comments: number;
}

const STATE_OPTIONS: Array<{ label: string; value: 'open' | 'closed' | 'all' }> = [
  { label: 'Open', value: 'open' },
  { label: 'Closed', value: 'closed' },
  { label: 'All', value: 'all' },
];

export default function PullsPage() {
  const [owner, setOwner] = useState('');
  const [repo, setRepo] = useState('');
  const [stateFilter, setStateFilter] = useState<'open' | 'closed' | 'all'>('open');
  const [submitted, setSubmitted] = useState<{ owner: string; repo: string; state: string } | null>(null);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!owner || !repo) return;
    setSubmitted({ owner, repo, state: stateFilter });
  };

  const requestPath = useMemo(() => {
    if (!submitted) return null;
    return `/github/repos/${submitted.owner}/${submitted.repo}/pulls`;
  }, [submitted]);

  const { data, loading, error, refetch } = useGitHubFetch<GitHubPullRequest[]>({
    path: requestPath ?? '',
    skip: !requestPath,
    query: submitted
      ? {
          per_page: 20,
          state: submitted.state,
          sort: 'updated',
        }
      : undefined,
  });

  const pullRequests = useMemo(() => data ?? [], [data]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/10 p-4 shadow-lg backdrop-blur md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-white">Pull Requests</h2>
          <p className="text-sm text-slate-200/70">
            Review pull requests via backend /github/repos/:owner/:repo/pulls
          </p>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-3 text-sm text-slate-100/80">
          <input
            value={owner}
            onChange={(event) => setOwner(event.target.value)}
            placeholder="Owner"
            className="w-40 rounded-md border border-white/20 bg-black/20 px-3 py-2 text-slate-100 placeholder:text-slate-400"
          />
          <span className="text-slate-500">/</span>
          <input
            value={repo}
            onChange={(event) => setRepo(event.target.value)}
            placeholder="Repository"
            className="w-48 rounded-md border border-white/20 bg-black/20 px-3 py-2 text-slate-100 placeholder:text-slate-400"
          />
          <select
            value={stateFilter}
            onChange={(event) => setStateFilter(event.target.value as typeof stateFilter)}
            className="rounded-md border border-white/20 bg-black/20 px-3 py-2 text-slate-100"
          >
            {STATE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-md border border-purple-400/60 px-3 py-2 text-xs font-semibold text-purple-100 transition-colors hover:border-purple-300 hover:text-purple-50"
          >
            Load pull requests
          </button>
          <button
            type="button"
            onClick={() => submitted && refetch()}
            className="rounded-md border border-white/20 px-3 py-2 text-xs font-medium text-slate-100 transition-colors hover:border-purple-300 hover:text-purple-50"
          >
            Refresh
          </button>
        </form>
      </header>

      {!submitted ? (
        <PlaceholderState />
      ) : loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error.message} />
      ) : pullRequests.length === 0 ? (
        <EmptyState owner={submitted.owner} repo={submitted.repo} state={submitted.state} />
      ) : (
        <div className="space-y-4">
          {pullRequests.map((pr) => (
            <PullRequestCard key={pr.id} pr={pr} />
          ))}
        </div>
      )}
    </div>
  );
}

function PullRequestCard({ pr }: { pr: GitHubPullRequest }) {
  const openedAt = new Date(pr.created_at).toLocaleString();
  const updatedAt = new Date(pr.updated_at).toLocaleString();
  const merged = Boolean(pr.merged_at);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 p-5 shadow-lg backdrop-blur">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <a
            href={pr.html_url}
            className="text-lg font-semibold text-purple-200 hover:text-purple-100"
            target="_blank"
            rel="noreferrer"
          >
            #{pr.number} — {pr.title}
          </a>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-200/70">
            <span className="flex items-center gap-1">
              {merged ? <GitMerge className="h-3 w-3" /> : <GitPullRequest className="h-3 w-3" />}
              {merged ? 'Merged' : pr.state.toUpperCase()}
            </span>
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              {pr.comments} comments
            </span>
            <span>Opened {openedAt}</span>
            <span>Updated {updatedAt}</span>
            {pr.user?.login && (
              <a
                href={pr.user.html_url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-purple-200 hover:text-purple-100"
              >
                <User className="h-3 w-3" />
                @{pr.user.login}
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PlaceholderState() {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-sm text-slate-200/80 backdrop-blur">
      Enter a <strong className="text-white">owner/repo</strong> and choose a state to load pull requests.
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100/80 backdrop-blur">
      <Loader2 className="h-4 w-4 animate-spin text-purple-200" />
      Loading pull requests…
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-red-500/40 bg-red-500/20 px-4 py-3 text-sm text-red-100">
      Failed to load pull requests: {message}
    </div>
  );
}

function EmptyState({ owner, repo, state }: { owner: string; repo: string; state: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-sm text-slate-200/80 backdrop-blur">
      No {state} pull requests found for <span className="font-semibold text-white">{owner}/{repo}</span>.
    </div>
  );
}
