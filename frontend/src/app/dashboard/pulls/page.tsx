'use client';

import { useMemo, useState } from 'react';
import { GitPullRequest, GitMerge, Loader2, MessageSquare, User, Search } from 'lucide-react';
import { useGitHubFetch } from '@/hooks/useGitHubFetch';

interface GitHubPullRequestItem {
  id: number;
  number: number;
  title: string;
  html_url: string;
  state: 'open' | 'closed';
  user?: {
    login?: string;
    html_url?: string;
  };
  created_at: string;
  updated_at: string;
  comments: number;
  labels?: Array<{ id: number; name?: string }>;
  pull_request?: {
    merged_at?: string | null;
  };
  repository_url: string;
}

interface GitHubPullSearchResponse {
  total_count: number;
  incomplete_results: boolean;
  items: GitHubPullRequestItem[];
}

type PullRole = 'author' | 'review-requested' | 'involves';
type PullState = 'open' | 'closed' | 'merged' | 'all';
type PullSort = 'created' | 'updated' | 'comments';
type PullDirection = 'asc' | 'desc';

interface PullFilters {
  role: PullRole;
  state: PullState;
  repo: string;
  labels: string;
  base: string;
  head: string;
  search: string;
  sort: PullSort;
  direction: PullDirection;
}

const PER_PAGE = 20;

const ROLE_OPTIONS: Array<{ label: string; value: PullRole }> = [
  { label: 'Involving me', value: 'involves' },
  { label: 'Authored by me', value: 'author' },
  { label: 'Review requested', value: 'review-requested' },
];

const STATE_OPTIONS: Array<{ label: string; value: PullState }> = [
  { label: 'Open', value: 'open' },
  { label: 'Closed', value: 'closed' },
  { label: 'Merged', value: 'merged' },
  { label: 'All', value: 'all' },
];

const SORT_OPTIONS: Array<{ label: string; value: PullSort }> = [
  { label: 'Recently updated', value: 'updated' },
  { label: 'Recently created', value: 'created' },
  { label: 'Most comments', value: 'comments' },
];

const DIRECTION_OPTIONS: Array<{ label: string; value: PullDirection }> = [
  { label: 'Descending', value: 'desc' },
  { label: 'Ascending', value: 'asc' },
];

export default function PullsPage() {
  const [filters, setFilters] = useState<PullFilters>({
    role: 'involves',
    state: 'open',
    repo: '',
    labels: '',
    base: '',
    head: '',
    search: '',
    sort: 'updated',
    direction: 'desc',
  });
  const [page, setPage] = useState(1);

  const query = useMemo(() => {
    return {
      per_page: PER_PAGE,
      page,
      role: filters.role,
      state: filters.state,
      repo: filters.repo.trim() || undefined,
      labels: filters.labels.trim() || undefined,
      base: filters.base.trim() || undefined,
      head: filters.head.trim() || undefined,
      search: filters.search.trim() || undefined,
      sort: filters.sort,
      direction: filters.direction,
    };
  }, [filters, page]);

  const { data, loading, error, refetch } = useGitHubFetch<GitHubPullSearchResponse>({
    path: '/github/me/pulls',
    query,
  });

  const pullRequests = data?.items ?? [];
  const totalCount = data?.total_count ?? 0;
  const hasNextPage = pullRequests.length === PER_PAGE;
  const hasPreviousPage = page > 1;

  const handleFilterChange = <K extends keyof PullFilters>(key: K, value: PullFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const handleRefresh = () => {
    refetch();
  };

  const handleNextPage = () => {
    if (hasNextPage) {
      setPage((prev) => prev + 1);
    }
  };

  const handlePreviousPage = () => {
    if (hasPreviousPage) {
      setPage((prev) => prev - 1);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/10 p-4 shadow-lg backdrop-blur md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-white">Your Pull Requests</h2>
          <p className="text-sm text-slate-200/70">
            Powered by the <code className="rounded bg-black/30 px-1.5 py-0.5 text-xs text-purple-200">/github/me/pulls</code>{' '}
            endpoint using GitHub App tokens.
          </p>
        </div>
        <form
          onSubmit={(event) => event.preventDefault()}
          className="flex flex-wrap items-center gap-3 text-sm text-slate-100/80"
        >
          <select
            value={filters.role}
            onChange={(event) => handleFilterChange('role', event.target.value as PullRole)}
            className="rounded-md border border-white/20 bg-black/20 px-3 py-2 text-slate-100"
          >
            {ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            value={filters.state}
            onChange={(event) => handleFilterChange('state', event.target.value as PullState)}
            className="rounded-md border border-white/20 bg-black/20 px-3 py-2 text-slate-100"
          >
            {STATE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <input
            value={filters.repo}
            onChange={(event) => handleFilterChange('repo', event.target.value as PullFilters['repo'])}
            placeholder="owner/repo"
            className="w-44 rounded-md border border-white/20 bg-black/20 px-3 py-2 text-slate-100 placeholder:text-slate-400"
          />
          <input
            value={filters.labels}
            onChange={(event) => handleFilterChange('labels', event.target.value as PullFilters['labels'])}
            placeholder="Labels"
            className="w-40 rounded-md border border-white/20 bg-black/20 px-3 py-2 text-slate-100 placeholder:text-slate-400"
          />
          <input
            value={filters.base}
            onChange={(event) => handleFilterChange('base', event.target.value as PullFilters['base'])}
            placeholder="Base"
            className="w-32 rounded-md border border-white/20 bg-black/20 px-3 py-2 text-slate-100 placeholder:text-slate-400"
          />
          <input
            value={filters.head}
            onChange={(event) => handleFilterChange('head', event.target.value as PullFilters['head'])}
            placeholder="Head"
            className="w-32 rounded-md border border-white/20 bg-black/20 px-3 py-2 text-slate-100 placeholder:text-slate-400"
          />
          <select
            value={filters.sort}
            onChange={(event) => handleFilterChange('sort', event.target.value as PullSort)}
            className="rounded-md border border-white/20 bg-black/20 px-3 py-2 text-slate-100"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            value={filters.direction}
            onChange={(event) => handleFilterChange('direction', event.target.value as PullDirection)}
            className="rounded-md border border-white/20 bg-black/20 px-3 py-2 text-slate-100"
          >
            {DIRECTION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <div className="relative w-48">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={filters.search}
              onChange={(event) => handleFilterChange('search', event.target.value as PullFilters['search'])}
              placeholder="Search text"
              className="w-full rounded-md border border-white/20 bg-black/20 py-2 pl-9 pr-3 text-slate-100 placeholder:text-slate-400"
            />
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            className="rounded-md border border-purple-400/60 px-3 py-2 text-xs font-semibold text-purple-100 transition-colors hover:border-purple-300 hover:text-purple-50"
          >
            Refresh
          </button>
        </form>
      </header>

      <section className="space-y-4">
        <PaginationControls
          page={page}
          totalCount={totalCount}
          onNext={handleNextPage}
          onPrevious={handlePreviousPage}
          hasNext={hasNextPage}
          hasPrevious={hasPreviousPage}
        />

        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error.message} />
        ) : pullRequests.length === 0 ? (
          <EmptyState filters={filters} />
        ) : (
          <div className="space-y-4">
            {pullRequests.map((pr) => (
              <PullRequestCard key={pr.id} pr={pr} />
            ))}
          </div>
        )}

        <PaginationControls
          page={page}
          totalCount={totalCount}
          onNext={handleNextPage}
          onPrevious={handlePreviousPage}
          hasNext={hasNextPage}
          hasPrevious={hasPreviousPage}
        />
      </section>
    </div>
  );
}

function PaginationControls({
  page,
  totalCount,
  hasNext,
  hasPrevious,
  onNext,
  onPrevious,
}: {
  page: number;
  totalCount: number;
  hasNext: boolean;
  hasPrevious: boolean;
  onNext: () => void;
  onPrevious: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-slate-200/80 backdrop-blur">
      <span>
        Page {page} · Total matches: <strong className="text-white">{totalCount}</strong>
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPrevious}
          disabled={!hasPrevious}
          className="rounded-md border border-white/20 px-3 py-1 font-medium transition-colors disabled:cursor-not-allowed disabled:border-white/10 disabled:text-slate-500 hover:border-purple-300 hover:text-purple-50"
        >
          Previous
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!hasNext}
          className="rounded-md border border-white/20 px-3 py-1 font-medium transition-colors disabled:cursor-not-allowed disabled:border-white/10 disabled:text-slate-500 hover:border-purple-300 hover:text-purple-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}

function PullRequestCard({ pr }: { pr: GitHubPullRequestItem }) {
  const openedAt = new Date(pr.created_at).toLocaleString();
  const updatedAt = new Date(pr.updated_at).toLocaleString();
  const merged = Boolean(pr.pull_request?.merged_at);
  const repositoryName = getRepositoryName(pr.repository_url);

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
        {repositoryName && (
          <a
            href={`https://github.com/${repositoryName}`}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-medium text-purple-200 hover:text-purple-100"
          >
            {repositoryName}
          </a>
        )}
      </div>
      {pr.labels && pr.labels.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-100">
          {pr.labels.map((label) => (
            <span
              key={label.id ?? `${pr.id}-${label.name}`}
              className="rounded-full border border-white/20 bg-black/30 px-3 py-1"
            >
              {label.name ?? 'label'}
            </span>
          ))}
        </div>
      )}
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

function EmptyState({ filters }: { filters: PullFilters }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-sm text-slate-200/80 backdrop-blur">
      <p className="font-medium text-white">No pull requests matched your filters.</p>
      <p className="mt-2 text-xs text-slate-400">
        Role: <span className="font-semibold">{filters.role}</span> · State: <span className="font-semibold">{filters.state}</span>
        {filters.repo.trim() ? (
          <>
            {' '}
            · Repo: <span className="font-semibold">{filters.repo}</span>
          </>
        ) : null}
        {filters.labels.trim() ? (
          <>
            {' '}
            · Labels: <span className="font-semibold">{filters.labels}</span>
          </>
        ) : null}
        {filters.search.trim() ? (
          <>
            {' '}
            · Search: <span className="font-semibold">{filters.search}</span>
          </>
        ) : null}
      </p>
    </div>
  );
}

function getRepositoryName(repositoryUrl: string | undefined): string | null {
  if (!repositoryUrl) return null;
  try {
    const url = new URL(repositoryUrl);
    return url.pathname.replace(/^\//, '');
  } catch (error) {
    return null;
  }
}
