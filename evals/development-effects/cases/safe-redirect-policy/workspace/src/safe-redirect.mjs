export function resolveSafeRedirect(target, baseOrigin, allowedOrigins) {
  if (
    typeof target !== "string" || target.length === 0 ||
    typeof baseOrigin !== "string" || baseOrigin.length === 0 ||
    !Array.isArray(allowedOrigins) || allowedOrigins.length === 0
  ) {
    throw new TypeError("invalid redirect policy");
  }

  const resolved = new URL(target, baseOrigin);
  return allowedOrigins.includes(resolved.origin) ? resolved.href : null;
}
