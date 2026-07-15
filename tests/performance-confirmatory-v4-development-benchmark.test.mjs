import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  HELDOUT_AGENT_READ_ISOLATION,
  caseSnapshotContract,
  fingerprintBenchmarkWorkspace,
  loadDevelopmentSuite,
  materializeWorkspaceSnapshot,
  runArtifactRegressionGates,
  runVerifier,
} from "../scripts/lib/development-benchmark.mjs";

const suitePath = new URL(
  "../evals/development-effects/performance-confirmatory-v4-suite.json",
  import.meta.url,
);

const preregistrationPath = new URL(
  "../docs/benchmarks/development-effects-performance-confirmatory-v4-preregistration-2026-07-16.md",
  import.meta.url,
);

const priorSuitePaths = [
  "../evals/development-effects/pilot-suite.json",
  "../evals/development-effects/heldout-suite.json",
  "../evals/development-effects/confirmatory-suite.json",
  "../evals/development-effects/confirmatory-followup-suite.json",
  "../evals/development-effects/performance-confirmatory-suite.json",
  "../evals/development-effects/performance-confirmatory-v2-suite.json",
  "../evals/development-effects/performance-confirmatory-v3-suite.json",
].map((relativePath) => new URL(relativePath, import.meta.url));

const frozen = {
  revision: "25170785dcab7b776dcd79e8eec1b75c8591cf8d",
  suite: "ef756d2a5f55c35366a1692c001d6789ef0dde5f0fb5616119b83572448f765c",
  cases: {
    "weighted-round-robin-interleave": {
      mutants_sha256: "1eeb54b2e6b3bdba51c227b227aacb7460422a73d5e28c46d9a586c395311b5c",
      verifier_sha256: "f6e668130d1e7e08ffd40adcb45b3d9d2953acfcc277d77db83e7b78675144eb",
      workspace_sha256: "173fcb5e076debd15132861ff58f1eaec75609f45c4595c1ce2e6b8cb3c835fc",
    },
    "structured-log-redaction": {
      mutants_sha256: "54706d1603d5d0401ca841d50b293a3f8dc559a8cbc4578275a0671c27804c6a",
      verifier_sha256: "be33ed47215db6eb31827a7bff0b1ba21af8af29cac11bcf3b79fff020791fa8",
      workspace_sha256: "82855490663f9146bcaf7b2d382b9710c405b2c0dca52ab2672142eef2528bc1",
    },
    "bidirectional-tag-index": {
      mutants_sha256: "1bb9178cf07f01f05f5c10b759e49866704fcf2a93b972d213c385021140d4f7",
      verifier_sha256: "ec09bd39e8b10a2ca4f2c61eaf9714f43aa3f8f67f6e6b2ed792389a2105559b",
      workspace_sha256: "2a95c76ccc09d4186f00d0286b738ab3e52ff2fa804751f85b315b3d7a461ac8",
    },
  },
};

const historicalSemanticFamilies = new Set([
  "duration-formatting",
  "localized-template-cache-keying",
  "webhook-secret-rotation",
  "transient-single-flight-loading",
  "integer-range-compaction",
  "layered-build-option-resolution",
  "chunked-ndjson-decoding",
  "canonical-query-serialization",
  "stable-topological-batching",
  "per-key-expiry-caching",
  "simultaneous-text-edit-application",
  "snapshot-signal-dispatch",
  "utf8-byte-chunking",
  "half-open-interval-coalescing",
  "escaped-field-parsing",
  "transactional-batch-flushing",
  "atomic-config-migration",
  "stable-priority-merge",
  "generation-guarded-refresh-cache",
]);

const fixtures = {
  "weighted-round-robin-interleave": {
    mutantCount: 6,
    target: "src/weighted-round-robin-interleave.mjs",
    reference: `export function interleaveWeightedLanes(lanes) {
  const denseValues = (value) => {
    if (!Array.isArray(value) || Reflect.ownKeys(value).length !== value.length + 1) {
      throw new TypeError("invalid array");
    }
    const result = [];
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (descriptor?.enumerable !== true || !Object.hasOwn(descriptor, "value")) {
        throw new TypeError("invalid array element");
      }
      result.push(descriptor.value);
    }
    return result;
  };

  const queues = denseValues(lanes).map((lane) => {
    if (
      lane === null
      || typeof lane !== "object"
      || Object.getPrototypeOf(lane) !== Object.prototype
    ) throw new TypeError("invalid lane");
    const keys = Reflect.ownKeys(lane);
    const weight = Object.getOwnPropertyDescriptor(lane, "weight");
    const items = Object.getOwnPropertyDescriptor(lane, "items");
    if (
      keys.length !== 2
      || !keys.includes("weight")
      || !keys.includes("items")
      || weight?.enumerable !== true
      || items?.enumerable !== true
      || !Object.hasOwn(weight, "value")
      || !Object.hasOwn(items, "value")
      || !Number.isSafeInteger(weight.value)
      || weight.value <= 0
    ) throw new TypeError("invalid lane");
    return {
      items: denseValues(items.value),
      offset: 0,
      weight: weight.value,
    };
  });

  const output = [];
  let remaining = queues.reduce((sum, lane) => sum + lane.items.length, 0);
  while (remaining > 0) {
    for (const lane of queues) {
      const take = Math.min(lane.weight, lane.items.length - lane.offset);
      output.push(...lane.items.slice(lane.offset, lane.offset + take));
      lane.offset += take;
      remaining -= take;
    }
  }
  return output;
}
`,
  },
  "structured-log-redaction": {
    mutantCount: 6,
    target: "src/structured-log-redaction.mjs",
    reference: `export function redactStructuredLog(record, sensitiveKeys) {
  function readSensitiveKeys(keys) {
    if (
      !Array.isArray(keys)
      || keys.length === 0
      || Reflect.ownKeys(keys).length !== keys.length + 1
    ) throw new TypeError("invalid sensitive keys");
    const result = new Set();
    for (let index = 0; index < keys.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(keys, String(index));
      if (
        descriptor?.enumerable !== true
        || !Object.hasOwn(descriptor, "value")
        || typeof descriptor.value !== "string"
        || descriptor.value.length === 0
        || result.has(descriptor.value)
      ) throw new TypeError("invalid sensitive key");
      result.add(descriptor.value);
    }
    return result;
  }

  const sensitive = readSensitiveKeys(sensitiveKeys);
  const active = new Set();
  function clone(value) {
    if (
      value === null
      || typeof value === "boolean"
      || typeof value === "string"
      || (typeof value === "number" && Number.isFinite(value))
    ) return value;
    if (Array.isArray(value)) {
      if (active.has(value) || Reflect.ownKeys(value).length !== value.length + 1) {
        throw new TypeError("invalid array");
      }
      active.add(value);
      const result = [];
      for (let index = 0; index < value.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (descriptor?.enumerable !== true || !Object.hasOwn(descriptor, "value")) {
          throw new TypeError("invalid array element");
        }
        result.push(clone(descriptor.value));
      }
      active.delete(value);
      return result;
    }
    if (
      value === null
      || typeof value !== "object"
      || Object.getPrototypeOf(value) !== Object.prototype
      || active.has(value)
    ) throw new TypeError("invalid object");
    active.add(value);
    const result = {};
    for (const key of Reflect.ownKeys(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        typeof key !== "string"
        || descriptor?.enumerable !== true
        || !Object.hasOwn(descriptor, "value")
      ) throw new TypeError("invalid object property");
      Object.defineProperty(result, key, {
        configurable: true,
        enumerable: true,
        value: sensitive.has(key) ? "[REDACTED]" : clone(descriptor.value),
        writable: true,
      });
    }
    active.delete(value);
    return result;
  }

  if (
    record === null
    || typeof record !== "object"
    || Array.isArray(record)
    || Object.getPrototypeOf(record) !== Object.prototype
  ) throw new TypeError("record must be an ordinary object");
  return clone(record);
}
`,
  },
  "bidirectional-tag-index": {
    mutantCount: 6,
    target: "src/tag-index.mjs",
    reference: `function validateId(id) {
  if (typeof id !== "string" || id.length === 0) throw new TypeError("invalid id");
}

function validateTag(tag) {
  if (typeof tag !== "string" || tag.length === 0) throw new TypeError("invalid tag");
}

function validateTags(tags) {
  if (!Array.isArray(tags) || Reflect.ownKeys(tags).length !== tags.length + 1) {
    throw new TypeError("invalid tags");
  }
  const result = [];
  const seen = new Set();
  for (let index = 0; index < tags.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(tags, String(index));
    if (descriptor?.enumerable !== true || !Object.hasOwn(descriptor, "value")) {
      throw new TypeError("invalid tags");
    }
    validateTag(descriptor.value);
    if (seen.has(descriptor.value)) throw new TypeError("duplicate tag");
    seen.add(descriptor.value);
    result.push(descriptor.value);
  }
  return result;
}

export function createTagIndex() {
  const byId = new Map();
  const byTag = new Map();
  return {
    set(id, tags) {
      validateId(id);
      const next = validateTags(tags);
      const current = byId.get(id);
      if (
        current !== undefined
        && current.size === next.length
        && next.every((tag) => current.has(tag))
      ) return false;
      const wanted = new Set(next);
      const links = current ?? new Map();
      for (const tag of [...links.keys()]) {
        if (!wanted.has(tag)) {
          links.delete(tag);
          const ids = byTag.get(tag);
          ids?.delete(id);
          if (ids?.size === 0) byTag.delete(tag);
        }
      }
      for (const tag of next) {
        if (!links.has(tag)) links.set(tag, true);
        let ids = byTag.get(tag);
        if (ids === undefined) {
          ids = new Map();
          byTag.set(tag, ids);
        }
        if (!ids.has(id)) ids.set(id, true);
      }
      byId.set(id, links);
      return true;
    },
    remove(id) {
      validateId(id);
      const links = byId.get(id);
      if (links === undefined) return false;
      byId.delete(id);
      for (const tag of links.keys()) {
        const ids = byTag.get(tag);
        ids?.delete(id);
        if (ids?.size === 0) byTag.delete(tag);
      }
      return true;
    },
    getTags(id) {
      validateId(id);
      return [...(byId.get(id)?.keys() ?? [])];
    },
    getIds(tag) {
      validateTag(tag);
      return [...(byTag.get(tag)?.keys() ?? [])];
    },
  };
}
`,
  },
};

function initializeGit(workspace) {
  const git = (...args) => execFileSync("git", args, {
    cwd: workspace,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
  git("init", "--quiet");
  git("config", "user.name", "LeanPowers benchmark");
  git("config", "user.email", "benchmark@example.invalid");
  git("add", ".");
  git("commit", "--quiet", "--no-gpg-sign", "-m", "baseline");
  return git("rev-parse", "HEAD");
}

function runReproduction(workspace, reproductionContract) {
  const [command, ...args] = reproductionContract.command.split(" ");
  assert.equal(command, "node");
  const output = execFileSync(process.execPath, args, {
    cwd: workspace,
    encoding: "utf8",
  });
  return JSON.parse(output.trim());
}

function normalizedTaskSha256(taskSource) {
  return createHash("sha256")
    .update(taskSource.trim().replace(/\s+/gu, " "))
    .digest("hex");
}

async function readPriorContracts() {
  const suites = await Promise.all(priorSuitePaths.map(async (suiteUrl) =>
    JSON.parse(await readFile(suiteUrl, "utf8"))
  ));
  const ids = new Set();
  const taskHashes = new Set();
  const snapshotHashes = new Set();
  for (const suite of suites) {
    for (const benchmarkCase of suite.cases ?? []) {
      ids.add(benchmarkCase.id);
      taskHashes.add(normalizedTaskSha256(benchmarkCase.task));
    }
    for (const snapshot of Object.values(suite.freeze_contract?.case_snapshots ?? {})) {
      for (const digest of Object.values(snapshot)) snapshotHashes.add(digest);
    }
  }
  return { ids, snapshotHashes, taskHashes };
}

test("performance v4 suite is an exact quality-first frozen contract", async () => {
  const suite = await loadDevelopmentSuite(suitePath);
  assert.equal(suite.suite_sha256, frozen.suite);
  assert.equal(suite.suite_id, "development-effects-performance-confirmatory-v4-2026-07-16");
  assert.equal(suite.evidence_level, "paired-development-heldout");
  assert.equal(suite.freeze_contract_verified, true);
  assert.equal(suite.report_contract, "categorized-exact-render-v1");
  assert.equal(suite.freeze_contract.agent_read_isolation, HELDOUT_AGENT_READ_ISOLATION);
  assert.equal(
    suite.freeze_contract.superpowers_revision,
    "d884ae04edebef577e82ff7c4e143debd0bbec99",
  );
  assert.equal(suite.freeze_contract.leanpowers_revision, frozen.revision);
  assert.equal(suite.freeze_contract.evaluator_revision, frozen.revision);
  assert.equal(suite.freeze_contract.runner_revision, frozen.revision);
  assert.equal(suite.model_default, "gpt-5.3-codex-spark");
  assert.equal(suite.effort, "low");
  assert.equal(suite.repetitions, 2);
  assert.deepEqual(suite.workflow_order, [
    ["superpowers-6.1.1", "leanpowers-0.2.0"],
    ["leanpowers-0.2.0", "superpowers-6.1.1"],
  ]);
  assert.deepEqual(suite.token_target, {
    metric: "aggregate-model-token-share",
    population: "all-matched-pairs",
    max_share_pct: 60,
  });
  assert.deepEqual(
    suite.cases.map(({
      id,
      risk_level: riskLevel,
      expected_workflow: owner,
      reporting_category: category,
      task_family: taskFamily,
    }) => [id, riskLevel, owner, category, taskFamily]),
    [
      [
        "weighted-round-robin-interleave",
        "standard",
        "build",
        "weighted interleave build",
        "weighted-round-robin-interleaving",
      ],
      [
        "structured-log-redaction",
        "strict",
        "build",
        "structured redaction build",
        "deep-structured-redaction",
      ],
      [
        "bidirectional-tag-index",
        "standard",
        "debug",
        "bidirectional index debug",
        "bidirectional-association-replacement",
      ],
    ],
  );

  let totalMutants = 0;
  for (const benchmarkCase of suite.cases) {
    assert.deepEqual(caseSnapshotContract(benchmarkCase), frozen.cases[benchmarkCase.id]);
    const mutantCount = benchmarkCase.artifact_regression_gates.reduce(
      (sum, gate) => sum + gate.mutations.length,
      0,
    );
    assert.equal(mutantCount, fixtures[benchmarkCase.id].mutantCount, benchmarkCase.id);
    totalMutants += mutantCount;
  }
  assert.equal(totalMutants, 18);
});

test("performance v4 cases are new by id, normalized task, semantic family, and snapshots", async () => {
  const suite = await loadDevelopmentSuite(suitePath);
  const prior = await readPriorContracts();
  const currentTaskHashes = new Set();
  const currentSnapshotHashes = new Set();

  for (const benchmarkCase of suite.cases) {
    assert.equal(prior.ids.has(benchmarkCase.id), false, benchmarkCase.id);
    const taskHash = normalizedTaskSha256(benchmarkCase.task);
    assert.equal(prior.taskHashes.has(taskHash), false, benchmarkCase.id);
    assert.equal(currentTaskHashes.has(taskHash), false, benchmarkCase.id);
    currentTaskHashes.add(taskHash);
    assert.equal(
      historicalSemanticFamilies.has(benchmarkCase.task_family),
      false,
      benchmarkCase.task_family,
    );
    for (const digest of Object.values(caseSnapshotContract(benchmarkCase))) {
      assert.equal(prior.snapshotHashes.has(digest), false, `${benchmarkCase.id}:${digest}`);
      assert.equal(currentSnapshotHashes.has(digest), false, `${benchmarkCase.id}:${digest}`);
      currentSnapshotHashes.add(digest);
    }
  }
  assert.equal(currentTaskHashes.size, 3);
  assert.equal(currentSnapshotHashes.size, 9);
  assert.equal(suite.cases.some(({ id }) => id === "stable-topological-plan"), false);
});

test("performance v4 pristine fixtures pass visible checks and fail hidden acceptance", async () => {
  const suite = await loadDevelopmentSuite(suitePath);
  const root = await mkdtemp(path.join(os.tmpdir(), "lp-performance-v4-pristine-"));
  try {
    for (const benchmarkCase of suite.cases) {
      const workspace = path.join(root, benchmarkCase.id);
      await materializeWorkspaceSnapshot(benchmarkCase.workspace_snapshot, workspace);
      if (benchmarkCase.reproduction_contract) {
        assert.deepEqual(
          runReproduction(workspace, benchmarkCase.reproduction_contract),
          benchmarkCase.reproduction_contract.expected_output,
        );
      }
      const verifier = await runVerifier({
        workspace,
        verifierSnapshots: benchmarkCase.verifier_snapshots,
      });
      assert.equal(verifier.visible.exit_code, 0, `${benchmarkCase.id}: ${verifier.visible.output}`);
      assert.notEqual(verifier.hidden.exit_code, 0, benchmarkCase.id);
    }
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("performance v4 references pass acceptance and ideal deltas kill every mutant", async () => {
  const suite = await loadDevelopmentSuite(suitePath);
  const root = await mkdtemp(path.join(os.tmpdir(), "lp-performance-v4-reference-"));
  try {
    for (const benchmarkCase of suite.cases) {
      const workspace = path.join(root, benchmarkCase.id);
      const fixture = fixtures[benchmarkCase.id];
      await materializeWorkspaceSnapshot(benchmarkCase.workspace_snapshot, workspace);
      const baselineHead = initializeGit(workspace);
      await writeFile(path.join(workspace, fixture.target), fixture.reference);
      const regressionPath = "test/performance-v4-regressions.test.mjs";
      await writeFile(
        path.join(workspace, regressionPath),
        benchmarkCase.verifier_snapshots.map(({ source }) => source).join("\n"),
      );

      if (benchmarkCase.reproduction_contract) {
        assert.deepEqual(
          runReproduction(workspace, benchmarkCase.reproduction_contract),
          benchmarkCase.reproduction_contract.resolved_output,
        );
      }
      const beforeVerifier = await fingerprintBenchmarkWorkspace({ baselineHead, workspace });
      const verifier = await runVerifier({
        workspace,
        verifierSnapshots: benchmarkCase.verifier_snapshots,
      });
      assert.equal(verifier.visible.exit_code, 0, `${benchmarkCase.id}: ${verifier.visible.output}`);
      assert.equal(verifier.hidden.exit_code, 0, `${benchmarkCase.id}: ${verifier.hidden.output}`);
      assert.equal(
        await fingerprintBenchmarkWorkspace({ baselineHead, workspace }),
        beforeVerifier,
      );

      const result = await runArtifactRegressionGates({
        baselineHead,
        changedPaths: [fixture.target, regressionPath],
        gates: benchmarkCase.artifact_regression_gates,
        testGlobs: benchmarkCase.change_policy.tests,
        workspace,
      });
      assert.equal(result.status, "PASS", `${benchmarkCase.id}: ${JSON.stringify(result)}`);
      assert.ok(result.gates.every((gate) =>
        gate.status === "PASS" && gate.members.every((member) =>
          member.baseline_tests_mutant_visible.exit_code === 0
          && member.candidate_tests_mutant_visible.exit_code !== 0
          && member.killed === true
        )
      ));
      assert.equal(
        await fingerprintBenchmarkWorkspace({ baselineHead, workspace }),
        beforeVerifier,
      );
    }
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("performance v4 inputs and preregistration contain only public relative data", async () => {
  const [source, preregistration] = await Promise.all([
    readFile(suitePath, "utf8"),
    readFile(preregistrationPath, "utf8"),
  ]);
  for (const publication of [source, preregistration]) {
    assert.doesNotMatch(
      publication,
      /(?:file:\/\/|\/Users\/|\/home\/[^/\s]+\/|\/private\/(?:tmp|var)\/|[A-Za-z]:\\Users\\)/u,
    );
  }
  assert.match(preregistration, new RegExp(frozen.suite, "u"));
  assert.match(preregistration, /Superpowers.*upstream reference and principal inspiration/iu);
  assert.match(preregistration, /exactly one complete live matrix/iu);
  assert.match(preregistration, /novelty/iu);

  const suite = await loadDevelopmentSuite(suitePath);
  for (const benchmarkCase of suite.cases) {
    for (const declaredPath of [
      benchmarkCase.workspace,
      ...benchmarkCase.verifier_files,
      ...benchmarkCase.artifact_regression_gates.flatMap(({ mutations }) =>
        mutations.flatMap(({ source: mutationSource, target }) => [mutationSource, target])
      ),
    ]) {
      assert.equal(path.posix.isAbsolute(declaredPath), false, declaredPath);
      assert.equal(declaredPath.includes(".."), false, declaredPath);
    }
  }
});
