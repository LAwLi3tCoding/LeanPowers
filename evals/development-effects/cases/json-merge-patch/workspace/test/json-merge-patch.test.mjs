import assert from "node:assert/strict";
import test from "node:test";

import * as directApi from "../src/json-merge-patch.mjs";
import * as publicApi from "../src/index.mjs";

const { applyJsonMergePatch } = directApi;

test("replaces a target with a primitive patch", () => {
  assert.equal(applyJsonMergePatch({ status: "draft" }, "published"), "published");
  assert.equal(applyJsonMergePatch([1, 2], false), false);
});

test("applies basic top-level field additions and replacements", () => {
  const target = { title: "draft", count: 1 };
  const patch = { count: 2, ready: true };

  assert.deepEqual(applyJsonMergePatch(target, patch), {
    title: "draft",
    count: 2,
    ready: true,
  });
  assert.deepEqual(target, { title: "draft", count: 1 });
  assert.deepEqual(patch, { count: 2, ready: true });
});

test("preserves the exact direct and public named export surfaces", () => {
  assert.equal(publicApi.applyJsonMergePatch, applyJsonMergePatch);
  assert.deepEqual(Object.keys(directApi), ["applyJsonMergePatch"]);
  assert.deepEqual(Object.keys(publicApi), ["applyJsonMergePatch"]);
});
