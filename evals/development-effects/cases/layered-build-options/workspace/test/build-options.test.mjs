import assert from "node:assert/strict";
import test from "node:test";

import { resolveBuildOptions, VERSION } from "../src/index.mjs";

test("project options override matching defaults", () => {
  assert.deepEqual(
    resolveBuildOptions(
      { format: "esm", target: "es2020", outDir: "dist" },
      { target: "es2022", outDir: "build" },
    ),
    { format: "esm", target: "es2022", outDir: "build" },
  );
});

test("missing project options keep the defaults and public version", () => {
  assert.deepEqual(
    resolveBuildOptions({ format: "cjs", target: "node20" }),
    { format: "cjs", target: "node20" },
  );
  assert.equal(VERSION, "1.0.0");
});
