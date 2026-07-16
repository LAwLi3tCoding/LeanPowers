export function encodeCanonicalQuery(entries) {
  const valid = Array.isArray(entries) && Array.from(entries).every(
    (entry) => Array.isArray(entry) && entry.length === 2 &&
      typeof entry[0] === "string" && typeof entry[1] === "string",
  );
  if (!valid) throw new TypeError("entries must be an array of string pairs");

  const encode = (component) => encodeURIComponent(component).replace(
    /[!'()*]/gu,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  ).replace(/%20/gu, "+");
  const encoded = entries.map(([name, value]) => [encode(name), encode(value)]);
  encoded.sort(([leftName, leftValue], [rightName, rightValue]) =>
    leftName.localeCompare(rightName) || leftValue.localeCompare(rightValue));
  return encoded.map(([name, value]) => `${name}=${value}`).join("&");
}
