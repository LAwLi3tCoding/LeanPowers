import assert from "node:assert/strict";
import test from "node:test";

import * as directApi from "../src/escaped-fields.mjs";
import * as publicApi from "../src/index.mjs";

const { splitEscapedFields } = directApi;

test("splits only on unescaped separators", () => {
  assert.deepEqual(
    splitEscapedFields("left\\|middle|right", "|"),
    ["left|middle", "right"],
  );
  assert.deepEqual(
    splitEscapedFields("one|two\\|still-two|three", "|"),
    ["one", "two|still-two", "three"],
  );
});

test("removes an escape before any following code point", () => {
  assert.deepEqual(splitEscapedFields("a\\qb|c\\\\d", "|"), [
    "aqb",
    "c\\d",
  ]);
  assert.deepEqual(splitEscapedFields("prefix\\🍵suffix", "|"), [
    "prefix🍵suffix",
  ]);
});

test("preserves leading, trailing, consecutive, and sole empty fields", () => {
  assert.deepEqual(splitEscapedFields("|a||", "|"), ["", "a", "", ""]);
  assert.deepEqual(splitEscapedFields("", "|"), [""]);
});

test("supports a supplementary Unicode separator as one code point", () => {
  assert.deepEqual(splitEscapedFields("a🍵b\\🍵c🍵", "🍵"), [
    "a",
    "b🍵c",
    "",
  ]);
});

test("rejects a trailing escape without returning partial fields", () => {
  assert.throws(() => splitEscapedFields("first|second\\", "|"), TypeError);
  assert.throws(() => splitEscapedFields("\\", "|"), TypeError);
});

test("validates primitive strings and exactly one non-backslash code point", () => {
  assert.deepEqual(splitEscapedFields("left🍵right", "🍵"), ["left", "right"]);

  for (const [input, separator] of [
    [undefined, "|"],
    [new String("value"), "|"],
    ["value", undefined],
    ["value", new String("|")],
    ["value", ""],
    ["value", "ab"],
    ["value", "🍵x"],
    ["value", "\\"],
  ]) {
    assert.throws(() => splitEscapedFields(input, separator), TypeError);
  }
});

test("preserves the exact direct and public named export surface", () => {
  assert.equal(publicApi.splitEscapedFields, splitEscapedFields);
  assert.deepEqual(Object.keys(directApi), ["splitEscapedFields"]);
  assert.deepEqual(Object.keys(publicApi), ["splitEscapedFields"]);
});
