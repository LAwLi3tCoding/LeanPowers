export function diffRecordData(before, after) {
  if (
    before === null ||
    after === null ||
    typeof before !== "object" ||
    typeof after !== "object" ||
    Array.isArray(before) ||
    Array.isArray(after)
  ) {
    throw new TypeError("inputs must be records");
  }
  const beforeKeys = Object.keys(before);
  const afterKeys = Object.keys(after);
  return {
    added: afterKeys.filter((key) => !Object.hasOwn(before, key)),
    removed: beforeKeys.filter((key) => !Object.hasOwn(after, key)),
    changed: afterKeys.filter((key) =>
      Object.hasOwn(before, key) && !Object.is(before[key], after[key])
    ),
  };
}
