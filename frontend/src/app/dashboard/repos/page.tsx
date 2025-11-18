'use client';

import { useMemo, useState } from 'react';
import { BookOpen, GitFork, Star, Loader2 } from 'lucide-react';
import { useGitHubFetch } from '@/hooks/useGitHubFetch';

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description?: string | null;
  private: boolean;
  stargazers_count: number;
  forks_count: number;
  language?: string | null;
  html_url: string;
  updated_at: string;
}

const FILTER_OPTIONS = [
  { label: 'All', value: 'all' },
  { label: 'Owner', value: 'owner' },
  { label: 'Member', value: 'member' },
];

export default function ReposPage() {
  const [typeFilter, setTypeFilter] = useState<'all' | 'owner' | 'member'>('all');

  const { data, loading, error, refetch } = useGitHubFetch<GitHubRepo[]>({
    path: '/github/me/repos',
    query: {
      per_page: 30,
      type: typeFilter,
      sort: 'updated',
    },
  });

  const sortedRepos = useMemo(() => {
    if (!data) return [];
    return [...data].sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
  }, [data]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/10 p-4 shadow-lg backdrop-blur">
        <div>
          <h2 className="text-2xl font-semibold text-white"> Repositories</h2>
          <p className="text-sm text-slate-200/70">Fetched from GitHub via backend /github/me/repos</p>
        </div>
        <div className="flex items-center gap-3 text-sm text-slate-100/80">
          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value as typeof typeFilter)}
            className="rounded-md border border-white/20 bg-black/20 px-3 py-2 text-slate-100"
          >
            {FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            onClick={refetch}
            className="flex items-center gap-2 rounded-md border border-purple-400/60 px-3 py-2 text-xs font-medium text-purple-100 transition-colors hover:border-purple-300 hover:text-purple-50"
          >
            Refresh
          </button>
        </div>
      </header>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error.message} />
      ) : sortedRepos.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {sortedRepos.map((repo) => (
            <RepoCard key={repo.id} repo={repo} />
          ))}
        </div>
      )}
    </div>
  );
}

function RepoCard({ repo }: { repo: GitHubRepo }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 p-5 shadow-lg backdrop-blur">
      <div className="flex items-start justify-between">
        <div>
          <a
            href={repo.html_url}
            target="_blank"
            rel="noreferrer"
            className="text-lg font-semibold text-purple-200 hover:text-purple-100"
          >
            {repo.name}
          </a>
          <p className="text-xs text-slate-200/60">{repo.full_name}</p>
        </div>
        <span className="rounded-full border border-white/20 px-2 py-1 text-xs text-slate-100/80">
          {repo.private ? 'Private' : 'Public'}
        </span>
      </div>
      {repo.description && <p className="mt-3 text-sm text-slate-100/80">{repo.description}</p>}
      <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-200/70">
        <div className="flex items-center gap-1">
          <Star className="h-3 w-3" />
          <span>{repo.stargazers_count}</span>
        </div>
        <div className="flex items-center gap-1">
          <GitFork className="h-3 w-3" />
          <span>{repo.forks_count}</span>
        </div>
        {repo.language && (
          <div className="flex items-center gap-1">
            <BookOpen className="h-3 w-3" />
            <span>{repo.language}</span>
          </div>
        )}
        <span>Updated {new Date(repo.updated_at).toLocaleDateString()}</span>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100/80 backdrop-blur">
      <Loader2 className="h-4 w-4 animate-spin text-purple-200" />
      Loading repositories…
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-red-500/40 bg-red-500/20 px-4 py-3 text-sm text-red-100">
      Failed to load repositories: {message}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-center text-sm text-slate-200/70 backdrop-blur">
      No repositories found for your GitHub user.
    </div>
  );
}
