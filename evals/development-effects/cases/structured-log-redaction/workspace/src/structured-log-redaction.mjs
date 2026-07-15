export function redactStructuredLog(record, sensitiveKeys) {
  const validRecord =
    record !== null && typeof record === "object" && !Array.isArray(record);
  const validKeys =
    Array.isArray(sensitiveKeys) &&
    sensitiveKeys.length > 0 &&
    sensitiveKeys.every(
      (key) => typeof key === "string" && key.length > 0,
    );

  if (!validRecord || !validKeys) {
    throw new TypeError("record and sensitiveKeys must be valid");
  }

  const sensitive = new Set(sensitiveKeys);
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [
      key,
      sensitive.has(key) ? "[REDACTED]" : value,
    ]),
  );
}
