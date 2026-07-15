import assert from "node:assert/strict";
import test from "node:test";

import { coalesceHalfOpenIntervals } from "../src/index.mjs";

test("keeps empty and already separated ordered intervals", () => {
  assert.deepEqual(coalesceHalfOpenIntervals([]), []);
  assert.deepEqual(coalesceHalfOpenIntervals([[2, 5]]), [[2, 5]]);
  assert.deepEqual(
    coalesceHalfOpenIntervals([
      [0, 2],
      [5, 8],
      [12, 13],
    ]),
    [
      [0, 2],
      [5, 8],
      [12, 13],
    ],
  );
});

test("rejects invalid collections and interval bounds", () => {
  for (const value of [
    null,
    "0-1",
    [[0]],
    [[2, 1]],
    [[-1, 1]],
    [[0, 1.5]],
    [[0, Number.MAX_SAFE_INTEGER + 1]],
  ]) {
    assert.throws(() => coalesceHalfOpenIntervals(value), TypeError);
  }
});
