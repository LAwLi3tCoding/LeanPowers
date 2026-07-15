import assert from "node:assert/strict";
import test from "node:test";

import { createExpiringCache } from "../src/index.mjs";

test("stores, overwrites, and reads values with an injected clock", () => {
  let current = 0;
  const cache = createExpiringCache(() => current);

  assert.equal(cache.get("missing"), undefined);
  cache.set("profile", { version: 1 }, 10);
  assert.deepEqual(cache.get("profile"), { version: 1 });
  current = 2;
  cache.set("profile", { version: 2 }, 10);
  assert.deepEqual(cache.get("profile"), { version: 2 });
});

test("rejects invalid clocks, keys, and TTL values", () => {
  assert.throws(() => createExpiringCache(null), TypeError);
  const cache = createExpiringCache(() => 0);

  for (const key of ["", null, 1]) {
    assert.throws(() => cache.set(key, "value", 1), TypeError);
    assert.throws(() => cache.get(key), TypeError);
  }
  for (const ttl of [-1, 0.5, Infinity, NaN, "1"]) {
    assert.throws(() => cache.set("key", "value", ttl), TypeError);
  }
});
