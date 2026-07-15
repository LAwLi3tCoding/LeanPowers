import assert from "node:assert/strict";
import test from "node:test";

import { createMigratingConfig } from "../src/index.mjs";

test("constructs a versioned config and exposes its snapshot", () => {
  const config = createMigratingConfig(
    { version: 0, values: { region: "us" } },
    [],
  );

  assert.deepEqual(config.snapshot(), {
    version: 0,
    values: { region: "us" },
  });
});

test("applies a simple contiguous migration chain", () => {
  const config = createMigratingConfig(
    { version: 0, values: { count: 1, mode: "safe" } },
    [
      {
        from: 0,
        to: 1,
        apply: (values) => ({ ...values, count: values.count + 1 }),
      },
      {
        from: 1,
        to: 2,
        apply: (values) => ({ ...values, mode: "fast" }),
      },
    ],
  );

  assert.deepEqual(config.migrateTo(2), {
    version: 2,
    values: { count: 2, mode: "fast" },
  });
  assert.deepEqual(config.snapshot(), {
    version: 2,
    values: { count: 2, mode: "fast" },
  });
});

test("rejects malformed top-level construction inputs", () => {
  assert.throws(() => createMigratingConfig(null, []), TypeError);
  assert.throws(
    () => createMigratingConfig({ version: 0, values: {} }, {}),
    TypeError,
  );
});
