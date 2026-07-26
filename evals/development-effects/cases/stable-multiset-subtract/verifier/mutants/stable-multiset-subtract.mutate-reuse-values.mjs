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
  const counts = new Map();
  for (const descriptor of removalDescriptors) {
    counts.set(descriptor.value, (counts.get(descriptor.value) ?? 0) + 1);
  }
  const result = [];
  for (const descriptor of valueDescriptors) {
    const remaining = counts.get(descriptor.value) ?? 0;
    if (remaining > 0) {
      counts.set(descriptor.value, remaining - 1);
    } else {
      result.push(descriptor.value);
    }
  }
  values.length = 0;
  values.push(...result);
  return values;
}
