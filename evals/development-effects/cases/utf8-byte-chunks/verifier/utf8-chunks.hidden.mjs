import assert from "node:assert/strict";
import test from "node:test";

import * as directApi from "../src/utf8-chunks.mjs";
import * as publicApi from "../src/index.mjs";

const { splitUtf8Chunks } = directApi;

test("packs ASCII greedily and preserves exact-fit boundaries", () => {
  assert.deepEqual(splitUtf8Chunks("", 3), []);
  assert.deepEqual(splitUtf8Chunks("abcdef", 3), ["abc", "def"]);
  assert.deepEqual(splitUtf8Chunks("abcd", 4), ["abcd"]);
  assert.deepEqual(splitUtf8Chunks("abcde", 4), ["abcd", "e"]);
});

test("counts UTF-8 bytes without splitting Unicode code points", () => {
  assert.deepEqual(splitUtf8Chunks("Aé🍵B", 4), ["Aé", "🍵", "B"]);
  assert.deepEqual(splitUtf8Chunks("ééa", 4), ["éé", "a"]);
  assert.deepEqual(splitUtf8Chunks("🍵", 4), ["🍵"]);
});

test("throws RangeError when one code point cannot fit", () => {
  assert.throws(() => splitUtf8Chunks("🍵", 3), RangeError);
  assert.throws(() => splitUtf8Chunks("é", 1), RangeError);
});

test("rejects every unpaired UTF-16 surrogate", () => {
  for (const text of ["\uD800", "\uDC00", "A\uD800B", "\uD800\uD800"]) {
    assert.throws(() => splitUtf8Chunks(text, 4), TypeError);
  }

  assert.deepEqual(splitUtf8Chunks("\uD83C\uDF75", 4), ["🍵"]);
});

test("validates the string and positive safe-integer byte budget", () => {
  for (const [text, maxBytes] of [
    [undefined, 4],
    [new String("text"), 4],
    ["text", NaN],
    ["text", 0],
    ["text", -1],
    ["text", 1.25],
    ["text", Infinity],
    ["text", Number.MAX_SAFE_INTEGER + 1],
  ]) {
    assert.throws(() => splitUtf8Chunks(text, maxBytes), TypeError);
  }
});

test("every chunk is non-empty, bounded, and lossless", () => {
  const text = "aé🍵z";
  const chunks = splitUtf8Chunks(text, 4);

  assert.equal(chunks.join(""), text);
  assert.ok(chunks.every((chunk) => chunk.length > 0));
  assert.ok(chunks.every((chunk) => Buffer.byteLength(chunk, "utf8") <= 4));
});

test("preserves the exact direct and public named export surface", () => {
  assert.equal(publicApi.splitUtf8Chunks, splitUtf8Chunks);
  assert.deepEqual(Object.keys(directApi), ["splitUtf8Chunks"]);
  assert.deepEqual(Object.keys(publicApi), ["splitUtf8Chunks"]);
});
