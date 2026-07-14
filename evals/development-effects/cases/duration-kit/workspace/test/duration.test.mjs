import assert from "node:assert/strict";
import test from "node:test";

import { formatDuration, parseDuration } from "../src/index.mjs";

test("integer durations remain milliseconds", () => {
  assert.equal(parseDuration(0), 0);
  assert.equal(parseDuration(250), 250);
});

test("formatDuration keeps its existing behavior", () => {
  assert.equal(formatDuration(1500), "1500ms");
  assert.throws(() => formatDuration(-1), TypeError);
});
