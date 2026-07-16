import { createTaskLimiter } from "../src/queued-task-permit-release.mjs";

const limiter = createTaskLimiter(1);
const starts = [];
const boom = new Error("boom");
let firstError = null;
let secondStarted = false;
let secondValue = null;

const first = limiter.run(() => {
  starts.push("first");
  throw boom;
});
const second = limiter.run(() => {
  starts.push("second");
  secondStarted = true;
  return "ok";
});

try {
  await first;
} catch (error) {
  firstError = error;
}
await Promise.resolve();
await Promise.resolve();
if (secondStarted) secondValue = await second;

const stats = limiter.stats();
const resolved = firstError === boom
  && secondStarted
  && secondValue === "ok"
  && stats.active === 0
  && stats.pending === 0;

process.stdout.write(`${JSON.stringify({
  scenario: "queued-task-permit-release",
  observations: [
    {
      action: "sync-throw-followed-by-queued-task",
      limit: 1,
      starts,
      first_error: firstError?.message ?? null,
      first_error_same: firstError === boom,
      second_started: secondStarted,
      second_value: secondValue,
      stats,
    },
  ],
  first_incorrect_transition: resolved
    ? null
    : {
        stage: "synchronous-throw-settlement",
        expected: "release the active permit and start the oldest queued task",
        observed: "the permit remained active and the queued task stayed pending",
      },
  resolution: resolved
    ? {
        stage: "synchronous-throw-settlement",
        observed: "the permit was released exactly once and the oldest queued task completed",
      }
    : null,
})}\n`);
