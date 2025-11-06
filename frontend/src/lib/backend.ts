const DEFAULT_BACKEND_URL = 'http://localhost:4000';

export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? DEFAULT_BACKEND_URL;

export function buildBackendUrl(path: string, query?: Record<string, string | number | boolean | undefined>) {
  const url = new URL(path, BACKEND_URL);
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      url.searchParams.set(key, String(value));
    });
  }
  return url.toString();
}
