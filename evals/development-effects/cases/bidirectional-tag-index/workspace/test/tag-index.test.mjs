import assert from "node:assert/strict";
import test from "node:test";

import { createTagIndex } from "../src/index.mjs";

test("indexes initial associations in encounter order", () => {
  const index = createTagIndex();
  assert.equal(index.set("item-b", ["blue", "sale"]), true);
  assert.equal(index.set("item-c", ["blue"]), true);
  assert.deepEqual(index.getTags("item-b"), ["blue", "sale"]);
  assert.deepEqual(index.getIds("blue"), ["item-b", "item-c"]);
  assert.equal(index.set("item-b", ["sale", "blue"]), false);
  assert.deepEqual(index.getTags("item-b"), ["blue", "sale"]);
});

test("replaces the forward set and removes existing ids", () => {
  const index = createTagIndex();
  index.set("item", ["old", "kept"]);
  assert.equal(index.set("item", ["kept", "new"]), true);
  assert.deepEqual(index.getTags("item"), ["kept", "new"]);
  assert.equal(index.remove("item"), true);
  assert.deepEqual(index.getTags("item"), []);
  assert.equal(index.remove("item"), false);
});

test("rejects invalid basic inputs", () => {
  const index = createTagIndex();
  for (const id of ["", null, 1, false, {}]) {
    assert.throws(() => index.set(id, []), TypeError);
    assert.throws(() => index.remove(id), TypeError);
    assert.throws(() => index.getTags(id), TypeError);
  }
  assert.throws(() => index.set("item", null), TypeError);
  assert.throws(() => index.set("item", [""]), TypeError);
  assert.throws(() => index.getIds(""), TypeError);
});
