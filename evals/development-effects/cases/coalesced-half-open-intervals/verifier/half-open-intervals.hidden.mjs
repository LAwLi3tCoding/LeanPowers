import assert from "node:assert/strict";
import test from "node:test";

import * as directApi from "../src/half-open-intervals.mjs";
import * as publicApi from "../src/index.mjs";

const { coalesceHalfOpenIntervals } = directApi;

test("sorts a copy and coalesces maximal overlapping intervals", () => {
  assert.deepEqual(
    coalesceHalfOpenIntervals([
      [11, 15],
      [2, 6],
      [4, 9],
      [0, 3],
      [17, 20],
      [12, 13],
    ]),
    [
      [0, 9],
      [11, 15],
      [17, 20],
    ],
  );
});

test("coalesces adjacent non-empty intervals but never bridges a gap", () => {
  assert.deepEqual(
    coalesceHalfOpenIntervals([
      [8, 11],
      [0, 2],
      [5, 8],
      [2, 5],
      [12, 14],
    ]),
    [
      [0, 11],
      [12, 14],
    ],
  );
});

test("keeps zero-length points independent and deduplicates only exact points", () => {
  assert.deepEqual(
    coalesceHalfOpenIntervals([
      [8, 9],
      [5, 5],
      [0, 3],
      [3, 6],
      [1, 1],
      [5, 5],
      [6, 8],
      [3, 3],
      [8, 8],
      [6, 6],
    ]),
    [
      [0, 9],
      [1, 1],
      [3, 3],
      [5, 5],
      [6, 6],
      [8, 8],
    ],
  );

  assert.deepEqual(
    coalesceHalfOpenIntervals([
      [2, 4],
      [2, 2],
      [4, 4],
    ]),
    [
      [2, 2],
      [2, 4],
      [4, 4],
    ],
  );
});

test("rejects sparse, inexact, and invalid tuples", () => {
  const sparseCollection = [];
  sparseCollection.length = 1;

  const sparseTuple = [];
  sparseTuple.length = 2;
  sparseTuple[1] = 2;

  for (const value of [
    sparseCollection,
    [sparseTuple],
    [[0, 1, 2]],
    [{ 0: 0, 1: 1, length: 2 }],
    [[0, "1"]],
    [[0, NaN]],
    [[0, Infinity]],
    [[0, -1]],
    [[0.5, 1]],
    [[Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER + 1]],
  ]) {
    assert.throws(() => coalesceHalfOpenIntervals(value), TypeError);
  }
});

test("does not mutate inputs and returns fresh tuples", () => {
  const first = Object.freeze([4, 7]);
  const second = Object.freeze([1, 3]);
  const third = Object.freeze([3, 4]);
  const point = Object.freeze([4, 4]);
  const intervals = Object.freeze([first, second, point, third]);

  const result = coalesceHalfOpenIntervals(intervals);

  assert.deepEqual(result, [
    [1, 7],
    [4, 4],
  ]);
  assert.deepEqual(intervals, [first, second, point, third]);
  assert.notEqual(result, intervals);
  for (const tuple of result) {
    assert.ok(!intervals.includes(tuple));
  }
});

test("supports the non-negative safe-integer boundary", () => {
  const maximum = Number.MAX_SAFE_INTEGER;

  assert.deepEqual(
    coalesceHalfOpenIntervals([
      [maximum - 2, maximum - 1],
      [maximum - 1, maximum],
      [0, 0],
    ]),
    [
      [0, 0],
      [maximum - 2, maximum],
    ],
  );
});

test("preserves the exact direct and public named export surface", () => {
  assert.equal(publicApi.coalesceHalfOpenIntervals, coalesceHalfOpenIntervals);
  assert.deepEqual(Object.keys(directApi), ["coalesceHalfOpenIntervals"]);
  assert.deepEqual(Object.keys(publicApi), ["coalesceHalfOpenIntervals"]);
});
