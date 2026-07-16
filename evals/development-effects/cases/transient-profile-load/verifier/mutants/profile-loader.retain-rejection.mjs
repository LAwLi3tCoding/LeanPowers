export function createProfileLoader(fetchProfile) {
  const loads = new Map();

  return function loadProfile(id) {
    if (!loads.has(id)) {
      loads.set(id, Promise.resolve().then(() => fetchProfile(id)));
    }
    return loads.get(id);
  };
}
