import assert from "node:assert/strict";
import test from "node:test";

import * as directApi from "../src/capability-scope-decision.mjs";
import * as publicApi from "../src/index.mjs";

const { isCapabilityAllowed } = directApi;

test("preserves the exact direct and public named export surfaces", () => {
  assert.equal(publicApi.isCapabilityAllowed, isCapabilityAllowed);
  assert.deepEqual(Object.keys(directApi), ["isCapabilityAllowed"]);
  assert.deepEqual(Object.keys(publicApi), ["isCapabilityAllowed"]);
});

test("matches exact, descendant, resource-wildcard, and action-wildcard rules", () => {
  const rules = [
    { effect: "allow", action: "read", resource: "tenant/orders" },
    { effect: "allow", action: "write", resource: "*" },
    { effect: "allow", action: "*", resource: "tenant/reports" },
  ];

  assert.equal(isCapabilityAllowed(rules, "read", "tenant/orders"), true);
  assert.equal(isCapabilityAllowed(rules, "read", "tenant/orders/2026/july"), true);
  assert.equal(isCapabilityAllowed(rules, "write", "any/scope"), true);
  assert.equal(isCapabilityAllowed(rules, "export", "tenant/reports/monthly"), true);
});

test("matching deny rules override allow rules regardless of order", () => {
  const allow = { effect: "allow", action: "read", resource: "tenant" };
  const deny = { effect: "deny", action: "read", resource: "tenant/secrets" };

  assert.equal(
    isCapabilityAllowed([allow, deny], "read", "tenant/secrets/current"),
    false,
  );
  assert.equal(
    isCapabilityAllowed([deny, allow], "read", "tenant/secrets/current"),
    false,
  );
  assert.equal(
    isCapabilityAllowed([
      { effect: "allow", action: "*", resource: "tenant" },
      { effect: "deny", action: "delete", resource: "tenant/orders" },
    ], "delete", "tenant/orders/old"),
    false,
  );
});

test("action-wildcard and resource-wildcard denies override allows in either order", () => {
  const allow = { effect: "allow", action: "read", resource: "tenant/orders" };
  const actionWildcardDeny = {
    effect: "deny",
    action: "*",
    resource: "tenant/orders",
  };
  const resourceWildcardDeny = {
    effect: "deny",
    action: "read",
    resource: "*",
  };

  for (const rules of [
    [actionWildcardDeny, allow],
    [allow, actionWildcardDeny],
    [resourceWildcardDeny, allow],
    [allow, resourceWildcardDeny],
  ]) {
    assert.equal(isCapabilityAllowed(rules, "read", "tenant/orders"), false);
  }
});

test("uses slash-segment boundaries for descendant matching", () => {
  const rules = [
    { effect: "allow", action: "read", resource: "tenant/orders" },
  ];

  assert.equal(isCapabilityAllowed(rules, "read", "tenant/orders/archive"), true);
  assert.equal(isCapabilityAllowed(rules, "read", "tenant/orders-archive"), false);
  assert.equal(isCapabilityAllowed(rules, "read", "tenant/order"), false);
});

test("defaults to deny when no allow rule matches", () => {
  assert.equal(isCapabilityAllowed([], "read", "tenant/orders"), false);
  assert.equal(
    isCapabilityAllowed(
      [{ effect: "allow", action: "write", resource: "tenant/orders" }],
      "read",
      "tenant/orders",
    ),
    false,
  );
  assert.equal(
    isCapabilityAllowed(
      [{ effect: "deny", action: "read", resource: "tenant/secrets" }],
      "read",
      "tenant/orders",
    ),
    false,
  );
});

test("matches action and resource tokens case-sensitively", () => {
  assert.equal(
    isCapabilityAllowed(
      [{ effect: "allow", action: "Read", resource: "tenant/orders" }],
      "read",
      "tenant/orders",
    ),
    false,
  );
  assert.equal(
    isCapabilityAllowed(
      [{ effect: "allow", action: "read", resource: "Tenant/Orders" }],
      "read",
      "tenant/orders",
    ),
    false,
  );
  assert.equal(
    isCapabilityAllowed([
      { effect: "allow", action: "read", resource: "tenant/orders" },
      { effect: "deny", action: "READ", resource: "TENANT/ORDERS" },
    ], "read", "tenant/orders"),
    true,
  );
});

test("requires a dense rules array with no extra keys and data elements", () => {
  const validRule = { effect: "allow", action: "read", resource: "tenant/orders" };
  const sparse = [];
  sparse.length = 1;
  const extra = [validRule];
  extra.label = "policy";
  const symbol = [validRule];
  symbol[Symbol("policy")] = true;
  const nonEnumerable = [validRule];
  Object.defineProperty(nonEnumerable, "0", {
    configurable: true,
    enumerable: false,
    value: validRule,
    writable: true,
  });
  let elementReads = 0;
  const accessor = [];
  Object.defineProperty(accessor, "0", {
    configurable: true,
    enumerable: true,
    get() {
      elementReads += 1;
      return validRule;
    },
  });
  accessor.length = 1;

  for (const rules of [undefined, null, {}, sparse, extra, symbol, nonEnumerable, accessor]) {
    assert.throws(
      () => isCapabilityAllowed(rules, "read", "tenant/orders"),
      TypeError,
    );
  }
  assert.equal(elementReads, 0);
});

test("requires exact ordinary rule records with enumerable data properties", () => {
  let fieldReads = 0;
  const accessorEffect = { action: "read", resource: "tenant/orders" };
  Object.defineProperty(accessorEffect, "effect", {
    enumerable: true,
    get() {
      fieldReads += 1;
      return "allow";
    },
  });
  const inherited = Object.create({ inherited: true });
  inherited.effect = "allow";
  inherited.action = "read";
  inherited.resource = "tenant/orders";
  const symbolExtra = { effect: "allow", action: "read", resource: "tenant/orders" };
  symbolExtra[Symbol("extra")] = true;
  const hiddenExtra = { effect: "allow", action: "read", resource: "tenant/orders" };
  Object.defineProperty(hiddenExtra, "extra", { value: true });

  for (const rule of [
    null,
    [],
    Object.assign(Object.create(null), {
      effect: "allow",
      action: "read",
      resource: "tenant/orders",
    }),
    inherited,
    { effect: "allow", action: "read" },
    { effect: "allow", action: "read", resource: "tenant/orders", extra: true },
    symbolExtra,
    hiddenExtra,
    accessorEffect,
  ]) {
    assert.throws(
      () => isCapabilityAllowed([rule], "read", "tenant/orders"),
      TypeError,
    );
  }
  assert.equal(fieldReads, 0);
});

test("validates effects, rule patterns, and request tokens exactly", () => {
  const valid = { effect: "allow", action: "read", resource: "tenant/orders" };
  for (const effect of ["", "ALLOW", "permit", new String("allow")]) {
    assert.throws(
      () => isCapabilityAllowed([{ ...valid, effect }], "read", "tenant/orders"),
      TypeError,
    );
  }
  for (const action of ["", "**", "read/write", "read space", new String("read")]) {
    assert.throws(
      () => isCapabilityAllowed([{ ...valid, action }], "read", "tenant/orders"),
      TypeError,
    );
  }
  for (const resource of [
    "",
    "/tenant",
    "tenant/",
    "tenant//orders",
    ".",
    "tenant/../orders",
    "tenant/orders space",
    new String("tenant/orders"),
  ]) {
    assert.throws(
      () => isCapabilityAllowed([{ ...valid, resource }], "read", "tenant/orders"),
      TypeError,
    );
  }
  for (const action of [undefined, null, "", "*", "read/write", new String("read")]) {
    assert.throws(() => isCapabilityAllowed([], action, "tenant/orders"), TypeError);
  }
  for (const resource of [
    undefined,
    null,
    "",
    "*",
    "/tenant",
    "tenant/",
    "tenant//orders",
    new String("tenant/orders"),
  ]) {
    assert.throws(() => isCapabilityAllowed([], "read", resource), TypeError);
  }
});

test("rejects accessor-bearing request values without invoking their getters", () => {
  let actionReads = 0;
  const actionAccessor = {};
  Object.defineProperty(actionAccessor, Symbol.toPrimitive, {
    get() {
      actionReads += 1;
      return () => "read";
    },
  });

  let resourceReads = 0;
  const resourceAccessor = {};
  Object.defineProperty(resourceAccessor, "toString", {
    get() {
      resourceReads += 1;
      return () => "tenant/orders";
    },
  });

  assert.throws(
    () => isCapabilityAllowed([], actionAccessor, "tenant/orders"),
    TypeError,
  );
  assert.throws(
    () => isCapabilityAllowed([], "read", resourceAccessor),
    TypeError,
  );
  assert.equal(actionReads, 0);
  assert.equal(resourceReads, 0);
});

test("validates every rule before making a decision without invoking accessors", () => {
  let reads = 0;
  const invalidLaterRule = { action: "read", resource: "tenant/orders" };
  Object.defineProperty(invalidLaterRule, "effect", {
    enumerable: true,
    get() {
      reads += 1;
      return "deny";
    },
  });

  assert.throws(
    () => isCapabilityAllowed([
      { effect: "allow", action: "read", resource: "tenant/orders" },
      invalidLaterRule,
    ], "read", "tenant/orders"),
    TypeError,
  );
  assert.equal(reads, 0);
});

test("preserves caller-owned rules and descriptors", () => {
  const allow = Object.freeze({
    effect: "allow",
    action: "read",
    resource: "tenant/orders",
  });
  const deny = Object.freeze({
    effect: "deny",
    action: "read",
    resource: "tenant/orders/private",
  });
  const rules = Object.freeze([allow, deny]);
  const before = Reflect.ownKeys(rules).map((key) => [
    key,
    Object.getOwnPropertyDescriptor(rules, key),
  ]);

  assert.equal(isCapabilityAllowed(rules, "read", "tenant/orders/public"), true);
  assert.deepEqual(
    Reflect.ownKeys(rules).map((key) => [
      key,
      Object.getOwnPropertyDescriptor(rules, key),
    ]),
    before,
  );
});
