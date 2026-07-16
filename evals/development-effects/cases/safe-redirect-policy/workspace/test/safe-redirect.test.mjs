import assert from "node:assert/strict";
import test from "node:test";

import { resolveSafeRedirect } from "../src/index.mjs";

test("resolves ordinary relative redirects against the configured origin", () => {
  assert.equal(
    resolveSafeRedirect(
      "/account?tab=profile#details",
      "https://app.example",
      ["https://app.example"],
    ),
    "https://app.example/account?tab=profile#details",
  );
});

test("accepts an absolute redirect only when its origin is listed", () => {
  const allowed = ["https://app.example", "https://static.example"];

  assert.equal(
    resolveSafeRedirect(
      "https://static.example/assets/app.js",
      "https://app.example",
      allowed,
    ),
    "https://static.example/assets/app.js",
  );
  assert.equal(
    resolveSafeRedirect(
      "https://outside.example/sign-in",
      "https://app.example",
      allowed,
    ),
    null,
  );
});

test("rejects plainly malformed argument containers", () => {
  for (const args of [
    [null, "https://app.example", ["https://app.example"]],
    ["/home", null, ["https://app.example"]],
    ["/home", "https://app.example", null],
    ["", "https://app.example", ["https://app.example"]],
    ["/home", "", ["https://app.example"]],
    ["/home", "https://app.example", []],
  ]) {
    assert.throws(() => resolveSafeRedirect(...args), TypeError);
  }
});
