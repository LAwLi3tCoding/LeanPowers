import assert from "node:assert/strict";
import test from "node:test";

import * as directApi from "../src/http-accept-negotiation.mjs";
import * as publicApi from "../src/index.mjs";

const { negotiateMediaType } = directApi;

test("[matching-case] matches case-insensitively and returns the original supported value", () => {
  assert.equal(
    negotiateMediaType("APPLICATION/JSON", ["text/plain", "Application/Json"]),
    "Application/Json",
  );
  assert.throws(
    () => negotiateMediaType("text/plain", ["text/plain", "TEXT/PLAIN"]),
    TypeError,
  );
});

test("[q-weight] selects the candidate with the greatest governing quality", () => {
  assert.equal(
    negotiateMediaType("application/json;q=0.4, text/plain; Q = 0.8", [
      "application/json",
      "text/plain",
    ]),
    "text/plain",
  );
});

test("[specificity] derives each quality from its most specific matching range", () => {
  assert.equal(
    negotiateMediaType("text/*;q=0.9, text/html;q=0.1", ["text/plain", "text/html"]),
    "text/plain",
  );
});

test("[wildcard] supports type wildcards, the universal wildcard, and OWS", () => {
  assert.equal(
    negotiateMediaType("\t text/* ; q=0.6 , */*;q=0.3 \t", [
      "application/json",
      "text/plain",
    ]),
    "text/plain",
  );
  assert.equal(negotiateMediaType("*/*", ["image/png"]), "image/png");
});

test("[q-zero] excludes a candidate whose governing range has quality zero", () => {
  assert.equal(negotiateMediaType("text/plain;q=0", ["text/plain"]), null);
  assert.equal(negotiateMediaType("text/plain;q=0.", ["text/plain"]), null);
  assert.equal(
    negotiateMediaType("text/plain;q=0, text/html;q=1", ["text/plain", "text/html"]),
    "text/html",
  );
});

test("[supported-order] resolves a complete tie with the last supported input", () => {
  assert.equal(
    negotiateMediaType("text/*;q=0.7", ["text/plain", "text/html", "text/css"]),
    "text/css",
  );
});

test("[header-order] uses the earliest equally specific range as a candidate's governor", () => {
  assert.equal(
    negotiateMediaType(
      "application/json;q=0.5, text/plain;q=0.2, text/plain;q=0.8",
      ["text/plain", "application/json"],
    ),
    "application/json",
  );
});

test("[winner-specificity] prefers the more specific governor when candidate qualities tie", () => {
  assert.equal(
    negotiateMediaType("text/*;q=0.7, application/json;q=0.7", [
      "text/plain",
      "application/json",
    ]),
    "application/json",
  );
});

test("[winner-header-order] prefers the candidate governed by the earliest range after equal q and specificity", () => {
  assert.equal(
    negotiateMediaType("application/json;q=0.6, text/plain;q=0.6", [
      "text/plain",
      "application/json",
    ]),
    "application/json",
  );
});

test("[syntax-validation] accepts RFC qvalues and rejects malformed ranges and parameters", () => {
  assert.equal(negotiateMediaType("text/plain;q=1.000", ["text/plain"]), "text/plain");
  assert.equal(negotiateMediaType("text/plain;q=0.125", ["text/plain"]), "text/plain");

  for (const accept of [
    "",
    " ",
    "text/plain,",
    ",text/plain",
    "*/json",
    "text/**",
    "text/plain;level=1",
    "text/plain;q",
    "text/plain;q=",
    "text/plain;q=.5",
    "text/plain;q=0.1234",
    "text/plain;q=1.001",
    "text/plain;q=2",
    "text/plain;q=0.5;q=0.4",
    "text/plain;q=\"0.5\"",
  ]) {
    assert.throws(() => negotiateMediaType(accept, ["text/plain"]), TypeError, accept);
  }
  assert.throws(
    () => negotiateMediaType(new String("text/plain"), ["text/plain"]),
    TypeError,
  );
});

test("[collection-validation] rejects invalid supported arrays without invoking element accessors", () => {
  const sparse = [];
  sparse.length = 1;

  const extra = ["text/plain"];
  extra.note = "not an element";

  const nonEnumerable = ["text/plain"];
  Object.defineProperty(nonEnumerable, "0", { enumerable: false });

  const nonEnumerableExtra = ["text/plain"];
  Object.defineProperty(nonEnumerableExtra, "note", {
    enumerable: false,
    value: "not an element",
  });

  const symbolExtra = ["text/plain"];
  Object.defineProperty(symbolExtra, Symbol("note"), {
    enumerable: true,
    value: "not an element",
  });

  let accessorReads = 0;
  const accessor = [];
  Object.defineProperty(accessor, "0", {
    configurable: true,
    enumerable: true,
    get() {
      accessorReads += 1;
      return "text/plain";
    },
  });
  accessor.length = 1;

  for (const supported of [
    sparse,
    extra,
    nonEnumerable,
    nonEnumerableExtra,
    symbolExtra,
    accessor,
    ["text/plain", 1],
    ["text/plain;level=1"],
    ["text"],
    ["text/plain/extra"],
    ["/plain"],
    ["text/"],
    ["text plain/plain"],
    ["*/plain"],
    ["text/*"],
  ]) {
    assert.throws(() => negotiateMediaType("text/plain", supported), TypeError);
  }
  assert.equal(accessorReads, 0);
});

test("[immutability] leaves the supported array and its descriptors unchanged", () => {
  const supported = ["application/json", "text/plain", "text/html"];
  const beforeValues = [...supported];
  const beforeDescriptors = Object.getOwnPropertyDescriptors(supported);

  assert.equal(negotiateMediaType("text/plain", supported), "text/plain");
  assert.deepEqual(supported, beforeValues);
  assert.deepEqual(Object.getOwnPropertyDescriptors(supported), beforeDescriptors);
});

test("[exports] preserves the exact direct and public named export surface", () => {
  assert.equal(publicApi.negotiateMediaType, negotiateMediaType);
  assert.deepEqual(Object.keys(directApi), ["negotiateMediaType"]);
  assert.deepEqual(Object.keys(publicApi), ["negotiateMediaType"]);
});
