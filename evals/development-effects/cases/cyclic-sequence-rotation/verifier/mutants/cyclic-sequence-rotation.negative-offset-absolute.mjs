export function rotateSequence(values, offset) {
  function invalid(message) {
    throw new TypeError(message);
  }
  function readValues(input) {
    if (!Array.isArray(input)) invalid("values must be an array");
    if (Reflect.ownKeys(input).length !== input.length + 1) {
      invalid("values must be dense without extra own keys");
    }
    const result = [];
    for (let index = 0; index < input.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(input, String(index));
      if (descriptor?.enumerable !== true || !Object.hasOwn(descriptor, "value")) {
        invalid("values must contain own enumerable data elements");
      }
      result.push(descriptor.value);
    }
    return result;
  }
  const entries = readValues(values);
  if (!Number.isSafeInteger(offset)) invalid("offset must be a safe integer");
  if (entries.length === 0) return [];
  const normalized = offset < 0
    ? Math.abs(offset) % entries.length
    : offset % entries.length;
  return [...entries.slice(normalized), ...entries.slice(0, normalized)];
}
