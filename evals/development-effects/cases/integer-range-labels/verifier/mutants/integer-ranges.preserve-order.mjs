export function formatIntegerRanges(values) {
  const valid = Array.isArray(values) && Array.from(values).every(
    (value) => Number.isSafeInteger(value) && value >= 0,
  );
  if (!valid) {
    throw new TypeError("values must be an array of non-negative safe integers");
  }

  const sorted = [...new Set(values)];
  if (sorted.length === 0) return "";
  const labels = [];
  let start = sorted[0];
  let end = start;
  const append = () => labels.push(start === end ? `${start}` : `${start}-${end}`);
  for (const value of sorted.slice(1)) {
    if (value === end + 1) {
      end = value;
      continue;
    }
    append();
    start = value;
    end = value;
  }
  append();
  return labels.join(",");
}
