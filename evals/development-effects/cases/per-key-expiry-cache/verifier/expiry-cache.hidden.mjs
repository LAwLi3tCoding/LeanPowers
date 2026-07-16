import assert from "node:assert/strict";
import test from "node:test";

import * as directApi from "../src/expiry-cache.mjs";
import * as publicApi from "../src/index.mjs";

const { createExpiringCache } = directApi;

test("expires each key from its own insertion time", () => {
  let current = 0;
  const cache = createExpiringCache(() => current);
  cache.set("short", "short-value", 10);
  current = 5;
  cache.set("later", "later-value", 10);
  current = 11;

  assert.equal(cache.get("short"), undefined);
  assert.equal(cache.get("later"), "later-value");
});

test("expires exactly at the boundary and treats zero TTL as immediate", () => {
  let current = 4;
  const cache = createExpiringCache(() => current);
  cache.set("boundary", "value", 6);
  cache.set("zero", "value", 0);
  assert.equal(cache.get("zero"), undefined);
  current = 10;
  assert.equal(cache.get("boundary"), undefined);
});

test("overwriting one key resets only that key expiry", () => {
  let current = 0;
  const cache = createExpiringCache(() => current);
  cache.set("first", "v1", 20);
  cache.set("other", "stable", 30);
  current = 5;
  cache.set("first", "v2", 10);
  current = 16;

  assert.equal(cache.get("first"), undefined);
  assert.equal(cache.get("other"), "stable");
});

test("reading one expired key does not evict live neighbors", () => {
  let current = 0;
  const cache = createExpiringCache(() => current);
  cache.set("short", "gone", 5);
  cache.set("long", "kept", 20);
  current = 5;

  assert.equal(cache.get("short"), undefined);
  assert.equal(cache.get("long"), "kept");
  assert.equal(cache.get("short"), undefined);
});

test("preserves deterministic validation", () => {
  assert.throws(() => createExpiringCache({}), TypeError);
  const cache = createExpiringCache(() => 0);
  for (const key of ["", undefined, 3]) {
    assert.throws(() => cache.get(key), TypeError);
    assert.throws(() => cache.set(key, "value", 1), TypeError);
  }
  for (const ttl of [-1, 1.5, Infinity, NaN, null]) {
    assert.throws(() => cache.set("key", "value", ttl), TypeError);
  }
});

test("preserves the exact direct and public named export surface", () => {
  assert.equal(publicApi.createExpiringCache, createExpiringCache);
  assert.deepEqual(Object.keys(directApi), ["createExpiringCache"]);
  assert.deepEqual(Object.keys(publicApi), ["createExpiringCache"]);
  assert.deepEqual(Object.keys(createExpiringCache(() => 0)).sort(), ["get", "set"]);
});
