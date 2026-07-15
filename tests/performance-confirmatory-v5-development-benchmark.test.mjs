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
  "../evals/development-effects/performance-confirmatory-v5-suite.json",
  import.meta.url,
);
const preregistrationPath = new URL(
  "../docs/benchmarks/development-effects-performance-confirmatory-v5-preregistration-2026-07-16.md",
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
  "../evals/development-effects/performance-confirmatory-v4-suite.json",
].map((relativePath) => new URL(relativePath, import.meta.url));

const frozen = {
  revision: "5716ee0efd27079c317d398e725c95f763f5f376",
  suite: "3d77b4bb81d551e50a4905be104474247fdf7f7eee53f861c1ee6bcf854ddc76",
  cases: {
    "http-accept-negotiation": {
      mutants_sha256: "bf4dc9608dff66878f5bdce32e0e6d2bc43c88fc9faf28b7440f2938eae19d58",
      verifier_sha256: "a877f9aca988299af4ab894751991050221d2eb6c7a1bfbac2d9ef04840eea7e",
      workspace_sha256: "bf33257e741993c67f07488511421514fb47396a4876b6550e6e04d51d4c46a6",
    },
    "safe-redirect-policy": {
      mutants_sha256: "bbc0b4fa186168c83ef33ee7bfe7bf7f1a004c01dc6b93f9e54eb04ea51b8642",
      verifier_sha256: "b8f34155d73843c293201539b7f064151477afb2a8d2c17f3cd79f02837a7bc0",
      workspace_sha256: "5d9fa07362620e00a9b2e003b842ebbd9d4af9e010df0ac59e412269305ae79d",
    },
    "keyset-cursor-page": {
      mutants_sha256: "0fd8718643f3ddeef00dd20e838d441564d040385c31575cb2c790bef1900448",
      verifier_sha256: "5213039d904bb4c84a7e3b4761c26a3ad76dbac28bed4597237f6133eda6ac09",
      workspace_sha256: "ad5d1c7f9d4d822c452ec4b96e98bb13396cfeba1fadf267f9dea78a62feb5ce",
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
  "weighted-round-robin-interleaving",
  "deep-structured-redaction",
  "bidirectional-association-replacement",
]);

const fixtures = {
  "http-accept-negotiation": {
    mutantCount: 12,
    target: "src/http-accept-negotiation.mjs",
    reference: new URL(
      "./fixtures/performance-v5-references/http-accept-negotiation.mjs",
      import.meta.url,
    ),
  },
  "safe-redirect-policy": {
    mutantCount: 9,
    target: "src/safe-redirect.mjs",
    reference: new URL(
      "./fixtures/performance-v5-references/safe-redirect.mjs",
      import.meta.url,
    ),
  },
  "keyset-cursor-page": {
    mutantCount: 8,
    target: "src/keyset-cursor-page.mjs",
    reference: new URL(
      "./fixtures/performance-v5-references/keyset-cursor-page.mjs",
      import.meta.url,
    ),
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

test("performance v5 suite is an exact quality-first frozen contract", async () => {
  const suite = await loadDevelopmentSuite(suitePath);
  assert.equal(suite.suite_sha256, frozen.suite);
  assert.equal(suite.suite_id, "development-effects-performance-confirmatory-v5-2026-07-16");
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
        "http-accept-negotiation",
        "standard",
        "build",
        "HTTP negotiation build",
        "http-content-negotiation",
      ],
      [
        "safe-redirect-policy",
        "strict",
        "build",
        "safe redirect build",
        "safe-redirect-origin-policy",
      ],
      [
        "keyset-cursor-page",
        "standard",
        "debug",
        "keyset cursor debug",
        "keyset-cursor-pagination",
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
  assert.equal(totalMutants, 29);
});

test("performance v5 cases are new by id, normalized task, semantic family, and snapshots", async () => {
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
});

test("performance v5 pristine fixtures pass visible checks and fail hidden acceptance", async () => {
  const suite = await loadDevelopmentSuite(suitePath);
  const root = await mkdtemp(path.join(os.tmpdir(), "lp-performance-v5-pristine-"));
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

test("performance v5 references pass acceptance and ideal deltas kill every mutant", async () => {
  const suite = await loadDevelopmentSuite(suitePath);
  const root = await mkdtemp(path.join(os.tmpdir(), "lp-performance-v5-reference-"));
  try {
    for (const benchmarkCase of suite.cases) {
      const workspace = path.join(root, benchmarkCase.id);
      const fixture = fixtures[benchmarkCase.id];
      await materializeWorkspaceSnapshot(benchmarkCase.workspace_snapshot, workspace);
      const baselineHead = initializeGit(workspace);
      await writeFile(path.join(workspace, fixture.target), await readFile(fixture.reference, "utf8"));
      const regressionPath = "test/performance-v5-regressions.test.mjs";
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

test("performance v5 inputs and preregistration contain only public relative data", async () => {
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
