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

test("keeps different templates isolated in the same locale", async () => {
  const calls = [];
  const resolve = createTemplateResolver(async (name, locale) => {
    calls.push([name, locale]);
    return `${name}:${locale}`;
  });

  assert.equal(await resolve("welcome", "en"), "welcome:en");
  assert.equal(await resolve("receipt", "en"), "receipt:en");
  assert.deepEqual(calls, [
    ["welcome", "en"],
    ["receipt", "en"],
  ]);
});

test("keeps composite cache identity collision-free", async () => {
  for (const separator of [":", "|", "/", "\u001f", "::", "<->"]) {
    const calls = [];
    const resolve = createTemplateResolver(async (name, locale) => {
      calls.push([name, locale]);
      return JSON.stringify([name, locale]);
    });

    const first = [`a${separator}`, "b"];
    const second = ["a", `${separator}b`];
    assert.notDeepEqual(first, second);
    assert.equal(first.join(""), second.join(""));
    assert.equal(await resolve(...first), JSON.stringify(first));
    assert.equal(await resolve(...second), JSON.stringify(second));
    assert.deepEqual(calls, [first, second]);
  }
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
