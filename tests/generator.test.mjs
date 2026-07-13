import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  projectRoot,
  readMetadata,
  stableJson,
} from "../scripts/lib/project.mjs";
import { expectedArtifacts } from "../scripts/generate.mjs";

test("canonical metadata uses the LeanPowers identity", async () => {
  const metadata = await readMetadata();

  assert.equal(metadata.id, "leanpowers");
  assert.match(metadata.version, /^\d+\.\d+\.\d+$/);
  assert.equal(metadata.name, "LeanPowers");
  assert.equal(metadata.positioningZh, "轻量但不降级的 Agent 工程工作流");
  assert.equal(metadata.tagline, "Essential workflows. Less ceremony.");
  assert.equal(metadata.repository, "https://github.com/LAwLi3tCoding/LeanPowers");
});

test("stableJson sorts object keys recursively and ends with one newline", () => {
  assert.equal(
    stableJson({ z: { b: 2, a: 1 }, a: [{ d: 4, c: 3 }] }),
    '{\n  "a": [\n    {\n      "c": 3,\n      "d": 4\n    }\n  ],\n  "z": {\n    "a": 1,\n    "b": 2\n  }\n}\n',
  );
});

test("generator defines both runtime manifests and marketplaces", async () => {
  const artifacts = await expectedArtifacts();
  const paths = [...artifacts.keys()].sort();

  for (const required of [
    ".agents/plugins/marketplace.json",
    ".claude-plugin/marketplace.json",
    "plugins/claude/leanpowers/.claude-plugin/plugin.json",
    "plugins/codex/leanpowers/.codex-plugin/plugin.json",
    "plugins/claude/leanpowers/skills/shape/SKILL.md",
    "plugins/codex/leanpowers/skills/shape/SKILL.md",
    "plugins/claude/leanpowers/README.md",
    "plugins/codex/leanpowers/LICENSE",
  ]) {
    assert.ok(paths.includes(required), `missing generated artifact: ${required}`);
  }

  const codexManifest = JSON.parse(
    artifacts.get("plugins/codex/leanpowers/.codex-plugin/plugin.json"),
  );
  const claudeManifest = JSON.parse(
    artifacts.get("plugins/claude/leanpowers/.claude-plugin/plugin.json"),
  );

  assert.equal(codexManifest.name, "leanpowers");
  assert.equal(codexManifest.skills, "./skills/");
  assert.equal("hooks" in codexManifest, false);
  assert.equal(claudeManifest.name, "leanpowers");
  assert.equal("interface" in claudeManifest, false);
});

test("checked-in generated artifacts match expected content", async () => {
  const artifacts = await expectedArtifacts();

  for (const [relativePath, expected] of artifacts) {
    const actual = await readFile(new URL(relativePath, projectRoot), "utf8");
    assert.equal(actual, expected, `${relativePath} is stale`);
  }
});
