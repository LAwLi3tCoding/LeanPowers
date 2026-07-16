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
        !descriptor?.enumerable ||
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
      continue;
    }
    const beforeValue = beforeDescriptors[key].value;
    const afterValue = afterDescriptors[key].value;
    if (
      !Object.is(beforeValue, afterValue) &&
      beforeValue !== null &&
      afterValue !== null &&
      typeof beforeValue === "object" &&
      typeof afterValue === "object"
    ) {
      Reflect.ownKeys(beforeValue);
      Reflect.ownKeys(afterValue);
    }
    if (!Object.is(beforeValue, afterValue)) changed.push(key);
  }
  for (const key of beforeKeys) {
    if (!Object.hasOwn(afterDescriptors, key)) removed.push(key);
  }
  return { added, removed, changed };
}
