import assert from "node:assert/strict";
import test from "node:test";

import { formatDuration, parseDuration } from "../src/index.mjs";

test("parses supported string units and surrounding whitespace", () => {
  assert.equal(parseDuration("0ms"), 0);
  assert.equal(parseDuration("250ms"), 250);
  assert.equal(parseDuration("2s"), 2000);
  assert.equal(parseDuration(" 3m "), 180000);
});

test("rejects unsupported or unsafe duration values", () => {
  for (const value of ["", "1", "-1ms", "1.5s", "1h", -1, 1.5, NaN, Infinity]) {
    assert.throws(() => parseDuration(value), TypeError, String(value));
  }
});

test("preserves numeric milliseconds, formatter behavior, and exports", () => {
  assert.equal(parseDuration(42), 42);
  assert.equal(formatDuration(42), "42ms");
});
