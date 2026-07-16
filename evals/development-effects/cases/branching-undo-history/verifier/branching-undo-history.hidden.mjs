import assert from "node:assert/strict";
import test from "node:test";

import * as directApi from "../src/branching-undo-history.mjs";
import * as publicApi from "../src/index.mjs";

const { createUndoHistory } = directApi;

test("preserves the exact direct, public, history, and snapshot surfaces", () => {
  assert.equal(publicApi.createUndoHistory, createUndoHistory);
  assert.deepEqual(Object.keys(directApi), ["createUndoHistory"]);
  assert.deepEqual(Object.keys(publicApi), ["createUndoHistory"]);

  const history = createUndoHistory("initial");
  assert.equal(Object.getPrototypeOf(history), Object.prototype);
  assert.deepEqual(Reflect.ownKeys(history), ["commit", "undo", "redo", "snapshot"]);
  for (const method of ["commit", "undo", "redo", "snapshot"]) {
    const descriptor = Object.getOwnPropertyDescriptor(history, method);
    assert.equal(descriptor?.enumerable, true);
    assert.equal(Object.hasOwn(descriptor, "value"), true);
    assert.equal(typeof descriptor.value, "function");
  }

  const snapshot = history.snapshot();
  assert.equal(Object.getPrototypeOf(snapshot), Object.prototype);
  assert.deepEqual(Reflect.ownKeys(snapshot), ["value", "canUndo", "canRedo"]);
});

test("truncates every abandoned descendant after multiple undo operations", () => {
  const history = createUndoHistory("v0");
  history.commit("v1");
  history.commit("v2");
  history.commit("v3");
  assert.equal(history.undo(), true);
  assert.equal(history.undo(), true);
  assert.equal(history.commit("branch"), undefined);

  assert.deepEqual(history.snapshot(), {
    value: "branch",
    canUndo: true,
    canRedo: false,
  });
  assert.equal(history.redo(), false);
  assert.equal(history.snapshot().value, "branch");
});

test("retains the history at and before the branch point", () => {
  const history = createUndoHistory("v0");
  history.commit("v1");
  history.commit("v2");
  history.commit("v3");
  history.undo();
  history.undo();
  history.commit("branch");

  assert.equal(history.undo(), true);
  assert.equal(history.snapshot().value, "v1");
  assert.equal(history.undo(), true);
  assert.equal(history.snapshot().value, "v0");
  assert.equal(history.undo(), false);
  assert.equal(history.redo(), true);
  assert.equal(history.snapshot().value, "v1");
  assert.equal(history.redo(), true);
  assert.equal(history.snapshot().value, "branch");
});

test("records identical commits as independent entries", () => {
  const value = { id: "same" };
  const history = createUndoHistory(value);
  assert.equal(history.commit(value), undefined);
  assert.deepEqual(history.snapshot(), {
    value,
    canUndo: true,
    canRedo: false,
  });
  assert.equal(history.undo(), true);
  assert.equal(history.snapshot().value, value);
  assert.equal(history.undo(), false);
  assert.equal(history.redo(), true);
  assert.equal(history.snapshot().value, value);
});

test("returns false without state changes at undo and redo boundaries", () => {
  const history = createUndoHistory("initial");
  const initial = history.snapshot();
  assert.equal(history.undo(), false);
  assert.deepEqual(history.snapshot(), initial);
  assert.equal(history.redo(), false);
  assert.deepEqual(history.snapshot(), initial);

  history.commit("next");
  const tip = history.snapshot();
  assert.equal(history.redo(), false);
  assert.deepEqual(history.snapshot(), tip);
});

test("returns fresh snapshots isolated from caller mutation", () => {
  const value = { id: "value" };
  const history = createUndoHistory(value);
  const first = history.snapshot();
  const second = history.snapshot();

  assert.notEqual(first, second);
  assert.equal(first.value, value);
  assert.equal(second.value, value);
  first.value = "changed";
  first.canUndo = true;
  first.canRedo = true;
  assert.deepEqual(history.snapshot(), {
    value,
    canUndo: false,
    canRedo: false,
  });
});

test("accepts arbitrary values and preserves their references", () => {
  const initial = Symbol("initial");
  const committed = () => "committed";
  const history = createUndoHistory(initial);
  assert.equal(history.snapshot().value, initial);
  history.commit(committed);
  assert.equal(history.snapshot().value, committed);
  history.undo();
  assert.equal(history.snapshot().value, initial);
  history.redo();
  assert.equal(history.snapshot().value, committed);
});
