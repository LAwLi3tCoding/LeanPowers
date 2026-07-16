import assert from "node:assert/strict";
import test from "node:test";

import { createTaskLimiter } from "../src/index.mjs";

test("runs an admitted task with no receiver or arguments", async () => {
  const limiter = createTaskLimiter(2);
  const value = { id: "value" };
  let receiver = "not-called";
  let args = null;

  const pending = limiter.run(function (...received) {
    receiver = this;
    args = received;
    return value;
  });

  assert.equal(pending instanceof Promise, true);
  assert.equal(await pending, value);
  assert.equal(receiver, undefined);
  assert.deepEqual(args, []);
  assert.deepEqual(limiter.stats(), { active: 0, pending: 0 });
});

test("rejects basic invalid limits and tasks", () => {
  for (const limit of [undefined, null, 0, -1, 1.5, "2"]) {
    assert.throws(() => createTaskLimiter(limit), TypeError);
  }

  const limiter = createTaskLimiter(1);
  for (const task of [undefined, null, {}, "task"]) {
    assert.throws(() => limiter.run(task), TypeError);
    assert.deepEqual(limiter.stats(), { active: 0, pending: 0 });
  }
});

test("keeps createTaskLimiter as the only direct and public named export", async () => {
  const direct = await import("../src/queued-task-permit-release.mjs");
  const publicApi = await import("../src/index.mjs");

  assert.equal(publicApi.createTaskLimiter, direct.createTaskLimiter);
  assert.deepEqual(Object.keys(direct), ["createTaskLimiter"]);
  assert.deepEqual(Object.keys(publicApi), ["createTaskLimiter"]);
});
