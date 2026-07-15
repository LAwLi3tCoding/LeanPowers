import assert from "node:assert/strict";
import test from "node:test";

import { splitUtf8Chunks } from "../src/index.mjs";

test("keeps empty and simple in-budget ASCII input", () => {
  assert.deepEqual(splitUtf8Chunks("", 8), []);
  assert.deepEqual(splitUtf8Chunks("ok", 8), ["ok"]);
});

test("rejects basic argument type and byte-budget errors", () => {
  for (const [text, maxBytes] of [
    [null, 8],
    [[], 8],
    ["ok", 0],
    ["ok", -1],
    ["ok", 1.5],
    ["ok", Infinity],
    ["ok", Number.MAX_SAFE_INTEGER + 1],
  ]) {
    assert.throws(() => splitUtf8Chunks(text, maxBytes), TypeError);
  }
});
