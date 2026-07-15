import assert from "node:assert/strict";
import test from "node:test";

import { createBatcher } from "../src/index.mjs";

test("delivers added values in insertion order and reports success", async () => {
  const deliveries = [];
  const batcher = createBatcher((batch) => deliveries.push([...batch]));

  batcher.add("first");
  batcher.add("second");
  assert.equal(batcher.flush(), true);
  await Promise.resolve();

  assert.deepEqual(deliveries, [["first", "second"]]);
});

test("validates deliver and keeps the public named export", () => {
  assert.throws(() => createBatcher(null), TypeError);
  assert.equal(typeof createBatcher, "function");
});
