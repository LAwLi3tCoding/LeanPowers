function invalid(message) {
  throw new TypeError(message);
}

function readValues(values) {
  if (!Array.isArray(values)) invalid("values must be an array");
  if (Reflect.ownKeys(values).length !== values.length + 1) {
    invalid("values must be dense without extra own keys");
  }

  const entries = [];
  for (let index = 0; index < values.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(values, String(index));
    if (descriptor?.enumerable !== true || !Object.hasOwn(descriptor, "value")) {
      invalid("values must contain own enumerable data elements");
    }
    entries.push(descriptor.value);
  }
  return entries;
}

export function rotateSequence(values, offset) {
  const entries = readValues(values);
  if (!Number.isSafeInteger(offset)) invalid("offset must be a safe integer");
  return [...entries];
}
