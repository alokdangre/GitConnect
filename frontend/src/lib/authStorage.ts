'use client';

const APP_TOKEN_KEY = 'gitconnect_app_token';
const GITHUB_TOKEN_KEY = 'github_access_token';
const GITHUB_USER_KEY = 'github_user';

type StoredUser = Record<string, unknown> | null;

function isBrowser() {
  return typeof window !== 'undefined';
}

export interface AuthSessionPayload {
  appToken: string;
  githubToken: string;
  user: Record<string, unknown>;
}

export function storeAuthSession(payload: AuthSessionPayload) {
  if (!isBrowser()) return;
  window.localStorage.setItem(APP_TOKEN_KEY, payload.appToken);
  window.localStorage.setItem(GITHUB_TOKEN_KEY, payload.githubToken);
  window.localStorage.setItem(GITHUB_USER_KEY, JSON.stringify(payload.user));
}

export function clearAuthSession() {
  if (!isBrowser()) return;
  window.localStorage.removeItem(APP_TOKEN_KEY);
  window.localStorage.removeItem(GITHUB_TOKEN_KEY);
  window.localStorage.removeItem(GITHUB_USER_KEY);
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
