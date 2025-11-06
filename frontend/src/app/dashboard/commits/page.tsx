'use client';

import { useMemo, useState } from 'react';
import { Calendar, GitCommit, LinkIcon, Loader2, User } from 'lucide-react';
import { useGitHubFetch } from '@/hooks/useGitHubFetch';

interface GitHubCommit {
  sha: string;
  html_url: string;
  commit: {
    message: string;
    author?: {
      name?: string;
      date?: string;
      email?: string;
    };
  };
  author?: {
    login?: string;
    avatar_url?: string;
    html_url?: string;
  };
}

export default function CommitsPage() {
  const [owner, setOwner] = useState('');
  const [repo, setRepo] = useState('');
  const [submitted, setSubmitted] = useState<{ owner: string; repo: string } | null>(null);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!owner || !repo) return;
    setSubmitted({ owner, repo });
  };

  const requestPath = useMemo(() => {
    if (!submitted) return null;
    return `/github/repos/${submitted.owner}/${submitted.repo}/commits`;
  }, [submitted]);

  const { data, loading, error, refetch } = useGitHubFetch<GitHubCommit[]>({
    path: requestPath ?? '',
    skip: !requestPath,
    query: submitted
      ? {
          per_page: 20,
        }
      : undefined,
  });

  const commits = useMemo(() => data ?? [], [data]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/10 p-4 shadow-lg backdrop-blur md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-white">Commits</h2>
          <p className="text-sm text-slate-200/70">
            Browse commits via backend /github/repos/:owner/:repo/commits
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
          <button
            type="submit"
            className="rounded-md border border-purple-400/60 px-3 py-2 text-xs font-semibold text-purple-100 transition-colors hover:border-purple-300 hover:text-purple-50"
          >
            Load commits
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
      ) : commits.length === 0 ? (
        <EmptyState owner={submitted.owner} repo={submitted.repo} />
      ) : (
        <div className="space-y-4">
          {commits.map((commit) => (
            <CommitCard key={commit.sha} commit={commit} />
          ))}
        </div>
      )}
    </div>
  );
}

function CommitCard({ commit }: { commit: GitHubCommit }) {
  const authorName = commit.commit.author?.name ?? commit.author?.login ?? 'Unknown author';
  const commitDate = commit.commit.author?.date
    ? new Date(commit.commit.author.date).toLocaleString()
    : 'Unknown date';
  const gravatar = commit.author?.avatar_url;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 p-5 shadow-lg backdrop-blur">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <a
            href={commit.html_url}
            className="font-mono text-sm text-purple-200 hover:text-purple-100"
            target="_blank"
            rel="noreferrer"
          >
            {commit.sha.slice(0, 7)}
          </a>
          <p className="mt-2 text-base font-semibold text-white">
            {commit.commit.message.split('\n')[0]}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-slate-200/70">
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {authorName}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {commitDate}
            </span>
            {commit.author?.html_url && (
              <a
                href={commit.author.html_url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-purple-200 hover:text-purple-100"
              >
                <LinkIcon className="h-3 w-3" />
                Author profile
              </a>
            )}
          </div>
        </div>
        {gravatar ? (
          <img
            src={gravatar}
            alt={authorName}
            className="h-12 w-12 rounded-full border border-white/20 shadow"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/20 text-sm text-white">
            <GitCommit className="h-4 w-4" />
          </div>
        )}
      </div>
    </div>
  );
}

function PlaceholderState() {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-sm text-slate-200/80 backdrop-blur">
      Enter a <strong className="text-white">owner/repo</strong> above to load commits.
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100/80 backdrop-blur">
      <Loader2 className="h-4 w-4 animate-spin text-purple-200" />
      Loading commits…
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-red-500/40 bg-red-500/20 px-4 py-3 text-sm text-red-100">
      Failed to load commits: {message}
    </div>
  );
}

function EmptyState({ owner, repo }: { owner: string; repo: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-sm text-slate-200/80 backdrop-blur">
      No commits found for <span className="font-semibold text-white">{owner}/{repo}</span>.
    </div>
  );
}
