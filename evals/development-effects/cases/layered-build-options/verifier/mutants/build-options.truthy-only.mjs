export function resolveBuildOptions(defaults, projectOptions = {}, cliOptions = {}) {
  const allowed = new Set(Object.keys(defaults));
  const resolved = { ...defaults };

  for (const layer of [projectOptions, cliOptions]) {
    for (const key of Object.keys(layer)) {
      if (!allowed.has(key)) {
        throw new TypeError(`unknown build option: ${key}`);
      }
      if (layer[key]) {
        resolved[key] = layer[key];
      }
    }
  }

  return resolved;
}
