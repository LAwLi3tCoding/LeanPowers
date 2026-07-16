import assert from "node:assert/strict";
import test from "node:test";

import * as directApi from "../src/cyclic-sequence-rotation.mjs";
import * as publicApi from "../src/index.mjs";

// This verifier exercises only the frozen public contract.
const { rotateSequence } = directApi;

test("rotates left while preserving element references", () => {
  const first = { id: "first" };
  const second = { id: "second" };
  const third = { id: "third" };
  const fourth = { id: "fourth" };
  const result = rotateSequence([first, second, third, fourth], 1);

  assert.deepEqual(result, [second, third, fourth, first]);
  assert.equal(result[0], second);
  assert.equal(result[3], first);
});

test("normalizes negative and oversized offsets with mathematical modulo", () => {
  const values = [0, 1, 2, 3];
  assert.deepEqual(rotateSequence(values, -1), [3, 0, 1, 2]);
  assert.deepEqual(rotateSequence(values, -6), [2, 3, 0, 1]);
  assert.deepEqual(rotateSequence(values, 6), [2, 3, 0, 1]);
  assert.deepEqual(rotateSequence(values, 8), values);
});

test("returns a fresh array without changing input descriptors", () => {
  const first = { id: "first" };
  const second = { id: "second" };
  const values = [first, second];
  Object.defineProperty(values, "0", {
    configurable: false,
    enumerable: true,
    value: first,
    writable: false,
  });
  const before = Object.getOwnPropertyDescriptors(values);

  const zero = rotateSequence(values, 0);
  const rotated = rotateSequence(values, 1);
  assert.notEqual(zero, values);
  assert.notEqual(rotated, values);
  assert.deepEqual(zero, [first, second]);
  assert.deepEqual(rotated, [second, first]);
  assert.deepEqual(Object.getOwnPropertyDescriptors(values), before);
});

test("validates dense arrays exactly without invoking element accessors", () => {
  const sparse = [];
  sparse.length = 1;
  const extra = ["value"];
  extra.extra = true;
  const symbolExtra = ["value"];
  symbolExtra[Symbol("extra")] = true;
  const hiddenExtra = ["value"];
  Object.defineProperty(hiddenExtra, "extra", { value: true });
  let getterCalls = 0;
  const accessor = [];
  Object.defineProperty(accessor, "0", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return "value";
    },
  });
  accessor.length = 1;

  for (const invalid of [sparse, extra, symbolExtra, hiddenExtra, accessor]) {
    assert.throws(() => rotateSequence(invalid, 1), TypeError);
  }
  for (const offset of [NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => rotateSequence([], offset), TypeError);
  }
  assert.equal(getterCalls, 0);
});

test("preserves the exact direct and public named export surfaces", () => {
  assert.equal(publicApi.rotateSequence, rotateSequence);
  assert.deepEqual(Object.keys(directApi), ["rotateSequence"]);
  assert.deepEqual(Object.keys(publicApi), ["rotateSequence"]);
});
