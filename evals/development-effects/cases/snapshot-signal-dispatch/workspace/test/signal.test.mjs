import assert from "node:assert/strict";
import test from "node:test";

import { createSignal } from "../src/index.mjs";

test("delivers a value and supports idempotent later unsubscribe", async () => {
  const values = [];
  const signal = createSignal();
  const unsubscribe = signal.subscribe((value) => values.push(value));

  signal.emit("first");
  await Promise.resolve();
  assert.deepEqual(values, ["first"]);

  unsubscribe();
  unsubscribe();
  signal.emit("second");
  await Promise.resolve();
  assert.deepEqual(values, ["first"]);
});

test("rejects non-function listeners and keeps the public named export", () => {
  const signal = createSignal();
  assert.throws(() => signal.subscribe(null), TypeError);
  assert.equal(typeof createSignal, "function");
});
