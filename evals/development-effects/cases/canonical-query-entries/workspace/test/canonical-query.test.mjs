import assert from "node:assert/strict";
import test from "node:test";

import { encodeCanonicalQuery } from "../src/index.mjs";

test("encodes empty and simple singleton queries", () => {
  assert.equal(encodeCanonicalQuery([]), "");
  assert.equal(encodeCanonicalQuery([["page", "2"]]), "page=2");
});

test("rejects malformed entry collections", () => {
  for (const value of [
    null,
    "page=2",
    ["page", "2"],
    [["page"]],
    [["page", "2", "extra"]],
    [[1, "2"]],
    [["page", 2]],
  ]) {
    assert.throws(() => encodeCanonicalQuery(value), TypeError);
  }
});
