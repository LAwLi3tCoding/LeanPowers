import assert from "node:assert/strict";
import test from "node:test";

import * as directApi from "../src/weighted-round-robin-interleave.mjs";
import * as publicApi from "../src/index.mjs";

const { interleaveWeightedLanes } = directApi;

test("takes each lane weight per round in outer lane order", () => {
  assert.deepEqual(
    interleaveWeightedLanes([
      { weight: 2, items: ["a1", "a2", "a3", "a4", "a5"] },
      { weight: 1, items: ["b1", "b2", "b3"] },
      { weight: 3, items: ["c1", "c2", "c3", "c4"] },
    ]),
    [
      "a1", "a2", "b1", "c1", "c2", "c3",
      "a3", "a4", "b2", "c4",
      "a5", "b3",
    ],
  );
});

test("continues rounds after earlier lanes are exhausted", () => {
  assert.deepEqual(
    interleaveWeightedLanes([
      { weight: 4, items: ["short"] },
      { weight: 2, items: ["long-1", "long-2", "long-3", "long-4", "long-5"] },
      { weight: 1, items: [] },
    ]),
    ["short", "long-1", "long-2", "long-3", "long-4", "long-5"],
  );

  assert.deepEqual(
    interleaveWeightedLanes([
      { weight: 1, items: ["z1", "z2"] },
      { weight: 1, items: ["a1", "a2"] },
    ]),
    ["z1", "a1", "z2", "a2"],
  );
});

test("returns a fresh dense output while preserving item references", () => {
  const objectValue = { id: 1 };
  const functionValue = () => "kept";
  const lanes = [
    { weight: 1, items: [objectValue, undefined] },
    { weight: 1, items: [functionValue, null] },
  ];
  const first = interleaveWeightedLanes(lanes);
  const second = interleaveWeightedLanes(lanes);

  assert.deepEqual(first, [objectValue, functionValue, undefined, null]);
  assert.notEqual(first, second);
  assert.equal(first[0], objectValue);
  assert.equal(first[1], functionValue);
  assert.deepEqual(Reflect.ownKeys(first), ["0", "1", "2", "3", "length"]);
  first.push("caller-change");
  assert.deepEqual(second, [objectValue, functionValue, undefined, null]);
  assert.deepEqual(lanes[0].items, [objectValue, undefined]);
});

test("does not modify mutable or frozen input structures", () => {
  const mutable = [
    { weight: 2, items: ["a", "b", "c"] },
    { weight: 1, items: ["x", "y"] },
  ];
  const before = structuredClone(mutable);
  assert.deepEqual(interleaveWeightedLanes(mutable), ["a", "b", "x", "c", "y"]);
  assert.deepEqual(mutable, before);

  const frozen = Object.freeze([
    Object.freeze({ weight: 1, items: Object.freeze(["a", "b"]) }),
    Object.freeze({ weight: 2, items: Object.freeze(["x", "y", "z"]) }),
  ]);
  assert.deepEqual(interleaveWeightedLanes(frozen), ["a", "x", "y", "b", "z"]);
});

test("requires a dense outer array with only own data elements", () => {
  let reads = 0;
  const sparse = [];
  sparse.length = 1;
  const stringExtra = [{ weight: 1, items: [] }];
  stringExtra.extra = true;
  const symbolExtra = [{ weight: 1, items: [] }];
  symbolExtra[Symbol("extra")] = true;
  const nonEnumerableExtra = [{ weight: 1, items: [] }];
  Object.defineProperty(nonEnumerableExtra, "extra", { value: true });
  const accessor = [];
  Object.defineProperty(accessor, "0", {
    enumerable: true,
    get() {
      reads += 1;
      return { weight: 1, items: [] };
    },
  });
  accessor.length = 1;

  for (const lanes of [sparse, stringExtra, symbolExtra, nonEnumerableExtra, accessor]) {
    assert.throws(() => interleaveWeightedLanes(lanes), TypeError);
  }
  assert.equal(reads, 0);
});

test("requires exact ordinary lane records and positive safe weights", () => {
  class Lane {
    constructor() {
      this.weight = 1;
      this.items = [];
    }
  }
  const inherited = Object.create({ weight: 1, items: [] });
  const nullPrototype = Object.assign(Object.create(null), { weight: 1, items: [] });
  const accessor = { items: [] };
  Object.defineProperty(accessor, "weight", {
    enumerable: true,
    get() {
      throw new Error("must not read accessor");
    },
  });
  const symbolExtra = { weight: 1, items: [] };
  symbolExtra[Symbol("extra")] = true;

  for (const lane of [
    null,
    [],
    new Lane(),
    inherited,
    nullPrototype,
    accessor,
    { weight: 1 },
    { weight: 1, items: [], extra: true },
    symbolExtra,
    { weight: 0, items: [] },
    { weight: -1, items: [] },
    { weight: 1.5, items: [] },
    { weight: Number.MAX_SAFE_INTEGER + 1, items: [] },
    { weight: 1n, items: [] },
  ]) {
    assert.throws(() => interleaveWeightedLanes([lane]), TypeError);
  }
});

test("requires each items array to be dense and free of extra or accessor keys", () => {
  let reads = 0;
  const sparse = ["first"];
  sparse.length = 2;
  const stringExtra = ["first"];
  stringExtra.extra = true;
  const symbolExtra = ["first"];
  symbolExtra[Symbol("extra")] = true;
  const nonEnumerableExtra = ["first"];
  Object.defineProperty(nonEnumerableExtra, "extra", { value: true });
  const accessor = [];
  Object.defineProperty(accessor, "0", {
    enumerable: true,
    get() {
      reads += 1;
      return "value";
    },
  });
  accessor.length = 1;

  for (const items of [null, {}, sparse, stringExtra, symbolExtra, nonEnumerableExtra, accessor]) {
    assert.throws(
      () => interleaveWeightedLanes([{ weight: 1, items }]),
      TypeError,
    );
  }
  assert.equal(reads, 0);
});

test("preserves the exact direct and public named export surfaces", () => {
  assert.equal(publicApi.interleaveWeightedLanes, interleaveWeightedLanes);
  assert.deepEqual(Object.keys(directApi), ["interleaveWeightedLanes"]);
  assert.deepEqual(Object.keys(publicApi), ["interleaveWeightedLanes"]);
});
