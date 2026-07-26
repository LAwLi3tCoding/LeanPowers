export function createRetryBudget(maxFailures) {
  if (!Number.isSafeInteger(maxFailures) || maxFailures <= 0) {
    throw new TypeError("maxFailures must be a positive safe integer");
  }

  let consecutiveFailures = 0;
  let lastFailure = null;

  return {
    recordFailure(reason) {
      lastFailure = reason;
      consecutiveFailures += 1;
      return consecutiveFailures < maxFailures;
    },
    recordSuccess() {
      return undefined;
    },
    canRetry() {
      return consecutiveFailures < maxFailures;
    },
    snapshot() {
      return {
        consecutiveFailures,
        lastFailure,
        retryable: consecutiveFailures < maxFailures,
      };
    },
  };
}
