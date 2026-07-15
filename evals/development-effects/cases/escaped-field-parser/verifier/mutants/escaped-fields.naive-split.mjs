export function splitEscapedFields(input, separator) {
  if (
    typeof input !== "string" ||
    typeof separator !== "string" ||
    Array.from(separator).length !== 1 ||
    separator === "\\"
  ) {
    throw new TypeError("invalid arguments");
  }

  return input.split(separator);
}
