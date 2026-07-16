import assert from "node:assert/strict";
import test from "node:test";

import * as publicApi from "../src/index.mjs";
import { resolveBuildOptions } from "../src/build-options.mjs";

test("resolves all three layers with CLI options taking precedence", () => {
  assert.deepEqual(
    resolveBuildOptions(
      { format: "esm", target: "es2020", outDir: "dist" },
      { format: "cjs", target: "es2022" },
      { format: "iife", outDir: "release" },
    ),
    { format: "iife", target: "es2022", outDir: "release" },
  );
});

test("undefined means no override in either optional layer", () => {
  assert.deepEqual(
    resolveBuildOptions(
      { format: "esm", target: "es2020", outDir: "dist" },
      { format: undefined, target: "es2022" },
      { target: undefined, outDir: "release" },
    ),
    { format: "esm", target: "es2022", outDir: "release" },
  );
});

test("preserves false, zero, empty string, and null overrides", () => {
  assert.deepEqual(
    resolveBuildOptions(
      { minify: true, sourcemap: 1, banner: "generated", metafile: {} },
      { minify: false, sourcemap: 0 },
      { banner: "", metafile: null },
    ),
    { minify: false, sourcemap: 0, banner: "", metafile: null },
  );
});

test("rejects unknown own options even when their value is undefined", () => {
  assert.throws(
    () => resolveBuildOptions({ target: "es2020" }, { typo: true }),
    TypeError,
  );
  assert.throws(
    () => resolveBuildOptions({ target: "es2020" }, {}, { typo: undefined }),
    TypeError,
  );
});

test("ignores inherited options and copies only declared own defaults", () => {
  const defaults = Object.assign(Object.create({ inheritedDefault: "ignored" }), {
    target: "es2020",
    minify: true,
  });
  const projectOptions = Object.assign(Object.create({ minify: false, typo: true }), {
    target: "es2022",
  });
  const cliOptions = Object.create({ target: "esnext", typo: true });

  const resolved = resolveBuildOptions(defaults, projectOptions, cliOptions);

  assert.deepEqual(resolved, { target: "es2022", minify: true });
  assert.equal(Object.hasOwn(resolved, "inheritedDefault"), false);
});

test("returns a fresh result without mutating any input", () => {
  const defaults = { target: "es2020", minify: true };
  const projectOptions = { target: "es2022" };
  const cliOptions = { minify: false };
  const defaultsSnapshot = { ...defaults };
  const projectSnapshot = { ...projectOptions };
  const cliSnapshot = { ...cliOptions };

  const resolved = resolveBuildOptions(defaults, projectOptions, cliOptions);

  assert.notEqual(resolved, defaults);
  assert.notEqual(resolved, projectOptions);
  assert.notEqual(resolved, cliOptions);
  assert.deepEqual(defaults, defaultsSnapshot);
  assert.deepEqual(projectOptions, projectSnapshot);
  assert.deepEqual(cliOptions, cliSnapshot);
});

test("retains the public named exports and version", () => {
  assert.equal(publicApi.resolveBuildOptions, resolveBuildOptions);
  assert.equal(publicApi.VERSION, "1.0.0");
  assert.deepEqual(Object.keys(publicApi).sort(), ["VERSION", "resolveBuildOptions"]);
});
