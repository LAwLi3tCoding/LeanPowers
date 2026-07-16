import assert from "node:assert/strict";
import test from "node:test";

import { applyTextEdits } from "../src/index.mjs";

test("keeps an unedited source and replaces the whole source", () => {
  assert.equal(applyTextEdits("hello", []), "hello");
  assert.equal(applyTextEdits("hello", [[0, 5, "bye"]]), "bye");
});

test("rejects basic invalid arguments", () => {
  for (const [source, edits] of [
    [null, []],
    ["abc", null],
    ["abc", [[0, 4, "x"]]],
    ["abc", [[2, 1, "x"]]],
    ["abc", [[0, 1]]],
    ["abc", [[0, 1, 3]]],
  ]) {
    assert.throws(() => applyTextEdits(source, edits), TypeError);
  }
});
