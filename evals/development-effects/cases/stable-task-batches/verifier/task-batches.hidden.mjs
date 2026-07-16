import assert from "node:assert/strict";
import test from "node:test";

import * as directApi from "../src/task-batches.mjs";
import * as publicApi from "../src/index.mjs";

const { scheduleTaskBatches } = directApi;

test("returns stable topological levels instead of a flattened order", () => {
  assert.deepEqual(
    scheduleTaskBatches([
      { id: "z-root", dependsOn: [] },
      { id: "z-child", dependsOn: ["z-root"] },
      { id: "a-root", dependsOn: [] },
      { id: "a-child", dependsOn: ["a-root"] },
      { id: "release", dependsOn: ["z-child", "a-child"] },
    ]),
    [["z-root", "a-root"], ["z-child", "a-child"], ["release"]],
  );
});

test("places a task in the first level after all dependencies complete", () => {
  assert.deepEqual(
    scheduleTaskBatches([
      { id: "source", dependsOn: [] },
      { id: "lint", dependsOn: ["source"] },
      { id: "test", dependsOn: ["source"] },
      { id: "package", dependsOn: ["lint", "test"] },
    ]),
    [["source"], ["lint", "test"], ["package"]],
  );
});

test("rejects missing dependencies", () => {
  assert.throws(
    () => scheduleTaskBatches([{ id: "deploy", dependsOn: ["build"] }]),
    TypeError,
  );
});

test("rejects duplicate task IDs", () => {
  assert.throws(
    () =>
      scheduleTaskBatches([
        { id: "build", dependsOn: [] },
        { id: "build", dependsOn: [] },
      ]),
    TypeError,
  );
});

test("rejects self dependencies and longer cycles", () => {
  assert.throws(
    () => scheduleTaskBatches([{ id: "self", dependsOn: ["self"] }]),
    TypeError,
  );
  assert.throws(
    () =>
      scheduleTaskBatches([
        { id: "a", dependsOn: ["c"] },
        { id: "b", dependsOn: ["a"] },
        { id: "c", dependsOn: ["b"] },
      ]),
    TypeError,
  );
});

test("validates own fields on plain task records and dependency IDs", () => {
  const inherited = Object.create({ id: "inherited", dependsOn: [] });
  class TaskRecord {
    constructor() {
      this.id = "class-instance";
      this.dependsOn = [];
    }
  }

  for (const tasks of [
    [null],
    [[]],
    [new TaskRecord()],
    [inherited],
    [{ id: "", dependsOn: [] }],
    [{ id: 1, dependsOn: [] }],
    [{ id: "build", dependsOn: "source" }],
    [{ id: "build", dependsOn: [""] }],
    [{ id: "build", dependsOn: [1] }],
  ]) {
    assert.throws(() => scheduleTaskBatches(tasks), TypeError);
  }

  const nullPrototype = Object.assign(Object.create(null), {
    id: "plain-null-prototype",
    dependsOn: [],
  });
  assert.deepEqual(scheduleTaskBatches([nullPrototype]), [
    ["plain-null-prototype"],
  ]);
});

test("does not mutate the collection, records, or dependency arrays", () => {
  const tasks = [
    { id: "z-root", dependsOn: [] },
    { id: "a-child", dependsOn: ["z-root"] },
    { id: "a-root", dependsOn: [] },
  ];
  const snapshot = structuredClone(tasks);

  assert.deepEqual(scheduleTaskBatches(tasks), [
    ["z-root", "a-root"],
    ["a-child"],
  ]);
  assert.deepEqual(tasks, snapshot);
});

test("preserves the exact direct and public named export surface", () => {
  assert.equal(publicApi.scheduleTaskBatches, scheduleTaskBatches);
  assert.deepEqual(Object.keys(directApi), ["scheduleTaskBatches"]);
  assert.deepEqual(Object.keys(publicApi), ["scheduleTaskBatches"]);
});
