import { Router, type Request, type Response } from 'express';
import { authenticateRequest } from '../middleware/auth.js';
import {
  githubRequest,
  type GitHubResponse,
  type GitHubRateLimitMeta,
} from '../lib/githubClient.js';
import { cache, buildCacheKey } from '../lib/cache.js';
import {
  parseZod,
  githubRepoParamsSchema,
  githubMeReposQuerySchema,
  githubRepoListQuerySchema,
  githubIssueListQuerySchema,
  githubPullListQuerySchema,
} from '../validators/github.schema.js';

type CacheStatus = 'HIT' | 'MISS';

interface RateLimitMeta {
  limit: number | null;
  remaining: number | null;
  reset: number | null;
  retryAfter: number | null;
}

interface PaginationMeta {
  link: string | null;
  next: string | null;
  prev: string | null;
  first: string | null;
  last: string | null;
  page: number | null;
}

interface ResponseMeta {
  pagination: PaginationMeta;
  rateLimit: RateLimitMeta;
}

interface CachedSuccess<T = unknown> {
  statusCode: number;
  data: T;
  meta: ResponseMeta;
}

const USER_PROFILE_TTL_MS = 30_000;
const DEFAULT_CACHE_TTL_MS = 60_000;

const githubRouter = Router();

githubRouter.use(authenticateRequest);

githubRouter.get('/me', async (req, res) => {
  const githubToken = ensureGithubToken(req, res);
  if (!githubToken) return;

  const cacheKey = buildCacheKey(['me', req.user?.id ?? '']);
  if (serveCacheHit(cacheKey, res)) return;

  try {
    const result = await githubRequest({ path: '/user', token: githubToken });

    if (!result.ok) {
      handleGithubError(res, result);
      return;
    }

    const meta = buildResponseMeta(result.rateLimit, 1);
    cacheSuccess(cacheKey, result, meta, USER_PROFILE_TTL_MS);
    sendSuccess(res, result.statusCode, result.data, meta, 'MISS');
  } catch (error) {
    handleUnexpectedError(res, error);
  }
});

githubRouter.get('/me/repos', async (req, res) => {
  const githubToken = ensureGithubToken(req, res);
  if (!githubToken) return;

  let query: ReturnType<typeof githubMeReposQuerySchema.parse>;
  try {
    query = parseZod(githubMeReposQuerySchema, req.query);
  } catch (error) {
    if (handleValidationError(res, error)) return;
    throw error;
  }

  const filteredQuery = toGitHubQuery(query);
  const cacheKey = buildCacheKey([
    'meRepos',
    req.user?.id ?? '',
    serializeQuery(filteredQuery),
  ]);

  if (serveCacheHit(cacheKey, res)) return;

  try {
    const result = await githubRequest({
      path: '/user/repos',
      token: githubToken,
      query: filteredQuery,
    });

    if (!result.ok) {
      handleGithubError(res, result);
      return;
    }

    const meta = buildResponseMeta(result.rateLimit, Number(query.page ?? 1));
    cacheSuccess(cacheKey, result, meta, DEFAULT_CACHE_TTL_MS);
    sendSuccess(res, result.statusCode, result.data, meta, 'MISS');
  } catch (error) {
    handleUnexpectedError(res, error);
  }
});

githubRouter.get('/repos/:owner/:repo', async (req, res) => {
  const githubToken = ensureGithubToken(req, res);
  if (!githubToken) return;

  let params: ReturnType<typeof githubRepoParamsSchema.parse>;
  try {
    params = parseZod(githubRepoParamsSchema, req.params);
  } catch (error) {
    if (handleValidationError(res, error)) return;
    throw error;
  }

  const cacheKey = buildCacheKey([
    'repo',
    req.user?.id ?? '',
    params.owner,
    params.repo,
  ]);

  if (serveCacheHit(cacheKey, res)) return;

  try {
    const result = await githubRequest({
      path: `/repos/${params.owner}/${params.repo}`,
      token: githubToken,
    });

    if (!result.ok) {
      handleGithubError(res, result);
      return;
    }

    const meta = buildResponseMeta(result.rateLimit, null);
    cacheSuccess(cacheKey, result, meta, DEFAULT_CACHE_TTL_MS);
    sendSuccess(res, result.statusCode, result.data, meta, 'MISS');
  } catch (error) {
    handleUnexpectedError(res, error);
  }
});

githubRouter.get('/repos/:owner/:repo/commits', async (req, res) => {
  const githubToken = ensureGithubToken(req, res);
  if (!githubToken) return;

  let params: ReturnType<typeof githubRepoParamsSchema.parse>;
  let query: ReturnType<typeof githubRepoListQuerySchema.parse>;
  try {
    params = parseZod(githubRepoParamsSchema, req.params);
    query = parseZod(githubRepoListQuerySchema, req.query);
  } catch (error) {
    if (handleValidationError(res, error)) return;
    throw error;
  }

  const filteredQuery = toGitHubQuery(query);
  const cacheKey = buildCacheKey([
    'commits',
    req.user?.id ?? '',
    params.owner,
    params.repo,
    serializeQuery(filteredQuery),
  ]);

  if (serveCacheHit(cacheKey, res)) return;

  try {
    const result = await githubRequest({
      path: `/repos/${params.owner}/${params.repo}/commits`,
      token: githubToken,
      query: filteredQuery,
    });

    if (!result.ok) {
      handleGithubError(res, result);
      return;
    }

    const meta = buildResponseMeta(result.rateLimit, Number(query.page ?? 1));
    cacheSuccess(cacheKey, result, meta, DEFAULT_CACHE_TTL_MS);
    sendSuccess(res, result.statusCode, result.data, meta, 'MISS');
  } catch (error) {
    handleUnexpectedError(res, error);
  }
});

githubRouter.get('/repos/:owner/:repo/issues', async (req, res) => {
  const githubToken = ensureGithubToken(req, res);
  if (!githubToken) return;

  let params: ReturnType<typeof githubRepoParamsSchema.parse>;
  let query: ReturnType<typeof githubIssueListQuerySchema.parse>;
  try {
    params = parseZod(githubRepoParamsSchema, req.params);
    query = parseZod(githubIssueListQuerySchema, req.query);
  } catch (error) {
    if (handleValidationError(res, error)) return;
    throw error;
  }

  const filteredQuery = toGitHubQuery(query);
  const cacheKey = buildCacheKey([
    'issues',
    req.user?.id ?? '',
    params.owner,
    params.repo,
    serializeQuery(filteredQuery),
  ]);

  if (serveCacheHit(cacheKey, res)) return;

  try {
    const result = await githubRequest({
      path: `/repos/${params.owner}/${params.repo}/issues`,
      token: githubToken,
      query: filteredQuery,
    });

    if (!result.ok) {
      handleGithubError(res, result);
      return;
    }

    const meta = buildResponseMeta(result.rateLimit, Number(query.page ?? 1));
    cacheSuccess(cacheKey, result, meta, DEFAULT_CACHE_TTL_MS);
    sendSuccess(res, result.statusCode, result.data, meta, 'MISS');
  } catch (error) {
    handleUnexpectedError(res, error);
  }
});

githubRouter.get('/repos/:owner/:repo/pulls', async (req, res) => {
  const githubToken = ensureGithubToken(req, res);
  if (!githubToken) return;

  let params: ReturnType<typeof githubRepoParamsSchema.parse>;
  let query: ReturnType<typeof githubPullListQuerySchema.parse>;
  try {
    params = parseZod(githubRepoParamsSchema, req.params);
    query = parseZod(githubPullListQuerySchema, req.query);
  } catch (error) {
    if (handleValidationError(res, error)) return;
    throw error;
  }

  const filteredQuery = toGitHubQuery(query);
  const cacheKey = buildCacheKey([
    'pulls',
    req.user?.id ?? '',
    params.owner,
    params.repo,
    serializeQuery(filteredQuery),
  ]);

  if (serveCacheHit(cacheKey, res)) return;

  try {
    const result = await githubRequest({
      path: `/repos/${params.owner}/${params.repo}/pulls`,
      token: githubToken,
      query: filteredQuery,
    });

    if (!result.ok) {
      handleGithubError(res, result);
      return;
    }

    const meta = buildResponseMeta(result.rateLimit, Number(query.page ?? 1));
    cacheSuccess(cacheKey, result, meta, DEFAULT_CACHE_TTL_MS);
    sendSuccess(res, result.statusCode, result.data, meta, 'MISS');
  } catch (error) {
    handleUnexpectedError(res, error);
  }
});

function ensureGithubToken(req: Request, res: Response): string | null {
  const token = req.githubToken;
  if (!token) {
    res.status(500).json({
      success: false,
      error: {
        code: 'GITHUB_TOKEN_MISSING',
        message: 'GitHub token was not provided on the request context',
      },
    });
    return null;
  }
  return token;
}

function toGitHubQuery(params: Record<string, unknown>): Record<string, string | number | boolean> {
  const output: Record<string, string | number | boolean> = {};
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }
    if (typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') {
      output[key] = value;
      return;
    }
    output[key] = String(value);
  });
  return output;
}

function serializeQuery(query: Record<string, unknown>): string {
  const sortedEntries = Object.entries(query)
    .filter(([, value]) => value !== undefined && value !== null)
    .sort(([a], [b]) => a.localeCompare(b));
  const canonical: Record<string, unknown> = {};
  sortedEntries.forEach(([key, value]) => {
    canonical[key] = value;
  });
  return JSON.stringify(canonical);
}

function serveCacheHit(cacheKey: string, res: Response): boolean {
  const cached = cache.get<CachedSuccess>(cacheKey);
  if (!cached) return false;

  applyMetaHeaders(res, cached.meta);
  sendSuccess(res, cached.statusCode, cached.data, cached.meta, 'HIT');
  return true;
}

function cacheSuccess(key: string, result: GitHubResponse, meta: ResponseMeta, ttlMs: number) {
  cache.set<CachedSuccess>(
    key,
    {
      statusCode: result.statusCode,
      data: result.data,
      meta,
    },
    { ttlMs }
  );
}

function buildResponseMeta(rateLimit: GitHubRateLimitMeta, currentPage: number | null): ResponseMeta {
  const pagination = parseLinkHeader(rateLimit.link);
  pagination.page = currentPage ?? pagination.page ?? null;

  return {
    pagination,
    rateLimit: {
      limit: rateLimit.limit,
      remaining: rateLimit.remaining,
      reset: rateLimit.reset,
      retryAfter: rateLimit.retryAfter,
    },
  };
}

function parseLinkHeader(linkHeader: string | null): PaginationMeta {
  const pagination: PaginationMeta = {
    link: linkHeader,
    next: null,
    prev: null,
    first: null,
    last: null,
    page: null,
  };

  if (!linkHeader) {
    return pagination;
  }

  const parts = linkHeader.split(',');
  parts.forEach((part) => {
    const match = part.match(/<([^>]+)>;\s*rel="([^"]+)"/);
    if (!match) return;
    const [, url, rel] = match;
    if (rel === 'next' || rel === 'prev' || rel === 'first' || rel === 'last') {
      pagination[rel] = url;
    }
  });

  return pagination;
}

function applyMetaHeaders(res: Response, meta: ResponseMeta) {
  if (meta.pagination.link) {
    res.set('X-GitHub-Link', meta.pagination.link);
  }
  if (meta.rateLimit.limit !== null) {
    res.set('X-GitHub-RateLimit-Limit', String(meta.rateLimit.limit));
  }
  if (meta.rateLimit.remaining !== null) {
    res.set('X-GitHub-RateLimit-Remaining', String(meta.rateLimit.remaining));
  }
  if (meta.rateLimit.reset !== null) {
    res.set('X-GitHub-RateLimit-Reset', String(meta.rateLimit.reset));
  }
}

function sendSuccess(res: Response, statusCode: number, data: unknown, meta: ResponseMeta, cacheStatus: CacheStatus) {
  applyMetaHeaders(res, meta);
  res.set('X-Cache', cacheStatus);
  res.status(statusCode).json({
    success: true,
    data,
    meta,
  });
}

function handleGithubError(res: Response, result: GitHubResponse) {
  const meta = buildResponseMeta(result.rateLimit, null);
  applyMetaHeaders(res, meta);
  res.set('X-Cache', 'MISS');

  let status = result.statusCode || 500;
  let code = 'GITHUB_ERROR';
  let message = 'GitHub request failed';

  let details: Record<string, unknown> | undefined;
  if (result.githubError && typeof result.githubError === 'object') {
    details = result.githubError as Record<string, unknown>;
  } else if (typeof result.githubError === 'string') {
    details = { message: result.githubError };
  }

  if (details && typeof details.message === 'string') {
    message = details.message;
  }

  if (isRateLimitResponse(result)) {
    status = 429;
    code = 'GITHUB_RATE_LIMIT';
    message = 'GitHub rate limit exceeded';
    const retryAfterSec = result.rateLimit.retryAfter ?? null;
    details = {
      ...(details ?? {}),
      retryAfterSec,
    };
  } else if (status === 404) {
    code = 'NOT_FOUND';
    message = 'GitHub resource not found';
  } else if (status === 401) {
    code = 'GITHUB_UNAUTHORIZED';
    message = 'GitHub rejected the provided token';
  }

  res.status(status).json({
    success: false,
    error: {
      code,
      message,
      details,
    },
    meta,
  });
}

function isRateLimitResponse(result: GitHubResponse): boolean {
  return (
    result.statusCode === 429 ||
    (result.statusCode === 403 && result.rateLimit.remaining === 0)
  );
}

function handleUnexpectedError(res: Response, error: unknown) {
  console.error('Unexpected GitHub proxy error:', error);
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
      details: error instanceof Error ? error.message : undefined,
    },
  });
}

function handleValidationError(res: Response, error: unknown): boolean {
  if (!(error instanceof Error) || error.message !== 'INVALID_PARAMS') {
    return false;
  }

  const issues = (error as Error & { issues?: unknown }).issues;

  res.status(400).json({
    success: false,
    error: {
      code: 'INVALID_PARAMS',
      message: 'Request parameters failed validation',
      details: issues,
    },
  });
  return true;
}

export default githubRouter;
