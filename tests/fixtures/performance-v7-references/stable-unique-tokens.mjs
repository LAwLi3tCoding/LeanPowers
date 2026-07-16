export function stableUniqueTokens(values) {
  const invalid = () => {
    throw new TypeError("values must be an exact dense token array");
  };
  if (!Array.isArray(values) || Object.getPrototypeOf(values) !== Array.prototype) {
    invalid();
  }

  const descriptors = Object.getOwnPropertyDescriptors(values);
  const keys = Reflect.ownKeys(values);
  const lengthDescriptor = descriptors.length;
  if (
    lengthDescriptor === undefined ||
    !("value" in lengthDescriptor) ||
    lengthDescriptor.enumerable ||
    !Number.isSafeInteger(lengthDescriptor.value) ||
    lengthDescriptor.value < 0 ||
    keys.length !== lengthDescriptor.value + 1
  ) {
    invalid();
  }

  const result = [];
  const seen = new Set();
  for (let index = 0; index < lengthDescriptor.value; index += 1) {
    const descriptor = descriptors[String(index)];
    if (
      descriptor === undefined ||
      !descriptor.enumerable ||
      !("value" in descriptor) ||
      typeof descriptor.value !== "string" ||
      !/^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(descriptor.value)
    ) {
      invalid();
    }
    if (!seen.has(descriptor.value)) {
      seen.add(descriptor.value);
      result.push(descriptor.value);
    }
  }
  return result;
}
