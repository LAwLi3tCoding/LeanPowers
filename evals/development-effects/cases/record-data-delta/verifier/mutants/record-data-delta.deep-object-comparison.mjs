export function diffRecordData(before, after) {
  function structurallyEqual(left, right) {
    if (Object.is(left, right)) return true;
    if (
      left === null ||
      right === null ||
      typeof left !== "object" ||
      typeof right !== "object" ||
      Object.getPrototypeOf(left) !== Object.getPrototypeOf(right)
    ) {
      return false;
    }

    const leftKeys = Reflect.ownKeys(left);
    const rightKeys = Reflect.ownKeys(right);
    if (leftKeys.length !== rightKeys.length) return false;
    const leftDescriptors = Object.getOwnPropertyDescriptors(left);
    const rightDescriptors = Object.getOwnPropertyDescriptors(right);

    for (let index = 0; index < leftKeys.length; index += 1) {
      const leftKey = leftKeys[index];
      const rightKey = rightKeys[index];
      if (leftKey !== rightKey) return false;
      const leftDescriptor = leftDescriptors[leftKey];
      const rightDescriptor = rightDescriptors[rightKey];
      if (
        leftDescriptor.configurable !== rightDescriptor.configurable ||
        leftDescriptor.enumerable !== rightDescriptor.enumerable ||
        leftDescriptor.writable !== rightDescriptor.writable
      ) {
        return false;
      }
      if ("value" in leftDescriptor !== ("value" in rightDescriptor)) return false;
      if ("value" in leftDescriptor) {
        if (!structurallyEqual(leftDescriptor.value, rightDescriptor.value)) return false;
      } else if (
        leftDescriptor.get !== rightDescriptor.get ||
        leftDescriptor.set !== rightDescriptor.set
      ) {
        return false;
      }
    }
    return true;
  }

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
  return {
    added: afterKeys.filter((key) => !Object.hasOwn(beforeDescriptors, key)),
    removed: beforeKeys.filter((key) => !Object.hasOwn(afterDescriptors, key)),
    changed: afterKeys.filter((key) =>
      Object.hasOwn(beforeDescriptors, key) &&
      !structurallyEqual(beforeDescriptors[key].value, afterDescriptors[key].value)
    ),
  };
}
