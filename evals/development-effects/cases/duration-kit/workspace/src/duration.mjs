export function parseDuration(value) {
  if (Number.isInteger(value) && value >= 0) {
    return value;
  }
  throw new TypeError("duration must be a non-negative integer in milliseconds");
}

export function formatDuration(milliseconds) {
  if (!Number.isInteger(milliseconds) || milliseconds < 0) {
    throw new TypeError("milliseconds must be a non-negative integer");
  }
  return `${milliseconds}ms`;
}
