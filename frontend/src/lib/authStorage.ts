'use client';

const APP_TOKEN_KEY = 'gitconnect_app_token';
const GITHUB_TOKEN_KEY = 'github_access_token';
const GITHUB_USER_KEY = 'github_user';
const GITHUB_TOKEN_METADATA_KEY = 'github_token_metadata';

type StoredUser = Record<string, unknown> | null;

function isBrowser() {
  return typeof window !== 'undefined';
}

export interface AuthSessionPayload {
  appToken: string;
  githubToken: string;
  user: Record<string, unknown>;
  tokenType?: string | null;
  scope?: string | null;
  tokenExpiresAt?: string | null;
  refreshTokenExpiresAt?: string | null;
}

export interface TokenMetadata {
  tokenType: string | null;
  scope: string | null;
  tokenExpiresAt: string | null;
  refreshTokenExpiresAt: string | null;
}

export function storeAuthSession(payload: AuthSessionPayload) {
  if (!isBrowser()) return;
  window.localStorage.setItem(APP_TOKEN_KEY, payload.appToken);
  window.localStorage.setItem(GITHUB_TOKEN_KEY, payload.githubToken);
  window.localStorage.setItem(GITHUB_USER_KEY, JSON.stringify(payload.user));

  if (
    payload.tokenType !== undefined ||
    payload.scope !== undefined ||
    payload.tokenExpiresAt !== undefined ||
    payload.refreshTokenExpiresAt !== undefined
  ) {
    const metadata: TokenMetadata = {
      tokenType: payload.tokenType ?? null,
      scope: payload.scope ?? null,
      tokenExpiresAt: payload.tokenExpiresAt ?? null,
      refreshTokenExpiresAt: payload.refreshTokenExpiresAt ?? null,
    };
    window.localStorage.setItem(GITHUB_TOKEN_METADATA_KEY, JSON.stringify(metadata));
  } else {
    window.localStorage.removeItem(GITHUB_TOKEN_METADATA_KEY);
  }
}

export function clearAuthSession() {
  if (!isBrowser()) return;
  window.localStorage.removeItem(APP_TOKEN_KEY);
  window.localStorage.removeItem(GITHUB_TOKEN_KEY);
  window.localStorage.removeItem(GITHUB_USER_KEY);
  window.localStorage.removeItem(GITHUB_TOKEN_METADATA_KEY);
}

export function getAppToken(): string | null {
  if (!isBrowser()) return null;
  return window.localStorage.getItem(APP_TOKEN_KEY);
}

export function getGithubToken(): string | null {
  if (!isBrowser()) return null;
  return window.localStorage.getItem(GITHUB_TOKEN_KEY);
}

export function getStoredUser(): StoredUser {
  if (!isBrowser()) return null;
  const raw = window.localStorage.getItem(GITHUB_USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch (error) {
    console.warn('Failed to parse stored GitHub user', error);
    return null;
  }
}

export function getTokenMetadata(): TokenMetadata | null {
  if (!isBrowser()) return null;
  const raw = window.localStorage.getItem(GITHUB_TOKEN_METADATA_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TokenMetadata;
  } catch (error) {
    console.warn('Failed to parse stored GitHub token metadata', error);
    return null;
  }
}
