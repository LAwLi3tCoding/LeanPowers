import assert from "node:assert/strict";
import test from "node:test";

import * as directApi from "../src/canonical-query.mjs";
import * as publicApi from "../src/index.mjs";

const { encodeCanonicalQuery } = directApi;

test("sorts by encoded name and then encoded value", () => {
  assert.equal(
    encodeCanonicalQuery([
      ["z", "2"],
      ["a", "3"],
      ["a", "1"],
    ]),
    "a=1&a=3&z=2",
  );
});

test("uses RFC3986 component encoding with percent-encoded spaces", () => {
  assert.equal(
    encodeCanonicalQuery([
      ["a b", "x/y?z"],
      ["!*'()", "=&+"],
    ]),
    "%21%2A%27%28%29=%3D%26%2B&a%20b=x%2Fy%3Fz",
  );
  assert.equal(
    encodeCanonicalQuery([["café", "🍵"]]),
    "caf%C3%A9=%F0%9F%8D%B5",
  );
});

test("preserves duplicate entries while ordering their neighboring values", () => {
  assert.equal(
    encodeCanonicalQuery([
      ["b", "2"],
      ["a", "1"],
      ["a", "1"],
      ["a", "0"],
    ]),
    "a=0&a=1&a=1&b=2",
  );
});

test("returns an empty query and never mutates caller-owned entries", () => {
  const entries = [
    ["z", "last"],
    ["a", "first"],
    ["a", "middle"],
  ];
  const before = entries.map((entry) => [...entry]);

  assert.equal(encodeCanonicalQuery([]), "");
  assert.equal(
    encodeCanonicalQuery(entries),
    "a=first&a=middle&z=last",
  );
  assert.deepEqual(entries, before);
});

test("rejects invalid arrays, pairs, and non-string fields", () => {
  const sparseEntries = [];
  sparseEntries.length = 1;
  const sparsePair = [];
  sparsePair.length = 2;

  for (const value of [
    undefined,
    {},
    sparseEntries,
    [sparsePair],
    [["name"]],
    [["name", "value", "extra"]],
    [[null, "value"]],
    [["name", null]],
  ]) {
    assert.throws(() => encodeCanonicalQuery(value), TypeError);
  }
});

test("preserves the exact direct and public named export surface", () => {
  assert.equal(publicApi.encodeCanonicalQuery, encodeCanonicalQuery);
  assert.deepEqual(Object.keys(directApi), ["encodeCanonicalQuery"]);
  assert.deepEqual(Object.keys(publicApi), ["encodeCanonicalQuery"]);
});
