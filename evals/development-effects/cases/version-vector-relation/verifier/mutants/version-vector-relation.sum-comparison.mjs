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
  const leftTotal = [...readVector(left, "left").values()]
    .reduce((total, value) => total + value, 0);
  const rightTotal = [...readVector(right, "right").values()]
    .reduce((total, value) => total + value, 0);
  if (leftTotal < rightTotal) return "before";
  if (leftTotal > rightTotal) return "after";
  return "equal";
}
