import assert from "node:assert/strict";
import test from "node:test";

import * as directApi from "../src/integer-ranges.mjs";
import * as publicApi from "../src/index.mjs";

const { formatIntegerRanges } = directApi;

test("normalizes order, duplicates, and mixed runs", () => {
  assert.equal(
    formatIntegerRanges([12, 3, 4, 3, 8, 9, 10]),
    "3-4,8-10,12",
  );
});

test("compacts exactly two values and longer maximal runs", () => {
  assert.equal(formatIntegerRanges([4, 5]), "4-5");
  assert.equal(formatIntegerRanges([9, 1, 2, 3, 6, 7]), "1-3,6-7,9");
});

test("does not bridge a missing integer", () => {
  assert.equal(formatIntegerRanges([1, 3, 4, 7]), "1,3-4,7");
});

test("does not mutate caller-owned input", () => {
  const values = [5, 2, 3, 2, 8];
  const before = [...values];

  assert.equal(formatIntegerRanges(values), "2-3,5,8");
  assert.deepEqual(values, before);
});

test("supports safe-integer boundaries and preserves validation", () => {
  const maximum = Number.MAX_SAFE_INTEGER;
  const sparse = [];
  sparse[1] = 1;

  assert.equal(
    formatIntegerRanges([maximum, maximum - 1, 0]),
    `0,${maximum - 1}-${maximum}`,
  );

  for (const value of [sparse, [0, Infinity], [0, NaN], [0, -1], [0, 0.5]]) {
    assert.throws(() => formatIntegerRanges(value), TypeError);
  }
});

test("preserves the exact direct and public named export surface", () => {
  assert.equal(publicApi.formatIntegerRanges, formatIntegerRanges);
  assert.deepEqual(Object.keys(directApi), ["formatIntegerRanges"]);
  assert.deepEqual(Object.keys(publicApi), ["formatIntegerRanges"]);
});
