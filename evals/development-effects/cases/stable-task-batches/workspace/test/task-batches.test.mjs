import assert from "node:assert/strict";
import test from "node:test";

import { scheduleTaskBatches } from "../src/index.mjs";

test("keeps an empty schedule and one input-ordered independent batch", () => {
  assert.deepEqual(scheduleTaskBatches([]), []);
  assert.deepEqual(
    scheduleTaskBatches([
      { id: "compile", dependsOn: [] },
      { id: "test", dependsOn: [] },
    ]),
    [["compile", "test"]],
  );
});

test("rejects a non-array task collection", () => {
  for (const value of [null, {}, "compile"]) {
    assert.throws(() => scheduleTaskBatches(value), TypeError);
  }
});
