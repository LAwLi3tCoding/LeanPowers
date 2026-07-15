import assert from "node:assert/strict";
import test from "node:test";

import * as directApi from "../src/stable-priority-merge.mjs";
import * as publicApi from "../src/index.mjs";

const { mergeStablePriorityItems } = directApi;

test("merges globally and sorts winners by descending priority", () => {
  assert.deepEqual(
    mergeStablePriorityItems([
      [
        { id: "low", priority: 1, value: "low" },
        { id: "tie-a", priority: 5, value: "a" },
        { id: "duplicate", priority: 2, value: "old" },
      ],
      [
        { id: "tie-b", priority: 5, value: "b" },
        { id: "high", priority: 9, value: "high" },
        { id: "duplicate", priority: 7, value: "new" },
      ],
      [{ id: "tie-c", priority: 5, value: "c" }],
    ]),
    [
      { id: "high", priority: 9, value: "high" },
      { id: "duplicate", priority: 7, value: "new" },
      { id: "tie-a", priority: 5, value: "a" },
      { id: "tie-b", priority: 5, value: "b" },
      { id: "tie-c", priority: 5, value: "c" },
      { id: "low", priority: 1, value: "low" },
    ],
  );
});

test("uses the winning record encounter to stabilize equal priorities", () => {
  assert.deepEqual(
    mergeStablePriorityItems([[
      { id: "promoted", priority: 1, value: "old" },
      { id: "peer", priority: 8, value: "peer" },
      { id: "promoted", priority: 8, value: "winner" },
    ]]),
    [
      { id: "peer", priority: 8, value: "peer" },
      { id: "promoted", priority: 8, value: "winner" },
    ],
  );
});

test("keeps the earliest encounter for equal-priority duplicates", () => {
  const firstValue = { source: "first" };
  const laterValue = { source: "later" };
  assert.deepEqual(
    mergeStablePriorityItems([
      [{ id: "same", priority: 4, value: firstValue }],
      [{ id: "same", priority: 4, value: laterValue }],
    ]),
    [{ id: "same", priority: 4, value: firstValue }],
  );
});

test("rejects sparse lanes and non-exact non-ordinary records", () => {
  const sparseLanes = [];
  sparseLanes.length = 1;
  const sparseLane = [];
  sparseLane.length = 1;
  const inherited = Object.create({ id: "item", priority: 1, value: null });
  class Item {
    constructor() {
      this.id = "item";
      this.priority = 1;
      this.value = null;
    }
  }
  const nullPrototype = Object.assign(Object.create(null), {
    id: "item",
    priority: 1,
    value: null,
  });
  const accessor = { id: "item", priority: 1 };
  Object.defineProperty(accessor, "value", { enumerable: true, get: () => null });
  const symbolExtra = { id: "item", priority: 1, value: null };
  symbolExtra[Symbol("extra")] = true;

  for (const value of [
    sparseLanes,
    [sparseLane],
    [[[]]],
    [[new Item()]],
    [[inherited]],
    [[nullPrototype]],
    [[accessor]],
    [[symbolExtra]],
    [[{ id: "item", priority: 1 }]],
    [[{ id: "item", priority: 1, value: null, extra: true }]],
    [[{ id: new String("item"), priority: 1, value: null }]],
    [[{ id: "item", priority: NaN, value: null }]],
    [[{ id: "item", priority: Infinity, value: null }]],
    [[{ id: "item", priority: Number.MIN_SAFE_INTEGER - 1, value: null }]],
  ]) {
    assert.throws(() => mergeStablePriorityItems(value), TypeError);
  }
});

test("accepts safe-integer boundaries and any value", () => {
  const reference = { retained: true };
  assert.deepEqual(
    mergeStablePriorityItems([[
      { id: "minimum", priority: Number.MIN_SAFE_INTEGER, value: undefined },
      { id: "maximum", priority: Number.MAX_SAFE_INTEGER, value: reference },
    ]]),
    [
      { id: "maximum", priority: Number.MAX_SAFE_INTEGER, value: reference },
      { id: "minimum", priority: Number.MIN_SAFE_INTEGER, value: undefined },
    ],
  );
});

test("does not mutate inputs and returns fresh records", () => {
  const first = Object.freeze({ id: "first", priority: 2, value: "first" });
  const second = Object.freeze({ id: "second", priority: 6, value: "second" });
  const lane = Object.freeze([first, second]);
  const lanes = Object.freeze([lane]);
  const result = mergeStablePriorityItems(lanes);

  assert.deepEqual(result, [
    { id: "second", priority: 6, value: "second" },
    { id: "first", priority: 2, value: "first" },
  ]);
  assert.deepEqual(lanes, [lane]);
  assert.notEqual(result[0], second);
  assert.notEqual(result[1], first);
  result[0].priority = -10;
  assert.equal(second.priority, 6);
});

test("preserves the exact direct and public named export surface", () => {
  assert.equal(publicApi.mergeStablePriorityItems, mergeStablePriorityItems);
  assert.deepEqual(Object.keys(directApi), ["mergeStablePriorityItems"]);
  assert.deepEqual(Object.keys(publicApi), ["mergeStablePriorityItems"]);
});
