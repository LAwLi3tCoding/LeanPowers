export function splitUtf8Chunks(text, maxBytes) {
  if (
    typeof text !== "string" ||
    !Number.isSafeInteger(maxBytes) ||
    maxBytes <= 0
  ) {
    throw new TypeError("text must be a string and maxBytes a positive safe integer");
  }

  return text.length === 0 ? [] : [text];
}
