export function createProfileLoader(fetchProfile) {
  const loads = new Map();

  return function loadProfile(id) {
    if (!loads.has(id)) {
      const load = Promise.resolve().then(() => fetchProfile(id));
      loads.set(id, load);
      load.then(
        () => {
          if (loads.get(id) === load) {
            loads.delete(id);
          }
        },
        () => {
          if (loads.get(id) === load) {
            loads.delete(id);
          }
        },
      );
    }
    return loads.get(id);
  };
}
