import assert from "node:assert/strict";
import test from "node:test";

import * as directApi from "../src/ring-buffer.mjs";
import * as publicApi from "../src/index.mjs";

const { createRingBuffer } = directApi;

test("preserves the exact direct and public named export surfaces", () => {
  assert.equal(publicApi.createRingBuffer, createRingBuffer);
  assert.deepEqual(Object.keys(directApi), ["createRingBuffer"]);
  assert.deepEqual(Object.keys(publicApi), ["createRingBuffer"]);
});

test("returns an ordinary buffer with exactly three enumerable data methods", () => {
  const buffer = createRingBuffer(3);
  assert.equal(Object.getPrototypeOf(buffer), Object.prototype);
  assert.deepEqual(Reflect.ownKeys(buffer), ["push", "clear", "values"]);

  for (const method of ["push", "clear", "values"]) {
    const descriptor = Object.getOwnPropertyDescriptor(buffer, method);
    assert.equal(descriptor?.enumerable, true);
    assert.equal(Object.hasOwn(descriptor, "value"), true);
    assert.equal(typeof descriptor.value, "function");
  }
});

test("returns retained values in chronological order after wrapping", () => {
  const buffer = createRingBuffer(3);
  for (const value of ["a", "b", "c", "d"]) buffer.push(value);

  assert.deepEqual(buffer.values(), ["b", "c", "d"]);
});

test("keeps chronological order across multiple overwrite rounds", () => {
  const buffer = createRingBuffer(3);
  for (let value = 1; value <= 8; value += 1) buffer.push(value);

  assert.deepEqual(buffer.values(), [6, 7, 8]);

  buffer.push(9);
  assert.deepEqual(buffer.values(), [7, 8, 9]);
});

test("clear resets both occupancy and the next insertion position after wrapping", () => {
  const buffer = createRingBuffer(3);
  for (const value of ["a", "b", "c", "d"]) buffer.push(value);

  assert.equal(buffer.clear(), undefined);
  assert.deepEqual(buffer.values(), []);

  buffer.push("x");
  buffer.push("y");
  assert.deepEqual(buffer.values(), ["x", "y"]);

  buffer.push("z");
  buffer.push("next");
  assert.deepEqual(buffer.values(), ["y", "z", "next"]);
});

test("values returns fresh dense arrays without exposing backing state", () => {
  const first = { id: "first" };
  const second = { id: "second" };
  const buffer = createRingBuffer(2);
  buffer.push(first);
  buffer.push(second);

  const initial = buffer.values();
  const repeated = buffer.values();
  assert.notEqual(initial, repeated);
  assert.equal(initial[0], first);
  assert.equal(initial[1], second);
  assert.deepEqual(Reflect.ownKeys(initial), ["0", "1", "length"]);
  assert.deepEqual(Object.keys(initial), ["0", "1"]);

  initial.reverse();
  initial.push("caller-owned");
  assert.deepEqual(buffer.values(), [first, second]);

  const withUndefined = createRingBuffer(2);
  withUndefined.push(undefined);
  const undefinedValues = withUndefined.values();
  assert.deepEqual(undefinedValues, [undefined]);
  assert.equal(Object.hasOwn(undefinedValues, "0"), true);
});

test("capacity one remains chronological and push exposes no backing state", () => {
  const buffer = createRingBuffer(1);
  assert.deepEqual(Object.keys(buffer), ["push", "clear", "values"]);
  assert.equal(buffer.push("first"), undefined);
  assert.equal(buffer.push("second"), undefined);
  assert.deepEqual(buffer.values(), ["second"]);
});

test("requires a positive safe-integer capacity", () => {
  for (const capacity of [
    undefined,
    null,
    true,
    "1",
    0,
    -1,
    1.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.MAX_SAFE_INTEGER + 1,
    new Number(1),
  ]) {
    assert.throws(() => createRingBuffer(capacity), TypeError);
  }
});
