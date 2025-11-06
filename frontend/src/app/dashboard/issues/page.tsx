'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, GitBranch, Loader2, MessageSquare, Tag } from 'lucide-react';
import { useGitHubFetch } from '@/hooks/useGitHubFetch';

interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  html_url: string;
  state: 'open' | 'closed';
  comments: number;
  labels?: Array<{ id: number; name?: string; description?: string }>;
  user?: {
    login?: string;
    html_url?: string;
  };
  created_at: string;
  updated_at: string;
}

const STATE_OPTIONS: Array<{ label: string; value: 'open' | 'closed' | 'all' }> = [
  { label: 'Open', value: 'open' },
  { label: 'Closed', value: 'closed' },
  { label: 'All', value: 'all' },
];

export default function IssuesPage() {
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
    return `/github/repos/${submitted.owner}/${submitted.repo}/issues`;
  }, [submitted]);

  const { data, loading, error, refetch } = useGitHubFetch<GitHubIssue[]>({
    path: requestPath ?? '',
    skip: !requestPath,
    query: submitted
      ? {
          per_page: 20,
          state: submitted.state,
        }
      : undefined,
  });

  const issues = useMemo(() => data ?? [], [data]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/10 p-4 shadow-lg backdrop-blur md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-white">Issues</h2>
          <p className="text-sm text-slate-200/70">
            Explore issues via backend /github/repos/:owner/:repo/issues
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
            Load issues
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
      ) : issues.length === 0 ? (
        <EmptyState owner={submitted.owner} repo={submitted.repo} state={submitted.state} />
      ) : (
        <div className="space-y-4">
          {issues.map((issue) => (
            <IssueCard key={issue.id} issue={issue} />
          ))}
        </div>
      )}
    </div>
  );
}

function IssueCard({ issue }: { issue: GitHubIssue }) {
  const openedAt = new Date(issue.created_at).toLocaleString();
  const updatedAt = new Date(issue.updated_at).toLocaleString();

  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 p-5 shadow-lg backdrop-blur">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <a
            href={issue.html_url}
            className="text-lg font-semibold text-purple-200 hover:text-purple-100"
            target="_blank"
            rel="noreferrer"
          >
            #{issue.number} — {issue.title}
          </a>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-200/70">
            <span className="flex items-center gap-1">
              <GitBranch className="h-3 w-3" />
              {issue.state.toUpperCase()}
            </span>
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              {issue.comments} comments
            </span>
            <span>Opened {openedAt}</span>
            <span>Updated {updatedAt}</span>
            {issue.user?.login && (
              <a
                href={issue.user.html_url}
                target="_blank"
                rel="noreferrer"
                className="text-purple-200 hover:text-purple-100"
              >
                @{issue.user.login}
              </a>
            )}
          </div>
        </div>
      </div>
      {issue.labels && issue.labels.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-100">
          {issue.labels.map((label) => (
            <span
              key={label.id}
              className="flex items-center gap-1 rounded-full border border-white/20 bg-black/30 px-3 py-1"
            >
              <Tag className="h-3 w-3" />
              {label.name ?? 'label'}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function PlaceholderState() {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-sm text-slate-200/80 backdrop-blur">
      Enter a <strong className="text-white">owner/repo</strong> and choose a state to load issues.
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100/80 backdrop-blur">
      <Loader2 className="h-4 w-4 animate-spin text-purple-200" />
      Loading issues…
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-red-500/40 bg-red-500/20 px-4 py-3 text-sm text-red-100">
      Failed to load issues: {message}
    </div>
  );
}

function EmptyState({ owner, repo, state }: { owner: string; repo: string; state: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-sm text-slate-200/80 backdrop-blur">
      No {state} issues found for <span className="font-semibold text-white">{owner}/{repo}</span>.
    </div>
  );
}
