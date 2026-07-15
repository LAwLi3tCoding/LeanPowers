export function isCapabilityAllowed(rules, action, resource) {
  const tokenPattern = /^[A-Za-z0-9][A-Za-z0-9._-]*$/u;
  function invalid() { throw new TypeError("invalid capability policy"); }
  function token(value) {
    return typeof value === "string" && tokenPattern.test(value);
  }
  function scope(value) {
    return typeof value === "string"
      && value.split("/").every((segment) => tokenPattern.test(segment));
  }
  function data(descriptor) {
    if (descriptor?.enumerable !== true || !Object.hasOwn(descriptor, "value")) invalid();
    return descriptor.value;
  }
  function readRule(value) {
    if (
      typeof value !== "object"
      || value === null
      || Object.getPrototypeOf(value) !== Object.prototype
    ) invalid();
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Reflect.ownKeys(descriptors);
    if (
      keys.length !== 3
      || !keys.includes("effect")
      || !keys.includes("action")
      || !keys.includes("resource")
    ) invalid();
    const effect = data(descriptors.effect);
    const ruleAction = data(descriptors.action);
    const ruleResource = data(descriptors.resource);
    if (effect !== "allow" && effect !== "deny") invalid();
    if (ruleAction !== "*" && !token(ruleAction)) invalid();
    if (ruleResource !== "*" && !scope(ruleResource)) invalid();
    return { effect, action: ruleAction, resource: ruleResource };
  }
  function readPolicy(value) {
    if (!Array.isArray(value)) invalid();
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const length = descriptors.length?.value;
    if (!Number.isSafeInteger(length) || length < 0) invalid();
    if (Reflect.ownKeys(descriptors).length !== length + 1) invalid();
    const entries = [];
    for (let index = 0; index < length; index += 1) {
      entries.push(readRule(data(descriptors[String(index)])));
    }
    return entries;
  }
  function resourceMatches(pattern, requested) {
    return pattern === "*"
      || pattern === requested
      || requested.startsWith(`${pattern}/`);
  }

  const entries = readPolicy(rules);
  if (!token(action) || !scope(resource)) invalid();
  for (const entry of entries) {
    if (entry.action !== "*" && entry.action !== action) continue;
    if (!resourceMatches(entry.resource, resource)) continue;
    return entry.effect === "allow";
  }
  return false;
}
