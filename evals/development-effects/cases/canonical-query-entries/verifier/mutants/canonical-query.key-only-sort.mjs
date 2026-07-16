export function encodeCanonicalQuery(entries) {
  const valid = Array.isArray(entries) && Array.from(entries).every(
    (entry) => Array.isArray(entry) && entry.length === 2 &&
      typeof entry[0] === "string" && typeof entry[1] === "string",
  );
  if (!valid) throw new TypeError("entries must be an array of string pairs");

  const encode = (component) => encodeURIComponent(component).replace(
    /[!'()*]/gu,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  const encoded = entries.map(([name, value]) => [encode(name), encode(value)]);
  encoded.sort(([leftName], [rightName]) => leftName.localeCompare(rightName));
  return encoded.map(([name, value]) => `${name}=${value}`).join("&");
}
