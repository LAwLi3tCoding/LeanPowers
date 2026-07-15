import assert from "node:assert/strict";
import test from "node:test";

import * as directApi from "../src/refresh-cache.mjs";
import * as publicApi from "../src/index.mjs";

const { createRefreshCache } = directApi;

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

test("a stale success cannot overwrite a newer fulfilled generation", async () => {
  const pending = [deferred(), deferred()];
  let calls = 0;
  const cache = createRefreshCache(() => pending[calls++].promise);

  const older = cache.get("profile");
  const newer = cache.refresh("profile");
  await Promise.resolve();
  assert.equal(calls, 2);

  pending[1].resolve("newer");
  assert.equal(await newer, "newer");
  pending[0].resolve("older");
  assert.equal(await older, "older");

  assert.equal(cache.get("profile"), newer);
  assert.equal(await cache.get("profile"), "newer");
  assert.equal(calls, 2);
});

test("a stale rejection cannot clear a newer fulfilled generation", async () => {
  const pending = [deferred(), deferred(), deferred()];
  let calls = 0;
  const cache = createRefreshCache(() => pending[calls++].promise);

  const older = cache.get("profile");
  const newer = cache.refresh("profile");
  await Promise.resolve();
  pending[1].resolve("newer");
  assert.equal(await newer, "newer");

  const failure = new Error("stale failure");
  const olderOutcome = older.then(
    () => null,
    (error) => error,
  );
  pending[0].reject(failure);
  assert.equal(await olderOutcome, failure);

  assert.equal(cache.get("profile"), newer);
  assert.equal(await cache.get("profile"), "newer");
  assert.equal(calls, 2);
});

test("get reuses the current in-flight generation exactly once", async () => {
  const pending = deferred();
  const calls = [];
  const cache = createRefreshCache((key) => {
    calls.push(key);
    return pending.promise;
  });

  const first = cache.get("profile");
  const peer = cache.get("profile");
  assert.equal(first, peer);
  await Promise.resolve();
  assert.deepEqual(calls, ["profile"]);

  pending.resolve("value");
  assert.deepEqual(await Promise.all([first, peer]), ["value", "value"]);
  assert.equal(cache.get("profile"), first);
});

test("a newer success remains observable while an older load is pending", async () => {
  const pending = [deferred(), deferred()];
  let calls = 0;
  const cache = createRefreshCache(() => pending[calls++].promise);

  const older = cache.get("profile");
  const newer = cache.refresh("profile");
  await Promise.resolve();
  pending[1].resolve({ version: 2 });
  const fresh = await newer;

  assert.equal(cache.get("profile"), newer);
  assert.deepEqual(await cache.get("profile"), { version: 2 });
  assert.deepEqual(fresh, { version: 2 });

  pending[0].resolve({ version: 1 });
  await older;
});

test("loads, refreshes, and failures stay isolated by key", async () => {
  const pending = new Map([
    ["alpha", deferred()],
    ["beta", deferred()],
  ]);
  const calls = [];
  const cache = createRefreshCache((key) => {
    calls.push(key);
    return pending.get(key).promise;
  });

  const alpha = cache.get("alpha");
  const beta = cache.get("beta");
  assert.notEqual(alpha, beta);
  await Promise.resolve();
  assert.deepEqual(calls, ["alpha", "beta"]);

  pending.get("beta").resolve("B");
  pending.get("alpha").resolve("A");
  assert.deepEqual(await Promise.all([alpha, beta]), ["A", "B"]);
  assert.equal(cache.get("alpha"), alpha);
  assert.equal(cache.get("beta"), beta);
});

test("invalidation advances only that key and blocks stale repopulation", async () => {
  const pending = [deferred(), deferred()];
  let calls = 0;
  const cache = createRefreshCache(() => pending[calls++].promise);

  const stale = cache.get("profile");
  await Promise.resolve();
  assert.equal(cache.invalidate("profile"), true);
  assert.equal(cache.invalidate("missing"), false);

  const current = cache.get("profile");
  await Promise.resolve();
  pending[1].resolve("current");
  assert.equal(await current, "current");
  pending[0].resolve("stale");
  assert.equal(await stale, "stale");

  assert.equal(cache.get("profile"), current);
  assert.equal(await cache.get("profile"), "current");
  assert.equal(calls, 2);
});

test("a current rejection allows a same-key retry without evicting neighbors", async () => {
  const failure = new Error("temporary failure");
  const calls = [];
  let profileAttempts = 0;
  const cache = createRefreshCache(async (key) => {
    calls.push(key);
    if (key === "stable") return "stable-value";
    profileAttempts += 1;
    if (profileAttempts === 1) throw failure;
    return "recovered";
  });

  const stable = cache.get("stable");
  await assert.rejects(cache.get("profile"), (error) => error === failure);
  assert.equal(await cache.get("stable"), "stable-value");
  assert.equal(cache.get("stable"), stable);
  assert.equal(await cache.get("profile"), "recovered");
  assert.deepEqual(calls, ["stable", "profile", "profile"]);
});

test("preserves exact validation, methods, and named export surfaces", () => {
  assert.throws(() => createRefreshCache(), TypeError);
  assert.throws(() => createRefreshCache({}), TypeError);

  const cache = createRefreshCache(async (key) => key);
  for (const key of ["", undefined, null, 0, false, {}, []]) {
    assert.throws(() => cache.get(key), TypeError);
    assert.throws(() => cache.refresh(key), TypeError);
    assert.throws(() => cache.invalidate(key), TypeError);
  }

  assert.equal(publicApi.createRefreshCache, createRefreshCache);
  assert.deepEqual(Object.keys(directApi), ["createRefreshCache"]);
  assert.deepEqual(Object.keys(publicApi), ["createRefreshCache"]);
  assert.deepEqual(Object.keys(cache), ["get", "refresh", "invalidate"]);
});

test("requires no timers or network access", async () => {
  const originals = {
    fetch: globalThis.fetch,
    setInterval: globalThis.setInterval,
    setTimeout: globalThis.setTimeout,
  };
  const forbidden = () => {
    throw new Error("timer or network access is forbidden");
  };

  globalThis.fetch = forbidden;
  globalThis.setInterval = forbidden;
  globalThis.setTimeout = forbidden;
  try {
    const cache = createRefreshCache(async (key) => `value:${key}`);
    assert.equal(await cache.get("safe"), "value:safe");
    assert.equal(await cache.refresh("safe"), "value:safe");
    assert.equal(cache.invalidate("safe"), true);
  } finally {
    globalThis.fetch = originals.fetch;
    globalThis.setInterval = originals.setInterval;
    globalThis.setTimeout = originals.setTimeout;
  }
});
