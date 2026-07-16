import assert from "node:assert/strict";
import test from "node:test";

import * as directApi from "../src/version-vector-relation.mjs";
import * as publicApi from "../src/index.mjs";

const { compareVersionVectors } = directApi;

test("compares components present on only one side against zero", () => {
  assert.equal(
    compareVersionVectors({ core: 2 }, { core: 2, ui: 1 }),
    "before",
  );
  assert.equal(
    compareVersionVectors({ core: 2, ui: 1 }, { core: 2 }),
    "after",
  );
  assert.equal(
    compareVersionVectors({ core: 2 }, { core: 2, ui: 0 }),
    "equal",
  );
});

test("reports concurrent vectors by componentwise partial order", () => {
  assert.equal(
    compareVersionVectors({ core: 2, ui: 0 }, { core: 1, ui: 2 }),
    "concurrent",
  );
  assert.equal(
    compareVersionVectors({ api: 1, core: 4 }, { api: 3, core: 2 }),
    "concurrent",
  );
});

test("preserves inputs and their property descriptors", () => {
  const left = { core: 2, ui: 0 };
  const right = { core: 1, ui: 2 };
  const leftBefore = Object.getOwnPropertyDescriptors(left);
  const rightBefore = Object.getOwnPropertyDescriptors(right);

  assert.equal(compareVersionVectors(left, right), "concurrent");
  assert.deepEqual(Object.getOwnPropertyDescriptors(left), leftBefore);
  assert.deepEqual(Object.getOwnPropertyDescriptors(right), rightBefore);
});

test("requires exact ordinary own-enumerable data records without invoking accessors", () => {
  const nullPrototype = Object.assign(Object.create(null), { core: 1 });
  const inherited = Object.create({ inherited: 1 });
  inherited.core = 1;
  const symbolKey = { core: 1 };
  symbolKey[Symbol("extra")] = 1;
  const hiddenKey = { core: 1 };
  Object.defineProperty(hiddenKey, "ui", { value: 1 });
  const unsafeKey = { core: 1 };
  Object.defineProperty(unsafeKey, "__proto__", {
    enumerable: true,
    value: 1,
  });
  let getterCalls = 0;
  const accessor = {};
  Object.defineProperty(accessor, "core", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return 1;
    },
  });

  for (const invalid of [
    nullPrototype,
    inherited,
    symbolKey,
    hiddenKey,
    unsafeKey,
    accessor,
    new Date(0),
    { core: NaN },
    { core: Infinity },
  ]) {
    assert.throws(() => compareVersionVectors(invalid, {}), TypeError);
    assert.throws(() => compareVersionVectors({}, invalid), TypeError);
  }
  assert.equal(getterCalls, 0);
});

test("preserves the exact direct and public named export surfaces", () => {
  assert.equal(publicApi.compareVersionVectors, compareVersionVectors);
  assert.deepEqual(Object.keys(directApi), ["compareVersionVectors"]);
  assert.deepEqual(Object.keys(publicApi), ["compareVersionVectors"]);
});
