export function splitEscapedFields(input, separator) {
  if (
    typeof input !== "string" ||
    typeof separator !== "string" ||
    Array.from(separator).length !== 1 ||
    separator === "\\"
  ) {
    throw new TypeError("invalid arguments");
  }

  const fields = [];
  let current = "";
  let escaped = false;
  for (const codePoint of input) {
    if (escaped) {
      current += codePoint;
      escaped = false;
    } else if (codePoint === "\\") {
      escaped = true;
    } else if (codePoint === separator) {
      fields.push(current);
      current = "";
    } else {
      current += codePoint;
    }
  }
  if (escaped) throw new TypeError("trailing escape");
  fields.push(current);
  return fields.filter((field) => field.length > 0);
}
