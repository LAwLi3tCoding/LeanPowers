import { createRetryBudget } from "../src/retry-budget.mjs";

const reason = { code: "timeout" };
const budget = createRetryBudget(2);

const firstFailureRetryable = budget.recordFailure(reason);
const successResult = budget.recordSuccess();
const observedAfterSuccess = budget.snapshot();
const retryableAfterSuccess = budget.canRetry();
const expectedAfterSuccess = {
  consecutiveFailures: 0,
  lastFailure: null,
  retryable: true,
};
const resolved = successResult === undefined
  && firstFailureRetryable === true
  && retryableAfterSuccess === true
  && observedAfterSuccess.consecutiveFailures === expectedAfterSuccess.consecutiveFailures
  && observedAfterSuccess.lastFailure === expectedAfterSuccess.lastFailure
  && observedAfterSuccess.retryable === expectedAfterSuccess.retryable;

process.stdout.write(`${JSON.stringify({
  scenario: "retry-budget-success-reset",
  observations: [
    {
      action: "failure-then-success",
      expected_after_success: expectedAfterSuccess,
      observed_after_success: observedAfterSuccess,
      expected_success_result_type: "undefined",
      observed_success_result_type: typeof successResult,
      expected_can_retry_after_success: true,
      observed_can_retry_after_success: retryableAfterSuccess,
    },
  ],
  first_incorrect_transition: resolved
    ? null
    : {
        stage: "recordSuccess",
        expected: "reset consecutiveFailures to 0 and lastFailure to null",
        observed: "previous failure state remained visible after success",
      },
  resolution: resolved
    ? {
        stage: "recordSuccess",
        observed: "failure count and last failure were cleared while retryability recovered",
      }
    : null,
})}\n`);
