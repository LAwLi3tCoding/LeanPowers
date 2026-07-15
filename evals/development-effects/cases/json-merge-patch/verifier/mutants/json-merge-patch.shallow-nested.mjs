export function applyJsonMergePatch(target, patch) {
  const invalid = () => {
    throw new TypeError("target and patch must be acyclic JSON-compatible values");
  };
  const isRecord = (value) =>
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype;
  const validate = (value, ancestors = new Set()) => {
    if (
      value === null ||
      typeof value === "string" ||
      typeof value === "boolean" ||
      (typeof value === "number" && Number.isFinite(value))
    ) return;
    if (typeof value !== "object" || ancestors.has(value)) invalid();
    ancestors.add(value);
    try {
      const descriptors = Object.getOwnPropertyDescriptors(value);
      const keys = Reflect.ownKeys(value);
      if (Array.isArray(value)) {
        if (
          keys.length !== value.length + 1 ||
          !Object.hasOwn(descriptors, "length") ||
          !("value" in descriptors.length) ||
          descriptors.length.enumerable ||
          descriptors.length.value !== value.length
        ) invalid();
        for (let index = 0; index < value.length; index += 1) {
          const descriptor = descriptors[index];
          if (!descriptor?.enumerable || !("value" in descriptor)) invalid();
          validate(descriptor.value, ancestors);
        }
        if (keys.some((key) =>
          typeof key !== "string" ||
          (key !== "length" && !/^(?:0|[1-9]\d*)$/u.test(key))
        )) invalid();
      } else {
        if (Object.getPrototypeOf(value) !== Object.prototype) invalid();
        for (const key of keys) {
          const descriptor = descriptors[key];
          if (
            typeof key !== "string" ||
            !descriptor?.enumerable ||
            !("value" in descriptor)
          ) invalid();
          validate(descriptor.value, ancestors);
        }
      }
    } finally {
      ancestors.delete(value);
    }
  };
  const defineMutable = (object, key, value) => {
    Object.defineProperty(object, key, {
      configurable: true,
      enumerable: true,
      value,
      writable: true,
    });
  };
  const clone = (value) => {
    if (Array.isArray(value)) {
      return Array.from(
        { length: value.length },
        (_, index) => clone(Object.getOwnPropertyDescriptor(value, String(index)).value),
      );
    }
    if (isRecord(value)) {
      const result = {};
      for (const key of Reflect.ownKeys(value)) {
        defineMutable(result, key, clone(Object.getOwnPropertyDescriptor(value, key).value));
      }
      return result;
    }
    return value;
  };
  const merge = (current, delta, nested = false) => {
    if (!isRecord(delta)) return clone(delta);
    if (nested) return clone(delta);
    const result = isRecord(current) ? clone(current) : {};
    for (const key of Reflect.ownKeys(delta)) {
      const deltaValue = Object.getOwnPropertyDescriptor(delta, key).value;
      if (deltaValue === null) {
        delete result[key];
        continue;
      }
      const currentValue = isRecord(current) && Object.hasOwn(current, key)
        ? Object.getOwnPropertyDescriptor(current, key).value
        : undefined;
      defineMutable(result, key, merge(currentValue, deltaValue, true));
    }
    return result;
  };
  validate(target);
  validate(patch);
  return merge(target, patch);
}
