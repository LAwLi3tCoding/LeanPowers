import assert from "node:assert/strict";
import test from "node:test";

import { createRingBuffer } from "../src/index.mjs";

test("collects values before reaching capacity", () => {
  const buffer = createRingBuffer(3);
  const first = { id: "first" };
  const second = { id: "second" };

  assert.equal(buffer.push(first), undefined);
  assert.equal(buffer.push(second), undefined);
  assert.deepEqual(buffer.values(), [first, second]);
});

test("clear empties a buffer that has not wrapped", () => {
  const buffer = createRingBuffer(3);
  buffer.push("a");
  buffer.push("b");

  assert.equal(buffer.clear(), undefined);
  assert.deepEqual(buffer.values(), []);
});

test("rejects basic invalid capacities", () => {
  for (const capacity of [undefined, null, 0, -1, 1.5, "3"]) {
    assert.throws(() => createRingBuffer(capacity), TypeError);
  }
});

test("keeps createRingBuffer as the public named export", async () => {
  const direct = await import("../src/ring-buffer.mjs");
  const publicApi = await import("../src/index.mjs");

  assert.equal(publicApi.createRingBuffer, direct.createRingBuffer);
  assert.deepEqual(Object.keys(direct), ["createRingBuffer"]);
  assert.deepEqual(Object.keys(publicApi), ["createRingBuffer"]);
});
