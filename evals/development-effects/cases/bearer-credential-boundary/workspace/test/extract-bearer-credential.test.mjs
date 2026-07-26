import assert from "node:assert/strict";
import test from "node:test";

import * as directApi from "../src/extract-bearer-credential.mjs";
import * as publicApi from "../src/index.mjs";

const { extractBearerCredential } = directApi;

test("extracts a bearer credential from an exact ASCII header", () => {
  assert.equal(
    extractBearerCredential("Bearer abcdefghijklmnop"),
    "abcdefghijklmnop",
  );
});

test("rejects obviously malformed headers", () => {
  assert.equal(extractBearerCredential("Token abcdefghijklmnop"), null);
  assert.equal(extractBearerCredential("Bearer"), null);
  assert.equal(extractBearerCredential("Bearer abc def"), null);
  assert.equal(extractBearerCredential("Bearer abc,def"), null);
});

test("rejects non-string headers without coercion", () => {
  assert.throws(() => extractBearerCredential(123), TypeError);
});

test("preserves the exact direct and public named export surfaces", () => {
  assert.equal(publicApi.extractBearerCredential, extractBearerCredential);
  assert.deepEqual(Object.keys(directApi), ["extractBearerCredential"]);
  assert.deepEqual(Object.keys(publicApi), ["extractBearerCredential"]);
});
