export function stableMultisetSubtract(values, removals) {
  const invalid = () => {
    throw new TypeError("values and removals must be exact dense token arrays");
  };
  const readExactTokenArray = (value) => {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
      invalid();
    }
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Reflect.ownKeys(value);
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
    for (let index = 0; index < length; index += 1) {
      const descriptor = descriptors[String(index)];
      if (
        !descriptor?.enumerable ||
        !("value" in descriptor) ||
        typeof descriptor.value !== "string" ||
        !/^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(descriptor.value)
      ) {
        invalid();
      }
      result.push(descriptor);
    }
    return result;
  };

  const valueDescriptors = readExactTokenArray(values);
  const removalDescriptors = readExactTokenArray(removals);
  const removeSet = new Set(removalDescriptors.map((descriptor) => descriptor.value));
  return valueDescriptors
    .map((descriptor) => descriptor.value)
    .filter((value) => !removeSet.has(value));
}
