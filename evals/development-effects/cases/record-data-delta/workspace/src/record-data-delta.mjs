export function diffRecordData(before, after) {
  if (
    before === null ||
    after === null ||
    typeof before !== "object" ||
    typeof after !== "object" ||
    Array.isArray(before) ||
    Array.isArray(after)
  ) {
    throw new TypeError("before and after must be records");
  }

  const beforeKeys = Object.keys(before);
  const afterKeys = Object.keys(after);
  return {
    added: afterKeys.filter((key) => before[key] === undefined).sort(),
    removed: beforeKeys.filter((key) => after[key] === undefined).sort(),
    changed: afterKeys
      .filter((key) => before[key] !== undefined && before[key] !== after[key])
      .sort(),
  };
}
