import assert from "node:assert/strict";
import test from "node:test";

import * as directApi from "../src/http-accept-negotiation.mjs";
import * as publicApi from "../src/index.mjs";

const { negotiateMediaType } = directApi;

test("returns an exact supported media type without changing its spelling", () => {
  assert.equal(
    negotiateMediaType("application/json, text/html", ["image/png", "text/html"]),
    "text/html",
  );
});

test("returns null when no listed media type is supported", () => {
  assert.equal(negotiateMediaType("application/json", ["text/plain"]), null);
});

test("rejects missing accept values and empty supported collections", () => {
  assert.throws(() => negotiateMediaType(null, ["text/plain"]), TypeError);
  assert.throws(() => negotiateMediaType("text/plain", []), TypeError);
});

test("preserves the direct and public named export surface", () => {
  assert.equal(publicApi.negotiateMediaType, negotiateMediaType);
  assert.deepEqual(Object.keys(directApi), ["negotiateMediaType"]);
  assert.deepEqual(Object.keys(publicApi), ["negotiateMediaType"]);
});
