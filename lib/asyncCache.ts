/** Bounded, process-local cache. Concurrent readers share one load; failures retry. */
export function createAsyncCache<T>(ttlMs: number, limit: number) {
  const entries = new Map<string, { expires: number; promise: Promise<T> }>();
  return (key: string, load: () => Promise<T>): Promise<T> => {
    const now = Date.now();
    const existing = entries.get(key);
    if (existing && existing.expires > now) return existing.promise;
    for (const [id, entry] of entries) if (entry.expires <= now) entries.delete(id);
    if (entries.size >= limit) entries.delete(entries.keys().next().value!);
    const entry = { expires: now + ttlMs, promise: Promise.resolve().then(load) };
    entries.set(key, entry);
    entry.promise.catch(() => { if (entries.get(key) === entry) entries.delete(key); });
    return entry.promise;
  };
}

