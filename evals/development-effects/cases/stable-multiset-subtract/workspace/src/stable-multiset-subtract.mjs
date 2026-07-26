export function stableMultisetSubtract(values, removals) {
  if (!Array.isArray(values) || !Array.isArray(removals)) {
    throw new TypeError("values and removals must be arrays");
  }
  const removeSet = new Set(removals);
  return values.filter((value) => !removeSet.has(value));
}
