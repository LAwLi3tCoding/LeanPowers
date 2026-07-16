export function interleaveWeightedLanes(lanes) {
  if (!Array.isArray(lanes)) throw new TypeError("lanes must be an array");
  const queues = lanes.map((lane) => {
    if (!lane || !Number.isSafeInteger(lane.weight) || lane.weight <= 0 || !Array.isArray(lane.items)) {
      throw new TypeError("invalid lane");
    }
    return { weight: lane.weight, items: [...lane.items], offset: 0 };
  });
  const output = [];
  let remaining = queues.reduce((sum, lane) => sum + lane.items.length, 0);
  while (remaining > 0) {
    for (const lane of queues) {
      const take = Math.min(lane.weight, lane.items.length - lane.offset);
      output.push(...lane.items.slice(lane.offset, lane.offset + take));
      lane.offset += take;
      remaining -= take;
    }
  }
  return output;
}
