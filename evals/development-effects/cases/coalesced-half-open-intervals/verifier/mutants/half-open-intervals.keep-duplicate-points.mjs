export function coalesceHalfOpenIntervals(intervals) {
  if (!Array.isArray(intervals)) {
    throw new TypeError("intervals must be a dense array of [start, end] tuples");
  }
  const normalized = [];
  for (let index = 0; index < intervals.length; index += 1) {
    const interval = intervals[index];
    if (
      !Object.hasOwn(intervals, index) ||
      !Array.isArray(interval) ||
      interval.length !== 2 ||
      !Object.hasOwn(interval, 0) ||
      !Object.hasOwn(interval, 1) ||
      !Number.isSafeInteger(interval[0]) ||
      !Number.isSafeInteger(interval[1]) ||
      interval[0] < 0 ||
      interval[0] > interval[1]
    ) {
      throw new TypeError("intervals must be a dense array of [start, end] tuples");
    }
    normalized.push([interval[0], interval[1]]);
  }
  normalized.sort((left, right) => left[0] - right[0] || left[1] - right[1]);

  const merged = [];
  const points = [];
  for (const [start, end] of normalized) {
    if (start === end) {
      points.push([start, end]);
      continue;
    }
    const previous = merged.at(-1);
    if (previous && start <= previous[1]) {
      previous[1] = Math.max(previous[1], end);
    } else {
      merged.push([start, end]);
    }
  }
  return [...merged, ...points].sort(
    (left, right) => left[0] - right[0] || left[1] - right[1],
  );
}
