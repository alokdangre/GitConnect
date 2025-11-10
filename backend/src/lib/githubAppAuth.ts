const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';

export interface GitHubAppTokenResponse {
  access_token?: string;
  token_type?: string;
  scope?: string;
  expires_in?: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  error?: string;
  error_description?: string;
  error_uri?: string;
}

export interface GitHubAppTokenPayload {
  accessToken: string;
  refreshToken: string | null;
  tokenType: string | null;
  scope: string | null;
  tokenExpiresAt: Date | null;
  refreshTokenExpiresAt: Date | null;
}

export class GitHubOAuthError extends Error {
  public readonly details?: unknown;

  constructor(message: string, details?: unknown) {
    super(message);
    this.name = 'GitHubOAuthError';
    this.details = details;
  }
}

async function requestGitHubTokens(params: URLSearchParams): Promise<GitHubAppTokenPayload> {
  const response = await fetch(GITHUB_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new GitHubOAuthError('GitHub token endpoint returned an error response', details);
  }

  const payload = (await response.json()) as GitHubAppTokenResponse;

  if (payload.error || !payload.access_token) {
    throw new GitHubOAuthError(payload.error_description ?? 'GitHub OAuth error', payload);
  }

  const now = new Date();
  const tokenExpiresAt =
    typeof payload.expires_in === 'number' ? new Date(now.getTime() + payload.expires_in * 1000) : null;
  const refreshTokenExpiresAt =
    typeof payload.refresh_token_expires_in === 'number'
      ? new Date(now.getTime() + payload.refresh_token_expires_in * 1000)
      : null;

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token ?? null,
    tokenType: payload.token_type ?? null,
    scope: payload.scope ?? null,
    tokenExpiresAt,
    refreshTokenExpiresAt,
  };
}

interface ExchangeCodeParams {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri?: string;
}

export async function exchangeCodeForTokens({ code, clientId, clientSecret, redirectUri }: ExchangeCodeParams) {
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
  });

  if (redirectUri) {
    params.set('redirect_uri', redirectUri);
  }

  return requestGitHubTokens(params);
}

interface RefreshTokenParams {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
}

export async function refreshUserTokens({ refreshToken, clientId, clientSecret }: RefreshTokenParams) {
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });

  return requestGitHubTokens(params);
}
