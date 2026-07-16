import assert from "node:assert/strict";
import test from "node:test";

import * as directApi from "../src/forward-header-sanitization.mjs";
import * as publicApi from "../src/index.mjs";

const { sanitizeForwardHeaders } = directApi;

function descriptorSnapshot(value) {
  return Reflect.ownKeys(value).map((key) => [
    key,
    Object.getOwnPropertyDescriptor(value, key),
  ]);
}

const TCHARS = new Set("!#$%&'*+-.^_`|~0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz");

function codeUnitLabel(code) {
  return `U+${code.toString(16).toUpperCase().padStart(4, "0")}`;
}

test("preserves the exact direct and public named export surfaces", () => {
  assert.equal(publicApi.sanitizeForwardHeaders, sanitizeForwardHeaders);
  assert.deepEqual(Object.keys(directApi), ["sanitizeForwardHeaders"]);
  assert.deepEqual(Object.keys(publicApi), ["sanitizeForwardHeaders"]);
});

test("removes the complete fixed hop-by-hop set case-insensitively", () => {
  const headers = [
    { name: "Connection", value: "X-Connection-Only" },
    { name: "KEEP-ALIVE", value: "timeout=5" },
    { name: "Proxy-Authenticate", value: "Basic realm=proxy" },
    { name: "proxy-authorization", value: "Basic abc" },
    { name: "Te", value: "trailers" },
    { name: "TRAILER", value: "Expires" },
    { name: "Transfer-Encoding", value: "chunked" },
    { name: "UPGRADE", value: "websocket" },
    { name: "Content-Type", value: "text/plain" },
  ];

  assert.deepEqual(
    sanitizeForwardHeaders(headers),
    [{ name: "Content-Type", value: "text/plain" }],
  );
});

test("unions every Connection nomination and removes exact names regardless of order", () => {
  const headers = [
    { name: "X-Trace", value: "before" },
    { name: "connection", value: "\tX-Trace , x-debug\t" },
    { name: "X-Debug", value: "middle" },
    { name: "Connection", value: " x-extra" },
    { name: "x-extra", value: "after" },
    { name: "Content-Type", value: "application/json" },
  ];

  assert.deepEqual(
    sanitizeForwardHeaders(headers),
    [{ name: "Content-Type", value: "application/json" }],
  );
});

test("uses exact case-insensitive nomination matching rather than substrings", () => {
  const headers = [
    { name: "Connection", value: "X-Trace-Id" },
    { name: "X-Trace", value: "keep-shorter" },
    { name: "x-trace-id", value: "remove-exact" },
    { name: "X-Trace-Id-Extra", value: "keep-longer" },
  ];

  assert.deepEqual(sanitizeForwardHeaders(headers), [
    { name: "X-Trace", value: "keep-shorter" },
    { name: "X-Trace-Id-Extra", value: "keep-longer" },
  ]);
});

test("preserves surviving duplicate order, spelling, and values", () => {
  const headers = [
    { name: "X-Dupe", value: "first" },
    { name: "Connection", value: "X-Remove" },
    { name: "x-dupe", value: "second" },
    { name: "X-Remove", value: "gone" },
    { name: "X-Dupe", value: "third" },
  ];

  assert.deepEqual(sanitizeForwardHeaders(headers), [
    { name: "X-Dupe", value: "first" },
    { name: "x-dupe", value: "second" },
    { name: "X-Dupe", value: "third" },
  ]);
});

test("accepts an empty list and the exact allowed name and value boundaries", () => {
  const empty = [];
  const firstEmpty = sanitizeForwardHeaders(empty);
  const secondEmpty = sanitizeForwardHeaders(empty);
  assert.deepEqual(firstEmpty, []);
  assert.deepEqual(secondEmpty, []);
  assert.notEqual(firstEmpty, empty);
  assert.notEqual(secondEmpty, empty);
  assert.notEqual(firstEmpty, secondEmpty);

  const boundary = {
    name: "!#$%&'*+-.^_`|~AZaz09",
    value: "\t ~",
  };
  assert.deepEqual(sanitizeForwardHeaders([boundary]), [{ ...boundary }]);
  assert.deepEqual(
    sanitizeForwardHeaders([{ name: "X-Empty", value: "" }]),
    [{ name: "X-Empty", value: "" }],
  );
});

test("rejects empty and malformed Connection token lists", () => {
  for (const value of [
    "",
    " \t ",
    ",X-Trace",
    "X-Trace,",
    "X-Trace,,X-Debug",
    "X-Trace, \t, X-Debug",
    "X-Trace, bad token",
    "X-Trace, bad/token",
  ]) {
    assert.throws(
      () => sanitizeForwardHeaders([{ name: "Connection", value }]),
      TypeError,
      JSON.stringify(value),
    );
  }
});

test("requires a dense exact array of enumerable data elements", () => {
  const valid = { name: "Content-Type", value: "text/plain" };
  const sparse = [];
  sparse.length = 1;
  const extra = [valid];
  extra.label = "request";
  const hiddenExtra = [valid];
  Object.defineProperty(hiddenExtra, "hidden", { value: true });
  const symbolExtra = [valid];
  symbolExtra[Symbol("extra")] = true;
  const customPrototype = [valid];
  Object.setPrototypeOf(customPrototype, Object.create(Array.prototype));
  const nonEnumerable = [valid];
  Object.defineProperty(nonEnumerable, "0", {
    configurable: true,
    enumerable: false,
    value: valid,
    writable: true,
  });
  let elementReads = 0;
  const accessor = [];
  Object.defineProperty(accessor, "0", {
    configurable: true,
    enumerable: true,
    get() {
      elementReads += 1;
      return valid;
    },
  });
  accessor.length = 1;

  for (const headers of [
    undefined,
    null,
    {},
    sparse,
    extra,
    hiddenExtra,
    symbolExtra,
    customPrototype,
    nonEnumerable,
    accessor,
  ]) {
    assert.throws(() => sanitizeForwardHeaders(headers), TypeError);
  }
  assert.equal(elementReads, 0);
});

test("requires exact ordinary header records with enumerable data fields", () => {
  const valid = { name: "Content-Type", value: "text/plain" };
  const inherited = Object.create({ inherited: true });
  inherited.name = "Content-Type";
  inherited.value = "text/plain";
  const extra = { ...valid, extra: true };
  const hiddenExtra = { ...valid };
  Object.defineProperty(hiddenExtra, "extra", { value: true });
  const symbolExtra = { ...valid };
  symbolExtra[Symbol("extra")] = true;
  const nonEnumerable = { value: "text/plain" };
  Object.defineProperty(nonEnumerable, "name", {
    enumerable: false,
    value: "Content-Type",
  });
  let fieldReads = 0;
  const accessorName = { value: "text/plain" };
  Object.defineProperty(accessorName, "name", {
    enumerable: true,
    get() {
      fieldReads += 1;
      return "Content-Type";
    },
  });
  const accessorValue = { name: "Content-Type" };
  Object.defineProperty(accessorValue, "value", {
    enumerable: true,
    get() {
      fieldReads += 1;
      return "text/plain";
    },
  });

  for (const header of [
    null,
    [],
    Object.assign(Object.create(null), valid),
    inherited,
    { name: "Content-Type" },
    { value: "text/plain" },
    extra,
    hiddenExtra,
    symbolExtra,
    nonEnumerable,
    accessorName,
    accessorValue,
  ]) {
    assert.throws(() => sanitizeForwardHeaders([header]), TypeError);
  }
  assert.equal(fieldReads, 0);
});

test("accepts only primitive tchar names and primitive safe ASCII values", () => {
  const invalidNames = [
    "",
    "bad name",
    "bad:name",
    "bad/name",
    "caf\u00e9",
    new String("X-Name"),
  ];
  const invalidValues = [
    "line\rbreak",
    "line\nbreak",
    "nul\0byte",
    "delete\x7f",
    "caf\u00e9",
    new String("value"),
  ];
  for (const name of invalidNames) {
    assert.throws(
      () => sanitizeForwardHeaders([{ name, value: "safe" }]),
      TypeError,
    );
  }
  for (const value of invalidValues) {
    assert.throws(
      () => sanitizeForwardHeaders([{ name: "X-Name", value }]),
      TypeError,
    );
  }

  let coercions = 0;
  const coercible = {};
  Object.defineProperty(coercible, Symbol.toPrimitive, {
    get() {
      coercions += 1;
      return () => "coerced";
    },
  });
  assert.throws(
    () => sanitizeForwardHeaders([{ name: coercible, value: "safe" }]),
    TypeError,
  );
  assert.throws(
    () => sanitizeForwardHeaders([{ name: "X-Name", value: coercible }]),
    TypeError,
  );
  assert.equal(coercions, 0);
});

test("enforces every ASCII name and value code-unit boundary", () => {
  for (let code = 0; code <= 0xff; code += 1) {
    const name = String.fromCharCode(code);
    const invoke = () => sanitizeForwardHeaders([{ name, value: "safe" }]);
    if (code <= 0x7f && TCHARS.has(name)) {
      assert.deepEqual(invoke(), [{ name, value: "safe" }], codeUnitLabel(code));
    } else {
      assert.throws(invoke, TypeError, codeUnitLabel(code));
    }
  }

  for (let code = 0; code <= 0xff; code += 1) {
    const value = String.fromCharCode(code);
    const invoke = () => sanitizeForwardHeaders([{ name: "X-Boundary", value }]);
    if (code === 0x09 || (code >= 0x20 && code <= 0x7e)) {
      assert.deepEqual(
        invoke(),
        [{ name: "X-Boundary", value }],
        codeUnitLabel(code),
      );
    } else {
      assert.throws(invoke, TypeError, codeUnitLabel(code));
    }
  }

  for (const code of [0x100, 0x1000, 0xd800, 0xffff]) {
    const nonAscii = String.fromCharCode(code);
    assert.throws(
      () => sanitizeForwardHeaders([{ name: nonAscii, value: "safe" }]),
      TypeError,
      `name ${codeUnitLabel(code)}`,
    );
    assert.throws(
      () => sanitizeForwardHeaders([{ name: "X-Boundary", value: nonAscii }]),
      TypeError,
      `value ${codeUnitLabel(code)}`,
    );
  }
});

test("enforces every Connection token-member code-unit boundary", () => {
  for (let code = 0; code <= 0xff; code += 1) {
    const member = String.fromCharCode(code);
    const invoke = () => sanitizeForwardHeaders([
      { name: "Connection", value: `\t${member} \t` },
      { name: "X-Keep", value: "kept" },
    ]);
    if (code <= 0x7f && TCHARS.has(member)) {
      assert.deepEqual(
        invoke(),
        [{ name: "X-Keep", value: "kept" }],
        codeUnitLabel(code),
      );
    } else {
      assert.throws(invoke, TypeError, codeUnitLabel(code));
    }
  }

  for (const code of [0x100, 0x1000, 0xd800, 0xffff]) {
    const member = String.fromCharCode(code);
    assert.throws(
      () => sanitizeForwardHeaders([
        { name: "Connection", value: `X-Good, ${member}` },
        { name: "X-Keep", value: "kept" },
      ]),
      TypeError,
      codeUnitLabel(code),
    );
  }
});

test("validates removed entries before filtering without invoking accessors", () => {
  const invalidRemoved = {
    name: "Transfer-Encoding",
    value: "chunked\r\nX-Injected: yes",
  };
  assert.throws(
    () => sanitizeForwardHeaders([
      { name: "Content-Type", value: "text/plain" },
      invalidRemoved,
    ]),
    TypeError,
  );

  let reads = 0;
  const accessorRemoved = { name: "Upgrade" };
  Object.defineProperty(accessorRemoved, "value", {
    enumerable: true,
    get() {
      reads += 1;
      return "websocket";
    },
  });
  assert.throws(
    () => sanitizeForwardHeaders([accessorRemoved]),
    TypeError,
  );
  assert.equal(reads, 0);
});

test("returns repeatably deep-fresh exact ordinary output without mutating input", () => {
  const firstInput = Object.freeze({ name: "X-First", value: "one" });
  const removedInput = Object.freeze({ name: "Connection", value: "X-Gone" });
  const secondInput = Object.freeze({ name: "X-Second", value: "two\twords" });
  const goneInput = Object.freeze({ name: "x-gone", value: "secret" });
  const firstDuplicate = Object.freeze({ name: "X-Dupe", value: "same" });
  const secondDuplicate = Object.freeze({ name: "X-Dupe", value: "same" });
  const headers = Object.freeze([
    firstInput,
    removedInput,
    firstDuplicate,
    secondInput,
    secondDuplicate,
    goneInput,
  ]);
  const beforeArray = descriptorSnapshot(headers);
  const beforeRecords = headers.map(descriptorSnapshot);

  const first = sanitizeForwardHeaders(headers);
  const second = sanitizeForwardHeaders(headers);
  const expected = [
    { name: "X-First", value: "one" },
    { name: "X-Dupe", value: "same" },
    { name: "X-Second", value: "two\twords" },
    { name: "X-Dupe", value: "same" },
  ];

  assert.deepEqual(first, expected);
  assert.deepEqual(second, expected);
  assert.notEqual(first, headers);
  assert.notEqual(second, headers);
  assert.notEqual(first, second);
  assert.equal(Object.getPrototypeOf(first), Array.prototype);
  assert.equal(Object.getPrototypeOf(second), Array.prototype);
  for (const output of [first, second]) {
    assert.deepEqual(Reflect.ownKeys(output), ["0", "1", "2", "3", "length"]);
    assert.equal(new Set(output).size, output.length);
    for (const record of output) {
      assert.equal(Object.getPrototypeOf(record), Object.prototype);
      assert.deepEqual(Reflect.ownKeys(record), ["name", "value"]);
      for (const key of ["name", "value"]) {
        const descriptor = Object.getOwnPropertyDescriptor(record, key);
        assert.equal(descriptor.enumerable, true);
        assert.equal(Object.hasOwn(descriptor, "value"), true);
      }
      assert.equal(headers.includes(record), false);
    }
  }
  for (const firstRecord of first) {
    for (const secondRecord of second) {
      assert.notEqual(firstRecord, secondRecord);
    }
  }
  assert.deepEqual(descriptorSnapshot(headers), beforeArray);
  assert.deepEqual(headers.map(descriptorSnapshot), beforeRecords);
});
