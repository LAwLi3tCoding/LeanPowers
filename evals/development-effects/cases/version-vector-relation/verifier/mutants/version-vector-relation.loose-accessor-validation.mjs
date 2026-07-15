export function compareVersionVectors(left, right) {
  const safeIdentifier = /^[A-Za-z][A-Za-z0-9_-]*$/u;
  function invalid(message) {
    throw new TypeError(message);
  }
  function readVector(vector, label) {
    if (typeof vector !== "object" || vector === null || Array.isArray(vector)) {
      invalid(`${label} must be a record`);
    }
    const entries = new Map();
    for (const [key, value] of Object.entries(vector)) {
      if (!safeIdentifier.test(key)) invalid(`${label} keys must be safe identifiers`);
      if (!Number.isSafeInteger(value) || value < 0) {
        invalid(`${label} values must be non-negative safe integers`);
      }
      entries.set(key, value);
    }
    return entries;
  }
  const leftEntries = readVector(left, "left");
  const rightEntries = readVector(right, "right");
  const keys = new Set([...leftEntries.keys(), ...rightEntries.keys()]);
  let less = false;
  let greater = false;
  for (const key of keys) {
    const leftValue = leftEntries.get(key) ?? 0;
    const rightValue = rightEntries.get(key) ?? 0;
    if (leftValue < rightValue) less = true;
    if (leftValue > rightValue) greater = true;
  }
  if (less && greater) return "concurrent";
  if (less) return "before";
  if (greater) return "after";
  return "equal";
}
