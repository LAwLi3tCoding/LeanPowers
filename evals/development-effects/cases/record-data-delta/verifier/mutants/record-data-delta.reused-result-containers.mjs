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
  const result = diffRecordData.result ??= {
    added: [],
    removed: [],
    changed: [],
  };
  result.added.length = 0;
  result.removed.length = 0;
  result.changed.length = 0;
  for (const key of Object.keys(afterDescriptors)) {
    if (!Object.hasOwn(beforeDescriptors, key)) {
      result.added.push(key);
    } else if (!Object.is(beforeDescriptors[key].value, afterDescriptors[key].value)) {
      result.changed.push(key);
    }
  }
  for (const key of Object.keys(beforeDescriptors)) {
    if (!Object.hasOwn(afterDescriptors, key)) result.removed.push(key);
  }
  return result;
}
