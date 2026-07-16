export function pageAfterCursor(records, cursor, limit) {
  function invalid() { throw new TypeError("invalid input"); }
  function tuple(value) {
    if (typeof value !== "object" || value === null || Object.getPrototypeOf(value) !== Object.prototype) invalid();
    const keys = Reflect.ownKeys(value);
    if (keys.length !== 2 || !keys.includes("id") || !keys.includes("updatedAt")) invalid();
    const idProperty = Object.getOwnPropertyDescriptor(value, "id");
    const timeProperty = Object.getOwnPropertyDescriptor(value, "updatedAt");
    if (idProperty?.enumerable !== true || !Object.hasOwn(idProperty, "value")) invalid();
    if (timeProperty?.enumerable !== true || !Object.hasOwn(timeProperty, "value")) invalid();
    if (typeof idProperty.value !== "string" || idProperty.value.length === 0 || !Number.isSafeInteger(timeProperty.value)) invalid();
    return { id: idProperty.value, updatedAt: timeProperty.value };
  }
  function collect() {
    if (!Array.isArray(records) || Reflect.ownKeys(records).length !== records.length + 1) invalid();
    const seen = new Set();
    const entries = [];
    for (let index = 0; index < records.length; index += 1) {
      const property = Object.getOwnPropertyDescriptor(records, String(index));
      if (property?.enumerable !== true || !Object.hasOwn(property, "value")) invalid();
      const key = tuple(property.value);
      if (seen.has(key.id)) invalid();
      seen.add(key.id);
      entries.push({ record: property.value, ...key });
    }
    return entries;
  }
  function compare(left, right) {
    if (left.updatedAt !== right.updatedAt) return right.updatedAt - left.updatedAt;
    return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
  }
  const ordered = collect().sort(compare);
  const boundary = cursor === null ? null : tuple(cursor);
  if (!Number.isSafeInteger(limit) || limit <= 0) invalid();
  const remaining = boundary === null
    ? ordered
    : ordered.filter((entry) => (
      entry.updatedAt < boundary.updatedAt
      || (entry.updatedAt === boundary.updatedAt && entry.id > boundary.id)
    ));
  const page = remaining.slice(0, limit);
  const last = page.at(-1);
  return {
    items: page.map((entry) => ({ id: entry.id, updatedAt: entry.updatedAt })),
    nextCursor: remaining.length > page.length && last !== undefined
      ? { id: last.id, updatedAt: last.updatedAt }
      : null,
  };
}
