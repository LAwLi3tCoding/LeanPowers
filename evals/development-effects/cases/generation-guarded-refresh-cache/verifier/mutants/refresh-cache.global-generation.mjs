export function createRefreshCache(loadValue) {
  if (typeof loadValue !== "function") throw new TypeError("loadValue must be a function");
  const entries = new Map();
  let generation = 0;
  const validateKey = (key) => {
    if (typeof key !== "string" || key.length === 0) throw new TypeError("key must be a non-empty string");
  };
  const start = (key) => {
    generation += 1;
    entries.clear();
    const currentGeneration = generation;
    const promise = Promise.resolve().then(() => loadValue(key));
    entries.set(key, { generation: currentGeneration, promise });
    promise.then(undefined, () => {
      if (generation === currentGeneration && entries.get(key)?.promise === promise) entries.delete(key);
    });
    return promise;
  };
  return {
    get(key) {
      validateKey(key);
      return entries.get(key)?.promise ?? start(key);
    },
    refresh(key) {
      validateKey(key);
      return start(key);
    },
    invalidate(key) {
      validateKey(key);
      generation += 1;
      const existed = entries.has(key);
      entries.clear();
      return existed;
    },
  };
}
