import assert from "node:assert/strict";
import test from "node:test";

import * as directApi from "../src/stable-multiset-subtract.mjs";
import * as publicApi from "../src/index.mjs";

const { stableMultisetSubtract } = directApi;

test("keeps values when there are no removals", () => {
  assert.deepEqual(
    stableMultisetSubtract(["alpha", "Beta-2", "gamma.3"], []),
    ["alpha", "Beta-2", "gamma.3"],
  );
});

test("rejects non-array inputs", () => {
  assert.throws(() => stableMultisetSubtract(null, []), TypeError);
  assert.throws(() => stableMultisetSubtract([], null), TypeError);
});

test("preserves the exact direct and public named export surfaces", () => {
  assert.equal(publicApi.stableMultisetSubtract, stableMultisetSubtract);
  assert.deepEqual(Object.keys(directApi), ["stableMultisetSubtract"]);
  assert.deepEqual(Object.keys(publicApi), ["stableMultisetSubtract"]);
});
