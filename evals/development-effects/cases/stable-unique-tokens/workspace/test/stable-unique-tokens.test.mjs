import assert from "node:assert/strict";
import test from "node:test";

import * as directApi from "../src/stable-unique-tokens.mjs";
import * as publicApi from "../src/index.mjs";

const { stableUniqueTokens } = directApi;

test("returns an empty array for empty input", () => {
  assert.deepEqual(stableUniqueTokens([]), []);
});

test("removes repeated copies of a token", () => {
  assert.deepEqual(
    stableUniqueTokens(["alpha", "alpha", "alpha"]),
    ["alpha"],
  );
});

test("rejects non-array input", () => {
  assert.throws(() => stableUniqueTokens("alpha"), TypeError);
});

test("preserves the exact direct and public named export surfaces", () => {
  assert.equal(publicApi.stableUniqueTokens, stableUniqueTokens);
  assert.deepEqual(Object.keys(directApi), ["stableUniqueTokens"]);
  assert.deepEqual(Object.keys(publicApi), ["stableUniqueTokens"]);
});
