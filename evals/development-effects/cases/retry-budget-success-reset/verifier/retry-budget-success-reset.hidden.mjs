import assert from "node:assert/strict";
import test from "node:test";

import * as directApi from "../src/retry-budget.mjs";
import * as publicApi from "../src/index.mjs";

const { createRetryBudget } = directApi;

function assertExactBudgetSurface(budget) {
  assert.equal(Object.getPrototypeOf(budget), Object.prototype);
  assert.deepEqual(Reflect.ownKeys(budget), [
    "recordFailure",
    "recordSuccess",
    "canRetry",
    "snapshot",
  ]);
  for (const method of ["recordFailure", "recordSuccess", "canRetry", "snapshot"]) {
    const descriptor = Object.getOwnPropertyDescriptor(budget, method);
    assert.equal(descriptor?.enumerable, true, method);
    assert.equal(Object.hasOwn(descriptor, "value"), true, method);
    assert.equal(typeof descriptor.value, "function", method);
  }
}

function assertExactSnapshot(snapshot) {
  assert.equal(Object.getPrototypeOf(snapshot), Object.prototype);
  assert.deepEqual(Reflect.ownKeys(snapshot), [
    "consecutiveFailures",
    "lastFailure",
    "retryable",
  ]);
  for (const key of ["consecutiveFailures", "lastFailure", "retryable"]) {
    const descriptor = Object.getOwnPropertyDescriptor(snapshot, key);
    assert.equal(descriptor?.enumerable, true, key);
    assert.equal(Object.hasOwn(descriptor, "value"), true, key);
  }
}

test("preserves the exact direct, public, budget, and snapshot surfaces", () => {
  assert.equal(publicApi.createRetryBudget, createRetryBudget);
  assert.deepEqual(Object.keys(directApi), ["createRetryBudget"]);
  assert.deepEqual(Object.keys(publicApi), ["createRetryBudget"]);

  const budget = createRetryBudget(2);
  assertExactBudgetSurface(budget);
  assertExactSnapshot(budget.snapshot());
});

test("rejects invalid maxFailures without coercion", () => {
  for (const value of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, "2", true, null]) {
    assert.throws(() => createRetryBudget(value), TypeError, String(value));
  }
});

test("recordFailure preserves exact reason references and boundary retryability", () => {
  const firstReason = { code: "timeout" };
  const secondReason = { code: "busy" };
  const budget = createRetryBudget(2);

  assert.equal(budget.recordFailure(firstReason), true);
  assert.equal(budget.snapshot().lastFailure, firstReason);
  assert.equal(budget.canRetry(), true);
  assert.equal(budget.recordFailure(secondReason), false);
  assert.deepEqual(budget.snapshot(), {
    consecutiveFailures: 2,
    lastFailure: secondReason,
    retryable: false,
  });
  assert.equal(budget.canRetry(), false);
});

test("recordSuccess clears failure state and returns undefined", () => {
  const reason = { code: "timeout" };
  const budget = createRetryBudget(3);

  assert.equal(budget.recordFailure(reason), true);
  assert.equal(budget.recordFailure("again"), true);
  assert.equal(budget.recordSuccess(), undefined);
  assert.deepEqual(budget.snapshot(), {
    consecutiveFailures: 0,
    lastFailure: null,
    retryable: true,
  });
  assert.equal(budget.canRetry(), true);
});

test("success reset starts the retry boundary from zero", () => {
  const budget = createRetryBudget(2);

  assert.equal(budget.recordFailure("first"), true);
  budget.recordSuccess();
  assert.equal(budget.recordFailure("after-success"), true);
  assert.equal(budget.snapshot().consecutiveFailures, 1);
  assert.equal(budget.recordFailure("boundary"), false);
});

test("snapshot is fresh and isolated from caller mutation", () => {
  const reason = { code: "timeout" };
  const budget = createRetryBudget(2);
  budget.recordFailure(reason);

  const first = budget.snapshot();
  const second = budget.snapshot();
  assert.notEqual(first, second);
  assert.equal(first.lastFailure, reason);
  assert.equal(second.lastFailure, reason);

  first.consecutiveFailures = 99;
  first.lastFailure = "changed";
  first.retryable = false;
  assert.deepEqual(budget.snapshot(), {
    consecutiveFailures: 1,
    lastFailure: reason,
    retryable: true,
  });
});
