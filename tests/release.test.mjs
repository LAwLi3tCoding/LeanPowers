import assert from "node:assert/strict";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  buildRelease,
  resolveSafeOutputRoot,
} from "../scripts/build-release.mjs";
import {
  collectValidationErrors,
  validateHookDescriptor,
  validateHookOutput,
} from "../scripts/validate-package.mjs";

test("repository package validation passes", async () => {
  assert.deepEqual(await collectValidationErrors(), []);
});

test("standalone validation rejects malformed Claude hook wiring and output", () => {
  assert.ok(validateHookDescriptor({ hooks: {} }).length > 0);
  assert.ok(
    validateHookOutput({
      hookSpecificOutput: { hookEventName: "Other", additionalContext: "" },
    }).length >= 2,
  );
});

test("release builder creates isolated Codex and Claude distributions", async (context) => {
  const outputRoot = await mkdtemp(path.join(os.tmpdir(), "leanpowers-release-"));
  context.after(() => rm(outputRoot, { force: true, recursive: true }));

  const outputs = await buildRelease({ outputRoot });
  assert.equal(outputs.codex, path.join(outputRoot, "codex/leanpowers"));
  assert.equal(outputs.claude, path.join(outputRoot, "claude/leanpowers"));
  await access(path.join(outputs.codex, ".codex-plugin/plugin.json"));
  await access(path.join(outputs.claude, ".claude-plugin/plugin.json"));
  await access(path.join(outputs.codex, "README.md"));
  await access(path.join(outputs.claude, "LICENSE"));
  await assert.rejects(access(path.join(outputs.codex, "hooks")));
  await assert.rejects(access(path.join(outputs.claude, ".codex-plugin")));
});

test("release builder rejects repository and source-package overlap", () => {
  const root = path.resolve(new URL("../", import.meta.url).pathname);
  assert.throws(() => resolveSafeOutputRoot(root), /contains the repository/);
  assert.throws(
    () => resolveSafeOutputRoot(path.dirname(root)),
    /contains the repository/,
  );
  assert.throws(
    () => resolveSafeOutputRoot(path.join(root, "plugins/codex/leanpowers")),
    /must stay under dist/,
  );
  assert.equal(
    resolveSafeOutputRoot(path.join(root, "dist/custom")),
    path.join(root, "dist/custom"),
  );
});

test("metadata, package.json, and generated manifests keep one version", async () => {
  const [metadata, packageJson, codexManifest, claudeManifest] = await Promise.all(
    [
      "metadata/plugin.json",
      "package.json",
      "plugins/codex/leanpowers/.codex-plugin/plugin.json",
      "plugins/claude/leanpowers/.claude-plugin/plugin.json",
    ].map(async (file) => JSON.parse(await readFile(new URL(`../${file}`, import.meta.url)))),
  );
  assert.equal(packageJson.version, metadata.version);
  assert.equal(codexManifest.version, metadata.version);
  assert.equal(claudeManifest.version, metadata.version);
});
