export function mergeStablePriorityItems(lanes) {
  validate(lanes);
  const byId = new Map();
  let encounter = 0;
  for (const lane of lanes) for (const item of lane) {
    byId.set(item.id, { item, encounter });
    encounter += 1;
  }
  return [...byId.values()].sort(compareWinners).map(({ item }) => ({ ...item }));

  function compareWinners(left, right) {
    return left.item.priority === right.item.priority
      ? left.encounter - right.encounter
      : left.item.priority > right.item.priority ? -1 : 1;
  }

  function validate(input) {
    if (!Array.isArray(input)) throw new TypeError("invalid lanes");
    for (let laneIndex = 0; laneIndex < input.length; laneIndex += 1) {
      const lane = input[laneIndex];
      if (!Object.hasOwn(input, laneIndex) || !Array.isArray(lane)) {
        throw new TypeError("invalid lane");
      }
      for (let itemIndex = 0; itemIndex < lane.length; itemIndex += 1) {
        if (!Object.hasOwn(lane, itemIndex) || !validItem(lane[itemIndex])) {
          throw new TypeError("invalid item");
        }
      }
    }
  }

  function validItem(item) {
    if (
      item === null ||
      typeof item !== "object" ||
      Array.isArray(item) ||
      Object.getPrototypeOf(item) !== Object.prototype
    ) return false;
    const keys = Reflect.ownKeys(item);
    return keys.length === 3 &&
      ["id", "priority", "value"].every((key) => {
        const descriptor = Object.getOwnPropertyDescriptor(item, key);
        return keys.includes(key) && descriptor !== undefined && "value" in descriptor;
      }) &&
      typeof item.id === "string" &&
      item.id.length > 0 &&
      Number.isSafeInteger(item.priority);
  }
}
