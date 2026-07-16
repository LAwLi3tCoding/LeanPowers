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
  for (let index = 0; index < input.length; index += 1) {
    const unit = input[index];
    if (escaped) {
      current += unit;
      escaped = false;
    } else if (unit === "\\") {
      escaped = true;
    } else if (unit === separator) {
      fields.push(current);
      current = "";
    } else {
      current += unit;
    }
  }
  if (escaped) throw new TypeError("trailing escape");
  fields.push(current);
  return fields;
}
