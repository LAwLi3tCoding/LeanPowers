export function extractBearerCredential(header) {
  if (typeof header !== "string") {
    throw new TypeError("header must be a string");
  }
  const match = /^([A-Za-z]+) ([A-Za-z0-9._~-]{16,512})$/u.exec(header);
  if (match === null || !match[1].toLowerCase().startsWith("bearer")) {
    return null;
  }
  return match[2];
}
