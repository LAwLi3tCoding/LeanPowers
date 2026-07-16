import assert from "node:assert/strict";
import test from "node:test";

import { createProfileLoader } from "../src/profile-loader.mjs";

test("forwards the profile ID and returns the loaded profile", async () => {
  const calls = [];
  const loadProfile = createProfileLoader(async (id) => {
    calls.push(id);
    return { id, name: "Ada" };
  });

  assert.deepEqual(await loadProfile("profile-7"), {
    id: "profile-7",
    name: "Ada",
  });
  assert.deepEqual(calls, ["profile-7"]);
});

test("propagates the loader error", async () => {
  const expected = new Error("profile service unavailable");
  const loadProfile = createProfileLoader(async () => {
    throw expected;
  });

  await assert.rejects(loadProfile("profile-7"), (error) => error === expected);
});
