import assert from "node:assert/strict";
import test from "node:test";

import { createTemplateResolver } from "../src/resolver.mjs";

test("keeps the same template isolated in both locale orders", async () => {
  for (const locales of [["en", "fr"], ["fr", "en"]]) {
    const calls = [];
    const resolve = createTemplateResolver(async (name, locale) => {
      calls.push([name, locale]);
      return `${name}:${locale}`;
    });

    assert.equal(await resolve("welcome", locales[0]), `welcome:${locales[0]}`);
    assert.equal(await resolve("welcome", locales[1]), `welcome:${locales[1]}`);
    assert.deepEqual(calls, [
      ["welcome", locales[0]],
      ["welcome", locales[1]],
    ]);
  }
});

test("normalizes locale before both caching and loading", async () => {
  const calls = [];
  const resolve = createTemplateResolver(async (name, locale) => {
    calls.push([name, locale]);
    return `${name}:${locale}`;
  });

  assert.equal(await resolve("receipt", " FR "), "receipt:fr");
  assert.equal(await resolve("receipt", "fr"), "receipt:fr");
  assert.equal(await resolve("receipt"), "receipt:en");
  assert.deepEqual(calls, [
    ["receipt", "fr"],
    ["receipt", "en"],
  ]);
});

test("retains cache hits without hiding loader failures", async () => {
  let calls = 0;
  const resolve = createTemplateResolver(async (name, locale) => {
    calls += 1;
    if (name === "missing") {
      throw new Error(`${name}:${locale}`);
    }
    return `${name}:${locale}`;
  });

  assert.equal(await resolve("welcome", "en"), "welcome:en");
  assert.equal(await resolve("welcome", "EN"), "welcome:en");
  await assert.rejects(resolve("missing", "fr"), /missing:fr/);
  assert.equal(calls, 2);
});
