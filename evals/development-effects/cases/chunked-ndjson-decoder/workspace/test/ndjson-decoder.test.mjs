import assert from "node:assert/strict";
import test from "node:test";

import { createNdjsonDecoder } from "../src/index.mjs";

test("emits one complete newline-terminated JSON record", () => {
  const records = [];
  const decoder = createNdjsonDecoder((record) => records.push(record));

  decoder.write('{"id":1}\n');
  decoder.end();

  assert.deepEqual(records, [{ id: 1 }]);
});

test("ignores an empty write and keeps the public named export", () => {
  const records = [];
  const decoder = createNdjsonDecoder((record) => records.push(record));

  decoder.write("");
  decoder.end();

  assert.deepEqual(records, []);
  assert.equal(typeof createNdjsonDecoder, "function");
});
