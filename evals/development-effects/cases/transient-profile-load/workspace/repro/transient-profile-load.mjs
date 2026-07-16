import { createProfileLoader } from "../src/profile-loader.mjs";

let recovered = false;
let attempt = 0;
const loaderCalls = [];
const loadProfile = createProfileLoader(async (id) => {
  attempt += 1;
  loaderCalls.push({ id, attempt });
  if (!recovered) {
    throw new Error("temporary outage");
  }
  return { id, status: "available" };
});

async function observe(request) {
  try {
    return {
      request,
      status: "fulfilled",
      value: await loadProfile("profile-7"),
    };
  } catch (error) {
    return {
      request,
      status: "rejected",
      reason: error.message,
    };
  }
}

const observations = [await observe("initial")];
recovered = true;
const callsBeforeRetry = loaderCalls.length;
observations.push(await observe("retry"));

console.log(JSON.stringify({
  scenario: "transient-profile-load",
  observations,
  loader_calls: loaderCalls,
  first_incorrect_transition: {
    stage: "retry-dispatch",
    retry_started_new_loader_call: loaderCalls.length > callsBeforeRetry,
  },
}));
