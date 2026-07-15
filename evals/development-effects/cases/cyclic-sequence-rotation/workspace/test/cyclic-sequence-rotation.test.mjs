import assert from "node:assert/strict";
import test from "node:test";

import { rotateSequence } from "../src/index.mjs";

test("keeps empty, singleton, and zero-offset values in order", () => {
  const token = { id: "token" };
  assert.deepEqual(rotateSequence([], 0), []);
  assert.deepEqual(rotateSequence([token], 0), [token]);
  assert.deepEqual(rotateSequence(["a", "b", "c"], 0), ["a", "b", "c"]);
});

test("rejects basic invalid arrays and offsets without invoking accessors", () => {
  const sparse = [];
  sparse.length = 1;
  const extra = ["value"];
  extra.note = true;
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

  for (const value of [null, sparse, extra, accessor]) {
    assert.throws(() => rotateSequence(value, 0), TypeError);
  }
  for (const offset of [undefined, 0.5, Number.MAX_SAFE_INTEGER + 1, "1"]) {
    assert.throws(() => rotateSequence([], offset), TypeError);
  }
  assert.equal(getterCalls, 0);
});

test("keeps rotateSequence as the only direct and public named export", async () => {
  const direct = await import("../src/cyclic-sequence-rotation.mjs");
  const publicApi = await import("../src/index.mjs");
  assert.equal(publicApi.rotateSequence, direct.rotateSequence);
  assert.deepEqual(Object.keys(direct), ["rotateSequence"]);
  assert.deepEqual(Object.keys(publicApi), ["rotateSequence"]);
});
