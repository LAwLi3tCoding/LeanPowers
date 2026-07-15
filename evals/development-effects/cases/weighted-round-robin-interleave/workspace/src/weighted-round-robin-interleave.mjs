export function interleaveWeightedLanes(lanes) {
  if (!Array.isArray(lanes)) {
    throw new TypeError("lanes must be an array");
  }
  return lanes.flatMap((lane) => lane.items);
}
