import assert from "node:assert/strict";
import test from "node:test";

import * as directApi from "../src/tag-index.mjs";
import * as publicApi from "../src/index.mjs";

const { createTagIndex } = directApi;

test("replacement removes old reverse links and installs new ones", () => {
  const index = createTagIndex();
  index.set("item", ["old", "kept"]);
  assert.equal(index.set("item", ["kept", "new"]), true);
  assert.deepEqual(index.getTags("item"), ["kept", "new"]);
  assert.deepEqual(index.getIds("old"), []);
  assert.deepEqual(index.getIds("kept"), ["item"]);
  assert.deepEqual(index.getIds("new"), ["item"]);
});

test("remove clears both directions, including an empty association set", () => {
  const index = createTagIndex();
  index.set("first", ["shared", "solo"]);
  index.set("second", ["shared"]);
  assert.equal(index.remove("first"), true);
  assert.deepEqual(index.getTags("first"), []);
  assert.deepEqual(index.getIds("shared"), ["second"]);
  assert.deepEqual(index.getIds("solo"), []);

  assert.equal(index.set("empty", []), true);
  assert.equal(index.set("empty", []), false);
  assert.equal(index.remove("empty"), true);
  assert.equal(index.remove("empty"), false);
});

test("current associations keep insertion order and re-added links move to the end", () => {
  const index = createTagIndex();
  index.set("zeta", ["shared"]);
  index.set("alpha", ["shared"]);
  index.set("middle", ["shared"]);
  assert.deepEqual(index.getIds("shared"), ["zeta", "alpha", "middle"]);

  index.set("alpha", []);
  index.set("alpha", ["shared"]);
  assert.deepEqual(index.getIds("shared"), ["zeta", "middle", "alpha"]);

  index.set("ordered", ["red", "blue"]);
  index.set("ordered", ["blue", "green", "red"]);
  assert.deepEqual(index.getTags("ordered"), ["red", "blue", "green"]);
  assert.equal(index.set("ordered", ["green", "blue", "red"]), false);
  assert.deepEqual(index.getTags("ordered"), ["red", "blue", "green"]);
});

test("getters return fresh arrays that cannot mutate the index", () => {
  const index = createTagIndex();
  index.set("item", ["blue"]);

  const tags = index.getTags("item");
  const ids = index.getIds("blue");
  tags.push("injected");
  ids.length = 0;

  const nextTags = index.getTags("item");
  const nextIds = index.getIds("blue");
  assert.notEqual(tags, nextTags);
  assert.notEqual(ids, nextIds);
  assert.deepEqual(nextTags, ["blue"]);
  assert.deepEqual(nextIds, ["item"]);

  const missingTags = index.getTags("missing");
  const missingIds = index.getIds("missing");
  missingTags.push("injected");
  missingIds.push("injected");
  const nextMissingTags = index.getTags("missing");
  const nextMissingIds = index.getIds("missing");
  assert.notEqual(missingTags, nextMissingTags);
  assert.notEqual(missingIds, nextMissingIds);
  assert.deepEqual(nextMissingTags, []);
  assert.deepEqual(nextMissingIds, []);

  index.set("empty", []);
  const emptyTags = index.getTags("empty");
  assert.notEqual(emptyTags, index.getTags("empty"));
  emptyTags.push("injected");
  assert.deepEqual(index.getTags("empty"), []);
});

test("set validation is exact and atomic", () => {
  const index = createTagIndex();
  index.set("item", ["stable"]);

  const sparse = [];
  sparse.length = 1;
  const extra = ["next"];
  extra.note = true;
  const symbol = ["next"];
  symbol[Symbol("extra")] = true;
  let getterCalls = 0;
  const accessor = [];
  Object.defineProperty(accessor, "0", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return "next";
    },
  });
  accessor.length = 1;

  for (const invalid of [
    sparse,
    extra,
    symbol,
    accessor,
    ["duplicate", "duplicate"],
    ["valid", ""],
    ["valid", null],
    ["valid", 1],
  ]) {
    assert.throws(() => index.set("item", invalid), TypeError);
    assert.deepEqual(index.getTags("item"), ["stable"]);
    assert.deepEqual(index.getIds("stable"), ["item"]);
    assert.deepEqual(index.getIds("valid"), []);
  }
  assert.equal(getterCalls, 0);
});

test("validates every id and tag as a non-empty primitive string", () => {
  const index = createTagIndex();
  for (const invalid of ["", undefined, null, 0, false, {}, [], new String("id")]) {
    assert.throws(() => index.set(invalid, []), TypeError);
    assert.throws(() => index.remove(invalid), TypeError);
    assert.throws(() => index.getTags(invalid), TypeError);
    assert.throws(() => index.getIds(invalid), TypeError);
  }
});

test("preserves the exact method and named export surfaces", () => {
  const index = createTagIndex();
  assert.equal(publicApi.createTagIndex, createTagIndex);
  assert.deepEqual(Object.keys(directApi), ["createTagIndex"]);
  assert.deepEqual(Object.keys(publicApi), ["createTagIndex"]);
  assert.deepEqual(Object.keys(index), ["set", "remove", "getTags", "getIds"]);
});
