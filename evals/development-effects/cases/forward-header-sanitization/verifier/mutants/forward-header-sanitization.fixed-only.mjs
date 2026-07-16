export function sanitizeForwardHeaders(headers) {
  const headerName = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/u;
  const headerValue = /^[\t\x20-\x7e]*$/u;
  const fixed = new Set([
    "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
    "te", "trailer", "transfer-encoding", "upgrade",
  ]);
  function invalid() { throw new TypeError("invalid forward headers"); }
  function data(descriptors, key) {
    const descriptor = descriptors[key];
    if (descriptor?.enumerable !== true || !Object.hasOwn(descriptor, "value")) invalid();
    return descriptor.value;
  }
  function readRecord(value) {
    if (
      typeof value !== "object"
      || value === null
      || Object.getPrototypeOf(value) !== Object.prototype
    ) invalid();
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Reflect.ownKeys(descriptors);
    if (keys.length !== 2 || !keys.includes("name") || !keys.includes("value")) invalid();
    const name = data(descriptors, "name");
    const valueText = data(descriptors, "value");
    if (typeof name !== "string" || !headerName.test(name)) invalid();
    if (typeof valueText !== "string" || !headerValue.test(valueText)) invalid();
    return { name, value: valueText };
  }
  function readList(value) {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) invalid();
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const length = descriptors.length?.value;
    if (!Number.isSafeInteger(length) || length < 0) invalid();
    if (Reflect.ownKeys(descriptors).length !== length + 1) invalid();
    const entries = [];
    for (let index = 0; index < length; index += 1) {
      entries.push(readRecord(data(descriptors, String(index))));
    }
    return entries;
  }
  function parseConnection(value) {
    const tokens = value.split(",").map((part) =>
      part.replace(/^[\t ]+|[\t ]+$/gu, "")
    );
    if (tokens.length === 0 || tokens.some((token) => !headerName.test(token))) invalid();
  }

  const entries = readList(headers);
  for (const entry of entries) {
    if (entry.name.toLowerCase() === "connection") parseConnection(entry.value);
  }
  return entries
    .filter((entry) => !fixed.has(entry.name.toLowerCase()))
    .map((entry) => ({ name: entry.name, value: entry.value }));
}
