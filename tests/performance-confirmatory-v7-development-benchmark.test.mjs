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
  "../evals/development-effects/performance-confirmatory-v7-suite.json",
  import.meta.url,
);
const preregistrationPath = new URL(
  "../docs/benchmarks/development-effects-performance-confirmatory-v7-preregistration-2026-07-16.md",
  import.meta.url,
);
const historicalPublicationPaths = [
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
  {
    sha256: "959c9f9f3889efc90cd3fc129b070caed266e373e082f57c13ce6104ba8c2a94",
    url: new URL(
      "../docs/benchmarks/development-effects-performance-confirmatory-v6-2026-07-16.md",
      import.meta.url,
    ),
  },
  {
    sha256: "25b336b30397bd6d214de9e3e0c027de041f1941136b25944cad0c1a3e03eff7",
    url: new URL(
      "../docs/benchmarks/development-effects-performance-confirmatory-v6-audit-2026-07-16.md",
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
  "../evals/development-effects/performance-confirmatory-v6-suite.json",
].map((relativePath) => new URL(relativePath, import.meta.url));

const frozen = {
  leanpowersRevision: "1e59e068e48070f30ebd6b74efbb31e479445a34",
  evaluatorRevision: "7295033839683084f63869460b4d026272c7e566",
  runnerRevision: "7295033839683084f63869460b4d026272c7e566",
  suite: "fe9c8f26c54d922aa998b7e51ef22a6edfee608351836de99285cc105f778d41",
  preregistration: "4bc0be25b872a1ad2dc3d2d51e5b659cdcc3aae889c1848beaff3a1b23bd79f7",
  cases: {
    "stable-unique-tokens": {
      mutants_sha256: "ef9e9d7951f896157a79e0168e2b525d1d60b25b28eb56a09819bae01d6efbf5",
      verifier_sha256: "6c145936ed7d9168d9d3a9be447bd44fe8736a3321b6e50921e3aa99a64040d4",
      workspace_sha256: "9e7044d0cc37294f74610ff83de09d667cdfbb8ea1434eff359e96b46cc1a64c",
    },
    "queued-task-permit-release": {
      mutants_sha256: "d6a5d9103563cdd238d35bcf4d4d0e0ffb9f0f74cf6315fa3fc8e0155f15d538",
      verifier_sha256: "138f813a97f4b269bd5c47f6d98c2295d33e033b727ada18393b253527b8bc4a",
      workspace_sha256: "e92a2e48f77f7731e6e741f1171319892d980f457f276c5c924820d02fc5e3e2",
    },
    "record-data-delta": {
      mutants_sha256: "52714ba914e1c9e7447740df58a18dfcd1cbcd1053b070a7c51736326b380ec1",
      verifier_sha256: "606c9826895a8a37b9d6345fb337bdbad731999e3effcd47deb1cb16ceef715a",
      workspace_sha256: "5e189a0f637b5115ce119d064136ffa35e48b5204f7276b333e6847bb59fa927",
    },
    "branching-undo-history": {
      mutants_sha256: "536a49ffc42f8addca290f726a0c83efb8734c46bc798b11534058163504796d",
      verifier_sha256: "7768b7ef95ae3806eded63708d0ebe1ddd768db4100e5a6d65ec13656d464dca",
      workspace_sha256: "69fbced2fa2e55bfc81f037399d5bc53560e7d276499f5b1161ca49927881e5c",
    },
    "forward-header-sanitization": {
      mutants_sha256: "7c5a5bc196f6f4d2401543ef53935eb4da2cd7bcfad23d713c925969e3a809b5",
      verifier_sha256: "c1818f94cf3eea4f8a6c406eac46ffa7c7b7551998ed17d668e0e2c9ca33f19f",
      workspace_sha256: "ad9d2bfde404b9f31e4ca6b25ff4892762a39b4023727d0240a99c1278fe2a9e",
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
  "cyclic-sequence-normalization",
  "version-vector-causality",
  "json-merge-patch-application",
  "ring-buffer-wraparound-ordering",
  "capability-scope-authorization",
]);

const fixtures = {
  "stable-unique-tokens": {
    mutantCount: 5,
    target: "src/stable-unique-tokens.mjs",
    reference: new URL(
      "./fixtures/performance-v7-references/stable-unique-tokens.mjs",
      import.meta.url,
    ),
  },
  "queued-task-permit-release": {
    mutantCount: 5,
    target: "src/queued-task-permit-release.mjs",
    reference: new URL(
      "./fixtures/performance-v7-references/queued-task-permit-release.mjs",
      import.meta.url,
    ),
  },
  "record-data-delta": {
    mutantCount: 9,
    target: "src/record-data-delta.mjs",
    reference: new URL(
      "./fixtures/performance-v7-references/record-data-delta.mjs",
      import.meta.url,
    ),
  },
  "branching-undo-history": {
    mutantCount: 5,
    target: "src/branching-undo-history.mjs",
    reference: new URL(
      "./fixtures/performance-v7-references/branching-undo-history.mjs",
      import.meta.url,
    ),
  },
  "forward-header-sanitization": {
    mutantCount: 11,
    target: "src/forward-header-sanitization.mjs",
    reference: new URL(
      "./fixtures/performance-v7-references/forward-header-sanitization.mjs",
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

test("performance v7 suite is an exact quality-first frozen contract", async () => {
  const suite = await loadDevelopmentSuite(suitePath);
  assert.equal(suite.suite_sha256, frozen.suite);
  assert.equal(suite.suite_id, "development-effects-performance-confirmatory-v7-2026-07-16");
  assert.equal(suite.evidence_level, "paired-development-heldout");
  assert.equal(suite.freeze_contract_verified, true);
  assert.equal(suite.freeze_contract.status, "frozen-before-live-run");
  assert.equal(suite.report_contract, "categorized-exact-render-v1");
  assert.equal(suite.quality_policy, "lean-all-pass-reference-diagnostic-v1");
  assert.equal(suite.freeze_contract.quality_policy, suite.quality_policy);
  assert.equal(suite.freeze_contract.agent_read_isolation, HELDOUT_AGENT_READ_ISOLATION);
  assert.equal(
    suite.freeze_contract.superpowers_revision,
    "d884ae04edebef577e82ff7c4e143debd0bbec99",
  );
  assert.equal(suite.freeze_contract.leanpowers_revision, frozen.leanpowersRevision);
  assert.equal(suite.freeze_contract.evaluator_revision, frozen.evaluatorRevision);
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
      "stable-unique-tokens",
      "queued-task-permit-release",
      "record-data-delta",
      "branching-undo-history",
      "forward-header-sanitization",
    ],
    [
      "forward-header-sanitization",
      "branching-undo-history",
      "record-data-delta",
      "queued-task-permit-release",
      "stable-unique-tokens",
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
      ["stable-unique-tokens", "lean", "build", "stable token dedup build", "stable-first-occurrence-token-deduplication"],
      ["queued-task-permit-release", "standard", "debug", "task limiter debug", "bounded-concurrency-permit-accounting"],
      ["record-data-delta", "standard", "build", "record delta build", "exact-record-delta-classification"],
      ["branching-undo-history", "standard", "debug", "undo history debug", "undo-redo-branch-invalidation"],
      ["forward-header-sanitization", "strict", "build", "hop-by-hop header strict build", "http-hop-by-hop-header-sanitization"],
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
  assert.equal(totalMutants, 35);
});

test("performance v7 cases are new by id, task, semantic family, and snapshots", async () => {
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

test("performance v7 pristine fixtures pass visible checks and fail hidden acceptance", async () => {
  const suite = await loadDevelopmentSuite(suitePath);
  const root = await mkdtemp(path.join(os.tmpdir(), "lp-performance-v7-pristine-"));
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

test("performance v7 references pass acceptance and ideal deltas kill every mutant", async () => {
  const suite = await loadDevelopmentSuite(suitePath);
  const root = await mkdtemp(path.join(os.tmpdir(), "lp-performance-v7-reference-"));
  try {
    for (const benchmarkCase of suite.cases) {
      const workspace = path.join(root, benchmarkCase.id);
      const fixture = fixtures[benchmarkCase.id];
      await materializeWorkspaceSnapshot(benchmarkCase.workspace_snapshot, workspace);
      const baselineHead = initializeGit(workspace);
      await writeFile(path.join(workspace, fixture.target), await readFile(fixture.reference, "utf8"));
      const regressionPath = "test/performance-v7-regressions.test.mjs";
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

test("performance v7 freeze is private-data-safe and preserves prior publications", async () => {
  const [source, preregistration, ...historicalPublications] = await Promise.all([
    readFile(suitePath, "utf8"),
    readFile(preregistrationPath, "utf8"),
    ...historicalPublicationPaths.map(({ url }) => readFile(url, "utf8")),
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
  assert.match(preregistration, /Superpowers.*upstream reference and principal engineering inspiration/iu);
  assert.match(preregistration, /v6 remains a frozen \*\*FAIL\*\*: Superpowers Task PASS `4\/10`, LeanPowers Task PASS `4\/10`, LeanPowers conformance `1\/10`/u);
  assert.match(preregistration, /aggregate Lean Token share `75\.15184646891723%`/u);
  assert.match(preregistration, /four both-pass pairs had Lean Token share `92\.9869680816793%`/u);
  assert.match(preregistration, /LeanPowers passes all `10\/10` task runs/u);
  assert.match(preregistration, /Superpowers task outcomes remain reported reference diagnostics/u);
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

  historicalPublications.forEach((publication, index) => {
    assert.equal(
      createHash("sha256").update(publication).digest("hex"),
      historicalPublicationPaths[index].sha256,
    );
  });

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
