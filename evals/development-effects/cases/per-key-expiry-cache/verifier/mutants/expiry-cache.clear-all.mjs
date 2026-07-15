export function createExpiringCache(now = Date.now) {
  if (typeof now !== "function") throw new TypeError("now must be a function");
  const entries = new Map();
  const key = (value) => {
    if (typeof value !== "string" || value.length === 0) throw new TypeError("invalid key");
  };
  return {
    set(name, value, ttlMs) {
      key(name);
      if (!Number.isInteger(ttlMs) || ttlMs < 0) throw new TypeError("invalid TTL");
      entries.set(name, { value, expiresAt: now() + ttlMs });
    },
    get(name) {
      key(name);
      const entry = entries.get(name);
      if (entry === undefined) return undefined;
      if (now() >= entry.expiresAt) {
        entries.clear();
        return undefined;
      }
      return entry.value;
    },
  };
}
