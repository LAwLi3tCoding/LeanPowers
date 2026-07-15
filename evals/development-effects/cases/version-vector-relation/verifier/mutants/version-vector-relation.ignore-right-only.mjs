export function compareVersionVectors(left, right) {
  const safeIdentifier = /^[A-Za-z][A-Za-z0-9_-]*$/u;
  function invalid(message) {
    throw new TypeError(message);
  }
  function readVector(vector, label) {
    if (
      typeof vector !== "object"
      || vector === null
      || Object.getPrototypeOf(vector) !== Object.prototype
    ) {
      invalid(`${label} must be an ordinary record`);
    }
    const entries = new Map();
    for (const key of Reflect.ownKeys(vector)) {
      if (typeof key !== "string" || !safeIdentifier.test(key)) {
        invalid(`${label} keys must be safe identifiers`);
      }
      const descriptor = Object.getOwnPropertyDescriptor(vector, key);
      if (descriptor?.enumerable !== true || !Object.hasOwn(descriptor, "value")) {
        invalid(`${label} must contain own enumerable data properties`);
      }
      if (!Number.isSafeInteger(descriptor.value) || descriptor.value < 0) {
        invalid(`${label} values must be non-negative safe integers`);
      }
      entries.set(key, descriptor.value);
    }
    return entries;
  }
  const leftEntries = readVector(left, "left");
  const rightEntries = readVector(right, "right");
  let less = false;
  let greater = false;
  for (const [key, leftValue] of leftEntries) {
    const rightValue = rightEntries.get(key) ?? 0;
    if (leftValue < rightValue) less = true;
    if (leftValue > rightValue) greater = true;
  }
  if (less && greater) return "concurrent";
  if (less) return "before";
  if (greater) return "after";
  return "equal";
}
