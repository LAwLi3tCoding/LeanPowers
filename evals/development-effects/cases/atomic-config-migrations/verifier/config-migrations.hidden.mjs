import assert from "node:assert/strict";
import test from "node:test";

import * as directApi from "../src/config-migrations.mjs";
import * as publicApi from "../src/index.mjs";

const { createMigratingConfig } = directApi;

const step = (from, apply) => ({ from, to: from + 1, apply });

function invalidFlatValues() {
  const accessor = {};
  Object.defineProperty(accessor, "derived", {
    enumerable: true,
    get: () => "invalid",
  });
  const symbolKey = { mode: "safe" };
  symbolKey[Symbol("extra")] = "invalid";
  const nonEnumerable = {};
  Object.defineProperty(nonEnumerable, "hidden", {
    enumerable: false,
    value: "invalid",
  });

  return [
    { callback: () => "invalid" },
    accessor,
    symbolKey,
    nonEnumerable,
  ];
}

test("applies a shuffled contiguous chain in version order", () => {
  const order = [];
  const initial = { version: 0, values: { trace: "" } };
  const migrations = [
    step(1, (values) => {
      order.push(1);
      return { trace: `${values.trace}B` };
    }),
    step(0, (values) => {
      order.push(0);
      return { trace: `${values.trace}A` };
    }),
  ];
  const config = createMigratingConfig(initial, migrations);

  assert.deepEqual(config.migrateTo(2), {
    version: 2,
    values: { trace: "AB" },
  });
  assert.deepEqual(order, [0, 1]);
  assert.deepEqual(initial, { version: 0, values: { trace: "" } });
  assert.equal(migrations[0].from, 1);
  assert.equal(migrations[1].from, 0);
});

test("a thrown later step propagates unchanged and commits nothing", () => {
  const failure = new Error("migration failed");
  const initial = { version: 0, values: { count: 0 } };
  const config = createMigratingConfig(initial, [
    step(0, (values) => {
      values.count += 1;
      return values;
    }),
    step(1, (values) => {
      values.count += 1;
      throw failure;
    }),
  ]);

  assert.throws(() => config.migrateTo(2), (error) => error === failure);
  assert.deepEqual(config.snapshot(), {
    version: 0,
    values: { count: 0 },
  });
  assert.deepEqual(initial, { version: 0, values: { count: 0 } });
});

test("a missing step rejects the entire attempted chain", () => {
  const initial = { version: 0, values: { count: 0 } };
  const config = createMigratingConfig(initial, [
    step(0, (values) => ({ count: values.count + 1 })),
    step(2, (values) => ({ count: values.count + 10 })),
  ]);

  assert.throws(() => config.migrateTo(3), TypeError);
  assert.deepEqual(config.snapshot(), {
    version: 0,
    values: { count: 0 },
  });
  assert.deepEqual(initial, { version: 0, values: { count: 0 } });
});

test("rejects invalid migration output without committing staged work", () => {
  const invalidOutputs = [
    null,
    [],
    Object.create(null),
    { nested: {} },
    ...invalidFlatValues(),
  ];

  for (const output of invalidOutputs) {
    const initial = { version: 0, values: { mode: "safe" } };
    const config = createMigratingConfig(initial, [
      step(0, () => ({ mode: "staged" })),
      step(1, () => output),
    ]);

    assert.throws(() => config.migrateTo(2), TypeError);
    assert.deepEqual(config.snapshot(), {
      version: 0,
      values: { mode: "safe" },
    });
    assert.deepEqual(initial, { version: 0, values: { mode: "safe" } });
  }
});

test("accepts every flat primitive in initial and migrated values", () => {
  const initialSymbol = Symbol("initial");
  const migratedSymbol = Symbol("migrated");
  const initial = {
    version: 0,
    values: {
      text: "initial",
      count: 1,
      enabled: true,
      absent: null,
      optional: undefined,
      large: 1n,
      marker: initialSymbol,
    },
  };
  const config = createMigratingConfig(initial, [
    step(0, () => ({
      text: "migrated",
      count: 2,
      enabled: false,
      absent: null,
      optional: undefined,
      large: 2n,
      marker: migratedSymbol,
    })),
  ]);

  assert.deepEqual(config.snapshot(), initial);
  assert.deepEqual(config.migrateTo(1), {
    version: 1,
    values: {
      text: "migrated",
      count: 2,
      enabled: false,
      absent: null,
      optional: undefined,
      large: 2n,
      marker: migratedSymbol,
    },
  });
});

test("each apply receives a fresh values copy and cannot mutate earlier state", () => {
  const initial = { version: 0, values: { count: 0 } };
  const received = [];
  const config = createMigratingConfig(initial, [
    step(0, (values) => {
      received.push(values);
      values.count = 1;
      return values;
    }),
    step(1, (values) => {
      received.push(values);
      values.count = 2;
      return values;
    }),
  ]);

  const result = config.migrateTo(2);
  assert.notEqual(received[0], initial.values);
  assert.notEqual(received[1], received[0]);
  assert.notEqual(result.values, received[1]);
  assert.deepEqual(result, { version: 2, values: { count: 2 } });
  assert.deepEqual(initial, { version: 0, values: { count: 0 } });
});

test("snapshot and migrate results are always fresh objects", () => {
  const config = createMigratingConfig(
    { version: 0, values: { mode: "safe" } },
    [],
  );
  const first = config.snapshot();
  const second = config.snapshot();
  const migrated = config.migrateTo(0);

  assert.notEqual(first, second);
  assert.notEqual(first.values, second.values);
  assert.notEqual(migrated, first);
  assert.notEqual(migrated, second);
  assert.notEqual(migrated.values, first.values);
  first.values.mode = "mutated";
  assert.deepEqual(config.snapshot(), {
    version: 0,
    values: { mode: "safe" },
  });
});

test("rejects downgrades and invalid targets without changing state", () => {
  const config = createMigratingConfig(
    { version: 2, values: { mode: "safe" } },
    [],
  );

  assert.throws(() => config.migrateTo(1), RangeError);
  for (const target of [-1, 1.5, Infinity, NaN, "2", null]) {
    assert.throws(() => config.migrateTo(target), TypeError);
  }
  assert.deepEqual(config.snapshot(), {
    version: 2,
    values: { mode: "safe" },
  });
});

test("validates exact ordinary initial and migration records", () => {
  const validInitial = { version: 0, values: {} };
  const validApply = (values) => values;
  const invalidInitials = [
    null,
    {},
    { version: 0 },
    { version: 0, values: {}, extra: true },
    { version: -1, values: {} },
    { version: 1.5, values: {} },
    { version: 0, values: [] },
    { version: 0, values: Object.create(null) },
    { version: 0, values: { nested: {} } },
    Object.assign(Object.create(null), { version: 0, values: {} }),
    ...invalidFlatValues().map((values) => ({ version: 0, values })),
  ];
  for (const initial of invalidInitials) {
    assert.throws(() => createMigratingConfig(initial, []), TypeError);
  }

  const sparse = [];
  sparse.length = 1;
  const withExtra = [];
  withExtra.extra = true;
  const invalidMigrations = [
    null,
    {},
    sparse,
    withExtra,
    [{ from: 0, to: 1 }],
    [{ from: 0, to: 1, apply: validApply, extra: true }],
    [{ from: -1, to: 0, apply: validApply }],
    [{ from: 0, to: 2, apply: validApply }],
    [{ from: 0, to: 1, apply: null }],
    [step(0, validApply), step(0, validApply)],
    [Object.assign(Object.create(null), step(0, validApply))],
  ];
  for (const migrations of invalidMigrations) {
    assert.throws(
      () => createMigratingConfig(validInitial, migrations),
      TypeError,
    );
  }
});

test("preserves exact methods and direct/public named exports", () => {
  const config = createMigratingConfig(
    { version: 0, values: {} },
    [],
  );

  assert.equal(publicApi.createMigratingConfig, createMigratingConfig);
  assert.deepEqual(Object.keys(directApi), ["createMigratingConfig"]);
  assert.deepEqual(Object.keys(publicApi), ["createMigratingConfig"]);
  assert.deepEqual(Object.keys(config), ["snapshot", "migrateTo"]);
});
