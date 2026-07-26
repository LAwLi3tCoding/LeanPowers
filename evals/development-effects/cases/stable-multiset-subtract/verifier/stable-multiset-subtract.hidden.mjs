import assert from "node:assert/strict";
import test from "node:test";

import * as directApi from "../src/stable-multiset-subtract.mjs";
import * as publicApi from "../src/index.mjs";

const { stableMultisetSubtract } = directApi;

function descriptorSnapshot(value) {
  return Reflect.ownKeys(value).map((key) => [
    key,
    Object.getOwnPropertyDescriptor(value, key),
  ]);
}

test("subtracts exact multiset counts from left to right", () => {
  assert.deepEqual(
    stableMultisetSubtract(
      ["a", "b", "a", "c", "a", "b", "d"],
      ["a", "b", "a"],
    ),
    ["c", "a", "b", "d"],
  );
  assert.deepEqual(
    stableMultisetSubtract(["x", "y", "x", "z"], ["missing", "x"]),
    ["y", "x", "z"],
  );
});

test("preserves token case as identity", () => {
  assert.deepEqual(
    stableMultisetSubtract(["A", "a", "A", "a"], ["a", "A"]),
    ["A", "a"],
  );
  assert.deepEqual(
    stableMultisetSubtract(["A", "a", "A"], ["a", "a"]),
    ["A", "A"],
  );
});

test("returns fresh dense ordinary arrays and preserves input descriptors", () => {
  const values = ["a", "b", "a", "c"];
  const removals = ["a"];
  const valuesBefore = descriptorSnapshot(values);
  const removalsBefore = descriptorSnapshot(removals);
  const first = stableMultisetSubtract(values, removals);
  const second = stableMultisetSubtract(values, removals);

  assert.deepEqual(first, ["b", "a", "c"]);
  assert.deepEqual(second, ["b", "a", "c"]);
  assert.notEqual(first, values);
  assert.notEqual(second, values);
  assert.notEqual(second, first);
  assert.equal(Object.getPrototypeOf(first), Array.prototype);
  assert.deepEqual(Reflect.ownKeys(first), ["0", "1", "2", "length"]);
  assert.deepEqual(descriptorSnapshot(values), valuesBefore);
  assert.deepEqual(descriptorSnapshot(removals), removalsBefore);
});

test("rejects non-exact array surfaces without invoking accessors", () => {
  let getterReads = 0;
  const sparse = [];
  sparse.length = 1;
  const extraString = ["alpha"];
  extraString.note = true;
  const extraSymbol = ["alpha"];
  extraSymbol[Symbol("extra")] = true;
  const nonEnumerable = ["alpha"];
  Object.defineProperty(nonEnumerable, "0", {
    configurable: true,
    enumerable: false,
    value: "alpha",
    writable: true,
  });
  const accessor = [];
  Object.defineProperty(accessor, "0", {
    configurable: true,
    enumerable: true,
    get() {
      getterReads += 1;
      return "alpha";
    },
  });
  accessor.length = 1;
  const customPrototype = ["alpha"];
  Object.setPrototypeOf(customPrototype, Object.create(Array.prototype));

  for (const candidate of [
    sparse,
    extraString,
    extraSymbol,
    nonEnumerable,
    accessor,
    customPrototype,
  ]) {
    assert.throws(() => stableMultisetSubtract(candidate, []), TypeError);
    assert.throws(() => stableMultisetSubtract([], candidate), TypeError);
  }
  assert.equal(getterReads, 0);
});

test("rejects invalid tokens without coercion", () => {
  let coercions = 0;
  const coercible = {
    toString() {
      coercions += 1;
      return "coerced";
    },
  };
  for (const token of [
    "",
    "-starts-with-dash",
    ".starts-with-dot",
    "_starts-with-underscore",
    "contains space",
    "slash/value",
    "ümlaut",
    1,
    new String("boxed"),
    coercible,
  ]) {
    assert.throws(() => stableMultisetSubtract([token], []), TypeError);
    assert.throws(() => stableMultisetSubtract([], [token]), TypeError);
  }
  assert.equal(coercions, 0);
});

test("preserves the exact direct and public named export surfaces", () => {
  assert.equal(publicApi.stableMultisetSubtract, stableMultisetSubtract);
  assert.deepEqual(Object.keys(directApi), ["stableMultisetSubtract"]);
  assert.deepEqual(Object.keys(publicApi), ["stableMultisetSubtract"]);
});
