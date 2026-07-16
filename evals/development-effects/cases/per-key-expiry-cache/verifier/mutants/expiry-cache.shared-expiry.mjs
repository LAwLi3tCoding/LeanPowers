export function createExpiringCache(now = Date.now) {
  if (typeof now !== "function") throw new TypeError("now must be a function");
  const values = new Map();
  let expiresAt = Infinity;
  const key = (value) => {
    if (typeof value !== "string" || value.length === 0) throw new TypeError("invalid key");
  };
  return {
    set(name, value, ttlMs) {
      key(name);
      if (!Number.isInteger(ttlMs) || ttlMs < 0) throw new TypeError("invalid TTL");
      values.set(name, value);
      expiresAt = now() + ttlMs;
    },
    get(name) {
      key(name);
      if (!values.has(name)) return undefined;
      if (now() >= expiresAt) {
        values.delete(name);
        return undefined;
      }
      return values.get(name);
    },
  };
}
