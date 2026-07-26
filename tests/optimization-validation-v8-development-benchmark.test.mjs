import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  caseSnapshotContract,
  fingerprintBenchmarkWorkspace,
  loadDevelopmentSuite,
  materializeWorkspaceSnapshot,
  runArtifactRegressionGates,
  runVerifier,
} from "../scripts/lib/development-benchmark.mjs";

const suitePath = new URL(
  "../evals/development-effects/optimization-validation-v8-suite.json",
  import.meta.url,
);
const suiteDirectory = new URL("../evals/development-effects/", import.meta.url);

const expectedCaseIds = [
  "stable-multiset-subtract",
  "retry-budget-success-reset",
  "bearer-credential-boundary",
];

const historicalTaskFamilies = new Set([
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
  "weighted-round-robin-interleaving",
  "deep-structured-redaction",
  "bidirectional-association-replacement",
  "http-content-negotiation",
  "safe-redirect-origin-policy",
  "keyset-cursor-pagination",
  "cyclic-sequence-normalization",
  "version-vector-causality",
  "json-merge-patch-application",
  "ring-buffer-wraparound-ordering",
  "capability-scope-authorization",
  "stable-token-deduplication",
  "async-permit-release",
  "record-delta-merge",
  "undo-redo-branching",
  "forwarded-header-sanitization",
]);

const fixtures = {
  "stable-multiset-subtract": {
    target: "src/stable-multiset-subtract.mjs",
    reference: new URL(
      "../evals/development-effects/cases/stable-multiset-subtract/verifier/reference/stable-multiset-subtract.reference.mjs",
      import.meta.url,
    ),
    regressionPath: "test/optimization-v8-stable-multiset-regression.test.mjs",
  },
  "retry-budget-success-reset": {
    target: "src/retry-budget.mjs",
    reference: new URL(
      "../evals/development-effects/cases/retry-budget-success-reset/verifier/reference/retry-budget-success-reset.reference.mjs",
      import.meta.url,
    ),
    regressionPath: "test/optimization-v8-retry-budget-regression.test.mjs",
  },
  "bearer-credential-boundary": {
    target: "src/extract-bearer-credential.mjs",
    reference: new URL(
      "../evals/development-effects/cases/bearer-credential-boundary/verifier/reference/bearer-credential-boundary.reference.mjs",
      import.meta.url,
    ),
    regressionPath: "test/optimization-v8-bearer-credential-regression.test.mjs",
  },
};

function initializeFixtureGit(workspace) {
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

async function loadPriorContracts() {
  const filenames = await readdir(suiteDirectory);
  const suites = [];
  for (const filename of filenames) {
    if (!filename.endsWith("-suite.json")) continue;
    if (filename === "optimization-validation-v8-suite.json") continue;
    suites.push(JSON.parse(await readFile(new URL(filename, suiteDirectory), "utf8")));
  }

  const ids = new Set();
  const taskHashes = new Set();
  const snapshotHashes = new Set();
  for (const suite of suites) {
    for (const benchmarkCase of suite.cases ?? []) {
      ids.add(benchmarkCase.id);
      taskHashes.add(normalizedTaskSha256(benchmarkCase.task));
    }
    for (const snapshot of Object.values(suite.freeze_contract?.case_snapshots ?? {})) {
      for (const digest of Object.values(snapshot)) {
        snapshotHashes.add(digest);
      }
    }
  }
  return { ids, snapshotHashes, taskHashes };
}

async function withMaterializedCase(root, benchmarkCase, callback) {
  const workspace = path.join(root, benchmarkCase.id);
  await materializeWorkspaceSnapshot(benchmarkCase.workspace_snapshot, workspace);
  return callback(workspace);
}

async function prepareReferenceCandidate(root, benchmarkCase) {
  return withMaterializedCase(root, benchmarkCase, async (workspace) => {
    const fixture = fixtures[benchmarkCase.id];
    const baselineHead = initializeFixtureGit(workspace);
    await writeFile(
      path.join(workspace, fixture.target),
      await readFile(fixture.reference, "utf8"),
    );
    await writeFile(
      path.join(workspace, fixture.regressionPath),
      benchmarkCase.verifier_snapshots.map(({ source }) => source).join("\n"),
    );
    return { baselineHead, fixture, workspace };
  });
}

test("optimization v8 suite loads three cases and pins the runtime tool policy", async () => {
  const suite = await loadDevelopmentSuite(suitePath);

  assert.equal(suite.suite_id, "development-effects-optimization-validation-v8-2026-07-26");
  assert.equal(suite.evidence_level, "paired-development-pilot");
  assert.equal(suite.runtime, "codex-cli");
  assert.equal(suite.model_default, "gpt-5.5");
  assert.equal(suite.effort, "medium");
  assert.deepEqual(suite.codex_tool_policy, {
    disabled_features: ["image_generation"],
    required_tool_event_type: "command_execution",
  });
  assert.equal(suite.repetitions, 2);
  assert.equal(suite.quality_policy, "lean-all-pass-reference-diagnostic-v1");
  assert.equal(suite.token_target.metric, "aggregate-model-token-share");
  assert.equal(suite.token_target.max_share_pct, 60);
  assert.deepEqual(suite.workflow_order, [
    ["superpowers-6.1.1", "leanpowers-0.2.0"],
    ["leanpowers-0.2.0", "superpowers-6.1.1"],
  ]);
  assert.deepEqual(suite.case_order, [
    [
      "stable-multiset-subtract",
      "retry-budget-success-reset",
      "bearer-credential-boundary",
    ],
    [
      "bearer-credential-boundary",
      "retry-budget-success-reset",
      "stable-multiset-subtract",
    ],
  ]);
  assert.deepEqual(suite.cases.map(({ id }) => id), expectedCaseIds);
});

test("optimization v8 cases are novel by id, task, task family, and snapshot hash", async () => {
  const suite = await loadDevelopmentSuite(suitePath);
  const prior = await loadPriorContracts();
  const currentTaskHashes = new Set();
  const currentSnapshotHashes = new Set();

  for (const benchmarkCase of suite.cases) {
    assert.equal(prior.ids.has(benchmarkCase.id), false, benchmarkCase.id);
    assert.equal(historicalTaskFamilies.has(benchmarkCase.task_family), false, benchmarkCase.task_family);

    const taskHash = normalizedTaskSha256(benchmarkCase.task);
    assert.equal(prior.taskHashes.has(taskHash), false, benchmarkCase.id);
    assert.equal(currentTaskHashes.has(taskHash), false, benchmarkCase.id);
    currentTaskHashes.add(taskHash);

    for (const digest of Object.values(caseSnapshotContract(benchmarkCase))) {
      assert.equal(prior.snapshotHashes.has(digest), false, `${benchmarkCase.id}:${digest}`);
      assert.equal(currentSnapshotHashes.has(digest), false, `${benchmarkCase.id}:${digest}`);
      currentSnapshotHashes.add(digest);
    }
  }

  assert.equal(currentTaskHashes.size, 3);
  assert.equal(currentSnapshotHashes.size, 9);
});

test("optimization v8 pristine baselines pass visible tests and fail hidden acceptance", async () => {
  const suite = await loadDevelopmentSuite(suitePath);
  const root = await mkdtemp(path.join(os.tmpdir(), "lp-optimization-v8-pristine-"));
  try {
    for (const benchmarkCase of suite.cases) {
      await withMaterializedCase(root, benchmarkCase, async (workspace) => {
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
        assert.match(
          verifier.hidden.output,
          /(?:not ok|AssertionError|fail|ERR_ASSERTION)/iu,
          benchmarkCase.id,
        );
      });
    }
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("optimization v8 reference implementations pass visible and hidden acceptance", async () => {
  const suite = await loadDevelopmentSuite(suitePath);
  const root = await mkdtemp(path.join(os.tmpdir(), "lp-optimization-v8-reference-"));
  try {
    for (const benchmarkCase of suite.cases) {
      const { baselineHead, workspace } = await prepareReferenceCandidate(root, benchmarkCase);

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
    }
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("optimization v8 ideal regression gates kill every mutant without changing the workspace", async () => {
  const suite = await loadDevelopmentSuite(suitePath);
  const root = await mkdtemp(path.join(os.tmpdir(), "lp-optimization-v8-gates-"));
  try {
    for (const benchmarkCase of suite.cases) {
      const { baselineHead, fixture, workspace } = await prepareReferenceCandidate(root, benchmarkCase);
      const fingerprintBefore = await fingerprintBenchmarkWorkspace({ baselineHead, workspace });

      const result = await runArtifactRegressionGates({
        baselineHead,
        changedPaths: [fixture.target, fixture.regressionPath],
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
      ), benchmarkCase.id);
      assert.equal(
        await fingerprintBenchmarkWorkspace({ baselineHead, workspace }),
        fingerprintBefore,
      );
    }
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});
