export function resolveBuildOptions(defaults, projectOptions = {}, cliOptions = {}) {
  const allowed = new Set(Object.keys(defaults));

  for (const layer of [projectOptions, cliOptions]) {
    for (const key of Object.keys(layer)) {
      if (!allowed.has(key)) {
        throw new TypeError(`unknown build option: ${key}`);
      }
    }
  }

  return {
    ...defaults,
    ...projectOptions,
    ...cliOptions,
  };
}
