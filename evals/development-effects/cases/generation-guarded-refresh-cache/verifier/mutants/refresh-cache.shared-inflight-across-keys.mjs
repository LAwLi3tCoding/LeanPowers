export function createRefreshCache(loadValue) {
  if (typeof loadValue !== "function") throw new TypeError("loadValue must be a function");
  let entry;
  let generation = 0;
  const validateKey = (key) => {
    if (typeof key !== "string" || key.length === 0) throw new TypeError("key must be a non-empty string");
  };
  const start = (key) => {
    generation += 1;
    const currentGeneration = generation;
    const promise = Promise.resolve().then(() => loadValue(key));
    entry = { generation: currentGeneration, key, promise };
    promise.then(undefined, () => {
      if (entry?.generation === currentGeneration && entry.promise === promise) entry = undefined;
    });
    return promise;
  };
  return {
    get(key) {
      validateKey(key);
      return entry?.promise ?? start(key);
    },
    refresh(key) {
      validateKey(key);
      return start(key);
    },
    invalidate(key) {
      validateKey(key);
      generation += 1;
      const existed = entry?.key === key;
      if (existed) entry = undefined;
      return existed;
    },
  };
}
