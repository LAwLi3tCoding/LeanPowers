import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import { verifySignature } from "../src/signature.mjs";

function sign(payload, secret) {
  return `sha256=${createHmac("sha256", secret).update(payload).digest("hex")}`;
}

test("keeps the existing single-secret API", () => {
  const payload = Buffer.from("hello");
  assert.equal(verifySignature(payload, sign(payload, "secret"), "secret"), true);
  assert.equal(verifySignature(payload, sign(payload, "wrong"), "secret"), false);
});

test("malformed headers return false", () => {
  assert.equal(verifySignature("hello", "sha1=abc", "secret"), false);
  assert.equal(verifySignature("hello", "sha256=abc", "secret"), false);
});
