type CacheValue<T> = {
  value: T;
  expiresAt: number;
};

export interface CacheOptions {
  ttlMs?: number;
}

const DEFAULT_TTL_MS = 60_000; // 1 minute

class InMemoryCache {
  private store = new Map<string, CacheValue<unknown>>();

  set<T>(key: string, value: T, options: CacheOptions = {}) {
    const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
    const expiresAt = Date.now() + ttlMs;
    this.store.set(key, { value, expiresAt });
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;

    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }

    return entry.value as T;
  }

  delete(key: string) {
    this.store.delete(key);
  }

  clear() {
    this.store.clear();
  }
}

export const cache = new InMemoryCache();

export function buildCacheKey(parts: Array<string | number | boolean | null | undefined>): string {
  return parts
    .map((part) => (part === null || part === undefined ? '_' : String(part)))
    .join('::');
}
