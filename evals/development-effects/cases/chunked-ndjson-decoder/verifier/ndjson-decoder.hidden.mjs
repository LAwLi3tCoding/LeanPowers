import assert from "node:assert/strict";
import test from "node:test";

import { createNdjsonDecoder } from "../src/index.mjs";

test("buffers a record split across arbitrary chunks", () => {
  const records = [];
  const decoder = createNdjsonDecoder((record) => records.push(record));
  decoder.write('{"id":');
  assert.deepEqual(records, []);
  decoder.write('1,"name":"Ada"}\n');
  assert.deepEqual(records, [{ id: 1, name: "Ada" }]);
});

test("emits every complete record synchronously and in source order", () => {
  const events = [];
  const decoder = createNdjsonDecoder((record) => events.push(record.id));
  decoder.write('{"id":1}\n{"id":2}\n{"id":3}\n');
  events.push("after-write");
  assert.deepEqual(events, [1, 2, 3, "after-write"]);
});

test("accepts CRLF, ignores blank lines, and flushes a final unterminated record", () => {
  const records = [];
  const decoder = createNdjsonDecoder((record) => records.push(record));
  decoder.write('\r\n {"id":4} \r\n\n');
  decoder.write('{"id":5}');
  assert.deepEqual(records, [{ id: 4 }]);
  decoder.end();
  assert.deepEqual(records, [{ id: 4 }, { id: 5 }]);
});

test("throws SyntaxError synchronously for a malformed complete record", () => {
  const records = [];
  const decoder = createNdjsonDecoder((record) => records.push(record));
  let returned = false;
  assert.throws(
    () => {
      decoder.write('{"id":}\n');
      returned = true;
    },
    SyntaxError,
  );
  assert.equal(returned, false);
  assert.deepEqual(records, []);
});

test("keeps createNdjsonDecoder as the direct public named export", async () => {
  const direct = await import("../src/ndjson-decoder.mjs");
  const index = await import("../src/index.mjs");
  assert.equal(index.createNdjsonDecoder, direct.createNdjsonDecoder);
  assert.deepEqual(Object.keys(index), ["createNdjsonDecoder"]);
});
