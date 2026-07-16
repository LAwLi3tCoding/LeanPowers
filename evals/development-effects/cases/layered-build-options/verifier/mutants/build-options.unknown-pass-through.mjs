export function resolveBuildOptions(defaults, projectOptions = {}, cliOptions = {}) {
  const resolved = { ...defaults };

  for (const layer of [projectOptions, cliOptions]) {
    for (const key of Object.keys(layer)) {
      if (layer[key] !== undefined) {
        resolved[key] = layer[key];
      }
    }
  }

  return resolved;
}
