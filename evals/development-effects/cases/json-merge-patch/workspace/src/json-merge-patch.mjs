export function applyJsonMergePatch(target, patch) {
  if (patch === null || typeof patch !== "object" || Array.isArray(patch)) {
    return patch;
  }
  const base = target !== null &&
      typeof target === "object" &&
      !Array.isArray(target)
    ? target
    : {};
  return { ...base, ...patch };
}
