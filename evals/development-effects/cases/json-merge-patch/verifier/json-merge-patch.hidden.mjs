import assert from "node:assert/strict";
import test from "node:test";

import * as directApi from "../src/json-merge-patch.mjs";
import * as publicApi from "../src/index.mjs";

const { applyJsonMergePatch } = directApi;

test("recursively merges records, deletes null members, and atomically replaces arrays", () => {
  const target = {
    name: "service",
    obsolete: "remove-me",
    settings: {
      theme: "dark",
      flags: { audit: true, legacy: true },
    },
    routes: [{ path: "/old", enabled: true }],
  };
  const patch = {
    obsolete: null,
    settings: {
      theme: "light",
      flags: { legacy: null, preview: true },
    },
    routes: [{ path: "/new", enabled: false }],
  };
  const descriptorInputs = [
    target,
    target.settings,
    target.settings.flags,
    target.routes,
    target.routes[0],
    patch,
    patch.settings,
    patch.settings.flags,
    patch.routes,
    patch.routes[0],
  ];
  const descriptorsBefore = descriptorInputs.map((value) =>
    Object.getOwnPropertyDescriptors(value)
  );

  const result = applyJsonMergePatch(target, patch);
  assert.deepEqual(result, {
    name: "service",
    settings: {
      theme: "light",
      flags: { audit: true, preview: true },
    },
    routes: [{ path: "/new", enabled: false }],
  });
  assert.equal(Object.hasOwn(result, "obsolete"), false);
  assert.notEqual(result, target);
  assert.notEqual(result.settings, target.settings);
  assert.notEqual(result.settings, patch.settings);
  assert.notEqual(result.settings.flags, target.settings.flags);
  assert.notEqual(result.settings.flags, patch.settings.flags);
  assert.notEqual(result.routes, target.routes);
  assert.notEqual(result.routes, patch.routes);
  assert.notEqual(result.routes[0], patch.routes[0]);

  result.settings.flags.audit = false;
  result.routes[0].path = "/changed";
  assert.deepEqual(target, {
    name: "service",
    obsolete: "remove-me",
    settings: {
      theme: "dark",
      flags: { audit: true, legacy: true },
    },
    routes: [{ path: "/old", enabled: true }],
  });
  assert.deepEqual(patch, {
    obsolete: null,
    settings: {
      theme: "light",
      flags: { legacy: null, preview: true },
    },
    routes: [{ path: "/new", enabled: false }],
  });
  assert.deepEqual(
    descriptorInputs.map((value) => Object.getOwnPropertyDescriptors(value)),
    descriptorsBefore,
  );
});

test("treats arrays and primitive patches as atomic replacement values", () => {
  const target = [{ id: "old" }];
  const patch = [{ id: "new" }];
  const replaced = applyJsonMergePatch(target, patch);
  assert.deepEqual(replaced, [{ id: "new" }]);
  assert.notEqual(replaced, patch);
  assert.notEqual(replaced[0], patch[0]);

  const customArrayPrototype = Object.create(Array.prototype);
  const customArrayPatch = [{ id: "custom" }];
  Object.setPrototypeOf(customArrayPatch, customArrayPrototype);
  const clonedCustomArray = applyJsonMergePatch(null, customArrayPatch);
  assert.deepEqual(clonedCustomArray, [{ id: "custom" }]);
  assert.equal(Object.getPrototypeOf(clonedCustomArray), Array.prototype);
  assert.equal(Object.getPrototypeOf(customArrayPatch), customArrayPrototype);

  const fromArray = applyJsonMergePatch(["discarded"], {
    kept: { value: 1 },
  });
  assert.deepEqual(fromArray, { kept: { value: 1 } });
  assert.deepEqual(Object.keys(fromArray), ["kept"]);
  assert.equal(applyJsonMergePatch({ value: 1 }, null), null);
  assert.equal(applyJsonMergePatch({ value: 1 }, 7), 7);
});

test("deeply isolates new record and array branches introduced only by the patch", () => {
  const target = { stable: true };
  const patch = {
    addedRecord: {
      nested: { value: "record" },
      items: [{ id: "record-item" }],
    },
    addedArray: [{ nested: { value: "array" } }],
  };
  const result = applyJsonMergePatch(target, patch);

  assert.deepEqual(result, {
    stable: true,
    addedRecord: {
      nested: { value: "record" },
      items: [{ id: "record-item" }],
    },
    addedArray: [{ nested: { value: "array" } }],
  });
  assert.notEqual(result.addedRecord, patch.addedRecord);
  assert.notEqual(result.addedRecord.nested, patch.addedRecord.nested);
  assert.notEqual(result.addedRecord.items, patch.addedRecord.items);
  assert.notEqual(result.addedRecord.items[0], patch.addedRecord.items[0]);
  assert.notEqual(result.addedArray, patch.addedArray);
  assert.notEqual(result.addedArray[0], patch.addedArray[0]);
  assert.notEqual(result.addedArray[0].nested, patch.addedArray[0].nested);

  result.addedRecord.nested.value = "result-record";
  result.addedRecord.items[0].id = "result-item";
  result.addedArray[0].nested.value = "result-array";
  result.addedArray.push({ nested: { value: "result-extra" } });
  assert.deepEqual(patch, {
    addedRecord: {
      nested: { value: "record" },
      items: [{ id: "record-item" }],
    },
    addedArray: [{ nested: { value: "array" } }],
  });

  patch.addedRecord.nested.value = "patch-record";
  patch.addedRecord.items.push({ id: "patch-item" });
  patch.addedArray[0].nested.value = "patch-array";
  assert.equal(result.addedRecord.nested.value, "result-record");
  assert.deepEqual(result.addedRecord.items, [{ id: "result-item" }]);
  assert.equal(result.addedArray[0].nested.value, "result-array");
  assert.equal(result.addedArray.length, 2);
  assert.deepEqual(target, { stable: true });
});

test("returns a fresh mutable tree even for unchanged or frozen branches", () => {
  const shared = Object.freeze({ values: Object.freeze([1, 2]) });
  const target = Object.freeze({ left: shared, right: shared });
  const patch = Object.freeze({});
  const result = applyJsonMergePatch(target, patch);

  assert.deepEqual(result, {
    left: { values: [1, 2] },
    right: { values: [1, 2] },
  });
  assert.notEqual(result.left, shared);
  assert.notEqual(result.right, shared);
  assert.notEqual(result.left.values, shared.values);
  result.left.values.push(3);
  result.right.values[0] = 9;
  result.extra = true;
  assert.deepEqual(shared, { values: [1, 2] });
});

test("preserves special own keys without changing the output prototype", () => {
  const target = JSON.parse('{"__proto__":{"fromTarget":true},"keep":1}');
  const patch = JSON.parse('{"__proto__":{"fromPatch":true}}');
  const result = applyJsonMergePatch(target, patch);

  assert.equal(Object.getPrototypeOf(result), Object.prototype);
  assert.equal(Object.hasOwn(result, "__proto__"), true);
  assert.deepEqual(result.__proto__, {
    fromTarget: true,
    fromPatch: true,
  });
  const descriptor = Object.getOwnPropertyDescriptor(result, "__proto__");
  assert.deepEqual(
    {
      configurable: descriptor.configurable,
      enumerable: descriptor.enumerable,
      writable: descriptor.writable,
    },
    { configurable: true, enumerable: true, writable: true },
  );
});

test("rejects invalid JSON-compatible values without invoking accessors", () => {
  let getterReads = 0;
  const accessorObject = {};
  Object.defineProperty(accessorObject, "value", {
    enumerable: true,
    get() {
      getterReads += 1;
      return 1;
    },
  });
  const accessorArray = [];
  Object.defineProperty(accessorArray, "0", {
    enumerable: true,
    get() {
      getterReads += 1;
      return 1;
    },
  });
  accessorArray.length = 1;

  const sparse = [];
  sparse.length = 1;
  const extraArray = [1];
  extraArray.note = true;
  const symbolArray = [1];
  symbolArray[Symbol("extra")] = true;
  const nonEnumerableArray = [1];
  Object.defineProperty(nonEnumerableArray, "note", { value: true });

  const symbolObject = { value: 1 };
  symbolObject[Symbol("extra")] = true;
  const nonEnumerableObject = { value: 1 };
  Object.defineProperty(nonEnumerableObject, "hidden", { value: true });
  const inheritedObject = Object.create({ inherited: true });
  inheritedObject.value = 1;
  const nullPrototype = Object.assign(Object.create(null), { value: 1 });
  const cycle = {};
  cycle.self = cycle;

  const invalidValues = [
    undefined,
    1n,
    Symbol("value"),
    () => 1,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    sparse,
    extraArray,
    symbolArray,
    nonEnumerableArray,
    accessorArray,
    symbolObject,
    nonEnumerableObject,
    accessorObject,
    inheritedObject,
    nullPrototype,
    new Date(0),
    [undefined],
    { nested: { invalid: Number.NaN } },
    cycle,
  ];

  for (const invalid of invalidValues) {
    assert.throws(() => applyJsonMergePatch(invalid, {}), TypeError);
    assert.throws(() => applyJsonMergePatch({}, invalid), TypeError);
  }
  assert.equal(getterReads, 0);
});

test("preserves the exact direct and public named export surfaces", () => {
  assert.equal(publicApi.applyJsonMergePatch, applyJsonMergePatch);
  assert.deepEqual(Object.keys(directApi), ["applyJsonMergePatch"]);
  assert.deepEqual(Object.keys(publicApi), ["applyJsonMergePatch"]);
});
