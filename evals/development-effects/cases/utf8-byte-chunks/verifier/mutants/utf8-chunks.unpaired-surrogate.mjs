export function splitUtf8Chunks(text, maxBytes) {
  if (typeof text !== "string" || !Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    throw new TypeError("invalid arguments");
  }

  const chunks = [];
  let current = "";
  let currentBytes = 0;
  for (const codePoint of text) {
    const codePointBytes = Buffer.byteLength(codePoint, "utf8");
    if (codePointBytes > maxBytes) throw new RangeError("code point exceeds maxBytes");
    if (currentBytes + codePointBytes > maxBytes) {
      chunks.push(current);
      current = codePoint;
      currentBytes = codePointBytes;
    } else {
      current += codePoint;
      currentBytes += codePointBytes;
    }
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}
