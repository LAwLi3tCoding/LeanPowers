export function resolveBuildOptions(defaults, projectOptions = {}) {
  return {
    ...defaults,
    ...projectOptions,
  };
}
