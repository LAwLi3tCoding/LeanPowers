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
  const beforeValue = (key) => beforeDescriptors[key]?.value;
  const afterValue = (key) => afterDescriptors[key]?.value;
  return {
    added: afterKeys.filter((key) => beforeValue(key) === undefined),
    removed: beforeKeys.filter((key) => afterValue(key) === undefined),
    changed: afterKeys.filter((key) =>
      beforeValue(key) !== undefined &&
      !Object.is(beforeValue(key), afterValue(key))
    ),
  };
}
