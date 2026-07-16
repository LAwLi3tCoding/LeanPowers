export function redactStructuredLog(record, sensitiveKeys) {
  function readSensitiveKeys(keys) {
    if (
      !Array.isArray(keys) ||
      keys.length === 0 ||
      Reflect.ownKeys(keys).length !== keys.length + 1
    ) {
      throw new TypeError("invalid sensitive keys");
    }
    const result = new Set();
    for (let index = 0; index < keys.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(keys, String(index));
      if (
        descriptor?.enumerable !== true ||
        !Object.hasOwn(descriptor, "value") ||
        typeof descriptor.value !== "string" ||
        descriptor.value.length === 0 ||
        result.has(descriptor.value)
      ) {
        throw new TypeError("invalid sensitive key");
      }
      result.add(descriptor.value);
    }
    return result;
  }

  const sensitive = readSensitiveKeys(sensitiveKeys);
  const active = new Set();

  function validate(value) {
    if (
      value === null ||
      typeof value === "boolean" ||
      typeof value === "string" ||
      (typeof value === "number" && Number.isFinite(value))
    ) {
      return;
    }
    if (Array.isArray(value)) {
      if (
        active.has(value) ||
        Reflect.ownKeys(value).length !== value.length + 1
      ) {
        throw new TypeError("invalid array");
      }
      active.add(value);
      for (let index = 0; index < value.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (descriptor?.enumerable !== true || !Object.hasOwn(descriptor, "value")) {
          throw new TypeError("invalid array element");
        }
        validate(descriptor.value);
      }
      active.delete(value);
      return;
    }
    if (
      value === null ||
      typeof value !== "object" ||
      Object.getPrototypeOf(value) !== Object.prototype ||
      active.has(value)
    ) {
      throw new TypeError("invalid object");
    }
    active.add(value);
    for (const key of Reflect.ownKeys(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        typeof key !== "string" ||
        descriptor?.enumerable !== true ||
        !Object.hasOwn(descriptor, "value")
      ) {
        throw new TypeError("invalid object property");
      }
      if (!sensitive.has(key)) validate(descriptor.value);
    }
    active.delete(value);
  }

  if (
    record === null ||
    typeof record !== "object" ||
    Array.isArray(record) ||
    Object.getPrototypeOf(record) !== Object.prototype
  ) {
    throw new TypeError("record must be an ordinary object");
  }
  validate(record);

  const result = {};
  for (const key of Reflect.ownKeys(record)) {
    const descriptor = Object.getOwnPropertyDescriptor(record, key);
    Object.defineProperty(result, key, {
      configurable: true,
      enumerable: true,
      value: sensitive.has(key) ? "[REDACTED]" : descriptor.value,
      writable: true,
    });
  }
  return result;
}
