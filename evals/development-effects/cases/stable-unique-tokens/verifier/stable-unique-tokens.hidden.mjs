import assert from "node:assert/strict";
import test from "node:test";

import * as directApi from "../src/stable-unique-tokens.mjs";
import * as publicApi from "../src/index.mjs";

const { stableUniqueTokens } = directApi;

test("keeps the first exact occurrence in encounter order", () => {
  assert.deepEqual(
    stableUniqueTokens(["z", "a", "z", "m", "a"]),
    ["z", "a", "m"],
  );
  assert.deepEqual(stableUniqueTokens(["A", "a", "A"]), ["A", "a"]);
});

test("rejects invalid tokens without coercion", () => {
  let coercions = 0;
  const coercible = {
    toString() {
      coercions += 1;
      return "coerced";
    },
  };
  const invalid = [
    [1],
    [new String("boxed")],
    [coercible],
    [""],
    ["contains space"],
    ["slash/value"],
    ["ümlaut"],
  ];

  for (const value of invalid) {
    assert.throws(() => stableUniqueTokens(value), TypeError);
  }
  assert.equal(coercions, 0);
});

test("validates the exact dense array surface without invoking accessors", () => {
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

  for (const value of [
    sparse,
    extraString,
    extraSymbol,
    nonEnumerable,
    accessor,
    customPrototype,
  ]) {
    assert.throws(() => stableUniqueTokens(value), TypeError);
  }
  assert.equal(getterReads, 0);
});

test("returns fresh dense ordinary arrays and preserves the input", () => {
  const input = ["beta", "alpha", "beta"];
  const descriptorsBefore = Object.getOwnPropertyDescriptors(input);
  const first = stableUniqueTokens(input);
  const second = stableUniqueTokens(input);

  assert.deepEqual(first, ["beta", "alpha"]);
  assert.notEqual(first, input);
  assert.notEqual(second, input);
  assert.notEqual(second, first);
  assert.equal(Object.getPrototypeOf(first), Array.prototype);
  assert.deepEqual(Reflect.ownKeys(first), ["0", "1", "length"]);
  assert.deepEqual(
    Object.getOwnPropertyDescriptors(input),
    descriptorsBefore,
  );

  first.push("later");
  assert.deepEqual(second, ["beta", "alpha"]);
  assert.deepEqual(input, ["beta", "alpha", "beta"]);
});

test("preserves the exact direct and public named export surfaces", () => {
  assert.equal(publicApi.stableUniqueTokens, stableUniqueTokens);
  assert.deepEqual(Object.keys(directApi), ["stableUniqueTokens"]);
  assert.deepEqual(Object.keys(publicApi), ["stableUniqueTokens"]);
});
