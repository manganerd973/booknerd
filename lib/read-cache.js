const MAX_ENTRIES = 40;
const cache = new Map();

function prune(now) {
  for (const [key, entry] of cache) {
    if (!entry.promise && entry.expiresAt <= now) cache.delete(key);
  }
  while (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value);
}

export async function cachedRead(key, ttlMs, loader) {
  const now = Date.now();
  const current = cache.get(key);
  if (current?.value !== undefined && current.expiresAt > now) return current.value;
  if (current?.promise) return current.promise;

  const promise = Promise.resolve()
    .then(loader)
    .then((value) => {
      cache.delete(key);
      cache.set(key, { value, expiresAt: Date.now() + ttlMs, promise: null });
      prune(Date.now());
      return value;
    })
    .catch((error) => {
      cache.delete(key);
      throw error;
    });
  cache.set(key, { value: undefined, expiresAt: 0, promise });
  return promise;
}
