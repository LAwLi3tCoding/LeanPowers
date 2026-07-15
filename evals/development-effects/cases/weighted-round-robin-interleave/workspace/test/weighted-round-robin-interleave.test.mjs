import assert from "node:assert/strict";
import test from "node:test";

import { interleaveWeightedLanes } from "../src/index.mjs";

test("returns empty and single-lane values in lane order", () => {
  assert.deepEqual(interleaveWeightedLanes([]), []);
  assert.deepEqual(
    interleaveWeightedLanes([{ weight: 2, items: ["a", "b", "c"] }]),
    ["a", "b", "c"],
  );
});

test("rejects a non-array lane collection", () => {
  for (const value of [null, {}, "lanes"]) {
    assert.throws(() => interleaveWeightedLanes(value), TypeError);
  }
});
