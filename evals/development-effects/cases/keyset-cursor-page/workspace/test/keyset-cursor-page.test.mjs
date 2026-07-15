import assert from "node:assert/strict";
import test from "node:test";

import { pageAfterCursor } from "../src/index.mjs";

test("orders distinct timestamps and continues after a cursor", () => {
  const oldest = { id: "old", updatedAt: 100 };
  const newest = { id: "new", updatedAt: 300 };
  const middle = { id: "mid", updatedAt: 200 };
  const records = [oldest, newest, middle];
  const originalOrder = [...records];

  const first = pageAfterCursor(records, null, 2);
  assert.deepEqual(first.items, [newest, middle]);
  assert.deepEqual(first.nextCursor, { id: "mid", updatedAt: 200 });
  assert.deepEqual(records, originalOrder);

  const second = pageAfterCursor(records, first.nextCursor, 2);
  assert.deepEqual(second.items, [oldest]);
  assert.equal(second.nextCursor, null);
});

test("returns an empty terminal page after the oldest timestamp", () => {
  const records = [
    { id: "new", updatedAt: 20 },
    { id: "old", updatedAt: 10 },
  ];
  assert.deepEqual(
    pageAfterCursor(records, { id: "past", updatedAt: 0 }, 1),
    { items: [], nextCursor: null },
  );
});

test("rejects basic invalid inputs", () => {
  assert.throws(() => pageAfterCursor(null, null, 1), TypeError);
  assert.throws(() => pageAfterCursor([{ id: "", updatedAt: 1 }], null, 1), TypeError);
  assert.throws(() => pageAfterCursor([{ id: "ok", updatedAt: 1.5 }], null, 1), TypeError);
  assert.throws(() => pageAfterCursor([], {}, 1), TypeError);
  assert.throws(() => pageAfterCursor([], null, 0), TypeError);
});

test("keeps pageAfterCursor as the public named export", async () => {
  const direct = await import("../src/keyset-cursor-page.mjs");
  const publicApi = await import("../src/index.mjs");
  assert.equal(publicApi.pageAfterCursor, direct.pageAfterCursor);
  assert.deepEqual(Object.keys(direct), ["pageAfterCursor"]);
  assert.deepEqual(Object.keys(publicApi), ["pageAfterCursor"]);
});
