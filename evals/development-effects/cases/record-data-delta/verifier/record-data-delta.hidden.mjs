import assert from "node:assert/strict";
import test from "node:test";

import * as directApi from "../src/record-data-delta.mjs";
import * as publicApi from "../src/index.mjs";

const { diffRecordData } = directApi;

test("preserves the source-specific order of every category", () => {
  const before = {
    removeZ: 1,
    removeA: 2,
    changeA: 3,
    changeZ: 4,
    stable: 5,
  };
  const after = {
    addZ: 6,
    addA: 7,
    changeZ: 40,
    changeA: 30,
    stable: 5,
  };

  assert.deepEqual(diffRecordData(before, after), {
    added: ["addZ", "addA"],
    removed: ["removeZ", "removeA"],
    changed: ["changeZ", "changeA"],
  });
});

test("uses Object.is and distinguishes own undefined from absence", () => {
  const before = {
    nan: Number.NaN,
    zero: -0,
    gone: undefined,
    stays: undefined,
  };
  const after = {
    nan: Number.NaN,
    zero: 0,
    added: undefined,
    stays: undefined,
  };

  assert.deepEqual(diffRecordData(before, after), {
    added: ["added"],
    removed: ["gone"],
    changed: ["zero"],
  });
});

test("treats distinct structurally equal object values as changed without inspecting them", () => {
  let getterReads = 0;
  let coercions = 0;
  const readSecret = () => {
    getterReads += 1;
    return "secret";
  };
  const coerce = () => {
    coercions += 1;
    return "coerced";
  };
  const makeValue = () => {
    const nested = { stable: 1 };
    Object.defineProperty(nested, "secret", {
      configurable: true,
      enumerable: true,
      get: readSecret,
    });
    Object.defineProperty(nested, Symbol.toPrimitive, {
      configurable: true,
      value: coerce,
    });
    return { nested };
  };

  assert.deepEqual(diffRecordData({ value: makeValue() }, { value: makeValue() }), {
    added: [],
    removed: [],
    changed: ["value"],
  });
  assert.equal(getterReads, 0);
  assert.equal(coercions, 0);
});

test("treats proxy values atomically without metadata traversal", () => {
  let trapCalls = 0;
  const trap = () => {
    trapCalls += 1;
    throw new Error("nested proxy values must remain opaque");
  };
  const makeValue = () => new Proxy({ stable: 1 }, {
    get: trap,
    getOwnPropertyDescriptor: trap,
    getPrototypeOf: trap,
    has: trap,
    ownKeys: trap,
  });

  const stableValue = makeValue();
  assert.deepEqual(diffRecordData({ value: stableValue }, { value: stableValue }), {
    added: [],
    removed: [],
    changed: [],
  });

  assert.deepEqual(diffRecordData({ value: makeValue() }, { value: makeValue() }), {
    added: [],
    removed: [],
    changed: ["value"],
  });
  assert.equal(trapCalls, 0);
});

test("rejects non-exact record surfaces without invoking accessors", () => {
  let getterReads = 0;
  const accessor = {};
  Object.defineProperty(accessor, "value", {
    enumerable: true,
    get() {
      getterReads += 1;
      return 1;
    },
  });
  const symbolKey = { value: 1 };
  symbolKey[Symbol("extra")] = true;
  const nonEnumerable = { value: 1 };
  Object.defineProperty(nonEnumerable, "hidden", { value: true });
  const customPrototype = Object.create({ inherited: true });
  customPrototype.value = 1;

  for (const invalid of [
    null,
    [],
    Object.create(null),
    customPrototype,
    symbolKey,
    nonEnumerable,
    accessor,
  ]) {
    assert.throws(() => diffRecordData(invalid, {}), TypeError);
    assert.throws(() => diffRecordData({}, invalid), TypeError);
  }
  assert.equal(getterReads, 0);
});

test("treats values atomically and supports an own __proto__ data key", () => {
  let nestedReads = 0;
  const nested = {};
  Object.defineProperty(nested, "secret", {
    get() {
      nestedReads += 1;
      return "hidden";
    },
  });
  const before = { nested };
  const after = { nested };
  Object.defineProperty(before, "__proto__", {
    configurable: true,
    enumerable: true,
    value: { version: 1 },
    writable: true,
  });
  Object.defineProperty(after, "__proto__", {
    configurable: true,
    enumerable: true,
    value: { version: 2 },
    writable: true,
  });

  assert.deepEqual(diffRecordData(before, after), {
    added: [],
    removed: [],
    changed: ["__proto__"],
  });
  assert.equal(nestedReads, 0);
});

test("returns a fresh exact result without changing either input", () => {
  const before = { removed: 1, changed: 2 };
  const after = { added: 3, changed: 4 };
  const beforeDescriptors = Object.getOwnPropertyDescriptors(before);
  const afterDescriptors = Object.getOwnPropertyDescriptors(after);
  const first = diffRecordData(before, after);
  const second = diffRecordData(before, after);

  assert.deepEqual(first, {
    added: ["added"],
    removed: ["removed"],
    changed: ["changed"],
  });
  assert.notEqual(first, second);
  assert.equal(Object.getPrototypeOf(first), Object.prototype);
  assert.deepEqual(Reflect.ownKeys(first), ["added", "removed", "changed"]);
  const firstLists = [];
  for (const key of ["added", "removed", "changed"]) {
    const firstDescriptor = Object.getOwnPropertyDescriptor(first, key);
    const secondDescriptor = Object.getOwnPropertyDescriptor(second, key);
    for (const descriptor of [firstDescriptor, secondDescriptor]) {
      assert.ok(descriptor);
      assert.equal("value" in descriptor, true);
      assert.equal(descriptor.enumerable, true);
      assert.equal(descriptor.writable, true);
      assert.equal(descriptor.configurable, true);
    }
    const firstList = firstDescriptor.value;
    const secondList = secondDescriptor.value;
    firstLists.push(firstList);
    assert.notEqual(firstList, secondList);
    assert.equal(Object.getPrototypeOf(firstList), Array.prototype);
    assert.deepEqual(
      Reflect.ownKeys(firstList),
      firstList.map((_, index) => String(index)).concat("length"),
    );
  }
  assert.equal(new Set(firstLists).size, 3);
  assert.deepEqual(Object.getOwnPropertyDescriptors(before), beforeDescriptors);
  assert.deepEqual(Object.getOwnPropertyDescriptors(after), afterDescriptors);

  first.added.push("later");
  first.removed.length = 0;
  assert.deepEqual(second, {
    added: ["added"],
    removed: ["removed"],
    changed: ["changed"],
  });
  assert.deepEqual(before, { removed: 1, changed: 2 });
  assert.deepEqual(after, { added: 3, changed: 4 });
});

test("preserves the exact direct and public named export surfaces", () => {
  assert.equal(publicApi.diffRecordData, diffRecordData);
  assert.deepEqual(Object.keys(directApi), ["diffRecordData"]);
  assert.deepEqual(Object.keys(publicApi), ["diffRecordData"]);
});
