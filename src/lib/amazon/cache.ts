// In-memory TTL cache (per server instance).
type Entry<T> = { value: T; expiresAt: number };
const store = new Map<string, Entry<unknown>>();

export function cacheGet<T>(key: string): T | undefined {
  const e = store.get(key) as Entry<T> | undefined;
  if (!e) return undefined;
  if (Date.now() > e.expiresAt) {
    store.delete(key);
    return undefined;
  }
  return e.value;
}

export function cacheSet<T>(key: string, value: T, ttlMs = 10 * 60 * 1000): void {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}
