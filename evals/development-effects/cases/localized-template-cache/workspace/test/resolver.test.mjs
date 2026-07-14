import assert from "node:assert/strict";
import test from "node:test";

import { createTemplateResolver } from "../src/resolver.mjs";

test("same-locale requests share a cached load", async () => {
  const calls = [];
  const resolve = createTemplateResolver(async (name, locale) => {
    calls.push([name, locale]);
    return `${name}:${locale}`;
  });

  assert.equal(await resolve("welcome", "EN"), "welcome:en");
  assert.equal(await resolve("welcome", "en"), "welcome:en");
  assert.deepEqual(calls, [["welcome", "en"]]);
});

test("loader errors keep propagating", async () => {
  const expected = new Error("missing template");
  const resolve = createTemplateResolver(async () => {
    throw expected;
  });

  await assert.rejects(resolve("missing", "en"), expected);
});
