const GITHUB_API_BASE_URL = 'https://api.github.com';
const DEFAULT_MAX_RETRIES = 3;
const BASE_DELAY_MS = 300;
const JITTER_MS = 100;

export interface GitHubRequestOptions {
  path: string;
  token: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  headers?: Record<string, string>;
  maxRetries?: number;
}

export interface GitHubRateLimitMeta {
  limit: number | null;
  remaining: number | null;
  reset: number | null;
  retryAfter: number | null;
  link: string | null;
}

export interface GitHubResponse<T = unknown> {
  statusCode: number;
  ok: boolean;
  data: T | null;
  rawBody: string | null;
  rateLimit: GitHubRateLimitMeta;
  githubError?: unknown;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function jitter(attempt: number): number {
  // Add small random jitter that increases with attempts to reduce thundering herd.
  const maxJitter = JITTER_MS * (attempt + 1);
  return Math.floor(Math.random() * maxJitter);
}

function buildUrl(path: string, query?: GitHubRequestOptions['query']): URL {
  const url = new URL(path.startsWith('http') ? path : `${GITHUB_API_BASE_URL}${path}`);

  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') {
        return;
      }
      url.searchParams.set(key, String(value));
    });
  }

  return url;
}

function parseRateLimit(headers: Headers, status: number): GitHubRateLimitMeta {
  const limit = parseHeaderInt(headers.get('x-ratelimit-limit'));
  const remaining = parseHeaderInt(headers.get('x-ratelimit-remaining'));
  const reset = parseHeaderInt(headers.get('x-ratelimit-reset'));
  const retryAfterHeader = headers.get('retry-after');
  const retryAfter = parseHeaderInt(retryAfterHeader);

  // If GitHub sends a reset timestamp but no Retry-After header, compute seconds until reset.
  if (!retryAfter && reset && status === 429) {
    const nowSec = Math.ceil(Date.now() / 1000);
    const delta = Math.max(0, reset - nowSec);
    return { limit, remaining, reset, retryAfter: delta, link: headers.get('link') };
  }

  return {
    limit,
    remaining,
    reset,
    retryAfter: retryAfter ?? null,
    link: headers.get('link'),
  };
}

function parseHeaderInt(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function isRateLimitStatus(status: number, rateLimit: GitHubRateLimitMeta): boolean {
  if (status === 429) return true;
  if (status === 403 && rateLimit.remaining === 0) return true;
  return false;
}

function shouldRetry(status: number): boolean {
  if (status >= 500 && status < 600) return true;
  return false;
}

export async function githubRequest<T = unknown>(options: GitHubRequestOptions): Promise<GitHubResponse<T>> {
  const {
    path,
    token,
    method = 'GET',
    query,
    body,
    headers,
    maxRetries = DEFAULT_MAX_RETRIES,
  } = options;

  const url = buildUrl(path, query);
  const requestHeaders: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'GitConnect Backend',
    ...headers,
  };

  const bodyPayload =
    body === undefined || body === null
      ? undefined
      : typeof body === 'string'
      ? body
      : JSON.stringify(body);

  let lastResponse: GitHubResponse<T> | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const response = await fetch(url, {
      method,
      headers: {
        ...requestHeaders,
        ...(bodyPayload ? { 'Content-Type': 'application/json' } : {}),
      },
      body: bodyPayload,
    });

    const rawBody = await response.text();
    let data: T | null = null;
    try {
      data = rawBody ? (JSON.parse(rawBody) as T) : null;
    } catch (error) {
      // leave data as null; caller can inspect rawBody if needed
    }

    const rateLimit = parseRateLimit(response.headers, response.status);
    const result: GitHubResponse<T> = {
      statusCode: response.status,
      ok: response.ok,
      data,
      rawBody: rawBody || null,
      rateLimit,
      githubError: response.ok ? undefined : data ?? rawBody ?? undefined,
    };

    lastResponse = result;

    if (response.ok) {
      return result;
    }

    if (isRateLimitStatus(response.status, rateLimit)) {
      if (attempt === maxRetries) {
        return result;
      }

      const retryAfterMs = (rateLimit.retryAfter ?? 1) * 1000;
      await sleep(retryAfterMs + jitter(attempt));
      continue;
    }

    if (shouldRetry(response.status) && attempt < maxRetries) {
      const backoffMs = BASE_DELAY_MS * 2 ** attempt + jitter(attempt);
      await sleep(backoffMs);
      continue;
    }

    return result;
  }

  // If we exit the loop without returning, fall back to last response.
  return (
    lastResponse ?? {
      statusCode: 0,
      ok: false,
      data: null,
      rawBody: null,
      rateLimit: {
        limit: null,
        remaining: null,
        reset: null,
        retryAfter: null,
        link: null,
      },
    }
  );
}

export async function githubRequestRaw(options: GitHubRequestOptions) {
  return githubRequest(options);
}
