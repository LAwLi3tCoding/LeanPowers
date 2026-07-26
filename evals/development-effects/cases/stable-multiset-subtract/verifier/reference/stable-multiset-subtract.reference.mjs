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

    const tokens = [];
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
      tokens.push(descriptor.value);
    }
    return tokens;
  };

  const valueTokens = readExactTokenArray(values);
  const removalTokens = readExactTokenArray(removals);
  const counts = new Map();
  for (const token of removalTokens) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }

  const result = [];
  for (const token of valueTokens) {
    const remaining = counts.get(token) ?? 0;
    if (remaining > 0) {
      counts.set(token, remaining - 1);
    } else {
      result.push(token);
    }
  }
  return result;
}
