import assert from "node:assert/strict";
import test from "node:test";

import { compareVersionVectors } from "../src/index.mjs";

test("compares equal and single-component vectors", () => {
  assert.equal(compareVersionVectors({}, {}), "equal");
  assert.equal(compareVersionVectors({ core: 2 }, { core: 2 }), "equal");
  assert.equal(compareVersionVectors({ core: 1 }, { core: 2 }), "before");
  assert.equal(compareVersionVectors({ core: 3 }, { core: 2 }), "after");
});

test("rejects basic invalid records, keys, and counters", () => {
  for (const invalid of [
    null,
    [],
    { core: -1 },
    { core: 1.5 },
    { core: Number.MAX_SAFE_INTEGER + 1 },
    { "unsafe key": 1 },
  ]) {
    assert.throws(() => compareVersionVectors(invalid, {}), TypeError);
    assert.throws(() => compareVersionVectors({}, invalid), TypeError);
  }
});

test("keeps compareVersionVectors as the only direct and public named export", async () => {
  const direct = await import("../src/version-vector-relation.mjs");
  const publicApi = await import("../src/index.mjs");
  assert.equal(publicApi.compareVersionVectors, direct.compareVersionVectors);
  assert.deepEqual(Object.keys(direct), ["compareVersionVectors"]);
  assert.deepEqual(Object.keys(publicApi), ["compareVersionVectors"]);
});
