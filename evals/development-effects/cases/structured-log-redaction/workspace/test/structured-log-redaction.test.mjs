import assert from "node:assert/strict";
import test from "node:test";

import { redactStructuredLog } from "../src/index.mjs";

test("redacts selected top-level fields without changing the input", () => {
  const record = {
    event: "sign-in",
    ["password"]: "open-sesame",
    attempts: 2,
  };

  assert.deepEqual(redactStructuredLog(record, ["password"]), {
    event: "sign-in",
    ["password"]: "[REDACTED]",
    attempts: 2,
  });
  assert.deepEqual(record, {
    event: "sign-in",
    ["password"]: "open-sesame",
    attempts: 2,
  });
});

test("requires an object record and at least one string key", () => {
  assert.throws(() => redactStructuredLog(null, ["password"]), TypeError);
  assert.throws(() => redactStructuredLog("event", ["password"]), TypeError);
  assert.throws(() => redactStructuredLog({}, []), TypeError);
  assert.throws(() => redactStructuredLog({}, [1]), TypeError);
});
