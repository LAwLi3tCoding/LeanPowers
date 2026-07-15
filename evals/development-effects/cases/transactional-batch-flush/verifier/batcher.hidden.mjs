import assert from "node:assert/strict";
import test from "node:test";

import * as directApi from "../src/batcher.mjs";
import * as publicApi from "../src/index.mjs";

const { createBatcher } = directApi;

test("flush delivers a fresh snapshot synchronously in insertion order", () => {
  const events = [];
  let deliveredBatch;
  const batcher = createBatcher((batch) => {
    deliveredBatch = batch;
    events.push([...batch]);
  });
  batcher.add("first");
  batcher.add("second");

  assert.equal(batcher.flush(), true);
  events.push("after-flush");
  deliveredBatch.reverse();

  assert.deepEqual(events, [["first", "second"], "after-flush"]);
  assert.equal(batcher.flush(), false);
});

test("values added during delivery remain pending for the next flush", () => {
  const deliveries = [];
  let firstDelivery = true;
  let receivedBatch;
  let batcher;
  batcher = createBatcher((batch) => {
    receivedBatch = batch;
    deliveries.push([...batch]);
    if (firstDelivery) {
      firstDelivery = false;
      batcher.add("later");
    }
  });
  batcher.add("initial");

  assert.equal(batcher.flush(), true);
  assert.deepEqual(receivedBatch, ["initial"]);
  assert.deepEqual(deliveries, [["initial"]]);
  assert.equal(batcher.flush(), true);
  assert.deepEqual(deliveries, [["initial"], ["later"]]);
  assert.equal(batcher.flush(), false);
});

test("a failed delivery restores the original snapshot before reentrant additions", () => {
  const failure = new Error("delivery failed");
  const deliveries = [];
  let fail = true;
  let batcher;
  batcher = createBatcher((batch) => {
    deliveries.push([...batch]);
    if (fail) {
      fail = false;
      batch.reverse();
      batcher.add("later-one");
      batcher.add("later-two");
      throw failure;
    }
  });
  batcher.add("first");
  batcher.add("second");

  assert.throws(() => batcher.flush(), (error) => error === failure);
  assert.equal(batcher.flush(), true);

  assert.deepEqual(deliveries, [
    ["first", "second"],
    ["first", "second", "later-one", "later-two"],
  ]);
  assert.equal(batcher.flush(), false);
});

test("nested flush captures its own current pending snapshot", () => {
  const deliveries = [];
  let enteredNested = false;
  let batcher;
  batcher = createBatcher((batch) => {
    deliveries.push([...batch]);
    if (!enteredNested && batch[0] === "outer-one") {
      enteredNested = true;
      batcher.add("inner");
      assert.equal(batcher.flush(), true);
      batcher.add("after-nested");
    }
  });
  batcher.add("outer-one");
  batcher.add("outer-two");

  assert.equal(batcher.flush(), true);
  assert.deepEqual(deliveries, [
    ["outer-one", "outer-two"],
    ["inner"],
  ]);
  assert.equal(batcher.flush(), true);
  assert.deepEqual(deliveries, [
    ["outer-one", "outer-two"],
    ["inner"],
    ["after-nested"],
  ]);
});

test("empty flush does not call deliver and returns false", () => {
  let calls = 0;
  const batcher = createBatcher(() => {
    calls += 1;
  });

  assert.equal(batcher.flush(), false);
  assert.equal(calls, 0);
  batcher.add(undefined);
  assert.equal(batcher.flush(), true);
  assert.equal(calls, 1);
  assert.equal(batcher.flush(), false);
  assert.equal(calls, 1);
});

test("preserves exact direct and public API surfaces", () => {
  for (const deliver of [undefined, null, {}, "deliver", 1]) {
    assert.throws(() => createBatcher(deliver), TypeError);
  }
  const batcher = createBatcher(() => {});
  assert.deepEqual(Object.keys(batcher), ["add", "flush"]);
  assert.equal(publicApi.createBatcher, createBatcher);
  assert.deepEqual(Object.keys(directApi), ["createBatcher"]);
  assert.deepEqual(Object.keys(publicApi), ["createBatcher"]);
});
