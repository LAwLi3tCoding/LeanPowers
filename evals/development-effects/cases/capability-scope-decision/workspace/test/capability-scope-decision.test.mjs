import assert from "node:assert/strict";
import test from "node:test";

import { isCapabilityAllowed } from "../src/index.mjs";

test("allows an exact action and resource match", () => {
  assert.equal(
    isCapabilityAllowed(
      [{ effect: "allow", action: "read", resource: "tenant/orders" }],
      "read",
      "tenant/orders",
    ),
    true,
  );
});

test("allows a descendant of an allowed resource scope", () => {
  assert.equal(
    isCapabilityAllowed(
      [{ effect: "allow", action: "write", resource: "tenant/orders" }],
      "write",
      "tenant/orders/archive/2026",
    ),
    true,
  );
});

test("honors a directly matching deny rule", () => {
  assert.equal(
    isCapabilityAllowed(
      [{ effect: "deny", action: "delete", resource: "tenant/orders" }],
      "delete",
      "tenant/orders",
    ),
    false,
  );
});

test("rejects basic malformed arguments", () => {
  assert.throws(() => isCapabilityAllowed(null, "read", "tenant/orders"), TypeError);
  assert.throws(() => isCapabilityAllowed([], "*", "tenant/orders"), TypeError);
  assert.throws(() => isCapabilityAllowed([], "read", "tenant//orders"), TypeError);
});

test("keeps isCapabilityAllowed as the public named export", async () => {
  const direct = await import("../src/capability-scope-decision.mjs");
  const publicApi = await import("../src/index.mjs");

  assert.equal(publicApi.isCapabilityAllowed, direct.isCapabilityAllowed);
  assert.deepEqual(Object.keys(direct), ["isCapabilityAllowed"]);
  assert.deepEqual(Object.keys(publicApi), ["isCapabilityAllowed"]);
});
