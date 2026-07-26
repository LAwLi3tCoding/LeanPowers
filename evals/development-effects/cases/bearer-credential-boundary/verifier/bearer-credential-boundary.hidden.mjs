import assert from "node:assert/strict";
import test from "node:test";

import * as directApi from "../src/extract-bearer-credential.mjs";
import * as publicApi from "../src/index.mjs";

const { extractBearerCredential } = directApi;

test("accepts bearer scheme case-insensitively but only as an exact token", () => {
  const validCredential = "abcdefghijklmnop";
  for (const scheme of ["Bearer", "bearer", "BEARER", "BeArEr"]) {
    assert.equal(
      extractBearerCredential(`${scheme} ${validCredential}`),
      validCredential,
    );
  }
  assert.equal(extractBearerCredential(`Bearerish ${validCredential}`), null);
  assert.equal(extractBearerCredential(`Bearer ${validCredential} extra`), null);
  assert.equal(extractBearerCredential(`Bearer,${validCredential}`), null);
});

test("rejects surrounding whitespace, tabs, and CRLF boundaries", () => {
  const validCredential = "abcdefghijklmnop";
  assert.equal(extractBearerCredential(` Bearer ${validCredential}`), null);
  assert.equal(extractBearerCredential(`Bearer ${validCredential} `), null);
  assert.equal(extractBearerCredential(`Bearer\t${validCredential}`), null);
  assert.equal(extractBearerCredential(`Bearer  ${validCredential}`), null);
  assert.equal(extractBearerCredential(`Bearer ${validCredential}\r\n`), null);
});

test("enforces credential charset and exact length bounds", () => {
  const asciiCredential = "A1._~-BCDEFGHIJK";
  assert.equal(extractBearerCredential(`Bearer ${asciiCredential}`), asciiCredential);
  assert.equal(extractBearerCredential(`Bearer short`), null);
  assert.equal(extractBearerCredential(`Bearer ${"a".repeat(15)}`), null);
  assert.equal(extractBearerCredential(`Bearer ${"a".repeat(512)}`), "a".repeat(512));
  assert.equal(extractBearerCredential(`Bearer ${"a".repeat(513)}`), null);
  assert.equal(extractBearerCredential("Bearer abcdefghijklmno+"), null);
});

test("rejects non-string headers without coercion", () => {
  const probe = {
    toString() {
      throw new Error("coercion should not happen");
    },
    valueOf() {
      throw new Error("coercion should not happen");
    },
  };
  assert.throws(() => extractBearerCredential(probe), TypeError);
  assert.throws(() => extractBearerCredential(Object("Bearer abcdefghijklmnop")), TypeError);
});

test("preserves the exact direct and public named export surfaces", () => {
  assert.equal(publicApi.extractBearerCredential, extractBearerCredential);
  assert.deepEqual(Object.keys(directApi), ["extractBearerCredential"]);
  assert.deepEqual(Object.keys(publicApi), ["extractBearerCredential"]);
});
