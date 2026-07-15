export function splitEscapedFields(input, separator) {
  if (
    typeof input !== "string" ||
    typeof separator !== "string" ||
    Array.from(separator).length !== 1 ||
    separator === "\\"
  ) {
    throw new TypeError("invalid arguments");
  }

  const codePoints = Array.from(input);
  const fields = [];
  let current = "";
  for (let index = 0; index < codePoints.length; index += 1) {
    const codePoint = codePoints[index];
    if (codePoint === "\\") {
      const next = codePoints[index + 1];
      if (next === undefined) throw new TypeError("trailing escape");
      current += next === separator || next === "\\" ? next : `\\${next}`;
      index += 1;
    } else if (codePoint === separator) {
      fields.push(current);
      current = "";
    } else {
      current += codePoint;
    }
  }
  fields.push(current);
  return fields;
}
