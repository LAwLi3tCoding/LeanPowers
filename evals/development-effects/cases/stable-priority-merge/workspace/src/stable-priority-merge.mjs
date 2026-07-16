function validateLanes(lanes) {
  if (!Array.isArray(lanes)) throw new TypeError("lanes must be a dense array");
  for (let laneIndex = 0; laneIndex < lanes.length; laneIndex += 1) {
    const lane = lanes[laneIndex];
    if (!Object.hasOwn(lanes, laneIndex) || !Array.isArray(lane)) {
      throw new TypeError("lanes must contain dense arrays");
    }
    for (let itemIndex = 0; itemIndex < lane.length; itemIndex += 1) {
      const item = lane[itemIndex];
      const keys = item !== null && typeof item === "object"
        ? Reflect.ownKeys(item)
        : [];
      const descriptors = keys.map((key) => Object.getOwnPropertyDescriptor(item, key));
      if (
        !Object.hasOwn(lane, itemIndex) ||
        item === null ||
        typeof item !== "object" ||
        Array.isArray(item) ||
        Object.getPrototypeOf(item) !== Object.prototype ||
        keys.length !== 3 ||
        !["id", "priority", "value"].every((key) => keys.includes(key)) ||
        descriptors.some((descriptor) => descriptor === undefined || !("value" in descriptor)) ||
        typeof item.id !== "string" ||
        item.id.length === 0 ||
        !Number.isSafeInteger(item.priority)
      ) {
        throw new TypeError("invalid priority item");
      }
    }
  }
}

export function mergeStablePriorityItems(lanes) {
  validateLanes(lanes);
  return lanes.flatMap((lane) => lane.map(({ id, priority, value }) => ({
    id,
    priority,
    value,
  })));
}
