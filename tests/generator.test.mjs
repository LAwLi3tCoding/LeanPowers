import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  projectRoot,
  readMetadata,
  stableJson,
} from "../scripts/lib/project.mjs";
import {
  commitStagedPackages,
  expectedArtifacts,
  packageReadme,
} from "../scripts/generate.mjs";

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
  const codexMarketplace = JSON.parse(
    artifacts.get(".agents/plugins/marketplace.json"),
  );

  assert.equal(codexManifest.name, "leanpowers");
  assert.equal(codexManifest.skills, "./skills/");
  assert.equal("hooks" in codexManifest, false);
  assert.equal(claudeManifest.name, "leanpowers");
  assert.equal("interface" in claudeManifest, false);
  assert.deepEqual(codexMarketplace.plugins[0].source, {
    source: "local",
    path: "./plugins/codex/leanpowers",
  });
});

test("checked-in generated artifacts match expected content", async () => {
  const artifacts = await expectedArtifacts();

  for (const [relativePath, expected] of artifacts) {
    const actual = await readFile(new URL(relativePath, projectRoot), "utf8");
    assert.equal(actual, expected, `${relativePath} is stale`);
  }
});

test("packaged README rewrites repository-only links to canonical GitHub URLs", () => {
  const rendered = packageReadme(
    "[local](docs/benchmark.md) [anchor](#usage) [web](https://example.test)",
    "https://github.com/LAwLi3tCoding/LeanPowers",
  );
  assert.match(
    rendered,
    /https:\/\/github\.com\/LAwLi3tCoding\/LeanPowers\/blob\/main\/docs\/benchmark\.md/,
  );
  assert.match(rendered, /\[anchor\]\(#usage\)/);
  assert.match(rendered, /\[web\]\(https:\/\/example\.test\)/);
});

test("package transaction restores the first package when the second swap fails", async () => {
  const fixture = transactionFixture({
    failRename: ({ from, to }) => from === "stage-claude" && to === "package-claude",
  });

  await assert.rejects(
    commitStagedPackages(fixture.entries, fixture.operations),
    /injected rename failure/,
  );

  assert.deepEqual(fixture.snapshot(), {
    "package-claude": "old-claude",
    "package-codex": "old-codex",
    "stage-claude": "new-claude",
  });
});

test("package transaction reports an incomplete current-package restore", async () => {
  const fixture = transactionFixture({
    failRename: ({ from, to }) =>
      (from === "stage-claude" && to === "package-claude") ||
      (from === "backup-claude" && to === "package-claude"),
  });

  await assert.rejects(
    commitStagedPackages(fixture.entries, fixture.operations),
    (error) =>
      error instanceof AggregateError &&
      /rollback was incomplete/i.test(error.message),
  );

  assert.equal(fixture.snapshot()["package-codex"], "old-codex");
  assert.equal(fixture.snapshot()["backup-claude"], "old-claude");
});

test("package transaction never deletes a new package when its backup vanished", async () => {
  const fixture = transactionFixture({
    failRename: ({ from, to, files }) => {
      if (from === "stage-claude" && to === "package-claude") {
        files.delete("backup-codex");
        return true;
      }
      return false;
    },
  });

  await assert.rejects(
    commitStagedPackages(fixture.entries, fixture.operations),
    (error) =>
      error instanceof AggregateError &&
      /rollback was incomplete/i.test(error.message),
  );

  assert.equal(fixture.snapshot()["package-codex"], "new-codex");
});

test("package transaction distinguishes committed output from backup cleanup failure", async () => {
  const fixture = transactionFixture({
    failRemove: ({ target }) => target === "backup-codex",
  });

  await assert.rejects(
    commitStagedPackages(fixture.entries, fixture.operations),
    (error) =>
      error instanceof AggregateError &&
      /swap committed.*cleanup was incomplete/i.test(error.message),
  );

  assert.equal(fixture.snapshot()["package-codex"], "new-codex");
  assert.equal(fixture.snapshot()["package-claude"], "new-claude");
  assert.equal(fixture.snapshot()["backup-codex"], "old-codex");
});

function transactionFixture({
  failRename = () => false,
  failRemove = () => false,
}) {
  const files = new Map([
    ["package-codex", "old-codex"],
    ["package-claude", "old-claude"],
    ["stage-codex", "new-codex"],
    ["stage-claude", "new-claude"],
  ]);
  const entries = [
    {
      packageUrl: "package-codex",
      stageUrl: "stage-codex",
      backupUrl: "backup-codex",
    },
    {
      packageUrl: "package-claude",
      stageUrl: "stage-claude",
      backupUrl: "backup-claude",
    },
  ];
  const operations = {
    exists: async (target) => files.has(target),
    rename: async (from, to) => {
      if (failRename({ from, to, files })) {
        throw new Error(`injected rename failure: ${from} -> ${to}`);
      }
      if (!files.has(from)) {
        throw new Error(`missing source: ${from}`);
      }
      files.set(to, files.get(from));
      files.delete(from);
    },
    rm: async (target) => {
      if (failRemove({ target, files })) {
        throw new Error(`injected remove failure: ${target}`);
      }
      files.delete(target);
    },
  };
  return {
    entries,
    operations,
    snapshot: () =>
      Object.fromEntries(
        [...files].sort(([left], [right]) => left.localeCompare(right)),
      ),
  };
}
