export function createRetryBudget(maxFailures) {
  if (!Number.isSafeInteger(maxFailures) || maxFailures <= 0) {
    throw new TypeError("maxFailures must be a positive safe integer");
  }

  let consecutiveFailures = 0;
  let lastFailure = null;
  const sharedSnapshot = {
    consecutiveFailures,
    lastFailure,
    retryable: consecutiveFailures < maxFailures,
  };

  return {
    recordFailure(reason) {
      lastFailure = reason;
      consecutiveFailures += 1;
      return consecutiveFailures < maxFailures;
    },
    recordSuccess() {
      consecutiveFailures = 0;
      lastFailure = null;
      return undefined;
    },
    canRetry() {
      return consecutiveFailures < maxFailures;
    },
    snapshot() {
      sharedSnapshot.consecutiveFailures = consecutiveFailures;
      sharedSnapshot.lastFailure = lastFailure;
      sharedSnapshot.retryable = consecutiveFailures < maxFailures;
      return sharedSnapshot;
    },
  };
}
