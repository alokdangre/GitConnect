'use client';

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Shield, Users } from "lucide-react";
import { useGitHubFetch } from '@/hooks/useGitHubFetch';
import { getStoredUser } from '@/lib/authStorage';

interface GitHubUser {
  login: string;
  name?: string | null;
  bio?: string | null;
  email?: string | null;
  avatar_url?: string | null;
  html_url?: string | null;
  followers?: number | null;
  following?: number | null;
  public_repos?: number | null;
  public_gists?: number | null;
  company?: string | null;
  location?: string | null;
  created_at?: string | null;
}

interface RateLimitMeta {
  limit?: number | null;
  remaining?: number | null;
  reset?: number | null;
}

export default function ProfilePage() {
  const { data, loading, error, meta, refetch } = useGitHubFetch<GitHubUser>({
    path: '/github/me',
  });
  const [storedLogin, setStoredLogin] = useState<string | null>(null);

  useEffect(() => {
    const user = getStoredUser();
    if (user && typeof user.login === 'string') {
      setStoredLogin(user.login);
    }
  }, []);

  const rateLimit = (meta?.rateLimit as RateLimitMeta | null) ?? null;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-white/10 p-6 shadow-xl backdrop-blur">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <AvatarImage src={data?.avatar_url} alt={data?.login ?? 'GitHub avatar'} />
            <div>
              <h2 className="text-2xl font-semibold text-white">
                {data?.name ?? data?.login ?? 'Your GitHub Profile'}
              </h2>
              <p className="text-sm text-slate-200/70">
                @{data?.login ?? storedLogin ?? 'unknown-user'}
              </p>
              {data?.bio && <p className="mt-3 text-sm text-slate-100/80">{data.bio}</p>}
            </div>
          </div>
          <div className="flex flex-col items-start gap-2 text-sm text-slate-100/70">
            {data?.company && <div>Company: {data.company}</div>}
            {data?.location && <div>Location: {data.location}</div>}
            {data?.email && (
              <div>
                Email: <a className="text-purple-200 hover:text-purple-100" href={`mailto:${data.email}`}>{data.email}</a>
              </div>
            )}
            {data?.html_url && (
              <a
                className="text-purple-200 hover:text-purple-100"
                href={data.html_url}
                target="_blank"
                rel="noreferrer"
              >
                View on GitHub
              </a>
            )}
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard label="Followers" value={data?.followers ?? '--'} icon={<Users className="h-4 w-4" />} />
          <StatCard label="Following" value={data?.following ?? '--'} icon={<Users className="h-4 w-4" />} />
          <StatCard label="Public Repos" value={data?.public_repos ?? '--'} icon={<Shield className="h-4 w-4" />} />
          <StatCard label="Public Gists" value={data?.public_gists ?? '--'} icon={<Shield className="h-4 w-4" />} />
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-white/80">Status</h3>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          {loading && <span className="text-slate-100/80">Loading profile…</span>}
          {error && (
            <span className="rounded-md bg-red-500/20 px-2 py-1 text-red-200">
              {error.message}
            </span>
          )}
          <button
            onClick={refetch}
            className="rounded-md border border-purple-400/60 px-3 py-1 text-xs font-medium text-purple-100 transition-colors hover:border-purple-300 hover:text-purple-50"
          >
            Refresh
          </button>
          {rateLimit ? (
            <span className="rounded-md bg-white/10 px-3 py-1 text-xs text-slate-100/80">
              Rate Limit: {rateLimit.limit ?? '--'} / Remaining: {rateLimit.remaining ?? '--'}
            </span>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function AvatarImage({ src, alt }: { src?: string | null; alt: string }) {
  if (!src) {
    return (
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10 text-lg font-semibold text-white">
        {alt.slice(0, 2).toUpperCase()}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className="h-16 w-16 rounded-full border border-white/20 object-cover shadow-lg"
      referrerPolicy="no-referrer"
    />
  );
}

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-200/80">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
    </div>
  );
}
