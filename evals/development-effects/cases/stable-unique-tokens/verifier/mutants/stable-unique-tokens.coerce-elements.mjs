export function stableUniqueTokens(values) {
  const invalid = () => {
    throw new TypeError("values must be an exact dense token array");
  };
  if (!Array.isArray(values) || Object.getPrototypeOf(values) !== Array.prototype) {
    invalid();
  }
  const descriptors = Object.getOwnPropertyDescriptors(values);
  const keys = Reflect.ownKeys(values);
  const length = descriptors.length?.value;
  if (
    !Number.isSafeInteger(length) ||
    length < 0 ||
    keys.length !== length + 1 ||
    descriptors.length.enumerable ||
    !("value" in descriptors.length)
  ) {
    invalid();
  }
  const result = [];
  const seen = new Set();
  for (let index = 0; index < length; index += 1) {
    const descriptor = descriptors[String(index)];
    if (!descriptor?.enumerable || !("value" in descriptor)) invalid();
    const token = String(descriptor.value);
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(token)) invalid();
    if (!seen.has(token)) {
      seen.add(token);
      result.push(token);
    }
  }
  return result;
}
