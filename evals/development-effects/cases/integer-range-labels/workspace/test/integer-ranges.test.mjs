import assert from "node:assert/strict";
import test from "node:test";

import { formatIntegerRanges } from "../src/index.mjs";

test("keeps empty, singleton, and separated integer labels", () => {
  assert.equal(formatIntegerRanges([]), "");
  assert.equal(formatIntegerRanges([4]), "4");
  assert.equal(formatIntegerRanges([2, 5, 9]), "2,5,9");
});

test("rejects invalid collections and values", () => {
  for (const value of [
    null,
    "1,2",
    [1, -1],
    [1, 1.5],
    [1, Number.MAX_SAFE_INTEGER + 1],
    [1, "2"],
  ]) {
    assert.throws(() => formatIntegerRanges(value), TypeError);
  }
});
