import { createExpiringCache } from "../src/expiry-cache.mjs";

let current = 0;
const cache = createExpiringCache(() => current);
cache.set("short", "short-value", 10);
current = 5;
cache.set("later", "later-value", 10);
current = 11;

const shortStatus = cache.get("short") === undefined ? "expired" : "present";
const laterStatus = cache.get("later") === undefined ? "expired" : "present";

process.stdout.write(`${JSON.stringify({
  scenario: "per-key-expiry-cache",
  observations: [
    { at: 0, action: "set", key: "short", ttl_ms: 10 },
    { at: 5, action: "set", key: "later", ttl_ms: 10 },
    { at: 11, action: "get", key: "short", expected: "expired", observed: shortStatus },
    { at: 11, action: "get", key: "later", expected: "present", observed: laterStatus },
  ],
  first_incorrect_transition: {
    stage: "per-key-expiry-check",
    key: "short",
    later_insert_extended_earlier_key: shortStatus === "present",
  },
})}\n`);
