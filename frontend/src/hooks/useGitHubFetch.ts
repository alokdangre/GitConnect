'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { buildBackendUrl } from '@/lib/backend';
import { getAppToken } from '@/lib/authStorage';

type Primitive = string | number | boolean | null | undefined;

export interface UseGitHubFetchOptions<Q extends Record<string, Primitive> | undefined = undefined> {
  path: string;
  query?: Q;
  skip?: boolean;
}

interface BackendError {
  code: string;
  message: string;
  details?: unknown;
}

interface BackendMeta {
  pagination?: Record<string, unknown> | null;
  rateLimit?: Record<string, unknown> | null;
  [key: string]: unknown;
}

interface BackendSuccessResponse<T> {
  success: true;
  data: T;
  meta?: BackendMeta;
}

interface BackendErrorResponse {
  success: false;
  error: BackendError;
  meta?: BackendMeta;
}

type BackendResponse<T> = BackendSuccessResponse<T> | BackendErrorResponse;

export interface UseGitHubFetchState<T> {
  data: T | null;
  meta: BackendMeta | null;
  loading: boolean;
  error: BackendError | null;
  refetch: () => Promise<void>;
}

export function useGitHubFetch<T = unknown>(options: UseGitHubFetchOptions): UseGitHubFetchState<T> {
  const { path, query, skip = false } = options;

  const [data, setData] = useState<T | null>(null);
  const [meta, setMeta] = useState<BackendMeta | null>(null);
  const [error, setError] = useState<BackendError | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const requestUrl = useMemo(() => {
    if (!path) return null;
    return buildBackendUrl(path, query);
  }, [path, query && JSON.stringify(query)]);

  const fetchData = useCallback(async () => {
    if (!requestUrl || skip) {
      return;
    }

    const appToken = getAppToken();

    if (!appToken) {
      setError({
        code: 'NO_APP_TOKEN',
        message: 'Please sign in to view GitHub data.',
      });
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(requestUrl, {
        headers: {
          Authorization: `Bearer ${appToken}`,
        },
      });

      const payload = (await response.json()) as BackendResponse<T>;

      if (response.ok && payload.success) {
        setData(payload.data);
        setMeta(payload.meta ?? null);
        setError(null);
      } else {
        const errorPayload = payload.success ? undefined : payload.error;
        setError(
          errorPayload ?? {
            code: 'UNKNOWN_ERROR',
            message: 'An unknown error occurred while fetching GitHub data.',
          }
        );
        setData(null);
        setMeta(payload.meta ?? null);
      }
    } catch (err) {
      setError({
        code: 'NETWORK_ERROR',
        message: err instanceof Error ? err.message : 'Network request failed',
      });
      setData(null);
      setMeta(null);
    } finally {
      setLoading(false);
    }
  }, [requestUrl, skip]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const refetch = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  return {
    data,
    meta,
    error,
    loading,
    refetch,
  };
}
