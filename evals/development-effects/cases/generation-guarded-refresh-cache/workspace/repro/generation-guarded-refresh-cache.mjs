import { createRefreshCache } from "../src/refresh-cache.mjs";

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

const pending = [deferred(), deferred(), deferred()];
const loaderCalls = [];
const cache = createRefreshCache((key) => {
  const attempt = loaderCalls.length;
  loaderCalls.push({ attempt: attempt + 1, key });
  return pending[attempt].promise;
});

const older = cache.get("profile-7");
const newer = cache.refresh("profile-7");
await Promise.resolve();

const freshValue = { id: "profile-7", version: 2 };
pending[1].resolve(freshValue);
await newer;

const staleFailure = new Error("older generation failed late");
const olderOutcome = older.then(
  () => ({ status: "fulfilled" }),
  (error) => ({ reason: error.message, status: "rejected" }),
);
pending[0].reject(staleFailure);
await olderOutcome;

const afterStaleFailure = cache.get("profile-7");
await Promise.resolve();
const staleFailureClearedNewerGeneration = loaderCalls.length === 3;
if (staleFailureClearedNewerGeneration) {
  pending[2].resolve({ id: "profile-7", version: 3 });
}
const observedValue = await afterStaleFailure;
const resolved =
  !staleFailureClearedNewerGeneration
  && loaderCalls.length === 2
  && observedValue.version === 2;

process.stdout.write(`${JSON.stringify({
  scenario: "generation-guarded-refresh-cache",
  observations: [
    { action: "get", generation: 1 },
    { action: "refresh", generation: 2 },
    { action: "resolve", generation: 2, value: freshValue },
    { action: "reject", generation: 1, reason: staleFailure.message },
    {
      action: "get-after-stale-rejection",
      expected_version: 2,
      observed_version: observedValue.version,
      loader_calls: loaderCalls.length,
    },
  ],
  first_incorrect_transition: staleFailureClearedNewerGeneration
    ? {
        stage: "stale-rejection-settlement",
        expected: "generation 2 remains cached",
        stale_rejection_cleared_newer_generation: true,
      }
    : null,
  resolution: resolved
    ? {
        stage: "stale-rejection-settlement",
        observed: "generation 2 remains cached",
        stale_rejection_cleared_newer_generation: false,
      }
    : null,
})}\n`);
