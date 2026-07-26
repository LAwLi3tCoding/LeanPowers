export function extractBearerCredential(header) {
  if (typeof header !== "string") {
    throw new TypeError("header must be a string");
  }
  if (header.length === 0 || header.length > 4096) {
    return null;
  }
  if (!/^[\x20-\x7E]+$/u.test(header)) {
    return null;
  }
  if (header.includes(",")) {
    return null;
  }

  const [scheme, credential, ...rest] = header.split(" ");
  if (rest.length !== 0 || credential === undefined || credential.length === 0) {
    return null;
  }
  if (scheme.toLowerCase() !== "bearer") {
    return null;
  }
  if (!/^[A-Za-z0-9._~-]+$/u.test(credential)) {
    return null;
  }
  if (credential.length > 512) {
    return null;
  }
  return credential;
}
