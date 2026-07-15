import assert from "node:assert/strict";
import test from "node:test";

import * as directApi from "../src/safe-redirect.mjs";
import * as publicApi from "../src/index.mjs";

const { resolveSafeRedirect } = directApi;
const APP = "https://app.example";
const CDN = "https://cdn.example";

test("preserves the exact direct and public named export surface", () => {
  assert.equal(publicApi.resolveSafeRedirect, resolveSafeRedirect);
  assert.deepEqual(Object.keys(directApi), ["resolveSafeRedirect"]);
  assert.deepEqual(Object.keys(publicApi), ["resolveSafeRedirect"]);
});

test("normalizes relative, absolute, and scheme-relative redirects", () => {
  const allowed = [APP, CDN];

  assert.equal(
    resolveSafeRedirect("settings/../profile?view=full#bio", APP, allowed),
    "https://app.example/profile?view=full#bio",
  );
  assert.equal(
    resolveSafeRedirect("https://app.example:443/a/../b", APP, allowed),
    "https://app.example/b",
  );
  assert.equal(
    resolveSafeRedirect("//cdn.example/assets/../app.js?x=1#main", APP, allowed),
    "https://cdn.example/app.js?x=1#main",
  );
});

test("normalizes canonical HTTP and isolates non-default HTTPS ports", () => {
  const HTTP_APP = "http://app.example";
  const HTTPS_ADMIN = "https://app.example:8443";

  assert.equal(
    resolveSafeRedirect("/status", HTTP_APP, [HTTP_APP]),
    "http://app.example/status",
  );
  assert.equal(
    resolveSafeRedirect("http://app.example:80/a/../health", HTTP_APP, [HTTP_APP]),
    "http://app.example/health",
  );
  assert.equal(
    resolveSafeRedirect("../admin?mode=safe", HTTPS_ADMIN, [HTTPS_ADMIN]),
    "https://app.example:8443/admin?mode=safe",
  );
  assert.equal(
    resolveSafeRedirect(
      "https://app.example:8443/control",
      APP,
      [APP, HTTPS_ADMIN],
    ),
    "https://app.example:8443/control",
  );
  assert.equal(
    resolveSafeRedirect(
      "https://app.example:9443/control",
      APP,
      [APP, HTTPS_ADMIN],
    ),
    null,
  );
});

test("uses exact canonical origins instead of host text boundaries", () => {
  const allowed = [APP, "https://safe.example"];

  assert.equal(
    resolveSafeRedirect("https://safe.example/welcome", APP, allowed),
    "https://safe.example/welcome",
  );
  for (const target of [
    "http://safe.example/welcome",
    "https://safe.example:8443/welcome",
    "https://safe.example.evil.invalid/welcome",
    "https://evil-safe.example/welcome",
    "https://safe.example@evil.invalid/welcome",
  ]) {
    assert.equal(resolveSafeRedirect(target, APP, allowed), null);
  }
});

test("returns null for invalid, credentialed, or non-web targets", () => {
  const allowed = [APP, CDN];

  for (const target of [
    "http://[::1",
    "javascript:alert(1)",
    "data:text/plain,hello",
    "https://user@app.example/private",
    "https://:secret@app.example/private",
    "//user:secret@cdn.example/private",
    "\\\\cdn.example/assets/app.js",
    "\thttps://app.example/private",
    "https://app.example/path\ncontinued",
    "\u0000https://app.example/private",
    "https://app.example\u0000.evil.invalid/private",
    "https://app.\rexample/private",
    "https://app.example/secure\rarea",
    "//cdn.example/asset\u007fmap.js",
  ]) {
    assert.equal(resolveSafeRedirect(target, APP, allowed), null, target);
  }
});

test("requires primitive nonempty target and base strings", () => {
  for (const target of [undefined, null, 1, new String("/home"), ""]) {
    assert.throws(
      () => resolveSafeRedirect(target, APP, [APP]),
      TypeError,
    );
  }

  for (const base of [undefined, null, 1, new String(APP), ""]) {
    assert.throws(
      () => resolveSafeRedirect("/home", base, [APP]),
      TypeError,
    );
  }
});

test("requires the base to be a canonical HTTP or HTTPS origin", () => {
  for (const base of [
    "ftp://app.example",
    "https://APP.example",
    "https://app.example:443",
    "https://user@app.example",
    "https://app.example/",
    "https://app.example/path",
    "https://app.example?query=1",
    "https://app.example#fragment",
    "not an origin",
  ]) {
    assert.throws(
      () => resolveSafeRedirect("/home", base, [base]),
      TypeError,
      base,
    );
  }
});

test("requires a dense unique canonical origin allowlist containing the base", () => {
  const sparse = [APP];
  sparse.length = 2;

  const extraKey = [APP];
  extraKey.label = "primary";

  const extraSymbol = [APP];
  extraSymbol[Symbol("metadata")] = true;

  const nonEnumerable = [APP, CDN];
  Object.defineProperty(nonEnumerable, "1", {
    value: CDN,
    enumerable: false,
    writable: true,
    configurable: true,
  });

  const invalidLists = [
    undefined,
    null,
    {},
    [],
    [CDN],
    [APP, APP],
    [APP, new String(CDN)],
    [APP, ""],
    [APP, "ftp://files.example"],
    [APP, "https://cdn.example:443"],
    [APP, "https://CDN.example"],
    [APP, "https://cdn.example/"],
    sparse,
    extraKey,
    extraSymbol,
    nonEnumerable,
  ];

  for (const allowed of invalidLists) {
    assert.throws(
      () => resolveSafeRedirect("/home", APP, allowed),
      TypeError,
    );
  }
});

test("rejects accessor elements without invoking them", () => {
  let reads = 0;
  const allowed = [APP];
  Object.defineProperty(allowed, "0", {
    enumerable: true,
    configurable: true,
    get() {
      reads += 1;
      throw new Error("allowlist accessors must not run");
    },
  });

  assert.throws(
    () => resolveSafeRedirect("/home", APP, allowed),
    TypeError,
  );
  assert.equal(reads, 0);
});

test("does not modify caller-owned allowlists", () => {
  const allowed = Object.freeze([APP, CDN]);
  const before = Reflect.ownKeys(allowed).map((key) => [
    key,
    Object.getOwnPropertyDescriptor(allowed, key),
  ]);

  assert.equal(
    resolveSafeRedirect("/docs", APP, allowed),
    "https://app.example/docs",
  );
  assert.deepEqual(
    Reflect.ownKeys(allowed).map((key) => [
      key,
      Object.getOwnPropertyDescriptor(allowed, key),
    ]),
    before,
  );
});
