function invalid(message) {
  throw new TypeError(message);
}

function readDataProperty(object, key, label) {
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  if (descriptor?.enumerable !== true || !Object.hasOwn(descriptor, "value")) {
    invalid(`${label} must contain enumerable data properties`);
  }
  return descriptor.value;
}

function readTuple(value, label) {
  if (
    typeof value !== "object"
    || value === null
    || Object.getPrototypeOf(value) !== Object.prototype
  ) {
    invalid(`${label} must be an ordinary record`);
  }
  const keys = Reflect.ownKeys(value);
  if (keys.length !== 2 || !keys.includes("id") || !keys.includes("updatedAt")) {
    invalid(`${label} must contain exactly id and updatedAt`);
  }
  const id = readDataProperty(value, "id", label);
  const updatedAt = readDataProperty(value, "updatedAt", label);
  if (typeof id !== "string" || id.length === 0 || !Number.isSafeInteger(updatedAt)) {
    invalid(`${label} contains an invalid tuple`);
  }
  return { id, updatedAt };
}

function readRecords(records) {
  if (!Array.isArray(records) || Reflect.ownKeys(records).length !== records.length + 1) {
    invalid("records must be a dense array without extra own keys");
  }
  const seen = new Set();
  const entries = [];
  for (let index = 0; index < records.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(records, String(index));
    if (descriptor?.enumerable !== true || !Object.hasOwn(descriptor, "value")) {
      invalid("records must contain own enumerable data elements");
    }
    const tuple = readTuple(descriptor.value, `records[${index}]`);
    if (seen.has(tuple.id)) invalid("record ids must be unique");
    seen.add(tuple.id);
    entries.push({ record: descriptor.value, ...tuple });
  }
  return entries;
}

function compareEntries(left, right) {
  if (left.updatedAt !== right.updatedAt) return right.updatedAt - left.updatedAt;
  if (left.id < right.id) return -1;
  if (left.id > right.id) return 1;
  return 0;
}

export function pageAfterCursor(records, cursor, limit) {
  const entries = readRecords(records);
  const cursorTuple = cursor === null ? null : readTuple(cursor, "cursor");
  if (!Number.isSafeInteger(limit) || limit <= 0) {
    invalid("limit must be a positive safe integer");
  }
  const ordered = entries.sort(compareEntries);
  const remaining = cursorTuple === null
    ? ordered
    : ordered.filter((entry) => (
      entry.updatedAt < cursorTuple.updatedAt
      || (entry.updatedAt === cursorTuple.updatedAt && entry.id > cursorTuple.id)
    ));
  const page = remaining.slice(0, limit);
  const items = page.map((entry) => entry.record);
  const last = page.at(-1);
  const nextCursor = remaining.length > page.length && last !== undefined
    ? { id: last.id, updatedAt: last.updatedAt }
    : null;
  return { items, nextCursor };
}
