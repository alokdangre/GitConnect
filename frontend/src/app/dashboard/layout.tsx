'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { Menu } from 'lucide-react';

const NAV_ITEMS: Array<{ href: string; label: string }> = [
  { href: '/dashboard/profile', label: 'Profile Overview' },
  { href: '/dashboard/repos', label: 'Repositories' },
  { href: '/dashboard/commits', label: 'Commits' },
  { href: '/dashboard/issues', label: 'Issues' },
  { href: '/dashboard/pulls', label: 'Pull Requests' },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col md:flex-row">
        <aside className="w-full border-b border-white/10 bg-white/5 p-6 backdrop-blur-lg md:w-64 md:border-b-0 md:border-r">
          <Link href="/" className="text-2xl font-bold">
            Git<span className="text-purple-300">Connect</span>
          </Link>
          <p className="mt-3 text-sm text-slate-300/80">
            Visualize your GitHub activity through our new backend-powered API.
          </p>
          <nav className="mt-8 hidden flex-col gap-2 md:flex">
            {NAV_ITEMS.map((item) => (
              <NavLink key={item.href} href={item.href} active={pathname === item.href}>
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="mt-6 hidden text-xs text-slate-400 md:block">
            Tip: refresh panels to pull the latest data from GitHub.
          </div>
        </aside>

        <main className="flex-1 bg-black/20 p-4 sm:p-8">
          <header className="mb-6 flex items-center justify-between rounded-xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur md:hidden">
            <div className="flex items-center gap-3">
              <Menu className="h-5 w-5 text-purple-200" />
              <span className="text-sm font-semibold">GitConnect Dashboard</span>
            </div>
            <Link
              href="/"
              className="rounded-md border border-purple-500/60 px-3 py-1 text-xs font-medium text-purple-100 transition-colors hover:border-purple-400 hover:text-purple-50"
            >
              Back to landing
            </Link>
          </header>
          <div className="space-y-6">
            {children}
          </div>
        </main>

        <aside className="fixed inset-x-0 bottom-0 z-20 flex justify-between border-t border-white/10 bg-black/30 px-4 py-3 backdrop-blur md:hidden">
          {NAV_ITEMS.map((item) => (
            <MobileNavLink key={item.href} href={item.href} active={pathname === item.href}>
              {item.label.replace(' ', '\n')}
            </MobileNavLink>
          ))}
        </aside>
      </div>
    </div>
  );
}

function NavLink({ href, active, children }: { href: string; active: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? 'border-purple-400/60 bg-purple-500/10 text-white shadow'
          : 'border-transparent text-slate-200 hover:border-purple-400/40 hover:bg-white/10 hover:text-white'
      }`}
    >
      {children}
    </Link>
  );
}

function MobileNavLink({ href, active, children }: { href: string; active: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      className={`flex-1 text-center text-[11px] uppercase tracking-wide transition-colors ${
        active ? 'text-purple-200' : 'text-slate-300 hover:text-purple-200'
      }`}
    >
      {children}
    </Link>
  );
}
