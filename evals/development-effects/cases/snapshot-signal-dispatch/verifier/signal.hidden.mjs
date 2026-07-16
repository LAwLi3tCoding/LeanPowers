import assert from "node:assert/strict";
import test from "node:test";

import * as directApi from "../src/signal.mjs";
import * as publicApi from "../src/index.mjs";

const { createSignal } = directApi;

test("dispatches synchronously in subscription order", () => {
  const signal = createSignal();
  const events = [];
  signal.subscribe((value) => events.push(`first:${value}`));
  signal.subscribe((value) => events.push(`second:${value}`));
  signal.subscribe((value) => events.push(`third:${value}`));

  signal.emit("value");
  events.push("after-emit");

  assert.deepEqual(events, [
    "first:value",
    "second:value",
    "third:value",
    "after-emit",
  ]);
});

test("self-unsubscribe affects only later emits", () => {
  const signal = createSignal();
  const events = [];
  let unsubscribeSelf;
  unsubscribeSelf = signal.subscribe((value) => {
    events.push(`self:${value}`);
    unsubscribeSelf();
  });
  signal.subscribe((value) => events.push(`next:${value}`));

  signal.emit("one");
  signal.emit("two");

  assert.deepEqual(events, ["self:one", "next:one", "next:two"]);
});

test("unsubscribing a later listener keeps it in the current snapshot", () => {
  const signal = createSignal();
  const events = [];
  let unsubscribeLater;
  signal.subscribe((value) => {
    events.push(`first:${value}`);
    unsubscribeLater();
  });
  unsubscribeLater = signal.subscribe((value) => events.push(`later:${value}`));

  signal.emit("one");
  signal.emit("two");

  assert.deepEqual(events, ["first:one", "later:one", "first:two"]);
});

test("listeners added during emit start with the next emit", () => {
  const signal = createSignal();
  const events = [];
  let added = false;
  signal.subscribe((value) => {
    events.push(`first:${value}`);
    if (!added) {
      added = true;
      signal.subscribe((nextValue) => events.push(`added:${nextValue}`));
    }
  });
  signal.subscribe((value) => events.push(`second:${value}`));

  signal.emit("one");
  signal.emit("two");

  assert.deepEqual(events, [
    "first:one",
    "second:one",
    "first:two",
    "second:two",
    "added:two",
  ]);
});

test("duplicate subscriptions remain independent and unsubscribe is scoped and idempotent", () => {
  const signal = createSignal();
  const events = [];
  const listener = (value) => events.push(value);
  const unsubscribeFirst = signal.subscribe(listener);
  const unsubscribeSecond = signal.subscribe(listener);

  signal.emit("both");
  unsubscribeFirst();
  unsubscribeFirst();
  signal.emit("second-only");
  unsubscribeSecond();
  signal.emit("none");

  assert.deepEqual(events, ["both", "both", "second-only"]);
});

test("listener errors synchronously stop dispatch and propagate unchanged", () => {
  const signal = createSignal();
  const events = [];
  const failure = new Error("listener failed");
  signal.subscribe(() => events.push("before"));
  signal.subscribe(() => {
    events.push("throws");
    throw failure;
  });
  signal.subscribe(() => events.push("after"));

  assert.throws(() => signal.emit("value"), (error) => error === failure);
  assert.deepEqual(events, ["before", "throws"]);
});

test("nested emit takes an independent snapshot at nested call time", () => {
  const signal = createSignal();
  const events = [];
  let unsubscribeSecond;
  signal.subscribe((value) => {
    events.push(`first:${value}`);
    if (value === "outer") {
      unsubscribeSecond();
      signal.subscribe((nextValue) => events.push(`added:${nextValue}`));
      signal.emit("inner");
    }
  });
  unsubscribeSecond = signal.subscribe((value) => events.push(`second:${value}`));

  signal.emit("outer");

  assert.deepEqual(events, [
    "first:outer",
    "first:inner",
    "added:inner",
    "second:outer",
  ]);
});

test("validates listeners and preserves exact direct and public API surfaces", () => {
  const signal = createSignal();
  for (const listener of [undefined, null, {}, "listener", 1]) {
    assert.throws(() => signal.subscribe(listener), TypeError);
  }
  assert.deepEqual(Object.keys(signal), ["subscribe", "emit"]);
  assert.equal(publicApi.createSignal, createSignal);
  assert.deepEqual(Object.keys(directApi), ["createSignal"]);
  assert.deepEqual(Object.keys(publicApi), ["createSignal"]);
});
