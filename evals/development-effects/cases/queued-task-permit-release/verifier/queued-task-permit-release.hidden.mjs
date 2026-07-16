import assert from "node:assert/strict";
import test from "node:test";

import * as directApi from "../src/queued-task-permit-release.mjs";
import * as publicApi from "../src/index.mjs";

const { createTaskLimiter } = directApi;

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

test("preserves the exact direct, public, limiter, and stats surfaces", () => {
  assert.equal(publicApi.createTaskLimiter, createTaskLimiter);
  assert.deepEqual(Object.keys(directApi), ["createTaskLimiter"]);
  assert.deepEqual(Object.keys(publicApi), ["createTaskLimiter"]);

  const limiter = createTaskLimiter(2);
  assert.equal(Object.getPrototypeOf(limiter), Object.prototype);
  assert.deepEqual(Reflect.ownKeys(limiter), ["run", "stats"]);
  for (const method of ["run", "stats"]) {
    const descriptor = Object.getOwnPropertyDescriptor(limiter, method);
    assert.equal(descriptor?.enumerable, true);
    assert.equal(Object.hasOwn(descriptor, "value"), true);
    assert.equal(typeof descriptor.value, "function");
  }

  const stats = limiter.stats();
  assert.equal(Object.getPrototypeOf(stats), Object.prototype);
  assert.deepEqual(Reflect.ownKeys(stats), ["active", "pending"]);
  assert.deepEqual(stats, { active: 0, pending: 0 });
});

test("preserves sync and fulfilled-thenable values by reference", async () => {
  const limiter = createTaskLimiter(1);
  const syncValue = { id: "sync" };
  const asyncValue = { id: "async" };
  let receiver = "not-called";
  let args = null;

  const first = await limiter.run(function (...received) {
    receiver = this;
    args = received;
    return syncValue;
  });
  const second = await limiter.run(() => Promise.resolve(asyncValue));

  assert.equal(first, syncValue);
  assert.equal(second, asyncValue);
  assert.equal(receiver, undefined);
  assert.deepEqual(args, []);
});

test("releases a permit after a synchronous throw and preserves the reason", async () => {
  const limiter = createTaskLimiter(1);
  const boom = { kind: "sync" };
  let secondStarted = false;
  const first = limiter.run(() => {
    throw boom;
  });
  const second = limiter.run(() => {
    secondStarted = true;
    return "second";
  });

  let observed;
  try {
    await first;
  } catch (error) {
    observed = error;
  }
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(observed, boom);
  assert.equal(secondStarted, true);
  assert.equal(await second, "second");
  assert.deepEqual(limiter.stats(), { active: 0, pending: 0 });
});

test("releases a permit after an asynchronous rejection and preserves the reason", async () => {
  const limiter = createTaskLimiter(1);
  const boom = { kind: "async" };
  let secondStarted = false;
  const first = limiter.run(() => Promise.reject(boom));
  const second = limiter.run(() => {
    secondStarted = true;
    return "second";
  });

  let observed;
  try {
    await first;
  } catch (error) {
    observed = error;
  }
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(observed, boom);
  assert.equal(secondStarted, true);
  assert.equal(await second, "second");
  assert.deepEqual(limiter.stats(), { active: 0, pending: 0 });
});

test("admits queued work FIFO without exceeding the active limit", async () => {
  const limiter = createTaskLimiter(2);
  const gates = [deferred(), deferred(), deferred(), deferred()];
  const starts = [];
  const runs = gates.map((gate, index) => limiter.run(() => {
    starts.push(index);
    return gate.promise;
  }));

  assert.deepEqual(starts, [0, 1]);
  assert.deepEqual(limiter.stats(), { active: 2, pending: 2 });

  gates[1].resolve("one");
  assert.equal(await runs[1], "one");
  assert.deepEqual(starts, [0, 1, 2]);
  assert.deepEqual(limiter.stats(), { active: 2, pending: 1 });

  gates[2].resolve("two");
  assert.equal(await runs[2], "two");
  assert.deepEqual(starts, [0, 1, 2, 3]);
  assert.deepEqual(limiter.stats(), { active: 2, pending: 0 });

  gates[0].resolve("zero");
  gates[3].resolve("three");
  assert.deepEqual(await Promise.all(runs), ["zero", "one", "two", "three"]);
  assert.deepEqual(limiter.stats(), { active: 0, pending: 0 });
});

test("returns fresh stats records isolated from caller mutation", () => {
  const limiter = createTaskLimiter(1);
  const first = limiter.stats();
  const second = limiter.stats();

  assert.notEqual(first, second);
  first.active = 99;
  first.pending = 99;
  assert.deepEqual(second, { active: 0, pending: 0 });
  assert.deepEqual(limiter.stats(), { active: 0, pending: 0 });
});

test("rejects invalid tasks synchronously without changing state", () => {
  const limiter = createTaskLimiter(1);
  const before = limiter.stats();
  for (const task of [undefined, null, true, {}, [], "task"]) {
    assert.throws(() => limiter.run(task), TypeError);
    assert.deepEqual(limiter.stats(), before);
  }
});

test("requires a positive safe-integer limit", () => {
  for (const limit of [
    undefined,
    null,
    true,
    "1",
    0,
    -1,
    1.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.MAX_SAFE_INTEGER + 1,
    new Number(1),
  ]) {
    assert.throws(() => createTaskLimiter(limit), TypeError);
  }
});
