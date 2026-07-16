export function createExpiringCache(now = Date.now) {
  if (typeof now !== "function") {
    throw new TypeError("now must be a function");
  }

  const values = new Map();
  let expiresAt = Infinity;
  const validateKey = (key) => {
    if (typeof key !== "string" || key.length === 0) {
      throw new TypeError("key must be a non-empty string");
    }
  };

  return {
    set(key, value, ttlMs) {
      validateKey(key);
      if (!Number.isInteger(ttlMs) || ttlMs < 0) {
        throw new TypeError("ttlMs must be a non-negative integer");
      }
      values.set(key, value);
      expiresAt = now() + ttlMs;
    },
    get(key) {
      validateKey(key);
      if (!values.has(key)) return undefined;
      if (now() >= expiresAt) {
        values.delete(key);
        return undefined;
      }
      return values.get(key);
    },
  };
}
