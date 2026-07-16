export function rotateSequence(values, offset) {
  function invalid(message) {
    throw new TypeError(message);
  }
  function readValues(input) {
    if (!Array.isArray(input)) invalid("values must be an array");
    if (Reflect.ownKeys(input).length !== input.length + 1) {
      invalid("values must be dense without extra own keys");
    }
    for (let index = 0; index < input.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(input, String(index));
      if (descriptor?.enumerable !== true || !Object.hasOwn(descriptor, "value")) {
        invalid("values must contain own enumerable data elements");
      }
    }
    return input;
  }
  readValues(values);
  if (!Number.isSafeInteger(offset)) invalid("offset must be a safe integer");
  if (values.length === 0) return values;
  const normalized = ((offset % values.length) + values.length) % values.length;
  values.push(...values.splice(0, normalized));
  return values;
}
