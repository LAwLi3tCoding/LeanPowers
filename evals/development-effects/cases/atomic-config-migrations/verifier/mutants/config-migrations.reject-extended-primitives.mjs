export function createMigratingConfig(initial, migrations) {
  function isExactRecord(value, keys) {
    if (value === null || typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) return false;
    const ownKeys = Reflect.ownKeys(value);
    return ownKeys.length === keys.length && keys.every((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      return descriptor?.enumerable === true && Object.hasOwn(descriptor, "value");
    });
  }

  function isFlatValues(value) {
    if (value === null || typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) return false;
    return Reflect.ownKeys(value).every((key) => {
      if (typeof key !== "string") return false;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor?.enumerable !== true || !Object.hasOwn(descriptor, "value")) return false;
      const field = descriptor.value;
      return field === null || ["boolean", "number", "string"].includes(typeof field);
    });
  }

  function validate(initialConfig, migrationSteps) {
    if (!isExactRecord(initialConfig, ["version", "values"]) || !Number.isSafeInteger(initialConfig.version) || initialConfig.version < 0 || !isFlatValues(initialConfig.values)) throw new TypeError("invalid initial config");
    if (!Array.isArray(migrationSteps) || Reflect.ownKeys(migrationSteps).length !== migrationSteps.length + 1) throw new TypeError("invalid migrations");
    const seen = new Set();
    for (let index = 0; index < migrationSteps.length; index += 1) {
      const migration = migrationSteps[index];
      if (!Object.hasOwn(migrationSteps, index) || !isExactRecord(migration, ["from", "to", "apply"]) || !Number.isSafeInteger(migration.from) || migration.from < 0 || !Number.isSafeInteger(migration.to) || migration.to !== migration.from + 1 || typeof migration.apply !== "function" || seen.has(migration.from)) throw new TypeError("invalid migration");
      seen.add(migration.from);
    }
  }

  validate(initial, migrations);
  const steps = new Map(migrations.map(({ from, to, apply }) => [from, { from, to, apply }]));
  let state = { version: initial.version, values: { ...initial.values } };
  const snapshot = () => ({ version: state.version, values: { ...state.values } });
  return {
    snapshot,
    migrateTo(target) {
      if (!Number.isSafeInteger(target) || target < 0) throw new TypeError("invalid target");
      if (target < state.version) throw new RangeError("downgrade");
      let version = state.version;
      let values = { ...state.values };
      while (version < target) {
        const migration = steps.get(version);
        if (migration === undefined) throw new TypeError("missing migration");
        const output = migration.apply({ ...values });
        if (!isFlatValues(output)) throw new TypeError("invalid migration output");
        values = { ...output };
        version = migration.to;
      }
      state = { version, values };
      return snapshot();
    },
  };
}
