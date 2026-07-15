export function splitEscapedFields(input, separator) {
  if (
    typeof input !== "string" ||
    typeof separator !== "string" ||
    Array.from(separator).length !== 1 ||
    separator === "\\"
  ) {
    throw new TypeError(
      "input must be a string and separator one non-backslash code point",
    );
  }

  return input.split(separator);
}
