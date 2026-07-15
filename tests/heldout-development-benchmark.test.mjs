import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  cp,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  HELDOUT_AGENT_READ_ISOLATION,
  HELDOUT_PERMISSION_PROFILE,
  assertFrozenHeldoutRevisions,
  assertFrozenHeldoutSelection,
  buildCodexArgs,
  caseSnapshotContract,
  fingerprintBenchmarkWorkspace,
  loadDevelopmentSuite,
  makePilotResult,
  materializeWorkspaceSnapshot,
  renderDevelopmentReport,
  renderHeldoutCodexProfile,
  runArtifactRegressionGates,
  runVerifier,
  summarizeArtifactRegressionEvidence,
} from "../scripts/lib/development-benchmark.mjs";

const suitePath = new URL(
  "../evals/development-effects/heldout-suite.json",
  import.meta.url,
);
const preregistrationPath = new URL(
  "../docs/benchmarks/development-effects-heldout-preregistration-2026-07-14.md",
  import.meta.url,
);

const frozenInputs = {
  mutantsCombined:
    "d1af3fa78bd8d9182fece0749bdd0903d7cae650975d9205684be04e65422fb4",
  suite: "c71222bd29e0035b6fbf91a3239b2def89d54c479a367dfa370e7474091bd82f",
  verifierCombined:
    "3037cabd474d64fe7472ca7c0f1be1ddfaaccbee463e086f5c3e2ea1cca24cf2",
  verifierFile:
    "704125745c7e58f3bec78830e3396e5b16b76c0e609c890a1ed6ed295e162c24",
  workspace: "22f835d2a6b569ad8091c1690d9a5fe9ed388995d270852c58273ff933b24c8e",
  faultFamilies: {
    "fulfilled-reuse":
      "626fb6afd4b57048433e6f0b210e001640eb4d90f012516d7f0480e28e2b89aa",
    "rejection-lifecycle":
      "91bf6ba056e8be56d3371c6dc2abefc0fe321e2bceca061af6ca4dd8915767dd",
    "same-id-single-flight":
      "b7c9b27ee92e5da77ec7f7679432e2210a280ae3ae5da20e3bfe9d716f338fd9",
  },
};

const referenceSource = [
  "export function createProfileLoader(fetchProfile) {",
  "  const loads = new Map();",
  "",
  "  return function loadProfile(id) {",
  "    if (!loads.has(id)) {",
  "      const load = Promise.resolve().then(() => fetchProfile(id));",
  "      loads.set(id, load);",
  "      load.then(",
  "        () => undefined,",
  "        () => {",
  "          if (loads.get(id) === load) {",
  "            loads.delete(id);",
  "          }",
  "        },",
  "      );",
  "    }",
  "    return loads.get(id);",
  "  };",
  "}",
  "",
].join("\n");

const retryRegression = [
  'test("retries a profile after its rejected request settles", async () => {',
  '  const expected = new Error("temporary outage");',
  "  let calls = 0;",
  "  const loadProfile = createProfileLoader(async (id) => {",
  "    calls += 1;",
  "    if (calls === 1) throw expected;",
  "    return { id, attempt: calls };",
  "  });",
  '  await assert.rejects(loadProfile("profile-7"), (error) => error === expected);',
  '  assert.deepEqual(await loadProfile("profile-7"), { id: "profile-7", attempt: 2 });',
  "  assert.equal(calls, 2);",
  "});",
].join("\n");

const crossIdRegression = [
  'test("a rejected profile does not evict another profile", async () => {',
  "  const calls = [];",
  '  const stable = { id: "stable", name: "Grace" };',
  "  const loadProfile = createProfileLoader(async (id) => {",
  "    calls.push(id);",
  '    if (id === "flaky") throw new Error("temporary outage");',
  "    return stable;",
  "  });",
  '  assert.equal(await loadProfile("stable"), stable);',
  '  await assert.rejects(loadProfile("flaky"), /temporary outage/u);',
  '  assert.equal(await loadProfile("stable"), stable);',
  '  assert.deepEqual(calls, ["stable", "flaky"]);',
  "});",
].join("\n");

const overlappingRegression = [
  'test("coalesces overlapping requests for one profile", async () => {',
  "  const pending = deferred();",
  "  const calls = [];",
  "  const loadProfile = createProfileLoader((id) => {",
  "    calls.push(id);",
  "    return pending.promise;",
  "  });",
  '  const first = loadProfile("profile-7");',
  '  const second = loadProfile("profile-7");',
  "  await Promise.resolve();",
  '  assert.deepEqual(calls, ["profile-7"]);',
  '  const profile = { id: "profile-7", name: "Ada" };',
  "  pending.resolve(profile);",
  "  assert.deepEqual(await Promise.all([first, second]), [profile, profile]);",
  '  assert.deepEqual(calls, ["profile-7"]);',
  "});",
].join("\n");

const fulfilledReuseRegression = [
  'test("reuses a fulfilled profile on a later request", async () => {',
  "  let calls = 0;",
  '  const profile = { id: "profile-7", name: "Ada" };',
  "  const loadProfile = createProfileLoader(async () => {",
  "    calls += 1;",
  "    return profile;",
  "  });",
  '  assert.equal(await loadProfile("profile-7"), profile);',
  '  assert.equal(await loadProfile("profile-7"), profile);',
  "  assert.equal(calls, 1);",
  "});",
].join("\n");

function candidateTestSource(regressions) {
  return [
    'import assert from "node:assert/strict";',
    'import test from "node:test";',
    'import { createProfileLoader } from "../src/profile-loader.mjs";',
    "",
    "function deferred() {",
    "  let resolve;",
    "  const promise = new Promise((resolvePromise) => {",
    "    resolve = resolvePromise;",
    "  });",
    "  return { promise, resolve };",
    "}",
    "",
    ...regressions.flatMap((regression) => [regression, ""]),
  ].join("\n");
}

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

async function loadHeldoutCase() {
  const suite = await loadDevelopmentSuite(suitePath);
  assert.equal(suite.cases.length, 1);
  return { benchmarkCase: suite.cases[0], suite };
}

async function prepareCandidate(workspace, benchmarkCase, regressions) {
  await materializeWorkspaceSnapshot(
    benchmarkCase.workspace_snapshot,
    workspace,
  );
  const baselineHead = initializeFixtureGit(workspace);
  await writeFile(
    path.join(workspace, "src", "profile-loader.mjs"),
    referenceSource,
  );
  await writeFile(
    path.join(workspace, "test", "heldout-regressions.test.mjs"),
    candidateTestSource(regressions),
  );
  return baselineHead;
}

async function runGateScenario({ benchmarkCase, gates, regressions, root, name }) {
  const workspace = path.join(root, name);
  const baselineHead = await prepareCandidate(
    workspace,
    benchmarkCase,
    regressions,
  );
  return runArtifactRegressionGates({
    baselineHead,
    changedPaths: [
      "src/profile-loader.mjs",
      "test/heldout-regressions.test.mjs",
    ],
    gates,
    testGlobs: benchmarkCase.change_policy.tests,
    workspace,
  });
}

test("held-out suite loads, hydrates, and pins every evaluation input", async () => {
  const { benchmarkCase, suite } = await loadHeldoutCase();

  assert.equal(suite.suite_id, "development-effects-heldout-2026-07-14");
  assert.equal(suite.evidence_level, "paired-development-heldout");
  assert.equal(suite.freeze_contract_verified, true);
  assert.equal(
    suite.freeze_contract.agent_read_isolation,
    HELDOUT_AGENT_READ_ISOLATION,
  );
  assert.equal(suite.suite_sha256, frozenInputs.suite);
  assert.equal(suite.repetitions, 2);
  assert.deepEqual(suite.workflow_order, [
    ["superpowers-6.1.1", "leanpowers-0.2.0"],
    ["leanpowers-0.2.0", "superpowers-6.1.1"],
  ]);
  assert.deepEqual(
    [
      benchmarkCase.id,
      benchmarkCase.scenario_class,
      benchmarkCase.risk_level,
      benchmarkCase.expected_workflow,
    ],
    [
      "transient-profile-load",
      "unknown-cause-defect",
      "standard",
      "debug",
    ],
  );
  assert.equal(benchmarkCase.workspace_snapshot.sha256, frozenInputs.workspace);
  assert.deepEqual(caseSnapshotContract(benchmarkCase), {
    mutants_sha256: frozenInputs.mutantsCombined,
    verifier_sha256: frozenInputs.verifierCombined,
    workspace_sha256: frozenInputs.workspace,
  });
  assert.deepEqual(
    benchmarkCase.verifier_snapshots.map(({ sha256 }) => sha256),
    [frozenInputs.verifierFile],
  );
  assert.deepEqual(
    Object.fromEntries(benchmarkCase.artifact_regression_gates.map((gate) => [
      gate.id,
      gate.mutation_manifest_sha256,
    ])),
    frozenInputs.faultFamilies,
  );
  assert.deepEqual(
    benchmarkCase.artifact_regression_gates.map(({ id, policy, mutations }) => [
      id,
      policy,
      mutations.length,
    ]),
    [
      ["rejection-lifecycle", "all-kill", 2],
      ["same-id-single-flight", "all-kill", 1],
      ["fulfilled-reuse", "all-kill", 1],
    ],
  );
  for (const gate of benchmarkCase.artifact_regression_gates) {
    assert.equal(gate.target, "src/profile-loader.mjs");
    assert.equal(gate.export_name, "createProfileLoader");
    assert.ok(gate.mutations.every(({ replacement, replacement_sha256 }) =>
      replacement.startsWith("export function createProfileLoader(") &&
      /^[a-f0-9]{64}$/u.test(replacement_sha256)
    ));
  }
});

test("held-out loading fails closed when a frozen input contract drifts", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "lp-heldout-freeze-drift-"));
  try {
    const copiedRoot = path.join(root, "development-effects");
    await cp(
      new URL("../evals/development-effects/", import.meta.url),
      copiedRoot,
      { recursive: true },
    );
    const copiedSuitePath = path.join(copiedRoot, "heldout-suite.json");
    const rawSuite = JSON.parse(await readFile(copiedSuitePath, "utf8"));
    rawSuite.freeze_contract.case_snapshots["transient-profile-load"]
      .workspace_sha256 = "0".repeat(64);
    await writeFile(copiedSuitePath, `${JSON.stringify(rawSuite, null, 2)}\n`);

    await assert.rejects(
      loadDevelopmentSuite(copiedSuitePath),
      /exact frozen model, matrix, read-isolation policy, baseline revision, and case snapshot contract/u,
    );
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("held-out Codex execution uses a strict minimal-read permissions profile", () => {
  const profile = renderHeldoutCodexProfile({
    authFile: "/tmp/isolated-codex-home/auth.json",
    pluginRoot: "/tmp/isolated-codex-home/plugins",
    runtimeReadRoots: ["/opt/toolchain/runtime"],
  });
  assert.match(profile, /^default_permissions = "benchmark"/u);
  assert.match(profile, /":minimal" = "read"/u);
  assert.match(profile, /":workspace_roots" = "write"/u);
  assert.match(profile, /":tmpdir" = "write"/u);
  assert.match(profile, /"\/tmp\/isolated-codex-home\/plugins" = "read"/u);
  assert.match(profile, /"\/opt\/toolchain\/runtime" = "read"/u);
  assert.match(profile, /"\/tmp\/isolated-codex-home\/auth\.json" = "none"/u);
  assert.match(profile, /\[permissions\.benchmark\.network\]\nenabled = false/u);
  assert.doesNotMatch(profile, /":root"|workspace-write/u);
  assert.throws(
    () => renderHeldoutCodexProfile({
      authFile: "/tmp/isolated-codex-home/auth.json",
      pluginRoot: "/tmp/isolated-codex-home/plugins",
      runtimeReadRoots: [path.parse("/tmp").root],
    }),
    /read root is too broad/u,
  );
  assert.throws(
    () => renderHeldoutCodexProfile({ pluginRoot: "/tmp/plugins" }),
    /permission paths must be absolute/u,
  );

  const args = buildCodexArgs({
    effort: "low",
    model: "gpt-5.3-codex-spark",
    permissionProfile: HELDOUT_PERMISSION_PROFILE,
    prompt: "Implement the task in this repository.",
    workspace: "/tmp/disposable-workspace",
  });
  assert.ok(args.includes("--strict-config"));
  assert.deepEqual(
    args.slice(args.indexOf("--profile"), args.indexOf("--profile") + 2),
    ["--profile", HELDOUT_PERMISSION_PROFILE],
  );
  assert.equal(args.includes("--sandbox"), false);
  assert.equal(args.includes("workspace-write"), false);
});

test("held-out execution rejects every frozen-condition override", async () => {
  const { suite } = await loadHeldoutCase();
  assert.doesNotThrow(() => assertFrozenHeldoutSelection(suite));
  assert.doesNotThrow(() => assertFrozenHeldoutSelection(suite, {
    caseIds: ["transient-profile-load"],
    model: "gpt-5.3-codex-spark",
    repetitions: 2,
  }));
  assert.throws(
    () => assertFrozenHeldoutSelection(suite, { repetitions: 1 }),
    /every frozen repetition/u,
  );
  assert.throws(
    () => assertFrozenHeldoutSelection(suite, { model: "another-model" }),
    /frozen default model/u,
  );
  for (const caseIds of [
    ["another-case"],
    ["transient-profile-load", "transient-profile-load"],
  ]) {
    assert.throws(
      () => assertFrozenHeldoutSelection(suite, { caseIds }),
      /every frozen case exactly once/u,
    );
  }

  const candidateRevision = "a".repeat(40);
  const revisions = {
    evaluatorRevision: candidateRevision,
    workflowRevisions: {
      "leanpowers-0.2.0": candidateRevision,
      "superpowers-6.1.1": suite.freeze_contract.superpowers_revision,
    },
  };
  assert.doesNotThrow(() => assertFrozenHeldoutRevisions(suite, revisions));
  for (const invalid of [
    { ...revisions, evaluatorRevision: "b".repeat(40) },
    {
      ...revisions,
      workflowRevisions: {
        ...revisions.workflowRevisions,
        "superpowers-6.1.1": "b".repeat(40),
      },
    },
  ]) {
    assert.throws(
      () => assertFrozenHeldoutRevisions(suite, invalid),
      /did not match the freeze contract/u,
    );
  }
});

test("the checked-in preregistration matches every frozen manifest", async () => {
  const preregistration = await readFile(preregistrationPath, "utf8");
  for (const digest of [
    frozenInputs.suite,
    frozenInputs.workspace,
    frozenInputs.verifierCombined,
    frozenInputs.mutantsCombined,
    ...Object.values(frozenInputs.faultFamilies),
  ]) {
    assert.equal(preregistration.includes(digest), true, digest);
  }
  assert.match(preregistration, /frozen before the first live model run/u);
  assert.match(preregistration, /hidden verifier remain unreadable/u);
  assert.match(preregistration, /at most 60% in \*\*every\*\* pair/u);
  assert.match(preregistration, /case is invalidated/u);
});

test("held-out reports identify confirmatory evidence and the actual case scope", async () => {
  const { benchmarkCase, suite } = await loadHeldoutCase();
  const candidateRevision = "a".repeat(40);
  const runtime = {
    agent_read_isolation: HELDOUT_AGENT_READ_ISOLATION,
    agent_read_isolation_preflight: "PASS",
    codex_version: "codex-test",
    effort: suite.effort,
    evaluator_revision: candidateRevision,
    freeze_contract_verified: true,
    model: suite.model_default,
    permission_profile: HELDOUT_PERMISSION_PROFILE,
    sandbox: "permissions-profile",
    workflow_revisions: {
      "leanpowers-0.2.0": candidateRevision,
      "superpowers-6.1.1": suite.freeze_contract.superpowers_revision,
    },
  };
  const incomplete = makePilotResult(
    suite,
    runtime,
    [],
    suite.repetitions,
    suite.cases,
  );
  const incompleteReport = renderDevelopmentReport(incomplete);
  assert.equal(incomplete.frozen_run_contract_verified, true);
  assert.equal(incomplete.confirmatory_eligible, false);
  assert.match(
    incompleteReport,
    /^# Incomplete held-out development-effects diagnostic/mu,
  );
  assert.match(incompleteReport, /diagnostic only/u);
  assert.match(incompleteReport, /Confirmatory eligibility: \*\*no\*\*/u);

  const caseSnapshot = caseSnapshotContract(benchmarkCase);
  const runs = suite.workflow_order.flatMap((order, repetition) =>
    order.map((workflow) => ({
      activation_reported: true,
      case_id: benchmarkCase.id,
      case_snapshot: caseSnapshot,
      changes: { product: ["src/profile-loader.mjs"], violations: [], workflow: [] },
      outcome: { reasons: [], status: "PASS" },
      repetition: repetition + 1,
      risk_level: benchmarkCase.risk_level,
      run_id: `r${repetition + 1}-${workflow}`,
      telemetry: {
        tool_calls: workflow.startsWith("leanpowers-") ? 5 : 10,
        tokens: {
          total: workflow.startsWith("leanpowers-") ? 100 : 200,
          uncached_plus_output: workflow.startsWith("leanpowers-") ? 50 : 80,
        },
        workflow_trace: { read_calls: 1 },
      },
      verifier: { artifact_regression: { status: "PASS" } },
      wall_seconds: workflow.startsWith("leanpowers-") ? 5 : 8,
      workflow,
      workflow_conformance: { reasons: [], status: "PASS" },
    }))
  );
  const result = makePilotResult(
    suite,
    runtime,
    runs,
    suite.repetitions,
    suite.cases,
  );
  const report = renderDevelopmentReport(result);

  assert.equal(result.completion, "complete");
  assert.equal(result.frozen_run_contract_verified, true);
  assert.equal(result.confirmatory_eligible, true);
  assert.match(report, /^# Frozen held-out development-effects comparison/mu);
  assert.match(report, /Evidence level: \*\*paired-development-heldout\*\*/u);
  assert.match(report, /Frozen run contract: \*\*verified\*\*/u);
  assert.match(report, /Confirmatory eligibility: \*\*yes\*\*/u);
  assert.match(
    report,
    /Agent read isolation: codex-minimal-workspace-plugin-toolchain-read-v1; permission profile: benchmark; preflight: PASS/u,
  );
  assert.match(report, /scoped to the one reported fixture/u);
  assert.match(report, /scenario classes: unknown-cause-defect/u);
  assert.match(report, /transient-profile-load verifier exercises/u);
  assert.doesNotMatch(report, /three pilot fixtures|The three cases|localized-cache hidden/u);

  const shortened = makePilotResult(
    suite,
    runtime,
    runs.filter(({ repetition }) => repetition === 1),
    1,
    suite.cases,
  );
  assert.equal(shortened.completion, "incomplete");
  assert.equal(shortened.frozen_run_contract_verified, false);
  assert.equal(shortened.confirmatory_eligible, false);
  assert.match(
    renderDevelopmentReport(shortened),
    /^# Incomplete held-out development-effects diagnostic/mu,
  );

  const unisolated = makePilotResult(
    suite,
    { ...runtime, agent_read_isolation_preflight: null },
    runs,
    suite.repetitions,
    suite.cases,
  );
  assert.equal(unisolated.frozen_run_contract_verified, false);
  assert.equal(unisolated.confirmatory_eligible, false);
});

test("held-out inputs use only repository-relative paths and contain no local path leakage", async () => {
  const { benchmarkCase } = await loadHeldoutCase();
  const rawSuite = await readFile(suitePath, "utf8");
  const declaredPaths = [
    benchmarkCase.workspace,
    ...benchmarkCase.verifier_files,
    ...benchmarkCase.artifact_regression_gates.flatMap(({ mutations }) =>
      mutations.flatMap(({ source, target }) => [source, target])
    ),
  ];
  for (const declaredPath of declaredPaths) {
    assert.equal(path.posix.isAbsolute(declaredPath), false, declaredPath);
    assert.equal(declaredPath.includes(".."), false, declaredPath);
    assert.equal(declaredPath.includes("\\"), false, declaredPath);
  }

  const sources = [
    ["suite", rawSuite],
    ...benchmarkCase.workspace_snapshot.entries
      .filter(({ kind }) => kind === "file")
      .map(({ contents_base64, path: entryPath }) => [
        `workspace:${entryPath}`,
        Buffer.from(contents_base64, "base64").toString("utf8"),
      ]),
    ...benchmarkCase.verifier_snapshots.map(({ source }, index) => [
      `verifier:${index}`,
      source,
    ]),
    ...benchmarkCase.artifact_regression_gates.flatMap(({ mutations }) =>
      mutations.map(({ replacement, source }) => [`mutation:${source}`, replacement])
    ),
  ];
  const localPathPattern = /(?:file:\/\/|\/Users\/|\/home\/[^/\s]+\/|\/private\/(?:tmp|var)\/|[A-Za-z]:\\Users\\)/u;
  for (const [label, source] of sources) {
    assert.doesNotMatch(source, localPathPattern, label);
    assert.equal(source.includes(os.homedir()), false, label);
  }
});

test("pristine held-out fixture passes visible tests, reproduces the defect, and fails hidden acceptance", async () => {
  const { benchmarkCase } = await loadHeldoutCase();
  const root = await mkdtemp(path.join(os.tmpdir(), "lp-heldout-pristine-"));
  try {
    const workspace = path.join(root, "workspace");
    await materializeWorkspaceSnapshot(
      benchmarkCase.workspace_snapshot,
      workspace,
    );
    const reproduction = JSON.parse(execFileSync(
      process.execPath,
      ["repro/transient-profile-load.mjs"],
      { cwd: workspace, encoding: "utf8" },
    ));
    assert.deepEqual(
      reproduction,
      benchmarkCase.reproduction_contract.expected_output,
    );

    const result = await runVerifier({
      workspace,
      verifierSnapshots: benchmarkCase.verifier_snapshots,
    });
    assert.equal(result.visible.exit_code, 0, result.visible.output);
    assert.notEqual(result.hidden.exit_code, 0, result.hidden.output);
    assert.match(result.hidden.output, /fail/u);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("reference solution passes both visible and hidden held-out acceptance", async () => {
  const { benchmarkCase } = await loadHeldoutCase();
  const root = await mkdtemp(path.join(os.tmpdir(), "lp-heldout-reference-"));
  try {
    const workspace = path.join(root, "workspace");
    await materializeWorkspaceSnapshot(
      benchmarkCase.workspace_snapshot,
      workspace,
    );
    await writeFile(
      path.join(workspace, "src", "profile-loader.mjs"),
      referenceSource,
    );
    const result = await runVerifier({
      workspace,
      verifierSnapshots: benchmarkCase.verifier_snapshots,
    });
    assert.equal(result.visible.exit_code, 0, result.visible.output);
    assert.equal(result.hidden.exit_code, 0, result.hidden.output);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("held-out candidate regressions survive at baseline and kill every registered mutant", async () => {
  const { benchmarkCase } = await loadHeldoutCase();
  const root = await mkdtemp(path.join(os.tmpdir(), "lp-heldout-artifacts-"));
  try {
    const workspace = path.join(root, "workspace");
    const baselineHead = await prepareCandidate(
      workspace,
      benchmarkCase,
      [
        retryRegression,
        crossIdRegression,
        overlappingRegression,
        fulfilledReuseRegression,
      ],
    );
    const normal = await runVerifier({
      workspace,
      verifierSnapshots: benchmarkCase.verifier_snapshots,
    });
    assert.equal(normal.visible.exit_code, 0, normal.visible.output);
    assert.equal(normal.hidden.exit_code, 0, normal.hidden.output);
    const fingerprintBefore = await fingerprintBenchmarkWorkspace({
      baselineHead,
      workspace,
    });

    const result = await runArtifactRegressionGates({
      baselineHead,
      changedPaths: [
        "src/profile-loader.mjs",
        "test/heldout-regressions.test.mjs",
      ],
      gates: benchmarkCase.artifact_regression_gates,
      testGlobs: benchmarkCase.change_policy.tests,
      workspace,
    });
    assert.equal(result.status, "PASS", JSON.stringify(result));
    assert.deepEqual(result.required_gate_ids, [
      "rejection-lifecycle",
      "same-id-single-flight",
      "fulfilled-reuse",
    ]);
    for (const gate of result.gates) {
      assert.equal(gate.status, "PASS", gate.id);
      assert.deepEqual(gate.changed_visible_test_paths, [
        "test/heldout-regressions.test.mjs",
      ]);
      assert.ok(gate.members.every((member) =>
        member.baseline_tests_mutant_visible.exit_code === 0 &&
        member.candidate_tests_mutant_visible.exit_code !== 0 &&
        member.killed === true
      ));
    }
    assert.equal(
      await fingerprintBenchmarkWorkspace({ baselineHead, workspace }),
      fingerprintBefore,
    );
    const publicEvidence = JSON.stringify(
      summarizeArtifactRegressionEvidence(result),
    );
    assert.doesNotMatch(publicEvidence, /(?:file:\/\/|\/Users\/|\/private\/)/u);
    assert.equal(publicEvidence.includes(workspace), false);
    assert.equal(publicEvidence.includes(os.homedir()), false);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("held-out negative controls distinguish every semantic fault family", async () => {
  const { benchmarkCase } = await loadHeldoutCase();
  const byId = Object.fromEntries(
    benchmarkCase.artifact_regression_gates.map((gate) => [gate.id, gate]),
  );
  const root = await mkdtemp(path.join(os.tmpdir(), "lp-heldout-controls-"));
  try {
    const retryOnly = await runGateScenario({
      benchmarkCase,
      gates: [byId["rejection-lifecycle"]],
      regressions: [retryRegression],
      root,
      name: "retry-only",
    });
    assert.equal(retryOnly.status, "FAIL");
    assert.deepEqual(
      retryOnly.gates[0].members.map(({ killed }) => killed),
      [true, false],
    );

    const crossIdOnly = await runGateScenario({
      benchmarkCase,
      gates: [byId["rejection-lifecycle"]],
      regressions: [crossIdRegression],
      root,
      name: "cross-id-only",
    });
    assert.equal(crossIdOnly.status, "FAIL");
    assert.deepEqual(
      crossIdOnly.gates[0].members.map(({ killed }) => killed),
      [false, true],
    );

    const overlapOnly = await runGateScenario({
      benchmarkCase,
      gates: [byId["same-id-single-flight"], byId["fulfilled-reuse"]],
      regressions: [overlappingRegression],
      root,
      name: "overlap-only",
    });
    assert.equal(overlapOnly.status, "FAIL");
    assert.deepEqual(
      overlapOnly.gates.map(({ status }) => status),
      ["PASS", "FAIL"],
    );
    assert.deepEqual(
      overlapOnly.gates.map(({ members }) => members[0].killed),
      [true, false],
    );

    const fulfilledOnly = await runGateScenario({
      benchmarkCase,
      gates: [byId["same-id-single-flight"], byId["fulfilled-reuse"]],
      regressions: [fulfilledReuseRegression],
      root,
      name: "fulfilled-only",
    });
    assert.equal(fulfilledOnly.status, "FAIL");
    assert.deepEqual(
      fulfilledOnly.gates.map(({ status }) => status),
      ["FAIL", "PASS"],
    );
    assert.deepEqual(
      fulfilledOnly.gates.map(({ members }) => members[0].killed),
      [false, true],
    );
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});
