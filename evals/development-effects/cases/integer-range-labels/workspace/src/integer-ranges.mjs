export function formatIntegerRanges(values) {
  const valid =
    Array.isArray(values) &&
    Array.from(values).every(
      (value) => Number.isSafeInteger(value) && value >= 0,
    );

  if (!valid) {
    throw new TypeError("values must be an array of non-negative safe integers");
  }

  return values.join(",");
}
