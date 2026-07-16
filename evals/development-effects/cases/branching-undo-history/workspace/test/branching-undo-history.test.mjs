import assert from "node:assert/strict";
import test from "node:test";

import { createUndoHistory } from "../src/index.mjs";

test("moves through a linear history one entry at a time", () => {
  const initial = { id: "initial" };
  const first = { id: "first" };
  const second = { id: "second" };
  const history = createUndoHistory(initial);

  assert.deepEqual(history.snapshot(), {
    value: initial,
    canUndo: false,
    canRedo: false,
  });
  assert.equal(history.commit(first), undefined);
  assert.equal(history.commit(second), undefined);
  assert.equal(history.undo(), true);
  assert.equal(history.snapshot().value, first);
  assert.equal(history.redo(), true);
  assert.equal(history.snapshot().value, second);
});

test("keeps createUndoHistory as the only direct and public named export", async () => {
  const direct = await import("../src/branching-undo-history.mjs");
  const publicApi = await import("../src/index.mjs");

  assert.equal(publicApi.createUndoHistory, direct.createUndoHistory);
  assert.deepEqual(Object.keys(direct), ["createUndoHistory"]);
  assert.deepEqual(Object.keys(publicApi), ["createUndoHistory"]);
});
