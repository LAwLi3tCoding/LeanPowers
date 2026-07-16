import assert from "node:assert/strict";
import test from "node:test";

import * as directApi from "../src/text-edits.mjs";
import * as publicApi from "../src/index.mjs";

const { applyTextEdits } = directApi;

test("applies unordered edits against original UTF-16 coordinates", () => {
  assert.equal(
    applyTextEdits("0123456789", [[7, 9, "X"], [1, 3, "AB"], [5, 6, ""]]),
    "0AB346X9",
  );
});

test("uses half-open ranges and permits adjacent edits", () => {
  assert.equal(applyTextEdits("abcdef", [[0, 2, "A"], [2, 4, "B"], [4, 6, "C"]]), "ABC");
  assert.equal(applyTextEdits("abc", [[1, 1, "X"], [2, 2, "Y"]]), "aXbYc");
});

test("rejects overlap and duplicate starts independent of input order", () => {
  for (const edits of [
    [[1, 4, "x"], [3, 5, "y"]],
    [[3, 5, "y"], [1, 4, "x"]],
    [[1, 1, "x"], [1, 2, "y"]],
  ]) {
    assert.throws(() => applyTextEdits("abcdef", edits), TypeError);
  }
  assert.throws(
    () => applyTextEdits("abcd", [[1, 3, "X"], [2, 2, "Y"]]),
    TypeError,
  );
  assert.equal(applyTextEdits("abcd", [[1, 3, "X"], [3, 3, "Y"]]), "aXYd");
});

test("interprets offsets as UTF-16 code units", () => {
  assert.equal(applyTextEdits("A🍵B", [[1, 3, "tea"]]), "AteaB");
  assert.equal(applyTextEdits("A🍵B", [[3, 4, "!"]]), "A🍵!");
});

test("does not mutate the edit collection or tuples", () => {
  const edits = Object.freeze([
    Object.freeze([4, 6, "C"]),
    Object.freeze([0, 2, "A"]),
    Object.freeze([2, 4, "B"]),
  ]);
  assert.equal(applyTextEdits("abcdef", edits), "ABC");
  assert.deepEqual(edits, [[4, 6, "C"], [0, 2, "A"], [2, 4, "B"]]);

  const ordered = Object.freeze([
    Object.freeze([0, 1, "A"]),
    Object.freeze([2, 3, "C"]),
  ]);
  assert.equal(applyTextEdits("abc", ordered), "AbC");
});

test("validates every edit and source boundary", () => {
  const sparse = [];
  sparse.length = 3;
  for (const [source, edits] of [
    [undefined, []],
    [new String("abc"), []],
    ["abc", {}],
    ["abc", [sparse]],
    ["abc", [[0, 1, "x", "extra"]]],
    ["abc", [[-1, 1, "x"]]],
    ["abc", [[0.5, 1, "x"]]],
    ["abc", [[0, 4, "x"]]],
    ["abc", [[2, 1, "x"]]],
    ["abc", [[0, 1, null]]],
  ]) {
    assert.throws(() => applyTextEdits(source, edits), TypeError);
  }
});

test("preserves the exact direct and public named export surface", () => {
  assert.equal(publicApi.applyTextEdits, applyTextEdits);
  assert.deepEqual(Object.keys(directApi), ["applyTextEdits"]);
  assert.deepEqual(Object.keys(publicApi), ["applyTextEdits"]);
});
