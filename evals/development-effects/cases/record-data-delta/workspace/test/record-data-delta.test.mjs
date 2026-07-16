import assert from "node:assert/strict";
import test from "node:test";

import * as directApi from "../src/record-data-delta.mjs";
import * as publicApi from "../src/index.mjs";

const { diffRecordData } = directApi;

test("classifies a basic added and changed property", () => {
  assert.deepEqual(diffRecordData({ a: 1 }, { a: 2, b: 3 }), {
    added: ["b"],
    removed: [],
    changed: ["a"],
  });
});

test("preserves the exact direct and public named export surfaces", () => {
  assert.equal(publicApi.diffRecordData, diffRecordData);
  assert.deepEqual(Object.keys(directApi), ["diffRecordData"]);
  assert.deepEqual(Object.keys(publicApi), ["diffRecordData"]);
});
