import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  projectRoot,
  readMetadata,
  stableJson,
} from "../scripts/lib/project.mjs";
import * as generator from "../scripts/generate.mjs";

const {
  commitStagedPackages,
  expectedArtifacts,
  packageReadme,
} = generator;

const skillNames = ["adapt", "build", "debug", "review", "route", "shape", "ship", "verify"];
const engineeringSkillNames = ["build", "debug", "review", "shape", "ship", "verify"];
const referenceNames = [
  "evidence-protocol.md",
  "learning-policy.md",
  "quality-gates.md",
  "risk-policy.md",
  "runtime-contract.md",
  "subagent-policy.md",
  "workflow-transitions.md",
];

test("canonical metadata uses the LeanPowers identity", async () => {
  const metadata = await readMetadata();

  assert.equal(metadata.id, "leanpowers");
  assert.equal(metadata.version, "0.2.0");
  assert.equal(metadata.name, "LeanPowers");
  assert.equal(metadata.positioningZh, "轻量但不降级的 Agent 工程工作流");
  assert.equal(metadata.tagline, "Essential workflows. Less ceremony.");
  assert.equal(metadata.repository, "https://github.com/LAwLi3tCoding/LeanPowers");
});

test("adaptive learning preview identity and documentation are explicit and opt-in", async () => {
  const metadata = await readMetadata();
  const packageJson = JSON.parse(
    await readFile(new URL("package.json", projectRoot), "utf8"),
  );
  const readme = await readFile(new URL("README.md", projectRoot), "utf8");
  const security = await readFile(new URL("SECURITY.md", projectRoot), "utf8");
  const comparison = await readFile(
    new URL("docs/comparison-superpowers.md", projectRoot),
    "utf8",
  );

  assert.equal(packageJson.version, "0.2.0");
  assert.ok(packageJson.keywords.includes("adaptive-learning"));
  assert.ok(packageJson.keywords.includes("feedback"));
  assert.ok(metadata.keywords.includes("adaptive-learning"));
  assert.ok(metadata.keywords.includes("feedback"));
  assert.match(metadata.interface.longDescription, /opt-in project learning/i);
  assert.ok(metadata.interface.defaultPrompt.some((prompt) => /enable.*learning/i.test(prompt)));
  assert.match(readme, /learning is disabled by default/i);
  assert.match(readme, /project-local `.leanpowers\/`/i);
  assert.match(security, /normalized rules and bounded evidence summaries/i);
  assert.match(security, /Node\.js 20\+.*learning is enabled/i);
  assert.match(comparison, /six engineering workflows.*two.*control skill/i);
});

test("published instruction counts match the canonical source exactly", async () => {
  const skillCounts = new Map();
  for (const name of skillNames) {
    const text = await readFile(
      new URL(`skills/${name}/SKILL.md`, projectRoot),
      "utf8",
    );
    skillCounts.set(name, wordCount(text));
  }
  const engineeringWords = engineeringSkillNames.reduce(
    (total, name) => total + skillCounts.get(name),
    0,
  );
  const adaptWords = skillCounts.get("adapt");
  const routeWords = skillCounts.get("route");
  const totalWords = engineeringWords + routeWords + adaptWords;
  const charterWords = wordCount(
    await readFile(new URL("adapters/claude/session-start", projectRoot), "utf8"),
  );

  assert.deepEqual(
    { engineeringWords, routeWords, adaptWords, totalWords, charterWords },
    {
      engineeringWords: 2882,
      routeWords: 598,
      adaptWords: 329,
      totalWords: 3809,
      charterWords: 111,
    },
  );
  for (const relativePath of [
    "README.md",
    "README.zh-CN.md",
    "docs/comparison-superpowers.md",
  ]) {
    const document = await readFile(new URL(relativePath, projectRoot), "utf8");
    for (const expected of ["2,882", "598", "329", "3,809", "84.4%", "79.4%"]) {
      assert.ok(document.includes(expected), `${relativePath} missing ${expected}`);
    }
  }
});

function wordCount(text) {
  const trimmed = text.trim();
  return trimmed === "" ? 0 : trimmed.split(/\s+/u).length;
}

test("stableJson sorts object keys recursively and ends with one newline", () => {
  assert.equal(
    stableJson({ z: { b: 2, a: 1 }, a: [{ d: 4, c: 3 }] }),
    '{\n  "a": [\n    {\n      "c": 3,\n      "d": 4\n    }\n  ],\n  "z": {\n    "a": 1,\n    "b": 2\n  }\n}\n',
  );
});

test("generator exports the exact portable and runtime package file manifest", () => {
  assert.ok(generator.PACKAGE_FILE_MANIFEST, "missing canonical package file manifest");
  assert.deepEqual(generator.PACKAGE_FILE_MANIFEST.portable, [
    "LICENSE",
    "README.md",
    ...referenceNames.map((name) => `references/${name}`),
    "schemas/learning-config.schema.json",
    "schemas/lesson-event.schema.json",
    ...skillNames.flatMap((name) => [
      `skills/${name}/SKILL.md`,
      `skills/${name}/agents/openai.yaml`,
    ]),
    "skills/adapt/scripts/learning-core.mjs",
    "skills/adapt/scripts/learning-store.mjs",
    "skills/adapt/scripts/learning.mjs",
  ].sort());
  assert.deepEqual(generator.PACKAGE_FILE_MANIFEST.codex, [
    ".codex-plugin/plugin.json",
  ]);
  assert.deepEqual(generator.PACKAGE_FILE_MANIFEST.claude, [
    ".claude-plugin/plugin.json",
    "agents/reviewer.md",
    "agents/verifier.md",
    "hooks/hooks.json",
    "hooks/session-start",
  ]);
});

test("generated package artifact keys equal the canonical manifest exactly", async () => {
  assert.equal(typeof generator.packageFileManifest, "function");
  const artifacts = await expectedArtifacts();
  for (const runtime of ["codex", "claude"]) {
    const prefix = `plugins/${runtime}/leanpowers/`;
    const actual = [...artifacts.keys()]
      .filter((file) => file.startsWith(prefix))
      .map((file) => file.slice(prefix.length))
      .sort();
    assert.deepEqual(actual, generator.packageFileManifest(runtime));
  }
});

test("generator defines both runtime manifests and marketplaces", async () => {
  const artifacts = await expectedArtifacts();
  const paths = [...artifacts.keys()].sort();

  for (const required of [
    ".agents/plugins/marketplace.json",
    ".claude-plugin/marketplace.json",
    "plugins/claude/leanpowers/.claude-plugin/plugin.json",
    "plugins/codex/leanpowers/.codex-plugin/plugin.json",
    "plugins/claude/leanpowers/skills/adapt/SKILL.md",
    "plugins/codex/leanpowers/skills/adapt/agents/openai.yaml",
    "plugins/claude/leanpowers/skills/adapt/scripts/learning.mjs",
    "plugins/codex/leanpowers/skills/adapt/scripts/learning-core.mjs",
    "plugins/claude/leanpowers/skills/adapt/scripts/learning-store.mjs",
    "plugins/claude/leanpowers/skills/shape/SKILL.md",
    "plugins/codex/leanpowers/skills/shape/SKILL.md",
    "plugins/claude/leanpowers/references/learning-policy.md",
    "plugins/codex/leanpowers/references/learning-policy.md",
    "plugins/claude/leanpowers/schemas/learning-config.schema.json",
    "plugins/codex/leanpowers/schemas/learning-config.schema.json",
    "plugins/claude/leanpowers/schemas/lesson-event.schema.json",
    "plugins/codex/leanpowers/schemas/lesson-event.schema.json",
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

  for (const packageRoot of [
    "plugins/codex/leanpowers",
    "plugins/claude/leanpowers",
  ]) {
    for (const relativePath of [
      "skills/adapt/SKILL.md",
      "skills/adapt/agents/openai.yaml",
      "skills/adapt/scripts/learning.mjs",
      "skills/adapt/scripts/learning-core.mjs",
      "skills/adapt/scripts/learning-store.mjs",
      "references/learning-policy.md",
      "schemas/learning-config.schema.json",
      "schemas/lesson-event.schema.json",
    ]) {
      assert.equal(
        artifacts.get(`${packageRoot}/${relativePath}`),
        await readFile(new URL(relativePath, projectRoot), "utf8"),
        `${packageRoot}/${relativePath} drifted from source`,
      );
    }
  }
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
