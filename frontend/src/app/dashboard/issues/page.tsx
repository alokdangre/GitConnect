'use client';

import { useMemo, useState } from 'react';
import { GitBranch, Loader2, MessageSquare, Tag } from 'lucide-react';
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
  repository?: {
    full_name?: string;
    html_url?: string;
  };
  created_at: string;
  updated_at: string;
}

type IssueFilterOption = 'assigned' | 'created' | 'mentioned' | 'subscribed' | 'all';
type IssueStateOption = 'open' | 'closed' | 'all';
type IssueSortOption = 'created' | 'updated' | 'comments';
type IssueDirectionOption = 'asc' | 'desc';

interface IssueFilters {
  filter: IssueFilterOption;
  state: IssueStateOption;
  labels: string;
  sort: IssueSortOption;
  direction: IssueDirectionOption;
}

const PER_PAGE = 20;

const FILTER_OPTIONS: Array<{ label: string; value: IssueFilterOption }> = [
  { label: 'Assigned to me', value: 'assigned' },
  { label: 'Created by me', value: 'created' },
  { label: 'Mentioning me', value: 'mentioned' },
  { label: 'Watching', value: 'subscribed' },
  { label: 'All issues', value: 'all' },
];

const STATE_OPTIONS: Array<{ label: string; value: IssueStateOption }> = [
  { label: 'Open', value: 'open' },
  { label: 'Closed', value: 'closed' },
  { label: 'All', value: 'all' },
];

const SORT_OPTIONS: Array<{ label: string; value: IssueSortOption }> = [
  { label: 'Recently updated', value: 'updated' },
  { label: 'Recently created', value: 'created' },
  { label: 'Most comments', value: 'comments' },
];

const DIRECTION_OPTIONS: Array<{ label: string; value: IssueDirectionOption }> = [
  { label: 'Descending', value: 'desc' },
  { label: 'Ascending', value: 'asc' },
];

export default function IssuesPage() {
  const [filters, setFilters] = useState<IssueFilters>({
    filter: 'assigned',
    state: 'open',
    labels: '',
    sort: 'updated',
    direction: 'desc',
  });
  const [page, setPage] = useState(1);

  const query = useMemo(() => {
    return {
      per_page: PER_PAGE,
      page,
      filter: filters.filter,
      state: filters.state,
      labels: filters.labels.trim() || undefined,
      sort: filters.sort,
      direction: filters.direction,
    };
  }, [filters, page]);

  const { data, loading, error, refetch } = useGitHubFetch<GitHubIssue[]>({
    path: '/github/me/issues',
    query,
  });

  const issues = data ?? [];
  const hasNextPage = issues.length === PER_PAGE;
  const hasPreviousPage = page > 1;

  const handleFilterChange = <K extends keyof IssueFilters>(key: K, value: IssueFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const handleLabelsChange = (value: string) => {
    setFilters((prev) => ({ ...prev, labels: value }));
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
          <h2 className="text-2xl font-semibold text-white">Your GitHub Issues</h2>
          <p className="text-sm text-slate-200/70">
            Backed by the <code className="rounded bg-black/30 px-1.5 py-0.5 text-xs text-purple-200">/github/me/issues</code>{' '}
            endpoint using your GitHub App installation.
          </p>
        </div>
        <form
          onSubmit={(event) => event.preventDefault()}
          className="flex flex-wrap items-center gap-3 text-sm text-slate-100/80"
        >
          <select
            value={filters.filter}
            onChange={(event) => handleFilterChange('filter', event.target.value as IssueFilterOption)}
            className="rounded-md border border-white/20 bg-black/20 px-3 py-2 text-slate-100"
          >
            {FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            value={filters.state}
            onChange={(event) => handleFilterChange('state', event.target.value as IssueStateOption)}
            className="rounded-md border border-white/20 bg-black/20 px-3 py-2 text-slate-100"
          >
            {STATE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <input
            value={filters.labels}
            onChange={(event) => handleLabelsChange(event.target.value)}
            placeholder="Labels (comma separated)"
            className="w-52 rounded-md border border-white/20 bg-black/20 px-3 py-2 text-slate-100 placeholder:text-slate-400"
          />
          <select
            value={filters.sort}
            onChange={(event) => handleFilterChange('sort', event.target.value as IssueSortOption)}
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
            onChange={(event) => handleFilterChange('direction', event.target.value as IssueDirectionOption)}
            className="rounded-md border border-white/20 bg-black/20 px-3 py-2 text-slate-100"
          >
            {DIRECTION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
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
          onNext={handleNextPage}
          onPrevious={handlePreviousPage}
          hasNext={hasNextPage}
          hasPrevious={hasPreviousPage}
        />

        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error.message} />
        ) : issues.length === 0 ? (
          <EmptyState filter={filters.filter} state={filters.state} labels={filters.labels} />
        ) : (
          <div className="space-y-4">
            {issues.map((issue) => (
              <IssueCard key={issue.id} issue={issue} />
            ))}
          </div>
        )}

        <PaginationControls
          page={page}
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
  hasNext,
  hasPrevious,
  onNext,
  onPrevious,
}: {
  page: number;
  hasNext: boolean;
  hasPrevious: boolean;
  onNext: () => void;
  onPrevious: () => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-slate-200/80 backdrop-blur">
      <span>Page {page}</span>
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

function IssueCard({ issue }: { issue: GitHubIssue }) {
  const openedAt = new Date(issue.created_at).toLocaleString();
  const updatedAt = new Date(issue.updated_at).toLocaleString();

  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 p-5 shadow-lg backdrop-blur">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <a
            href={issue.html_url}
            className="text-lg font-semibold text-purple-200 hover:text-purple-100"
            target="_blank"
            rel="noreferrer"
          >
            #{issue.number} — {issue.title}
          </a>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-200/70">
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
        {issue.repository?.full_name && (
          <a
            href={issue.repository.html_url ?? '#'}
            className="text-xs font-medium text-purple-200 hover:text-purple-100"
            target="_blank"
            rel="noreferrer"
          >
            {issue.repository.full_name}
          </a>
        )}
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

function EmptyState({
  filter,
  state,
  labels,
}: {
  filter: IssueFilterOption;
  state: IssueStateOption;
  labels: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-sm text-slate-200/80 backdrop-blur">
      <p className="font-medium text-white">No issues matched your filters.</p>
      <p className="mt-2 text-xs text-slate-400">
        Filter: <span className="font-semibold">{filter}</span> · State: <span className="font-semibold">{state}</span>
        {labels.trim() ? (
          <>
            {' '}
            · Labels: <span className="font-semibold">{labels}</span>
          </>
        ) : null}
      </p>
    </div>
  );
}
