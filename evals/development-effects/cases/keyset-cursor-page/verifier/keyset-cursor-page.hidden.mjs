import assert from "node:assert/strict";
import test from "node:test";

import * as directApi from "../src/keyset-cursor-page.mjs";
import * as publicApi from "../src/index.mjs";

const { pageAfterCursor } = directApi;

test("orders by descending updatedAt then ascending id and continues through ties", () => {
  const newest = { id: "z-new", updatedAt: 600 };
  const tiedA = { id: "item-a", updatedAt: 500 };
  const tiedB = { id: "item-b", updatedAt: 500 };
  const tiedC = { id: "item-c", updatedAt: 500 };
  const oldest = { id: "a-old", updatedAt: 400 };
  const records = [tiedC, oldest, tiedB, newest, tiedA];

  const first = pageAfterCursor(records, null, 3);
  assert.deepEqual(first.items, [newest, tiedA, tiedB]);
  assert.deepEqual(first.nextCursor, { id: "item-b", updatedAt: 500 });

  const second = pageAfterCursor(records, first.nextCursor, 3);
  assert.deepEqual(second.items, [tiedC, oldest]);
  assert.equal(second.nextCursor, null);
});

test("treats a non-existent cursor as a tuple boundary", () => {
  const tiedA = { id: "item-a", updatedAt: 500 };
  const tiedB = { id: "item-b", updatedAt: 500 };
  const tiedC = { id: "item-c", updatedAt: 500 };
  const older = { id: "older", updatedAt: 400 };
  const records = [older, tiedC, tiedA, tiedB];

  const page = pageAfterCursor(
    records,
    { id: "item-bb", updatedAt: 500 },
    5,
  );
  assert.deepEqual(page.items, [tiedC, older]);
  assert.equal(page.nextCursor, null);
});

test("uses a strict cursor boundary and never repeats the cursor record", () => {
  const before = { id: "item-a", updatedAt: 50 };
  const at = { id: "item-b", updatedAt: 50 };
  const after = { id: "item-c", updatedAt: 50 };
  const older = { id: "older", updatedAt: 40 };
  const page = pageAfterCursor(
    [older, at, after, before],
    { id: "item-b", updatedAt: 50 },
    3,
  );
  assert.deepEqual(page.items, [after, older]);
});

test("emits nextCursor only when another ordered record remains", () => {
  const first = { id: "first", updatedAt: 30 };
  const second = { id: "second", updatedAt: 20 };
  const third = { id: "third", updatedAt: 10 };
  const records = [third, first, second];

  const partial = pageAfterCursor(records, null, 2);
  assert.deepEqual(partial.nextCursor, { id: "second", updatedAt: 20 });
  assert.equal(Object.getPrototypeOf(partial.nextCursor), Object.prototype);
  assert.deepEqual(Object.keys(partial.nextCursor), ["id", "updatedAt"]);

  const exact = pageAfterCursor(records, null, 3);
  const oversized = pageAfterCursor(records, null, 10);
  const empty = pageAfterCursor(records, { id: "past", updatedAt: 0 }, 2);
  assert.equal(exact.nextCursor, null);
  assert.equal(oversized.nextCursor, null);
  assert.deepEqual(empty, { items: [], nextCursor: null });
});

test("preserves input order and returns fresh containers with original record references", () => {
  const first = Object.freeze({ id: "first", updatedAt: 30 });
  const second = Object.freeze({ id: "second", updatedAt: 20 });
  const third = Object.freeze({ id: "third", updatedAt: 10 });
  const records = [third, first, second];
  const originalOrder = [...records];

  const page = pageAfterCursor(records, null, 2);
  const repeated = pageAfterCursor(records, null, 2);
  assert.deepEqual(records, originalOrder);
  assert.equal(page.items[0], first);
  assert.equal(page.items[1], second);
  assert.notEqual(page.items, repeated.items);
  assert.notEqual(page.nextCursor, repeated.nextCursor);
  assert.equal(Object.getPrototypeOf(page.items), Array.prototype);
  assert.equal(Object.getPrototypeOf(page), Object.prototype);
  assert.deepEqual(Object.keys(page), ["items", "nextCursor"]);

  page.items.reverse();
  page.nextCursor.id = "changed";
  const afterCallerMutation = pageAfterCursor(records, null, 2);
  assert.deepEqual(afterCallerMutation.items, [first, second]);
  assert.deepEqual(afterCallerMutation.nextCursor, { id: "second", updatedAt: 20 });

  const frozenRecords = Object.freeze([third, first, second]);
  assert.deepEqual(pageAfterCursor(frozenRecords, null, 3).items, [first, second, third]);

  const sortedRecords = [first, second, third];
  const terminal = pageAfterCursor(sortedRecords, null, 3);
  assert.notEqual(terminal.items, sortedRecords);
  terminal.items.pop();
  assert.deepEqual(sortedRecords, [first, second, third]);
});

test("validates the records array exactly without invoking element accessors", () => {
  const validRecord = { id: "valid", updatedAt: 1 };
  const sparse = [];
  sparse.length = 1;
  const extra = [validRecord];
  extra.note = true;
  const symbol = [validRecord];
  symbol[Symbol("extra")] = true;
  let elementGetterCalls = 0;
  const accessor = [];
  Object.defineProperty(accessor, "0", {
    enumerable: true,
    get() {
      elementGetterCalls += 1;
      return validRecord;
    },
  });
  accessor.length = 1;

  for (const invalid of [sparse, extra, symbol, accessor]) {
    assert.throws(() => pageAfterCursor(invalid, null, 1), TypeError);
  }
  assert.equal(elementGetterCalls, 0);
});

test("validates every record as an exact ordinary tuple without invoking accessors", () => {
  let recordGetterCalls = 0;
  const accessorId = { updatedAt: 1 };
  Object.defineProperty(accessorId, "id", {
    enumerable: true,
    get() {
      recordGetterCalls += 1;
      return "accessor";
    },
  });
  const accessorTimestamp = { id: "accessor" };
  Object.defineProperty(accessorTimestamp, "updatedAt", {
    enumerable: true,
    get() {
      recordGetterCalls += 1;
      return 1;
    },
  });
  const inherited = Object.create({ inherited: true });
  inherited.id = "inherited";
  inherited.updatedAt = 1;
  const symbolExtra = { id: "symbol-extra", updatedAt: 1 };
  symbolExtra[Symbol("extra")] = true;
  const nonEnumerableExtra = { id: "hidden-extra", updatedAt: 1 };
  Object.defineProperty(nonEnumerableExtra, "extra", { value: true });

  for (const invalid of [
    null,
    [],
    Object.assign(Object.create(null), { id: "null-proto", updatedAt: 1 }),
    inherited,
    { id: "extra", updatedAt: 1, extra: true },
    symbolExtra,
    nonEnumerableExtra,
    { id: "", updatedAt: 1 },
    { id: new String("boxed"), updatedAt: 1 },
    { id: "unsafe", updatedAt: Number.MAX_SAFE_INTEGER + 1 },
    { id: "fraction", updatedAt: 1.5 },
    accessorId,
    accessorTimestamp,
  ]) {
    assert.throws(() => pageAfterCursor([invalid], null, 1), TypeError);
  }
  assert.throws(
    () => pageAfterCursor([
      { id: "duplicate", updatedAt: 2 },
      { id: "duplicate", updatedAt: 1 },
    ], null, 1),
    TypeError,
  );
  assert.equal(recordGetterCalls, 0);
});

test("validates cursor and limit exactly without invoking cursor accessors", () => {
  let cursorGetterCalls = 0;
  const accessorCursor = { updatedAt: 1 };
  Object.defineProperty(accessorCursor, "id", {
    enumerable: true,
    get() {
      cursorGetterCalls += 1;
      return "cursor";
    },
  });
  const symbolExtraCursor = { id: "cursor", updatedAt: 1 };
  symbolExtraCursor[Symbol("extra")] = true;
  const nonEnumerableExtraCursor = { id: "cursor", updatedAt: 1 };
  Object.defineProperty(nonEnumerableExtraCursor, "extra", { value: true });

  for (const invalidCursor of [
    undefined,
    {},
    [],
    Object.assign(Object.create(null), { id: "cursor", updatedAt: 1 }),
    { id: "cursor", updatedAt: 1, extra: true },
    symbolExtraCursor,
    nonEnumerableExtraCursor,
    { id: "", updatedAt: 1 },
    { id: "cursor", updatedAt: 1.5 },
    accessorCursor,
  ]) {
    assert.throws(() => pageAfterCursor([], invalidCursor, 1), TypeError);
  }
  assert.equal(cursorGetterCalls, 0);

  for (const invalidLimit of [
    undefined,
    null,
    0,
    -1,
    1.5,
    Number.MAX_SAFE_INTEGER + 1,
    "1",
  ]) {
    assert.throws(() => pageAfterCursor([], null, invalidLimit), TypeError);
  }
});

test("preserves the exact direct and public named export surfaces", () => {
  assert.equal(publicApi.pageAfterCursor, pageAfterCursor);
  assert.deepEqual(Object.keys(directApi), ["pageAfterCursor"]);
  assert.deepEqual(Object.keys(publicApi), ["pageAfterCursor"]);
});
