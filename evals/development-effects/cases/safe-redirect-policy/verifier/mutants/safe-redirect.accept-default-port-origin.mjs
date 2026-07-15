export function resolveSafeRedirect(target, baseOrigin, allowedOrigins) {
  const canonicalOrigin = (value) => {
    if (typeof value !== "string" || value.length === 0) throw new TypeError();
    let parsed;
    try { parsed = new URL(value); } catch { throw new TypeError(); }
    const defaultPort = parsed.protocol === "https:" ? "443" : "80";
    const explicitDefaultPort = value === `${parsed.origin}:${defaultPort}`;
    if (
      !["http:", "https:"].includes(parsed.protocol) || parsed.username ||
      parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash ||
      (parsed.origin !== value && !explicitDefaultPort)
    ) throw new TypeError();
    return parsed.origin;
  };
  const allowedSet = (value, base) => {
    if (!Array.isArray(value)) throw new TypeError();
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const length = descriptors.length?.value;
    if (!Number.isSafeInteger(length) || length <= 0) throw new TypeError();
    if (Reflect.ownKeys(descriptors).length !== length + 1) throw new TypeError();
    const result = new Set();
    for (let index = 0; index < length; index += 1) {
      const descriptor = descriptors[index];
      if (!descriptor?.enumerable || !Object.hasOwn(descriptor, "value")) throw new TypeError();
      const origin = canonicalOrigin(descriptor.value);
      if (result.has(origin)) throw new TypeError();
      result.add(origin);
    }
    if (!result.has(base)) throw new TypeError();
    return result;
  };
  if (typeof target !== "string" || target.length === 0) throw new TypeError();
  const base = canonicalOrigin(baseOrigin);
  const allowed = allowedSet(allowedOrigins, base);
  if (/[\u0000-\u001f\u007f\\]/u.test(target)) return null;
  let resolved;
  try { resolved = new URL(target, base); } catch { return null; }
  if (
    !["http:", "https:"].includes(resolved.protocol) || resolved.username ||
    resolved.password || !allowed.has(resolved.origin)
  ) return null;
  return resolved.href;
}
