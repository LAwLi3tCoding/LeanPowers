import assert from "node:assert/strict";
import test from "node:test";

import * as directApi from "../src/structured-log-redaction.mjs";
import * as publicApi from "../src/index.mjs";

const { redactStructuredLog } = directApi;

test("redacts exact object-property matches through objects and arrays", () => {
  const record = {
    token: "outer-secret",
    Token: "case-sensitive-value",
    entries: [
      { token: "nested-secret", "0": "object-property-secret", keep: true },
      "array-element-zero",
      [{ token: "deep-secret" }],
    ],
    "0": "root-object-property-secret",
  };

  const result = redactStructuredLog(record, ["token", "0"]);

  assert.deepEqual(result, {
    token: "[REDACTED]",
    Token: "case-sensitive-value",
    entries: [
      { token: "[REDACTED]", "0": "[REDACTED]", keep: true },
      "array-element-zero",
      [{ token: "[REDACTED]" }],
    ],
    "0": "[REDACTED]",
  });
});

test("returns a completely fresh deep copy and leaves inputs isolated", () => {
  const record = {
    context: {
      tags: ["api", { enabled: true }],
      credentials: { token: "nested-secret", keep: "visible" },
    },
    ["password"]: "top-secret",
  };
  const before = structuredClone(record);

  const result = redactStructuredLog(record, ["password", "token"]);

  assert.deepEqual(record, before);
  assert.deepEqual(result, {
    context: {
      tags: ["api", { enabled: true }],
      credentials: { token: "[REDACTED]", keep: "visible" },
    },
    ["password"]: "[REDACTED]",
  });
  assert.notEqual(result, record);
  assert.notEqual(result.context, record.context);
  assert.notEqual(result.context.tags, record.context.tags);
  assert.notEqual(result.context.tags[1], record.context.tags[1]);
  assert.notEqual(result.context.credentials, record.context.credentials);

  result.context.tags[1].enabled = false;
  result.context.credentials.keep = "changed-result";
  assert.deepEqual(record, before);

  record.context.tags[0] = "changed-input";
  assert.equal(result.context.tags[0], "api");
});

test("preserves finite primitives, key order, and special own property names", () => {
  const record = {
    first: null,
    enabled: false,
    count: -0,
    message: "kept",
    last: 1.25,
  };
  Object.defineProperty(record, "__proto__", {
    configurable: true,
    enumerable: true,
    value: "ordinary-own-value",
    writable: true,
  });

  const result = redactStructuredLog(record, ["unused"]);

  assert.deepEqual(Object.keys(result), Object.keys(record));
  assert.equal(Object.getPrototypeOf(result), Object.prototype);
  assert.equal(Object.hasOwn(result, "__proto__"), true);
  assert.equal(result.__proto__, "ordinary-own-value");
  assert.equal(Object.is(result.count, -0), true);
  assert.deepEqual(result, record);
});

test("short-circuits a sensitive data-property value without inspecting it", () => {
  let reads = 0;
  const opaqueSecret = {};
  Object.defineProperty(opaqueSecret, "danger", {
    enumerable: true,
    get() {
      reads += 1;
      throw new Error("sensitive value was traversed");
    },
  });
  const record = { event: "payment", secret: opaqueSecret };

  assert.deepEqual(redactStructuredLog(record, ["secret"]), {
    event: "payment",
    secret: "[REDACTED]",
  });
  assert.equal(reads, 0);
  assert.equal(record.secret, opaqueSecret);
});

test("rejects cycles and non-JSON values on non-sensitive branches", () => {
  const selfCycle = {};
  selfCycle.self = selfCycle;
  const first = {};
  const second = { first };
  first.second = second;
  const arrayCycle = [];
  arrayCycle.push(arrayCycle);

  for (const value of [
    undefined,
    NaN,
    Infinity,
    -Infinity,
    1n,
    Symbol("value"),
    () => "value",
    new Date(0),
    Object.create(null),
    selfCycle,
    first,
    arrayCycle,
  ]) {
    assert.throws(
      () => redactStructuredLog({ payload: value }, ["secret"]),
      TypeError,
    );
  }
});

test("requires ordinary objects with enumerable string data properties", () => {
  let accessorReads = 0;
  const accessorValue = {};
  Object.defineProperty(accessorValue, "value", {
    enumerable: true,
    get() {
      accessorReads += 1;
      return "invalid";
    },
  });
  const sensitiveAccessor = {};
  Object.defineProperty(sensitiveAccessor, "secret", {
    enumerable: true,
    get() {
      accessorReads += 1;
      return "must not be read";
    },
  });
  const nonEnumerable = { visible: true };
  Object.defineProperty(nonEnumerable, "hidden", {
    enumerable: false,
    value: "invalid",
  });
  const symbolProperty = { visible: true };
  symbolProperty[Symbol("hidden")] = "invalid";
  class RecordValue {
    constructor() {
      this.value = "invalid";
    }
  }

  for (const record of [
    accessorValue,
    sensitiveAccessor,
    nonEnumerable,
    symbolProperty,
    Object.assign(Object.create(null), { value: "invalid" }),
    new RecordValue(),
  ]) {
    assert.throws(() => redactStructuredLog(record, ["secret"]), TypeError);
  }
  assert.equal(accessorReads, 0);
});

test("requires dense arrays of own enumerable data elements and no extra keys", () => {
  let accessorReads = 0;
  const sparse = ["first"];
  sparse.length = 2;
  const extraString = ["first"];
  extraString.extra = true;
  const extraSymbol = ["first"];
  extraSymbol[Symbol("extra")] = true;
  const extraNonEnumerable = ["first"];
  Object.defineProperty(extraNonEnumerable, "extra", {
    enumerable: false,
    value: true,
  });
  const accessorElement = [];
  Object.defineProperty(accessorElement, "0", {
    enumerable: true,
    get() {
      accessorReads += 1;
      return "invalid";
    },
  });
  const nonEnumerableElement = [];
  Object.defineProperty(nonEnumerableElement, "0", {
    enumerable: false,
    value: "invalid",
  });

  for (const value of [
    sparse,
    extraString,
    extraSymbol,
    extraNonEnumerable,
    accessorElement,
    nonEnumerableElement,
  ]) {
    assert.throws(
      () => redactStructuredLog({ items: value }, ["secret"]),
      TypeError,
    );
  }
  assert.equal(accessorReads, 0);
});

test("validates sensitiveKeys as a dense nonempty exact set of strings", () => {
  let accessorReads = 0;
  const sparse = ["token"];
  sparse.length = 2;
  const extraString = ["token"];
  extraString.extra = true;
  const extraSymbol = ["token"];
  extraSymbol[Symbol("extra")] = true;
  const extraNonEnumerable = ["token"];
  Object.defineProperty(extraNonEnumerable, "extra", {
    enumerable: false,
    value: true,
  });
  const accessorElement = [];
  Object.defineProperty(accessorElement, "0", {
    enumerable: true,
    get() {
      accessorReads += 1;
      return "token";
    },
  });
  const nonEnumerableElement = [];
  Object.defineProperty(nonEnumerableElement, "0", {
    enumerable: false,
    value: "token",
  });

  for (const keys of [
    null,
    [],
    sparse,
    extraString,
    extraSymbol,
    extraNonEnumerable,
    accessorElement,
    nonEnumerableElement,
    [""],
    [new String("token")],
    ["token", "token"],
  ]) {
    assert.throws(() => redactStructuredLog({}, keys), TypeError);
  }
  assert.equal(accessorReads, 0);
  assert.deepEqual(
    redactStructuredLog({ token: "a", Token: "b" }, ["token", "Token"]),
    { token: "[REDACTED]", Token: "[REDACTED]" },
  );
});

test("requires an ordinary object at the top level", () => {
  for (const record of [
    null,
    true,
    1,
    "record",
    [],
    () => ({}),
  ]) {
    assert.throws(
      () => redactStructuredLog(record, ["secret"]),
      TypeError,
    );
  }
});

test("preserves the exact direct and public named export surface", () => {
  assert.equal(publicApi.redactStructuredLog, redactStructuredLog);
  assert.deepEqual(Object.keys(directApi), ["redactStructuredLog"]);
  assert.deepEqual(Object.keys(publicApi), ["redactStructuredLog"]);
});
