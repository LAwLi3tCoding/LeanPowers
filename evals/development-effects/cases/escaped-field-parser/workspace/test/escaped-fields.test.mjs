import assert from "node:assert/strict";
import test from "node:test";

import { splitEscapedFields } from "../src/index.mjs";

test("splits ordinary fields and preserves an unsplit field", () => {
  assert.deepEqual(splitEscapedFields("red|green|blue", "|"), [
    "red",
    "green",
    "blue",
  ]);
  assert.deepEqual(splitEscapedFields("plain", "|"), ["plain"]);
});

test("rejects basic input and separator contract violations", () => {
  for (const [input, separator] of [
    [undefined, "|"],
    [null, "|"],
    [new String("value"), "|"],
    ["value", undefined],
    ["value", null],
    ["value", new String("|")],
    ["value", ""],
    ["value", "||"],
    ["value", "\\"],
  ]) {
    assert.throws(() => splitEscapedFields(input, separator), TypeError);
  }
});
