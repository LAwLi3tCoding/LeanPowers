import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { verifySignature } from "../src/signature.mjs";

function sign(payload, secret) {
  return `sha256=${createHmac("sha256", secret).update(payload).digest("hex")}`;
}

test("accepts old and new rotation secrets while preserving single-secret compatibility", () => {
  const payload = Buffer.from("rotate-me");
  assert.equal(verifySignature(payload, sign(payload, "old"), ["new", "old"]), true);
  assert.equal(verifySignature(payload, sign(payload, "new"), ["new", "old"]), true);
  assert.equal(verifySignature(payload, sign(payload, "old"), "old"), true);
  assert.equal(verifySignature(payload, sign(payload, "other"), ["new", "old"]), false);
});

test("rejects invalid secret collections before verification", () => {
  for (const secret of [[], ["valid", ""], ["valid", 3], "", null, undefined]) {
    assert.throws(() => verifySignature("payload", sign("payload", "valid"), secret), TypeError);
  }
});

test("enforces the exact signature grammar", () => {
  const valid = sign("payload", "secret");
  const upperHex = `sha256=${valid.slice(7).toUpperCase()}`;
  const mixedHex = `sha256=${[...valid.slice(7)]
    .map((character, index) => index % 2 === 0 ? character.toUpperCase() : character)
    .join("")}`;
  assert.equal(verifySignature("payload", upperHex, "secret"), true);
  assert.equal(verifySignature("payload", mixedHex, "secret"), true);
  for (const header of [
    ` sha256=${valid.slice(7)}`,
    `sha256=${valid.slice(7)} `,
    `sha256=${valid.slice(7)}00`,
    `SHA256=${valid.slice(7)}`,
  ]) {
    assert.equal(verifySignature("payload", header, "secret"), false, header);
  }
});

test("preserves Buffer and Unicode payload bytes", () => {
  const buffer = Buffer.from([0, 255, 10, 20]);
  const unicode = "你好, webhook";
  assert.equal(verifySignature(buffer, sign(buffer, "secret"), ["secret"]), true);
  assert.equal(verifySignature(unicode, sign(unicode, "secret"), ["secret"]), true);
});

test("implementation retains Node constant-time comparison", async () => {
  const source = await readFile(new URL("../src/signature.mjs", import.meta.url), "utf8");
  assert.match(source, /timingSafeEqual/);
  assert.doesNotMatch(source, /===\s*(?:expected|actual)|(?:expected|actual)\s*===/);
});
