export function createProfileLoader(fetchProfile) {
  const loads = new Map();

  return function loadProfile(id) {
    if (!loads.has(id)) {
      const load = Promise.resolve().then(() => fetchProfile(id));
      loads.set(id, load);
      load.then(undefined, () => {
        loads.clear();
      });
    }
    return loads.get(id);
  };
}
