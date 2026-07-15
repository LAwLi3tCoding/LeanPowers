export function resolveBuildOptions(defaults, projectOptions = {}, cliOptions = {}) {
  const allowed = new Set(Object.keys(defaults));
  const resolved = { ...defaults };

  for (const layer of [projectOptions, cliOptions]) {
    for (const key in layer) {
      if (!allowed.has(key)) {
        throw new TypeError(`unknown build option: ${key}`);
      }
      if (layer[key] !== undefined) {
        resolved[key] = layer[key];
      }
    }
  }

  return resolved;
}
