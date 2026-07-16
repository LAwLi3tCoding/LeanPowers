const HEADER_NAME = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/u;
const HEADER_VALUE = /^[\t\x20-\x7e]*$/u;
const FIXED_HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

function invalid(message) {
  throw new TypeError(message);
}

function readDataProperty(descriptors, key, label) {
  const descriptor = descriptors[key];
  if (descriptor?.enumerable !== true || !Object.hasOwn(descriptor, "value")) {
    invalid(`${label} must contain enumerable data properties`);
  }
  return descriptor.value;
}

function readHeader(value, index) {
  const label = `headers[${index}]`;
  if (
    typeof value !== "object"
    || value === null
    || Object.getPrototypeOf(value) !== Object.prototype
  ) {
    invalid(`${label} must be an ordinary record`);
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(descriptors);
  if (
    keys.length !== 2
    || !keys.includes("name")
    || !keys.includes("value")
  ) {
    invalid(`${label} must contain exactly name and value`);
  }
  const name = readDataProperty(descriptors, "name", label);
  const headerValue = readDataProperty(descriptors, "value", label);
  if (typeof name !== "string" || !HEADER_NAME.test(name)) {
    invalid(`${label}.name must be a nonempty ASCII HTTP tchar string`);
  }
  if (typeof headerValue !== "string" || !HEADER_VALUE.test(headerValue)) {
    invalid(`${label}.value must contain only safe ASCII header-value bytes`);
  }
  return { name, value: headerValue };
}

function readHeaders(value) {
  if (
    !Array.isArray(value)
    || Object.getPrototypeOf(value) !== Array.prototype
  ) {
    invalid("headers must be an ordinary array");
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const length = descriptors.length?.value;
  if (!Number.isSafeInteger(length) || length < 0) {
    invalid("headers must have a valid length");
  }
  if (Reflect.ownKeys(descriptors).length !== length + 1) {
    invalid("headers must be dense without extra own keys");
  }
  const headers = [];
  for (let index = 0; index < length; index += 1) {
    const descriptor = descriptors[String(index)];
    if (descriptor?.enumerable !== true || !Object.hasOwn(descriptor, "value")) {
      invalid("headers must contain own enumerable data elements");
    }
    headers.push(readHeader(descriptor.value, index));
  }
  return headers;
}

function connectionTokens(value) {
  const tokens = value.split(",").map((part) =>
    part.replace(/^[\t ]+|[\t ]+$/gu, "")
  );
  if (tokens.length === 0 || tokens.some((token) => !HEADER_NAME.test(token))) {
    invalid("Connection must contain one or more comma-separated tchar tokens");
  }
  return tokens;
}

export function sanitizeForwardHeaders(headers) {
  const entries = readHeaders(headers);
  const removedNames = new Set(FIXED_HOP_BY_HOP);
  for (const entry of entries) {
    if (entry.name.toLowerCase() !== "connection") continue;
    for (const token of connectionTokens(entry.value)) {
      removedNames.add(token.toLowerCase());
    }
  }

  const result = [];
  for (const entry of entries) {
    if (removedNames.has(entry.name.toLowerCase())) continue;
    result.push({ name: entry.name, value: entry.value });
  }
  return result;
}
