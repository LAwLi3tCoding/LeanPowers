export function splitUtf8Chunks(text, maxBytes) {
  if (typeof text !== "string" || !Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    throw new TypeError("invalid arguments");
  }
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = text.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) throw new TypeError("unpaired surrogate");
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      throw new TypeError("unpaired surrogate");
    }
  }

  const chunks = [];
  let current = "";
  let currentBytes = 0;
  for (const codePoint of text) {
    const codePointBytes = Buffer.byteLength(codePoint, "utf8");
    if (codePointBytes > maxBytes) throw new RangeError("code point exceeds maxBytes");
    if (current.length > 0 && currentBytes + codePointBytes >= maxBytes) {
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
