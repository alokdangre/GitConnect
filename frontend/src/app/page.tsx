'use client';

import { Github } from 'lucide-react';

export default function Home() {
  const handleSignIn = () => {
    const clientId =
      process.env.NEXT_PUBLIC_GITHUB_APP_CLIENT_ID ?? process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;

    if (!clientId) {
      console.error('GitHub App client ID is not configured');
      return;
    }

    const redirectUri = `${window.location.origin}/auth/callback`;
    const scope = 'user:email,read:user,repo';
    const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}`;
    window.location.href = githubAuthUrl;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center">
          <div className="mb-8">
            <h1 className="text-6xl font-bold text-white mb-4">
              Git<span className="text-purple-400">Connect</span>
            </h1>
            <p className="text-xl text-slate-300 mb-8 max-w-2xl mx-auto">
              Connect your GitHub repositories and unlock powerful insights about your coding journey.
              Analyze commits, track progress, and discover your development patterns.
            </p>
          </div>

          <div className="space-y-6">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-8 max-w-md mx-auto border border-white/20">
              <h2 className="text-2xl font-semibold text-white mb-4">Get Started</h2>
              <p className="text-slate-300 mb-6">
                Sign in with your GitHub account to connect your repositories and start exploring your data.
              </p>

              <button
                onClick={handleSignIn}
                className="w-full bg-slate-800 hover:bg-slate-700 text-white font-medium py-3 px-6 rounded-lg flex items-center justify-center gap-3 transition-colors border border-slate-600 hover:border-slate-500"
              >
                <Github className="w-5 h-5" />
                Sign in with GitHub
              </button>
            </div>

            <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
              <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6 border border-white/10">
                <div className="text-purple-400 mb-3">
                  <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Repository Insights</h3>
                <p className="text-slate-400 text-sm">
                  Get detailed analytics on your repositories, commits, and contributions.
                </p>
              </div>

              <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6 border border-white/10">
                <div className="text-purple-400 mb-3">
                  <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Team Collaboration</h3>
                <p className="text-slate-400 text-sm">
                  Connect with collaborators and track team contributions across projects.
                </p>
              </div>

              <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6 border border-white/10">
                <div className="text-purple-400 mb-3">
                  <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Progress Tracking</h3>
                <p className="text-slate-400 text-sm">
                  Monitor your coding progress and identify areas for improvement.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
