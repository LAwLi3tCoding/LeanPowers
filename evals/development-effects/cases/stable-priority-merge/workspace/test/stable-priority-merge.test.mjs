import assert from "node:assert/strict";
import test from "node:test";

import { mergeStablePriorityItems } from "../src/index.mjs";

test("keeps empty and single already-ordered input", () => {
  assert.deepEqual(mergeStablePriorityItems([]), []);
  assert.deepEqual(mergeStablePriorityItems([[]]), []);
  assert.deepEqual(
    mergeStablePriorityItems([[], [{ id: "only", priority: 3, value: "value" }]]),
    [{ id: "only", priority: 3, value: "value" }],
  );
});

test("rejects basic invalid collections and item fields", () => {
  for (const value of [
    null,
    "lane",
    [null],
    [[null]],
    [[{ id: "", priority: 1, value: null }]],
    [[{ id: 1, priority: 1, value: null }]],
    [[{ id: "item", priority: 1.5, value: null }]],
    [[{ id: "item", priority: Number.MAX_SAFE_INTEGER + 1, value: null }]],
  ]) {
    assert.throws(() => mergeStablePriorityItems(value), TypeError);
  }
});
