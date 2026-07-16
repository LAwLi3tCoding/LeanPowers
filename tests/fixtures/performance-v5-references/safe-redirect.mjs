const FORBIDDEN_TARGET_CODE_UNITS = /[\u0000-\u001f\u007f\\]/u;

function canonicalOrigin(value, label) {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`${label} must be a nonempty primitive string`);
  }

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new TypeError(`${label} must be a canonical HTTP or HTTPS origin`);
  }

  if (
    (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
    parsed.username !== "" ||
    parsed.password !== "" ||
    parsed.pathname !== "/" ||
    parsed.search !== "" ||
    parsed.hash !== "" ||
    parsed.origin !== value
  ) {
    throw new TypeError(`${label} must be a canonical HTTP or HTTPS origin`);
  }

  return parsed.origin;
}

function readAllowedOrigins(value, baseOrigin) {
  if (!Array.isArray(value)) {
    throw new TypeError("allowedOrigins must be an array");
  }

  const descriptors = Object.getOwnPropertyDescriptors(value);
  const lengthDescriptor = descriptors.length;
  const length = lengthDescriptor?.value;
  if (!Number.isSafeInteger(length) || length <= 0) {
    throw new TypeError("allowedOrigins must be nonempty");
  }

  const ownKeys = Reflect.ownKeys(descriptors);
  if (
    ownKeys.length !== length + 1 ||
    !ownKeys.includes("length")
  ) {
    throw new TypeError("allowedOrigins must not have extra own keys");
  }

  const origins = new Set();
  for (let index = 0; index < length; index += 1) {
    const descriptor = descriptors[String(index)];
    if (
      descriptor === undefined ||
      descriptor.enumerable !== true ||
      !Object.hasOwn(descriptor, "value")
    ) {
      throw new TypeError("allowedOrigins must contain own enumerable data elements");
    }

    const origin = canonicalOrigin(
      descriptor.value,
      `allowedOrigins[${index}]`,
    );
    if (origins.has(origin)) {
      throw new TypeError("allowedOrigins must contain unique origins");
    }
    origins.add(origin);
  }

  if (!origins.has(baseOrigin)) {
    throw new TypeError("allowedOrigins must include baseOrigin");
  }
  return origins;
}

export function resolveSafeRedirect(target, baseOrigin, allowedOrigins) {
  if (typeof target !== "string" || target.length === 0) {
    throw new TypeError("target must be a nonempty primitive string");
  }

  const canonicalBase = canonicalOrigin(baseOrigin, "baseOrigin");
  const allowed = readAllowedOrigins(allowedOrigins, canonicalBase);

  if (FORBIDDEN_TARGET_CODE_UNITS.test(target)) {
    return null;
  }

  let resolved;
  try {
    resolved = new URL(target, canonicalBase);
  } catch {
    return null;
  }

  if (
    (resolved.protocol !== "http:" && resolved.protocol !== "https:") ||
    resolved.username !== "" ||
    resolved.password !== "" ||
    !allowed.has(resolved.origin)
  ) {
    return null;
  }

  return resolved.href;
}
