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
  const added = afterKeys.filter((key) => !Object.hasOwn(beforeDescriptors, key));
  const removed = beforeKeys.filter((key) => !Object.hasOwn(afterDescriptors, key));
  const changed = afterKeys.filter((key) =>
    Object.hasOwn(beforeDescriptors, key) &&
    !Object.is(beforeDescriptors[key].value, afterDescriptors[key].value)
  );
  const result = {};
  Object.defineProperties(result, {
    added: {
      configurable: true,
      enumerable: true,
      get: () => added,
    },
    removed: {
      configurable: true,
      enumerable: true,
      get: () => removed,
    },
    changed: {
      configurable: true,
      enumerable: true,
      get: () => changed,
    },
  });
  return result;
}
