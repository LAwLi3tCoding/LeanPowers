const FIXED_HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

export function sanitizeForwardHeaders(headers) {
  return headers
    .filter(({ name }) => !FIXED_HOP_BY_HOP.has(name))
    .map(({ name, value }) => ({ name, value }));
}
