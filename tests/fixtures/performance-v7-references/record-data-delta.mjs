export function diffRecordData(before, after) {
  const validate = (value) => {
    if (
      value === null ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Object.prototype
    ) {
      throw new TypeError("inputs must be exact ordinary records");
    }
    const descriptors = Object.getOwnPropertyDescriptors(value);
    for (const key of Reflect.ownKeys(value)) {
      const descriptor = descriptors[key];
      if (
        typeof key !== "string" ||
        descriptor === undefined ||
        !descriptor.enumerable ||
        !("value" in descriptor)
      ) {
        throw new TypeError("inputs must contain enumerable string data properties");
      }
    }
    return descriptors;
  };

  const beforeDescriptors = validate(before);
  const afterDescriptors = validate(after);
  const beforeKeys = Object.keys(beforeDescriptors);
  const afterKeys = Object.keys(afterDescriptors);
  const added = [];
  const removed = [];
  const changed = [];

  for (const key of afterKeys) {
    if (!Object.hasOwn(beforeDescriptors, key)) {
      added.push(key);
    } else if (!Object.is(beforeDescriptors[key].value, afterDescriptors[key].value)) {
      changed.push(key);
    }
  }
  for (const key of beforeKeys) {
    if (!Object.hasOwn(afterDescriptors, key)) removed.push(key);
  }
  return { added, removed, changed };
}
