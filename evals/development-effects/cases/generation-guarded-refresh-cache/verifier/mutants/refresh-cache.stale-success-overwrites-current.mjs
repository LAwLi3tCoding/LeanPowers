export function createRefreshCache(loadValue) {
  if (typeof loadValue !== "function") throw new TypeError("loadValue must be a function");
  const entries = new Map();
  const generations = new Map();
  const validateKey = (key) => {
    if (typeof key !== "string" || key.length === 0) throw new TypeError("key must be a non-empty string");
  };
  const nextGeneration = (key) => {
    const generation = (generations.get(key) ?? 0) + 1;
    generations.set(key, generation);
    return generation;
  };
  const start = (key, generation) => {
    let promise;
    promise = Promise.resolve().then(() => loadValue(key)).then((value) => {
      entries.set(key, { generation, promise });
      return value;
    });
    entries.set(key, { generation, promise });
    promise.then(undefined, () => {
      if (generations.get(key) === generation && entries.get(key)?.promise === promise) entries.delete(key);
    });
    return promise;
  };
  return {
    get(key) {
      validateKey(key);
      return entries.get(key)?.promise ?? start(key, nextGeneration(key));
    },
    refresh(key) {
      validateKey(key);
      return start(key, nextGeneration(key));
    },
    invalidate(key) {
      validateKey(key);
      nextGeneration(key);
      return entries.delete(key);
    },
  };
}
