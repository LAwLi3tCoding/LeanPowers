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
  "../evals/development-effects/performance-confirmatory-v6-suite.json",
  import.meta.url,
);
const preregistrationPath = new URL(
  "../docs/benchmarks/development-effects-performance-confirmatory-v6-preregistration-2026-07-16.md",
  import.meta.url,
);
const resultPath = new URL(
  "../docs/benchmarks/development-effects-performance-confirmatory-v6-2026-07-16.md",
  import.meta.url,
);
const auditPath = new URL(
  "../docs/benchmarks/development-effects-performance-confirmatory-v6-audit-2026-07-16.md",
  import.meta.url,
);
const historicalResultPaths = [
  {
    sha256: "b297b1428533826dd63802970e657349f6c42bab908b6e2c3a2d9360657dda08",
    url: new URL(
      "../docs/benchmarks/development-effects-performance-confirmatory-v4-2026-07-16.md",
      import.meta.url,
    ),
  },
  {
    sha256: "d03c2dee03b97b7f5fc8ab601d6692b43da1dadba0c4da1a12c57bc9b1d38eda",
    url: new URL(
      "../docs/benchmarks/development-effects-performance-confirmatory-v5-2026-07-16.md",
      import.meta.url,
    ),
  },
];
const priorSuitePaths = [
  "../evals/development-effects/pilot-suite.json",
  "../evals/development-effects/heldout-suite.json",
  "../evals/development-effects/confirmatory-suite.json",
  "../evals/development-effects/confirmatory-followup-suite.json",
  "../evals/development-effects/performance-confirmatory-suite.json",
  "../evals/development-effects/performance-confirmatory-v2-suite.json",
  "../evals/development-effects/performance-confirmatory-v3-suite.json",
  "../evals/development-effects/performance-confirmatory-v4-suite.json",
  "../evals/development-effects/performance-confirmatory-v5-suite.json",
].map((relativePath) => new URL(relativePath, import.meta.url));

const frozen = {
  leanpowersRevision: "1a88de222685f420ebb14a84b8bab405ec2e33a6",
  evaluatorRevision: "b82812c91f46f708475cac285847ed84b70e441a",
  runnerRevision: "b82812c91f46f708475cac285847ed84b70e441a",
  suite: "aa6cf77ac1ed7b2d3aeab2ab0d8484fbcf2a9199940a4adf46d6fb43f8332bdb",
  preregistration: "c4fe282a9e8e3c1616be5f5397bc8f7216c7c376e171560ba1238bdf0b948d04",
  cases: {
    "cyclic-sequence-rotation": {
      mutants_sha256: "b2588b25b3284c2580abaa85bacdb0d611577d464d4a6ee5a8e92c8b373d5206",
      verifier_sha256: "aaefcfd98c1f058374528277bd4785b7cc91407d6277b8c743859b6c9876dbc2",
      workspace_sha256: "2643779c8506acb7495e61d190191d36855ec06bcd1ee1605174be9b43908803",
    },
    "version-vector-relation": {
      mutants_sha256: "afd77b6a88d5836a80787c2fc7ba1231dd2bf8a1be374ffdc91d4b8d769637a2",
      verifier_sha256: "4ceef552651da383dd4a43b6231e5857f233d07d19297dc21d07d464e2062d3a",
      workspace_sha256: "5af0e494a3a55764bbf6f19e180144e13a60261f66bec6af689f35b6c5760cc7",
    },
    "json-merge-patch": {
      mutants_sha256: "f670dc36ab6c88f70474c8b3f44ed392f0d57154d392f2e180c08fbd545b475c",
      verifier_sha256: "d2e67af87c9f20765adde8612b4ed61ad073c8ded019cc9a52c9e9b7cbb35357",
      workspace_sha256: "07d4ea0ba1a01e28b4e83b11db16fe484d243bc75eda87d6a3d8d86bacb78c1d",
    },
    "ring-buffer-wraparound": {
      mutants_sha256: "94520a2a7396e02667ef7c3a35ffd340532fb33ac01052b9749a164936aa8dad",
      verifier_sha256: "6b2efb9fe5e3dea7ae4bb5455fa67eaeb58a4a26f7c40a55cf84c45dc3bb8018",
      workspace_sha256: "7de83c2c55530c029c161a37d05ddac413959f580b87509cf6a45654ca96c13d",
    },
    "capability-scope-decision": {
      mutants_sha256: "895797c39b1481cf3a44d2ec805f61a180c1a8379a3e0edaaba4b03b86657bd6",
      verifier_sha256: "8a6931177ee02e8c4c8df3ad855d9618d5736524a6de7383c364145c54fcda11",
      workspace_sha256: "12dba20809438414d2c74bfc952101d6f6d8b715cfe565ee082f260fcc15adae",
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
  "http-content-negotiation",
  "safe-redirect-origin-policy",
  "keyset-cursor-pagination",
]);

const fixtures = {
  "cyclic-sequence-rotation": {
    mutantCount: 4,
    target: "src/cyclic-sequence-rotation.mjs",
    reference: new URL(
      "./fixtures/performance-v6-references/cyclic-sequence-rotation.mjs",
      import.meta.url,
    ),
  },
  "version-vector-relation": {
    mutantCount: 4,
    target: "src/version-vector-relation.mjs",
    reference: new URL(
      "./fixtures/performance-v6-references/version-vector-relation.mjs",
      import.meta.url,
    ),
  },
  "json-merge-patch": {
    mutantCount: 5,
    target: "src/json-merge-patch.mjs",
    reference: new URL(
      "./fixtures/performance-v6-references/json-merge-patch.mjs",
      import.meta.url,
    ),
  },
  "ring-buffer-wraparound": {
    mutantCount: 5,
    target: "src/ring-buffer.mjs",
    reference: new URL(
      "./fixtures/performance-v6-references/ring-buffer-wraparound.mjs",
      import.meta.url,
    ),
  },
  "capability-scope-decision": {
    mutantCount: 7,
    target: "src/capability-scope-decision.mjs",
    reference: new URL(
      "./fixtures/performance-v6-references/capability-scope-decision.mjs",
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

test("performance v6 suite is an exact quality-first frozen contract", async () => {
  const suite = await loadDevelopmentSuite(suitePath);
  assert.equal(suite.suite_sha256, frozen.suite);
  assert.equal(suite.suite_id, "development-effects-performance-confirmatory-v6-2026-07-16");
  assert.equal(suite.evidence_level, "paired-development-heldout");
  assert.equal(suite.freeze_contract_verified, true);
  assert.equal(suite.freeze_contract.status, "frozen-before-live-run");
  assert.equal(suite.report_contract, "categorized-exact-render-v1");
  assert.equal(suite.freeze_contract.agent_read_isolation, HELDOUT_AGENT_READ_ISOLATION);
  assert.equal(
    suite.freeze_contract.superpowers_revision,
    "d884ae04edebef577e82ff7c4e143debd0bbec99",
  );
  assert.equal(
    suite.freeze_contract.leanpowers_revision,
    frozen.leanpowersRevision,
  );
  assert.equal(
    suite.freeze_contract.evaluator_revision,
    frozen.evaluatorRevision,
  );
  assert.equal(suite.freeze_contract.runner_revision, frozen.runnerRevision);
  assert.equal(suite.model_default, "gpt-5.3-codex-spark");
  assert.equal(suite.effort, "medium");
  assert.equal(suite.repetitions, 2);
  assert.deepEqual(suite.workflow_order, [
    ["superpowers-6.1.1", "leanpowers-0.2.0"],
    ["leanpowers-0.2.0", "superpowers-6.1.1"],
  ]);
  assert.deepEqual(suite.case_order, [
    [
      "cyclic-sequence-rotation",
      "version-vector-relation",
      "json-merge-patch",
      "ring-buffer-wraparound",
      "capability-scope-decision",
    ],
    [
      "capability-scope-decision",
      "ring-buffer-wraparound",
      "json-merge-patch",
      "version-vector-relation",
      "cyclic-sequence-rotation",
    ],
  ]);
  assert.deepEqual(suite.freeze_contract.case_order, suite.case_order);
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
      ["cyclic-sequence-rotation", "lean", "build", "cyclic rotation build", "cyclic-sequence-normalization"],
      ["version-vector-relation", "standard", "debug", "version vector debug", "version-vector-causality"],
      ["json-merge-patch", "standard", "build", "JSON merge patch build", "json-merge-patch-application"],
      ["ring-buffer-wraparound", "standard", "debug", "ring buffer debug", "ring-buffer-wraparound-ordering"],
      ["capability-scope-decision", "strict", "build", "capability scope strict build", "capability-scope-authorization"],
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
  assert.equal(totalMutants, 25);
});

test("performance v6 cases are new by id, normalized task, semantic family, and snapshots", async () => {
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
  assert.equal(currentTaskHashes.size, 5);
  assert.equal(currentSnapshotHashes.size, 15);
});

test("performance v6 pristine fixtures pass visible checks and fail hidden acceptance", async () => {
  const suite = await loadDevelopmentSuite(suitePath);
  const root = await mkdtemp(path.join(os.tmpdir(), "lp-performance-v6-pristine-"));
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

test("performance v6 references pass acceptance and ideal deltas kill every mutant", async () => {
  const suite = await loadDevelopmentSuite(suitePath);
  const root = await mkdtemp(path.join(os.tmpdir(), "lp-performance-v6-reference-"));
  try {
    for (const benchmarkCase of suite.cases) {
      const workspace = path.join(root, benchmarkCase.id);
      const fixture = fixtures[benchmarkCase.id];
      await materializeWorkspaceSnapshot(benchmarkCase.workspace_snapshot, workspace);
      const baselineHead = initializeGit(workspace);
      await writeFile(path.join(workspace, fixture.target), await readFile(fixture.reference, "utf8"));
      const regressionPath = "test/performance-v6-regressions.test.mjs";
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

test("performance v6 inputs and preregistration contain only public relative data", async () => {
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
  assert.equal(
    createHash("sha256").update(preregistration).digest("hex"),
    frozen.preregistration,
  );
  assert.match(preregistration, new RegExp(frozen.suite, "u"));
  assert.match(preregistration, new RegExp(frozen.leanpowersRevision, "u"));
  assert.match(preregistration, new RegExp(frozen.evaluatorRevision, "u"));
  assert.match(preregistration, /Superpowers.*upstream reference and principal inspiration/iu);
  assert.match(preregistration, /v4 remains a frozen \*\*FAIL\*\*: Superpowers Task PASS `5\/6`, LeanPowers Task PASS `3\/6`, LeanPowers conformance `0\/6`, and aggregate Lean Token share `79\.0877%`/u);
  assert.match(preregistration, /v5 remains a frozen \*\*FAIL\*\*: Superpowers Task PASS `0\/6`, LeanPowers Task PASS `0\/6`, and LeanPowers conformance `0\/6`/u);
  assert.match(preregistration, /five telemetry-complete pairs had diagnostic aggregate Lean Token share `102\.3742%`; one Superpowers run lacked complete telemetry/u);
  assert.match(preregistration, /Superpowers passes all `10\/10` task runs and LeanPowers passes all `10\/10` task runs/u);
  assert.match(preregistration, /LeanPowers passes workflow conformance `10\/10`/u);
  assert.match(preregistration, /Superpowers reports activation `10\/10`/u);
  assert.match(preregistration, /`<=60%`: Token target met/u);
  assert.match(preregistration, /`>60%` and `<=65%`: preregistered near-target band/u);
  assert.match(preregistration, /`>65%`: Token target missed/u);
  for (const quadrant of [
    "both_pass",
    "superpowers_pass_lean_fail",
    "lean_pass_superpowers_fail",
    "both_fail",
  ]) {
    assert.equal(preregistration.includes(`\`${quadrant}\``), true, quadrant);
  }
  assert.match(preregistration, /both workflows individually pass strictly less than `20%` of their ten runs, which here means at most `1\/10` each/u);
  assert.match(preregistration, /both workflows individually pass strictly more than `80%`, which here means at least `9\/10` each/u);
  assert.match(preregistration, /exactly `20%` or `80%` does not trigger either rule/u);
  assert.match(preregistration, /five independent task clusters, not ten independent tasks/u);
  assert.match(preregistration, /Exactly one complete live matrix is authorized for confirmatory interpretation/u);
  assert.match(preregistration, /no live output has been inspected/iu);

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

test("performance v6 publication is sanitized, exact, and preserves frozen history", async () => {
  const [result, audit, ...historicalResults] = await Promise.all([
    readFile(resultPath, "utf8"),
    readFile(auditPath, "utf8"),
    ...historicalResultPaths.map(({ url }) => readFile(url, "utf8")),
  ]);
  for (const publication of [result, audit]) {
    assert.doesNotMatch(
      publication,
      /(?:file:\/\/|\/Users\/|\/home\/[^/\s]+\/|\/private\/(?:tmp|var)\/|[A-Za-z]:\\Users\\)/u,
    );
  }
  assert.equal(
    createHash("sha256").update(result).digest("hex"),
    "959c9f9f3889efc90cd3fc129b070caed266e373e082f57c13ce6104ba8c2a94",
  );
  assert.equal(
    createHash("sha256").update(audit).digest("hex"),
    "25b336b30397bd6d214de9e3e0c027de041f1941136b25944cad0c1a3e03eff7",
  );
  historicalResults.forEach((source, index) => {
    assert.equal(
      createHash("sha256").update(source).digest("hex"),
      historicalResultPaths[index].sha256,
    );
  });

  assert.match(result, /Status: \*\*FAIL\*\*/u);
  assert.match(result, /Reasons: lean-conformance, task-outcome, token-target\./u);
  assert.match(result, /superpowers-6\.1\.1 \| 4\/10/u);
  assert.match(result, /leanpowers-0\.2\.0 \| 4\/10/u);
  assert.match(result, /both_pass \| 4/u);
  assert.match(result, /superpowers_pass_lean_fail \| 0/u);
  assert.match(result, /lean_pass_superpowers_fail \| 0/u);
  assert.match(result, /both_fail \| 6/u);
  assert.match(result, /75\.15184646891723%/u);
  assert.match(result, /All matched runs \| 10\/10[\s\S]{0,220}\| 4\.6%/u);
  assert.match(result, /upstream baseline and inspiration for LeanPowers/iu);

  assert.match(audit, /LeanPowers conformance failures: `9\/10`/u);
  assert.match(audit, /The preregistered primary population is therefore `0\/10`/u);
  assert.match(audit, /`92\.9869680816793%`/u);
  assert.match(audit, /supplied `91\.3%` of the total Token saving/u);
  assert.match(audit, /zero model calls/u);
  assert.match(audit, /V6 is now frozen calibration evidence/u);
  assert.match(audit, /will not be rerun, rescored, or tuned/u);
  assert.match(audit, /upstream reference and principal engineering foundation/iu);
});
