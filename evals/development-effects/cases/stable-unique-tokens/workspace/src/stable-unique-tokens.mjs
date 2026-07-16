export function stableUniqueTokens(values) {
  if (!Array.isArray(values)) {
    throw new TypeError("values must be an array");
  }
  return [...new Set(values)].sort();
}
