import assert from "node:assert/strict";
import test from "node:test";

import { createRetryBudget } from "../src/index.mjs";

test("tracks a failure and preserves the reason reference", () => {
  const firstReason = { code: "timeout" };
  const budget = createRetryBudget(2);

  assert.equal(budget.canRetry(), true);
  assert.equal(budget.recordFailure(firstReason), true);
  assert.deepEqual(budget.snapshot(), {
    consecutiveFailures: 1,
    lastFailure: firstReason,
    retryable: true,
  });
});

test("keeps createRetryBudget as the only direct and public named export", async () => {
  const direct = await import("../src/retry-budget.mjs");
  const publicApi = await import("../src/index.mjs");

  assert.equal(publicApi.createRetryBudget, direct.createRetryBudget);
  assert.deepEqual(Object.keys(direct), ["createRetryBudget"]);
  assert.deepEqual(Object.keys(publicApi), ["createRetryBudget"]);
});
