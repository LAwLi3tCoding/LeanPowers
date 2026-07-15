export function mergeStablePriorityItems(lanes) {
  if (!Array.isArray(lanes) || !lanes.every(Array.isArray)) {
    throw new TypeError("invalid lanes");
  }
  const items = lanes.flat();
  if (!items.every((item) =>
    item !== null &&
    typeof item === "object" &&
    typeof item.id === "string" &&
    item.id.length > 0 &&
    Number.isSafeInteger(item.priority)
  )) {
    throw new TypeError("invalid item");
  }
  const byId = new Map();
  let encounter = 0;
  for (const item of items) {
    const current = byId.get(item.id);
    if (!current || item.priority > current.item.priority) {
      byId.set(item.id, { item, encounter });
    }
    encounter += 1;
  }
  return [...byId.values()].sort((left, right) =>
    left.item.priority === right.item.priority
      ? left.encounter - right.encounter
      : left.item.priority > right.item.priority ? -1 : 1
  ).map(({ item }) => ({
    id: item.id,
    priority: item.priority,
    value: item.value,
  }));
}
