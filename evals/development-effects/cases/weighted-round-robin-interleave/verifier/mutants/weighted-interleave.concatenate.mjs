export function interleaveWeightedLanes(lanes) {
  const denseValues = (value) => {
    if (!Array.isArray(value) || Reflect.ownKeys(value).length !== value.length + 1) throw new TypeError("invalid array");
    const result = [];
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (descriptor?.enumerable !== true || !Object.hasOwn(descriptor, "value")) throw new TypeError("invalid array");
      result.push(descriptor.value);
    }
    return result;
  };
  const normalized = denseValues(lanes).map((lane) => {
    if (lane === null || typeof lane !== "object" || Object.getPrototypeOf(lane) !== Object.prototype) throw new TypeError("invalid lane");
    const keys = Reflect.ownKeys(lane);
    const weight = Object.getOwnPropertyDescriptor(lane, "weight");
    const items = Object.getOwnPropertyDescriptor(lane, "items");
    if (keys.length !== 2 || !keys.includes("weight") || !keys.includes("items") || weight?.enumerable !== true || items?.enumerable !== true || !Object.hasOwn(weight, "value") || !Object.hasOwn(items, "value") || !Number.isSafeInteger(weight.value) || weight.value <= 0) throw new TypeError("invalid lane");
    return { weight: weight.value, items: denseValues(items.value) };
  });
  return normalized.flatMap(({ items }) => items);
}
