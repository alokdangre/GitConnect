'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Github, Loader2 } from 'lucide-react';
import { getAppToken } from '@/lib/authStorage';

export default function AppSetupPage() {
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const hasRunRef = useRef(false);

  useEffect(() => {
    const finalizeSetup = async () => {
      setStatus('loading');
      setError(null);

      const searchParams = new URLSearchParams(window.location.search);
      const installationId = searchParams.get('installation_id');
      const setupAction = searchParams.get('setup_action');
      const state = searchParams.get('state');

      const targetPath = state && state.startsWith('/') ? state : '/dashboard/profile';

      if (!installationId) {
        setStatus('error');
        setError('Missing installation_id from GitHub setup URL');
        setTimeout(() => {
          router.replace(targetPath);
        }, 2000);
        return;
      }

      const appToken = getAppToken();
      if (!appToken) {
        setStatus('error');
        setError('Your session has expired. Please sign in with GitHub again.');
        setTimeout(() => {
          router.replace('/');
        }, 2000);
        return;
      }

      try {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
        const response = await fetch(`${backendUrl}/auth/installations/link`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${appToken}`,
          },
          body: JSON.stringify({
            installationId,
            setupAction,
          }),
        });

        if (!response.ok) {
          let message = 'Failed to record GitHub App installation';
          try {
            const errorData = await response.json();
            if (typeof errorData.error === 'string') {
              message = errorData.error;
            }
          } catch (_) {}
          throw new Error(message);
        }

        setStatus('success');
        setTimeout(() => {
          router.replace(targetPath);
        }, 1500);
      } catch (err) {
        setStatus('error');
        setError(err instanceof Error ? err.message : 'Failed to complete GitHub App setup');
        setTimeout(() => {
          router.replace('/dashboard/profile');
        }, 2500);
      }
    };

    if (hasRunRef.current) {
      return;
    }

    hasRunRef.current = true;
    finalizeSetup();
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
      <div className="bg-white/10 backdrop-blur-sm rounded-xl p-8 max-w-md mx-4 border border-white/20">
        <div className="text-center">
          <div className="mb-6">
            <Github className="w-12 h-12 text-purple-400 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-white mb-2">Finalizing GitHub App setup</h1>
          </div>

          {status === 'loading' && (
            <div className="space-y-4">
              <Loader2 className="w-8 h-8 text-purple-400 animate-spin mx-auto" />
              <p className="text-slate-300">Linking your GitHub App installation to your account...</p>
            </div>
          )}

          {status === 'success' && (
            <div className="space-y-4">
              <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <p className="text-green-400 font-medium">GitHub App installation linked!</p>
              <p className="text-slate-300 text-sm">Redirecting you to your dashboard...</p>
            </div>
          )}

          {status === 'error' && (
            <div className="space-y-4">
              <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <p className="text-red-400 font-medium">Setup Failed</p>
              <p className="text-slate-300 text-sm">{error}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
