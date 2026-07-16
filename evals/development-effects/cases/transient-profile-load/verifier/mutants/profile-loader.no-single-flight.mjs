export function createProfileLoader(fetchProfile) {
  const profiles = new Map();

  return function loadProfile(id) {
    if (profiles.has(id)) {
      return Promise.resolve(profiles.get(id));
    }
    return Promise.resolve()
      .then(() => fetchProfile(id))
      .then((profile) => {
        profiles.set(id, profile);
        return profile;
      });
  };
}
