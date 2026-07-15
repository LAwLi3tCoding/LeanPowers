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
  for (let index = 0; index < text.length; index += 1) {
    const unit = text[index];
    const unitBytes = Buffer.byteLength(unit, "utf8");
    if (unitBytes > maxBytes) throw new RangeError("code point exceeds maxBytes");
    if (currentBytes + unitBytes > maxBytes) {
      chunks.push(current);
      current = unit;
      currentBytes = unitBytes;
    } else {
      current += unit;
      currentBytes += unitBytes;
    }
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}
