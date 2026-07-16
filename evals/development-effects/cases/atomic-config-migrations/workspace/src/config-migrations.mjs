function isExactRecord(value, keys) {
  if (
    value === null
    || typeof value !== "object"
    || Object.getPrototypeOf(value) !== Object.prototype
  ) {
    return false;
  }

  const ownKeys = Reflect.ownKeys(value);
  return ownKeys.length === keys.length && keys.every((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor?.enumerable === true && Object.hasOwn(descriptor, "value");
  });
}

function isFlatValues(value) {
  if (
    value === null
    || typeof value !== "object"
    || Object.getPrototypeOf(value) !== Object.prototype
  ) {
    return false;
  }

  return Reflect.ownKeys(value).every((key) => {
    if (typeof key !== "string") return false;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor?.enumerable !== true || !Object.hasOwn(descriptor, "value")) return false;
    const field = descriptor.value;
    return field === null || (typeof field !== "object" && typeof field !== "function");
  });
}

function validateInitial(initial) {
  if (
    !isExactRecord(initial, ["version", "values"])
    || !Number.isSafeInteger(initial.version)
    || initial.version < 0
    || !isFlatValues(initial.values)
  ) {
    throw new TypeError("initial must be an exact { version, values } record");
  }
}

function validateMigrations(migrations) {
  if (
    !Array.isArray(migrations)
    || Reflect.ownKeys(migrations).length !== migrations.length + 1
  ) {
    throw new TypeError("migrations must be a dense array");
  }

  const fromVersions = new Set();
  for (let index = 0; index < migrations.length; index += 1) {
    if (!Object.hasOwn(migrations, index)) {
      throw new TypeError("migrations must be a dense array");
    }
    const step = migrations[index];
    if (
      !isExactRecord(step, ["from", "to", "apply"])
      || !Number.isSafeInteger(step.from)
      || step.from < 0
      || !Number.isSafeInteger(step.to)
      || step.to !== step.from + 1
      || typeof step.apply !== "function"
      || fromVersions.has(step.from)
    ) {
      throw new TypeError("each migration must be a unique adjacent step");
    }
    fromVersions.add(step.from);
  }
}

export function createMigratingConfig(initial, migrations) {
  validateInitial(initial);
  validateMigrations(migrations);

  const steps = migrations.map(({ from, to, apply }) => ({ from, to, apply }));
  const state = {
    version: initial.version,
    values: initial.values,
  };

  return {
    snapshot() {
      return state;
    },

    migrateTo(target) {
      if (!Number.isSafeInteger(target) || target < 0) {
        throw new TypeError("target must be a non-negative safe integer");
      }

      for (const step of steps) {
        if (step.from < state.version) continue;
        if (step.from >= target) break;
        state.values = step.apply(state.values);
        state.version = step.to;
      }
      return state;
    },
  };
}
