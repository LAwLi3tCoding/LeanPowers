const TOKEN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/u;

function invalid(message) {
  throw new TypeError(message);
}

function isToken(value) {
  return typeof value === "string" && TOKEN.test(value);
}

function isScope(value) {
  return typeof value === "string"
    && value.split("/").every((segment) => TOKEN.test(segment));
}

function readDataProperty(record, key, label) {
  const descriptor = Object.getOwnPropertyDescriptor(record, key);
  if (descriptor?.enumerable !== true || !Object.hasOwn(descriptor, "value")) {
    invalid(`${label} must contain enumerable data properties`);
  }
  return descriptor.value;
}

function readRule(value, index) {
  const label = `rules[${index}]`;
  if (
    typeof value !== "object"
    || value === null
    || Object.getPrototypeOf(value) !== Object.prototype
  ) {
    invalid(`${label} must be an ordinary record`);
  }
  const keys = Reflect.ownKeys(value);
  if (
    keys.length !== 3
    || !keys.includes("effect")
    || !keys.includes("action")
    || !keys.includes("resource")
  ) {
    invalid(`${label} must contain exactly effect, action, and resource`);
  }
  const effect = readDataProperty(value, "effect", label);
  const action = readDataProperty(value, "action", label);
  const resource = readDataProperty(value, "resource", label);
  if (effect !== "allow" && effect !== "deny") {
    invalid(`${label}.effect must be allow or deny`);
  }
  if (action !== "*" && !isToken(action)) {
    invalid(`${label}.action must be a token or wildcard`);
  }
  if (resource !== "*" && !isScope(resource)) {
    invalid(`${label}.resource must be a canonical scope or wildcard`);
  }
  return { effect, action, resource };
}

function readRules(value) {
  if (!Array.isArray(value)) invalid("rules must be an array");
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const length = descriptors.length?.value;
  if (!Number.isSafeInteger(length) || length < 0) {
    invalid("rules must have a valid length");
  }
  if (Reflect.ownKeys(descriptors).length !== length + 1) {
    invalid("rules must be dense without extra own keys");
  }
  const rules = [];
  for (let index = 0; index < length; index += 1) {
    const descriptor = descriptors[String(index)];
    if (
      descriptor?.enumerable !== true
      || !Object.hasOwn(descriptor, "value")
    ) {
      invalid("rules must contain own enumerable data elements");
    }
    rules.push(readRule(descriptor.value, index));
  }
  return rules;
}

function validateRequest(action, resource) {
  if (!isToken(action)) invalid("action must be a non-wildcard token");
  if (!isScope(resource)) invalid("resource must be a canonical scope");
}

export function isCapabilityAllowed(rules, action, resource) {
  const entries = readRules(rules);
  validateRequest(action, resource);

  for (const rule of entries) {
    if (rule.action !== action) continue;
    if (
      rule.resource !== "*"
      && rule.resource !== resource
      && !resource.startsWith(rule.resource)
    ) {
      continue;
    }
    return rule.effect === "allow";
  }
  return false;
}
