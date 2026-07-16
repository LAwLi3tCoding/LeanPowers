import assert from "node:assert/strict";
import test from "node:test";

import { createRefreshCache } from "../src/index.mjs";

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

test("coalesces one in-flight load and reuses its fulfilled value", async () => {
  const pending = deferred();
  const calls = [];
  const cache = createRefreshCache((key) => {
    calls.push(key);
    return pending.promise;
  });

  const first = cache.get("theme");
  const second = cache.get("theme");
  assert.equal(first, second);
  await Promise.resolve();
  assert.deepEqual(calls, ["theme"]);

  const value = { color: "blue" };
  pending.resolve(value);
  assert.deepEqual(await Promise.all([first, second]), [value, value]);
  assert.equal(cache.get("theme"), first);
});

test("refresh replaces one generation and invalidation starts a later load", async () => {
  const pending = [deferred(), deferred(), deferred()];
  let calls = 0;
  const cache = createRefreshCache(() => pending[calls++].promise);

  const initial = cache.get("theme");
  await Promise.resolve();
  pending[0].resolve("v1");
  assert.equal(await initial, "v1");

  const refreshed = cache.refresh("theme");
  assert.notEqual(refreshed, initial);
  assert.equal(cache.get("theme"), refreshed);
  await Promise.resolve();
  pending[1].resolve("v2");
  assert.equal(await refreshed, "v2");

  assert.equal(cache.invalidate("theme"), true);
  const afterInvalidation = cache.get("theme");
  await Promise.resolve();
  pending[2].resolve("v3");
  assert.equal(await afterInvalidation, "v3");
  assert.equal(calls, 3);
});

test("rejects invalid construction and key inputs", () => {
  assert.throws(() => createRefreshCache(null), TypeError);
  const cache = createRefreshCache(async (key) => key);

  for (const key of ["", null, undefined, 1, {}]) {
    assert.throws(() => cache.get(key), TypeError);
    assert.throws(() => cache.refresh(key), TypeError);
    assert.throws(() => cache.invalidate(key), TypeError);
  }
});
