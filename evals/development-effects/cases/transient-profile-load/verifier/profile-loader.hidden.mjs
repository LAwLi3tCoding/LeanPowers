import assert from "node:assert/strict";
import test from "node:test";

import { createProfileLoader } from "../src/profile-loader.mjs";

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

test("retries the same profile after a completed failure", async () => {
  const expected = new Error("temporary outage");
  let calls = 0;
  const loadProfile = createProfileLoader(async (id) => {
    calls += 1;
    if (calls === 1) {
      throw expected;
    }
    return { id, attempt: calls };
  });

  await assert.rejects(loadProfile("profile-7"), (error) => error === expected);
  assert.deepEqual(await loadProfile("profile-7"), {
    id: "profile-7",
    attempt: 2,
  });
  assert.equal(calls, 2);
});

test("coalesces overlapping requests for the same profile", async () => {
  const pending = deferred();
  const calls = [];
  const loadProfile = createProfileLoader((id) => {
    calls.push(id);
    return pending.promise;
  });

  const first = loadProfile("profile-7");
  const second = loadProfile("profile-7");
  await Promise.resolve();
  assert.deepEqual(calls, ["profile-7"]);

  const profile = { id: "profile-7", name: "Ada" };
  pending.resolve(profile);
  assert.deepEqual(await Promise.all([first, second]), [profile, profile]);
  assert.deepEqual(calls, ["profile-7"]);
});

test("reuses a fulfilled profile on later requests", async () => {
  let calls = 0;
  const profile = { id: "profile-7", name: "Ada" };
  const loadProfile = createProfileLoader(async () => {
    calls += 1;
    return profile;
  });

  assert.equal(await loadProfile("profile-7"), profile);
  assert.equal(await loadProfile("profile-7"), profile);
  assert.equal(calls, 1);
});

test("a failure only evicts the failed profile ID", async () => {
  const calls = [];
  let flakyAttempts = 0;
  const stableProfile = { id: "stable", name: "Grace" };
  const loadProfile = createProfileLoader(async (id) => {
    calls.push(id);
    if (id === "stable") {
      return stableProfile;
    }
    flakyAttempts += 1;
    if (flakyAttempts === 1) {
      throw new Error("temporary outage");
    }
    return { id, attempt: flakyAttempts };
  });

  assert.equal(await loadProfile("stable"), stableProfile);
  await assert.rejects(loadProfile("flaky"), /temporary outage/);
  assert.equal(await loadProfile("stable"), stableProfile);
  assert.deepEqual(await loadProfile("flaky"), { id: "flaky", attempt: 2 });
  assert.deepEqual(calls, ["stable", "flaky", "flaky"]);
});

test("keeps each retry wave single-flight", async () => {
  const firstWave = deferred();
  const secondWave = deferred();
  let calls = 0;
  const loadProfile = createProfileLoader(() => {
    calls += 1;
    return calls === 1 ? firstWave.promise : secondWave.promise;
  });

  const first = loadProfile("profile-7");
  const firstPeer = loadProfile("profile-7");
  await Promise.resolve();
  assert.equal(calls, 1);
  firstWave.reject(new Error("temporary outage"));
  await assert.rejects(Promise.all([first, firstPeer]), /temporary outage/);

  const retry = loadProfile("profile-7");
  const retryPeer = loadProfile("profile-7");
  await Promise.resolve();
  assert.equal(calls, 2);
  const recovered = { id: "profile-7", status: "available" };
  secondWave.resolve(recovered);
  assert.deepEqual(await Promise.all([retry, retryPeer]), [recovered, recovered]);
  assert.equal(calls, 2);
});
