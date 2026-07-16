function validateIntervals(intervals) {
  if (!Array.isArray(intervals)) {
    throw new TypeError("intervals must be a dense array of [start, end] tuples");
  }

  for (let index = 0; index < intervals.length; index += 1) {
    if (!Object.hasOwn(intervals, index)) {
      throw new TypeError("intervals must be a dense array of [start, end] tuples");
    }

    const interval = intervals[index];
    const validTuple =
      Array.isArray(interval) &&
      interval.length === 2 &&
      Object.hasOwn(interval, 0) &&
      Object.hasOwn(interval, 1) &&
      Number.isSafeInteger(interval[0]) &&
      Number.isSafeInteger(interval[1]) &&
      interval[0] >= 0 &&
      interval[0] <= interval[1];

    if (!validTuple) {
      throw new TypeError("intervals must be a dense array of [start, end] tuples");
    }
  }
}

export function coalesceHalfOpenIntervals(intervals) {
  validateIntervals(intervals);
  return intervals.map(([start, end]) => [start, end]);
}
