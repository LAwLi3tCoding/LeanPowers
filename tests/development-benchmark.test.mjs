import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  approvedLinuxRuntimeRoot,
  benchmarkEnvironment,
  buildClaudeArgs,
  buildCodexArgs,
  caseSnapshotContract,
  createReviewerWorkspaceMutationTracker,
  evaluateChangedPaths,
  evaluateRunOutcome,
  evaluateWorkflowConformance,
  extractDeclaredRisk,
  fingerprintBenchmarkWorkspace,
  inspectBenchmarkGitState,
  loadDevelopmentSuite,
  makePilotResult,
  materializeWorkspaceSnapshot,
  parseClaudeResult,
  parseCodexResult,
  parseLeanRouteLedger,
  resolveDevelopmentOutputDirectory,
  reportsWorkflowActivation,
  renderDevelopmentReport,
  runArtifactRegressionGates,
  runProcess,
  runVerifier,
  summarizeArtifactRegressionEvidence,
  tracksReviewerWorkspaceMutations,
} from "../scripts/lib/development-benchmark.mjs";

const suitePath = new URL(
  "../evals/development-effects/pilot-suite.json",
  import.meta.url,
);
const capsuleChangePolicy = {
  product: ["src/**", "test/**"],
  tests: ["test/**"],
  workflow: [],
};
const capsuleReproductionContract = {
  command: "node repro/localized-template-cache.mjs",
  expected_output: {
    scenario: "localized-template-cache",
    requests: [
      {
        name: "welcome",
        locale: "EN",
        normalized_locale: "en",
        cache_key: "welcome",
        resolved: "welcome:en",
      },
      {
        name: "welcome",
        locale: "fr",
        normalized_locale: "fr",
        cache_key: "welcome",
        resolved: "welcome:en",
      },
    ],
    loader_calls: [["welcome", "en"]],
    first_incorrect_transition: {
      stage: "templateCacheKey",
      distinct_normalized_locales_share_key: true,
    },
  },
};
const cacheArtifactGateSchemas = [
  {
    id: "component-inclusion",
    policy: "all-kill",
    mutations: [
      {
        kind: "replace-callable-export",
        export_name: "templateCacheKey",
        target: "src/cache-key.mjs",
        source:
          "cases/localized-template-cache/verifier/mutants/cache-key.component-omission.mjs",
      },
      {
        kind: "replace-callable-export",
        export_name: "templateCacheKey",
        target: "src/cache-key.mjs",
        source:
          "cases/localized-template-cache/verifier/mutants/cache-key.name-omission.mjs",
      },
    ],
  },
  {
    id: "collision-free-composition",
    policy: "all-kill",
    mutations: [{
      kind: "replace-callable-export",
      export_name: "templateCacheKey",
      target: "src/cache-key.mjs",
      source:
        "cases/localized-template-cache/verifier/mutants/cache-key.boundary-erasure.mjs",
    }],
  },
];
const cacheFixtureRoot = fileURLToPath(new URL(
  "../evals/development-effects/cases/localized-template-cache/workspace/",
  import.meta.url,
));
const capsuleReproductionOutput = execFileSync(
  process.execPath,
  ["repro/localized-template-cache.mjs"],
  { cwd: cacheFixtureRoot, encoding: "utf8" },
).trim();
const capsuleReviewContract = "Implement the benchmark fixture change. Preserve current behavior.";

assert.deepEqual(
  JSON.parse(capsuleReproductionOutput),
  capsuleReproductionContract.expected_output,
);

async function hydratedCacheArtifactGates() {
  const suite = await loadDevelopmentSuite(suitePath);
  return suite.cases.find(
    ({ id }) => id === "localized-template-cache",
  ).artifact_regression_gates;
}

function testFingerprintSha256(entries) {
  const hash = createHash("sha256");
  const update = (label, contents) => {
    const labelBytes = Buffer.from(label);
    const contentBytes = Buffer.from(contents);
    hash.update(`${labelBytes.length}:`);
    hash.update(labelBytes);
    hash.update(`${contentBytes.length}:`);
    hash.update(contentBytes);
  };
  for (const [label, contents] of entries) update(label, contents);
  return hash.digest("hex");
}

function testArtifactFamilyManifestSha256({
  id,
  policy,
  target,
  exportName,
  digests,
}) {
  const entries = [];
  const update = (label, contents) => entries.push([label, contents]);
  update(`fault-family:${id}:policy`, policy);
  update(`fault-family:${id}:target`, target);
  update(`fault-family:${id}:export`, exportName);
  for (const [index, digest] of digests.entries()) {
    update(`fault-family:${id}:member:${index + 1}`, digest);
  }
  return testFingerprintSha256(entries);
}

function testArtifactGateContractManifestSha256(contracts) {
  return testFingerprintSha256(contracts.map((contract, index) => [
    `fault-family:${index + 1}:${contract.id}:${contract.policy}:${contract.target}:${contract.export_name}:${contract.member_count}`,
    contract.mutation_manifest_sha256,
  ]));
}

const collisionRegressionBlock = [
  'test("keeps locale components in cache identity", async () => {',
  "  const calls = [];",
  "  const resolve = createTemplateResolver(async (name, locale) => {",
  "    calls.push([name, locale]);",
  "    return JSON.stringify([name, locale]);",
  "  });",
  '  assert.equal(await resolve("welcome", "en"), JSON.stringify(["welcome", "en"]));',
  '  assert.equal(await resolve("welcome", "fr"), JSON.stringify(["welcome", "fr"]));',
  '  assert.equal(await resolve("receipt", "en"), JSON.stringify(["receipt", "en"]));',
  '  assert.deepEqual(calls, [["welcome", "en"], ["welcome", "fr"], ["receipt", "en"]]);',
  "});",
  "",
  'test("keeps delimiter-colliding tuples isolated", async () => {',
  "  const calls = [];",
  "  const resolve = createTemplateResolver(async (name, locale) => {",
  "    calls.push([name, locale]);",
  "    return JSON.stringify([name, locale]);",
  "  });",
  '  const first = ["a:", "b"];',
  '  const second = ["a", ":b"];',
  "  assert.notDeepEqual(first, second);",
  '  assert.equal(first.join(""), second.join(""));',
  "  assert.equal(await resolve(...first), JSON.stringify(first));",
  "  assert.equal(await resolve(...second), JSON.stringify(second));",
  "  assert.deepEqual(calls, [first, second]);",
  "});",
  "",
].join("\n");

const componentOnlyRegressionBlock = [
  'test("keeps locale components in cache identity", async () => {',
  "  const calls = [];",
  "  const resolve = createTemplateResolver(async (name, locale) => {",
  "    calls.push([name, locale]);",
  "    return JSON.stringify([name, locale]);",
  "  });",
  '  await resolve("welcome", "en");',
  '  await resolve("welcome", "fr");',
  '  await resolve("receipt", "en");',
  '  assert.deepEqual(calls, [["welcome", "en"], ["welcome", "fr"], ["receipt", "en"]]);',
  "});",
  "",
].join("\n");

function collisionRegressionBlockFor(separator) {
  return collisionRegressionBlock
    .replaceAll('"a:"', JSON.stringify(`a${separator}`))
    .replaceAll('":b"', JSON.stringify(`${separator}b`));
}

const nonBoundaryAnagramRegressionBlock = [
  'test("keeps name anagrams isolated", async () => {',
  "  const calls = [];",
  "  const resolve = createTemplateResolver(async (name, locale) => {",
  "    calls.push([name, locale]);",
  "    return JSON.stringify([name, locale]);",
  "  });",
  '  const first = ["abc", "en"];',
  '  const second = ["acb", "en"];',
  "  assert.equal(await resolve(...first), JSON.stringify(first));",
  "  assert.equal(await resolve(...second), JSON.stringify(second));",
  "  assert.deepEqual(calls, [first, second]);",
  "});",
  "",
].join("\n");

const delimiterOnlyRegressionBlock = [
  'test("keeps delimiter-colliding tuples isolated", async () => {',
  "  const calls = [];",
  "  const resolve = createTemplateResolver(async (name, locale) => {",
  "    calls.push([name, locale]);",
  "    return JSON.stringify([name, locale]);",
  "  });",
  '  const first = ["a:", "b"];',
  '  const second = ["a", ":b"];',
  "  assert.notDeepEqual(first, second);",
  '  assert.equal(first.join(""), second.join(""));',
  "  await resolve(...first);",
  "  await resolve(...second);",
  "  assert.deepEqual(calls, [first, second]);",
  "});",
  "",
].join("\n");

const delimiterOnlyRegressionSource = [
  'import assert from "node:assert/strict";',
  'import test from "node:test";',
  'import { createTemplateResolver } from "../src/resolver.mjs";',
  "",
  delimiterOnlyRegressionBlock,
].join("\n");

const collisionRegressionSource = [
  'import assert from "node:assert/strict";',
  'import test from "node:test";',
  'import { createTemplateResolver } from "../src/resolver.mjs";',
  "",
  collisionRegressionBlock,
].join("\n");

const collisionFreeCacheKeySource = [
  "export function templateCacheKey(name, locale) {",
  "  return JSON.stringify([name, locale]);",
  "}",
  "",
].join("\n");

const collisionFreeCacheKeyConstExportSource = [
  "export const templateCacheKey = (name, locale) =>",
  "  JSON.stringify([name, locale]);",
  "",
].join("\n");

const collisionFreeCacheKeyWithExtraExportSource = [
  collisionFreeCacheKeySource.trimEnd(),
  "export const candidateOnlyMarker = true;",
  "",
].join("\n");

const collisionFreeCacheKeyWithDefaultExportSource = [
  collisionFreeCacheKeySource.trimEnd(),
  'export default "candidate-default";',
  "",
].join("\n");

const collisionFreeCacheKeyWithRegexSource = [
  "export function templateCacheKey(name, locale) {",
  "  const closingBracePattern = /[}]/u;",
  '  if (!closingBracePattern.test("}")) throw new Error("unreachable");',
  "  return JSON.stringify([name, locale]);",
  "}",
  "",
].join("\n");

const collisionFreeCacheKeyWithNestedTemplateSource = [
  "export function templateCacheKey(name, locale) {",
  "  const nestedTemplateMarker = `outer:${`export function templateCacheKey(){}`}`;",
  "  void nestedTemplateMarker;",
  "  return JSON.stringify([name, locale]);",
  "}",
  "",
].join("\n");

const baselineWithoutTargetImportSource = [
  'import assert from "node:assert/strict";',
  'import test from "node:test";',
  "",
  'test("baseline arithmetic", () => {',
  "  assert.equal(2 + 2, 4);",
  "});",
  "",
].join("\n");

const candidateOnlyExportTestSource = [
  'import assert from "node:assert/strict";',
  'import test from "node:test";',
  'import { candidateOnlyMarker } from "../src/cache-key.mjs";',
  "",
  'test("retains an unrelated candidate export", () => {',
  "  assert.equal(candidateOnlyMarker, true);",
  "});",
  "",
].join("\n");

const candidateOnlyDefaultExportTestSource = [
  'import assert from "node:assert/strict";',
  'import test from "node:test";',
  'import candidateDefault from "../src/cache-key.mjs";',
  "",
  'test("retains the candidate default export", () => {',
  '  assert.equal(candidateDefault, "candidate-default");',
  "});",
  "",
].join("\n");

const candidateLayoutProbeSource = [
  'import assert from "node:assert/strict";',
  'import { readdirSync } from "node:fs";',
  'import test from "node:test";',
  "",
  'test("artifact phase preserves the ordinary source layout", () => {',
  "  assert.deepEqual(",
  '    readdirSync(new URL("../src/", import.meta.url)).sort(),',
  '    ["cache-key.mjs", "locale.mjs", "resolver.mjs"],',
  "  );",
  "});",
  "",
].join("\n");

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

function strictReviewPrompt(contract, {
  ledger = "exact clauses -> positive and negative evidence",
  paths = "src/index.mjs, test/index.test.mjs",
  testEvidence = "exit=0; command=npm test",
} = {}) {
  return [
    "$leanpowers:review",
    "Original task:",
    contract,
    "",
    "Reviewer context:",
    "Sole reviewer; read diff/code; do not edit/delegate.",
    `Ledger: ${ledger}`,
    `Paths: ${paths}`,
    `Test: ${testEvidence}`,
    "Return Review YAML raw—no JSON/fence/heading/prose. Pass: exactly these three lines:",
    "",
    "verdict: pass",
    "findings: []",
    "unverified_areas: []",
  ].join("\n");
}

function passingCapsuleStage(workflow = "build") {
  return {
    workflow,
    route_ledger_occurrences: 1,
    route_declarations_consistent: true,
    risk_monotonic_observed: true,
    ledger_before_tools_observed: true,
    canonical_route_declaration_observed: true,
    ledger_keys_after_initial_observed: false,
    highest_presented_risk: "standard",
    workflow_read_calls: 0,
    pre_change_command_calls: workflow === "debug" ? 3 : 2,
    pre_change_stage_protocol_observed: true,
    stage_retry_calls: 0,
    stage_attempts: {
      discover: 1,
      read: 1,
      reproduce: workflow === "debug" ? 1 : 0,
    },
    unexpected_pre_change_command_calls: 0,
    out_of_order_stage_calls: 0,
    extra_read_calls: 0,
    malformed_read_calls: 0,
    discover_observed: true,
    read_observed: true,
    patch_targets_read_observed: true,
    grounded_candidate_paths: ["src/index.mjs", "test/index.test.mjs"],
    grounded_candidates_read_observed: true,
    quality_grounded_candidates_read_observed: true,
    quality_patch_targets_read_observed: true,
    quality_pre_change_evidence_observed: true,
    quality_read_observed: true,
    required_read_paths: ["src/index.mjs", "test/index.test.mjs"],
    validation_metadata_read_observed: true,
    reproduce_observed: workflow === "debug" ? true : null,
    ordered_reproduce_observed: workflow === "debug" ? true : null,
    pre_patch_clause_test_ledger_structure_observed: true,
    pre_patch_clause_test_ledger_packet_count: 1,
    pre_patch_clause_test_ledger_observed: true,
    clause_test_mapping_count: 2,
    grounded_clause_test_mapping_count: 2,
    task_boundary_count: 1,
    distinct_boundary_coverage_observed: true,
    clause_coverage_observed: true,
    counterexample_presentation_count: 1,
    pre_patch_counterexample_structure_observed: true,
    pre_patch_counterexample_transition_observed: true,
    pre_patch_counterexample_observed: true,
    post_patch_clause_test_ledger_observed: false,
    patch_batches: 1,
    patch_file_events: 2,
    patch_paths: ["src/index.mjs", "test/index.test.mjs"],
    implementation_patch_observed: true,
    quality_patch_observed: true,
    test_patch_observed: true,
    multi_file_patch_observed: true,
    post_change_command_calls: 1,
    validation_observed: true,
    quality_validation_observed: true,
    quality_validation_mode: workflow === "debug" ? "combined" : "canonical",
    post_change_validation_mode: workflow === "debug" ? "combined" : "canonical",
    final_validation_budget_observed: true,
    capsule_green_path_observed: true,
    post_change_reproduction_replayed: workflow === "debug",
    post_validation_tool_calls: 0,
    quality_post_validation_tool_calls: 0,
    quality_ordinary_stop_observed: true,
    ordinary_stop_observed: true,
    protocol_observed: true,
  };
}

function capsuleTraceOptions(expectedWorkflow) {
  return {
    changePolicy: capsuleChangePolicy,
    expectedReviewContract: capsuleReviewContract,
    expectedWorkflow,
    reproductionContract:
      expectedWorkflow === "debug" ? capsuleReproductionContract : null,
  };
}

function capsuleTraceEvents({
  discoverCommand = "/bin/zsh -lc \"rg --files .; rg -n -- 'cache|locale' .\"",
  discoverOutput = [
    "src/index.mjs",
    "test/index.test.mjs",
    "package.json",
    "src/index.mjs:1:cache",
    "test/index.test.mjs:1:test",
  ].join("\n"),
  duplicateLedger = false,
  expectedWorkflow = "debug",
  extraPostCommand = false,
  extraPreCommand = false,
  extraReadAfterSuccess = false,
  extraReadAfterReproduce = false,
  failedDiscoverAttempts = [],
  failedReadAttempts = [],
  failedReproductionAttempts = [],
  finalMessage = "Done",
  initialExtra = null,
  ledgerAfterDiscover = false,
  nonReviewTail = false,
  patchBatches = 1,
  patchPaths = ["src/index.mjs", "test/index.test.mjs"],
  prePatchProgress = [],
  prePatchLedger = [
    "Clause→test ledger:",
    "- preserve behavior → existing regression",
    "- benchmark fixture change → focused change test",
    "Counterexample: behavior=case=fixture,value=current→case=fixture,value=changed→preserve current behavior",
  ].join("\n"),
  postValidationReview = false,
  readCommand = "tail -n +1 -- src/index.mjs test/index.test.mjs package.json",
  readOutput = "source and test contents",
  reproduceBeforeRead = false,
  reproduceCommand = capsuleReproductionContract.command,
  reproduceOutput = capsuleReproductionOutput,
  routeDeclaration = null,
  separatePostReproduction = false,
  validationExitCode = 0,
  validationCommand = null,
  workflowRead = false,
} = {}) {
  const ledger = [
    "entrypoint: leanpowers:route",
    `workflow: ${expectedWorkflow}`,
    "risk: standard",
    "required_gates: [current_evidence]",
    "",
    "Starting work.",
  ].join("\n");
  const declaration = routeDeclaration ?? ledger;
  const resolvedValidationCommand = validationCommand ?? (
    expectedWorkflow === "debug" && !separatePostReproduction
      ? `${reproduceCommand} && npm test`
      : "npm test"
  );
  const completed = (item) => ({ type: "item.completed", item });
  const events = [];
  if (!ledgerAfterDiscover) {
    events.push(completed({
      type: "agent_message",
      text: initialExtra === null ? declaration : `${declaration}\n${initialExtra}`,
    }));
  }
  if (workflowRead) {
    events.push(completed({
      type: "command_execution",
      command: "cat skills/debug/SKILL.md",
      aggregated_output: "debug workflow",
      exit_code: 0,
      status: "completed",
    }));
  }
  for (const attempt of failedDiscoverAttempts) {
    events.push(completed({
      type: "command_execution",
      command: attempt.command,
      aggregated_output: attempt.output ?? "",
      exit_code: attempt.exitCode ?? 1,
      status: "completed",
    }));
  }
  events.push(completed({
    type: "command_execution",
    command: discoverCommand,
    aggregated_output: discoverOutput,
    exit_code: 0,
    status: "completed",
  }));
  if (ledgerAfterDiscover) {
    events.push(completed({ type: "agent_message", text: declaration }));
  }
  if (expectedWorkflow === "debug" && reproduceBeforeRead) {
    events.push(completed({
      type: "command_execution",
      command: reproduceCommand,
      aggregated_output: reproduceOutput,
      exit_code: 0,
      status: "completed",
    }));
  }
  for (const attempt of failedReadAttempts) {
    events.push(completed({
      type: "command_execution",
      command: attempt.command,
      aggregated_output: attempt.output ?? "",
      exit_code: attempt.exitCode ?? 1,
      status: "completed",
    }));
  }
  events.push(completed({
    type: "command_execution",
    command: readCommand,
    aggregated_output: readOutput,
    exit_code: 0,
    status: "completed",
  }));
  if (extraReadAfterSuccess) {
    events.push(completed({
      type: "command_execution",
      command: "tail -n +1 -- package.json src/index.mjs",
      aggregated_output: "extra read",
      exit_code: 0,
      status: "completed",
    }));
  }
  if (extraPreCommand) {
    events.push(completed({
      type: "command_execution",
      command: "git status --short",
      aggregated_output: "",
      exit_code: 0,
      status: "completed",
    }));
  }
  if (expectedWorkflow === "debug") {
    for (const attempt of failedReproductionAttempts) {
      events.push(completed({
        type: "command_execution",
        command: attempt.command ?? reproduceCommand,
        aggregated_output: attempt.output ?? "",
        exit_code: attempt.exitCode ?? 1,
        status: "completed",
      }));
    }
    if (!reproduceBeforeRead) {
      events.push(completed({
        type: "command_execution",
        command: reproduceCommand,
        aggregated_output: reproduceOutput,
        exit_code: 0,
        status: "completed",
      }));
    }
  }
  if (extraReadAfterReproduce) {
    events.push(completed({
      type: "command_execution",
      command: "tail -n +1 -- package.json src/index.mjs",
      aggregated_output: "extra read",
      exit_code: 0,
      status: "completed",
    }));
  }
  for (const text of prePatchProgress) {
    events.push(completed({ type: "agent_message", text }));
  }
  if (prePatchLedger !== null) {
    events.push(completed({ type: "agent_message", text: prePatchLedger }));
  }
  const changes = patchPaths.map((changedPath) => ({
    path: `/tmp/run/workspace/${changedPath}`,
    kind: "update",
  }));
  for (const [index, change] of changes.entries()) {
    const item = {
      id: `patch-${index}`,
      type: "file_change",
      changes: [change],
      status: "completed",
    };
    events.push({ type: "item.started", item: { ...item, status: "in_progress" } });
    events.push(completed(item));
    if (patchBatches > 1 && index < changes.length - 1) {
      events.push(completed({ type: "agent_message", text: "Starting another patch." }));
    }
  }
  if (separatePostReproduction) {
    events.push(completed({
      type: "command_execution",
      command: reproduceCommand,
      aggregated_output: "reproduction replayed",
      exit_code: 0,
      status: "completed",
    }));
  }
  events.push(completed({
    type: "command_execution",
    command: resolvedValidationCommand,
    aggregated_output: validationExitCode === 0 ? "pass" : "fail",
    exit_code: validationExitCode,
    status: "completed",
  }));
  if (postValidationReview) {
    events.push(completed({
      id: "ordinary-review-spawn",
      type: "collab_tool_call",
      tool: "spawn_agent",
      receiver_thread_ids: ["ordinary-reviewer"],
      status: "completed",
    }));
    events.push(completed({
      id: "ordinary-review-wait",
      type: "collab_tool_call",
      tool: "wait",
      receiver_thread_ids: ["ordinary-reviewer"],
      status: "completed",
    }));
  }
  if (nonReviewTail) {
    events.push(completed({
      id: "helper-spawn",
      type: "collab_tool_call",
      tool: "spawn_agent",
      prompt: "Review a helper detail without using the LeanPowers review packet.",
      receiver_thread_ids: ["helper"],
      status: "completed",
    }));
    events.push(completed({
      type: "file_change",
      changes: [{
        path: "/tmp/run/workspace/src/extra.mjs",
        kind: "update",
      }],
      status: "completed",
    }));
    events.push(completed({
      type: "command_execution",
      command: "npm test",
      aggregated_output: "pass",
      exit_code: 0,
      status: "completed",
    }));
  }
  if (extraPostCommand) {
    events.push(completed({
      type: "command_execution",
      command: "git diff --check",
      aggregated_output: "",
      exit_code: 0,
      status: "completed",
    }));
  }
  events.push(completed({
    type: "agent_message",
    text: duplicateLedger ? declaration : finalMessage,
  }));
  events.push({
    type: "turn.completed",
    usage: { input_tokens: 100, cached_input_tokens: 50, output_tokens: 20 },
  });
  return events;
}

test("development pilot declares three executable risk-calibrated scenario classes", async () => {
  const suite = await loadDevelopmentSuite(suitePath);

  assert.equal(suite.schema_version, 2);
  assert.equal(suite.evidence_level, "paired-development-pilot");
  assert.equal(suite.repetitions, 2);
  assert.match(suite.suite_sha256, /^[a-f0-9]{64}$/u);
  assert.ok(suite.cases.every(({ workspace_snapshot, verifier_snapshots }) =>
    /^[a-f0-9]{64}$/u.test(workspace_snapshot?.sha256) &&
    Array.isArray(verifier_snapshots) &&
    verifier_snapshots.length > 0
  ));
  assert.deepEqual(suite.workflow_entrypoints, {
    "superpowers-6.1.1": "$superpowers:using-superpowers",
    "leanpowers-0.2.0": "$leanpowers:route",
  });
  assert.deepEqual(
    suite.cases.map(({ scenario_class, risk_level, expected_workflow }) => [
      scenario_class,
      risk_level,
      expected_workflow,
    ]),
    [
      ["small-explicit-feature", "lean", "build"],
      ["unknown-cause-defect", "standard", "debug"],
      ["security-authorization-or-data-risk", "strict", "build"],
    ],
  );
  assert.ok(suite.cases.every(({ task }) => task.trim().length > 80));
  assert.ok(suite.cases.every(({ change_policy }) => change_policy.tests.includes("test/**")));
  assert.deepEqual(
    suite.cases.find(({ id }) => id === "localized-template-cache")?.reproduction_contract,
    capsuleReproductionContract,
  );
  const cacheTask = suite.cases.find(
    ({ id }) => id === "localized-template-cache",
  )?.task;
  assert.match(cacheTask, /vary the locale for one template/i);
  assert.match(cacheTask, /vary the template name for one locale/i);
  assert.match(cacheTask, /vary the component boundary/i);
  assert.match(
    cacheTask,
    /nameA \+ normalizedLocaleA === nameB \+ normalizedLocaleB/i,
  );
  assert.match(cacheTask, /direct string concatenation with no inserted separator/i);
  assert.deepEqual(
    suite.cases.find(({ id }) => id === "localized-template-cache")
      ?.artifact_regression_gates.map(({ id, policy, mutations }) => ({
        id,
        policy,
        mutations: mutations.map(({ kind, export_name, source, target }) => ({
          kind,
          export_name,
          source,
          target,
        })),
      })),
    cacheArtifactGateSchemas,
  );
  const hydratedGates = suite.cases.find(
    ({ id }) => id === "localized-template-cache",
  ).artifact_regression_gates;
  for (const gate of hydratedGates) {
    assert.equal(gate.target, "src/cache-key.mjs");
    assert.equal(gate.export_name, "templateCacheKey");
    assert.match(gate.mutation_manifest_sha256, /^[a-f0-9]{64}$/u);
    for (const mutation of gate.mutations) {
      assert.equal(
        mutation.replacement,
        (await readFile(new URL(mutation.source, suitePath), "utf8")).trim(),
      );
      assert.match(mutation.replacement_sha256, /^[a-f0-9]{64}$/u);
    }
  }
});

test("suite input snapshots pin workspace, hidden verifier, and applied fault fragments", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "lp-suite-snapshot-"));
  try {
    const copiedRoot = path.join(root, "development-effects");
    await cp(new URL("../evals/development-effects/", import.meta.url), copiedRoot, {
      recursive: true,
    });
    const copiedSuitePath = path.join(copiedRoot, "pilot-suite.json");
    const suite = await loadDevelopmentSuite(copiedSuitePath);
    const benchmarkCase = suite.cases.find(
      ({ id }) => id === "localized-template-cache",
    );
    const contractBefore = caseSnapshotContract(benchmarkCase);
    const originalWorkspaceSource = Buffer.from(
      benchmarkCase.workspace_snapshot.entries.find(
        ({ path: entryPath }) => entryPath === "src/cache-key.mjs",
      ).contents_base64,
      "base64",
    ).toString("utf8");
    const workspaceSourcePath = path.join(
      copiedRoot,
      benchmarkCase.workspace,
      "src",
      "cache-key.mjs",
    );
    const verifierPath = path.join(
      copiedRoot,
      benchmarkCase.verifier_files[0],
    );
    const mutantPath = path.join(
      copiedRoot,
      benchmarkCase.artifact_regression_gates[1].mutations[0].source,
    );
    const originalMutantSource = await readFile(mutantPath, "utf8");
    await writeFile(workspaceSourcePath, "export const changed = true;\n");
    await writeFile(verifierPath, 'throw new Error("changed verifier");\n');
    await writeFile(
      mutantPath,
      'export function templateCacheKey() { return "changed"; }\n',
    );

    const materialized = path.join(root, "materialized");
    await materializeWorkspaceSnapshot(
      benchmarkCase.workspace_snapshot,
      materialized,
    );
    assert.equal(
      await readFile(path.join(materialized, "src", "cache-key.mjs"), "utf8"),
      originalWorkspaceSource,
    );
    assert.deepEqual(caseSnapshotContract(benchmarkCase), contractBefore);
    const reloaded = await loadDevelopmentSuite(copiedSuitePath);
    const reloadedCase = reloaded.cases.find(
      ({ id }) => id === "localized-template-cache",
    );
    assert.notDeepEqual(caseSnapshotContract(reloadedCase), contractBefore);

    await writeFile(mutantPath, originalMutantSource);
    const rawSuite = JSON.parse(await readFile(copiedSuitePath, "utf8"));
    const rawCacheCase = rawSuite.cases.find(
      ({ id }) => id === "localized-template-cache",
    );
    rawCacheCase.artifact_regression_gates[0].mutations.reverse();
    await writeFile(copiedSuitePath, `${JSON.stringify(rawSuite, null, 2)}\n`);
    const reordered = await loadDevelopmentSuite(copiedSuitePath);
    assert.notDeepEqual(
      caseSnapshotContract(reordered.cases.find(
        ({ id }) => id === "localized-template-cache",
      )),
      contractBefore,
    );

  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("workspace snapshots use canonical global path order", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "lp-suite-order-"));
  try {
    const copiedRoot = path.join(root, "development-effects");
    await cp(new URL("../evals/development-effects/", import.meta.url), copiedRoot, {
      recursive: true,
    });
    const copiedSuitePath = path.join(copiedRoot, "pilot-suite.json");
    const rawSuite = JSON.parse(await readFile(copiedSuitePath, "utf8"));
    const fixture = path.join(copiedRoot, rawSuite.cases[0].workspace);
    await mkdir(path.join(fixture, "a"));
    await writeFile(path.join(fixture, "a", "child.txt"), "child\n");
    await writeFile(path.join(fixture, "a-foo.txt"), "sibling\n");

    const suite = await loadDevelopmentSuite(copiedSuitePath);
    const paths = suite.cases[0].workspace_snapshot.entries.map(({ path: entryPath }) =>
      entryPath
    );
    assert.deepEqual(paths, [...paths].sort());
    assert.ok(paths.indexOf("a-foo.txt") < paths.indexOf("a/child.txt"));
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("artifact regression gate schema fails closed", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "leanpowers-suite-schema-"));
  try {
    const copiedRoot = path.join(root, "development-effects");
    await cp(new URL("../evals/development-effects/", import.meta.url), copiedRoot, {
      recursive: true,
    });
    const copiedSuitePath = path.join(copiedRoot, "pilot-suite.json");
    const baseline = JSON.parse(await readFile(copiedSuitePath, "utf8"));
    const cacheCaseIndex = baseline.cases.findIndex(
      ({ id }) => id === "localized-template-cache",
    );
    assert.notEqual(cacheCaseIndex, -1);
    const duplicateMutationSource = path.join(
      copiedRoot,
      "cases/localized-template-cache/verifier/mutants/cache-key.duplicate.mjs",
    );
    await writeFile(
      duplicateMutationSource,
      await readFile(path.join(
        copiedRoot,
        "cases/localized-template-cache/verifier/mutants/cache-key.component-omission.mjs",
      ), "utf8"),
    );
    const invalidMutationSource = path.join(
      copiedRoot,
      "cases/localized-template-cache/verifier/mutants/cache-key.invalid-shape.mjs",
    );
    await writeFile(
      invalidMutationSource,
      "export const templateCacheKey = (name, locale) => `${name}:${locale}`;\n",
    );
    const invalidSyntaxMutationSource = path.join(
      copiedRoot,
      "cases/localized-template-cache/verifier/mutants/cache-key.invalid-syntax.mjs",
    );
    await writeFile(
      invalidSyntaxMutationSource,
      'export function templateCacheKey(name, locale) { return name + locale; }\n"unterminated\n',
    );
    const commentOnlyDuplicateMutationSource = path.join(
      copiedRoot,
      "cases/localized-template-cache/verifier/mutants/cache-key.comment-duplicate.mjs",
    );
    await writeFile(
      commentOnlyDuplicateMutationSource,
      `// Different file comment, identical applied function.\n${await readFile(
        path.join(
          copiedRoot,
          "cases/localized-template-cache/verifier/mutants/cache-key.component-omission.mjs",
        ),
        "utf8",
      )}`,
    );

    const invalidCases = [
      [
        (candidate) => {
          candidate.schema_version = 1;
        },
        /schema_version must equal 2/u,
      ],
      [
        (candidate) => {
          candidate.cases[cacheCaseIndex].artifact_regression_gates[0].id =
            "not--kebab";
        },
        /id must be unique lower-kebab-case/u,
      ],
      [
        (candidate) => candidate.cases[cacheCaseIndex]
          .artifact_regression_gates.push(
            structuredClone(candidate.cases[cacheCaseIndex].artifact_regression_gates[0]),
          ),
        /id must be unique lower-kebab-case/u,
      ],
      [
        (candidate) => {
          candidate.cases[cacheCaseIndex].artifact_regression_gates[0].policy =
            "majority-kill";
        },
        /policy must be all-kill/u,
      ],
      [
        (candidate) => {
          candidate.cases[cacheCaseIndex].artifact_regression_gates[1].mutations = [];
        },
        /mutations must be a non-empty policy-valid array/u,
      ],
      [
        (candidate) => {
          const gate = candidate.cases[cacheCaseIndex].artifact_regression_gates[0];
          gate.mutation = gate.mutations[0];
          delete gate.mutations;
        },
        /mutations must be a non-empty policy-valid array/u,
      ],
      [
        (candidate) => {
          candidate.cases[cacheCaseIndex].artifact_regression_gates[1].policy =
            "any-kill";
        },
        /policy must be all-kill/u,
      ],
      [
        (candidate) => {
          candidate.cases[cacheCaseIndex].artifact_regression_gates[0]
            .mutations[0].kind = "run-command";
        },
        /safe replace-callable-export target, source, and export name/u,
      ],
      [
        (candidate) => {
          candidate.cases[cacheCaseIndex].artifact_regression_gates[0]
            .mutations[0].export_name = "not-valid()";
        },
        /safe replace-callable-export target, source, and export name/u,
      ],
      [
        (candidate) => {
          candidate.cases[cacheCaseIndex].artifact_regression_gates[0]
            .mutations[0].export_name = "default";
        },
        /safe replace-callable-export target, source, and export name/u,
      ],
      [
        (candidate) => {
          candidate.cases[cacheCaseIndex].artifact_regression_gates[0]
            .mutations[0].target = "../src/cache-key.mjs";
        },
        /safe replace-callable-export target, source, and export name/u,
      ],
      [
        (candidate) => {
          candidate.cases[cacheCaseIndex].artifact_regression_gates[0]
            .mutations[0].source = path.resolve(copiedRoot, "mutant.mjs");
        },
        /safe replace-callable-export target, source, and export name/u,
      ],
      [
        (candidate) => {
          candidate.cases[cacheCaseIndex].artifact_regression_gates[0]
            .mutations[0].target = "test/resolver.test.mjs";
        },
        /must address product code/u,
      ],
      [
        (candidate) => {
          candidate.cases[cacheCaseIndex].artifact_regression_gates[0]
            .mutations[0].target = "README.md";
        },
        /must address product code/u,
      ],
      [
        (candidate) => {
          candidate.cases[cacheCaseIndex].artifact_regression_gates[0]
            .mutations[1].target = "src/resolver.mjs";
        },
        /must replace one shared product target/u,
      ],
      [
        (candidate) => {
          candidate.cases[cacheCaseIndex].artifact_regression_gates[0]
            .mutations[1].export_name = "otherExport";
        },
        /must replace one shared named export/u,
      ],
      [
        (candidate) => {
          candidate.cases[cacheCaseIndex].artifact_regression_gates[0]
            .mutations[1].source = candidate.cases[cacheCaseIndex]
              .artifact_regression_gates[0].mutations[0].source;
        },
        /must use unique source files/u,
      ],
      [
        (candidate) => {
          candidate.cases[cacheCaseIndex].artifact_regression_gates[0]
            .mutations[1].source =
              "cases/localized-template-cache/verifier/mutants/cache-key.duplicate.mjs";
        },
        /must have unique replacement content/u,
      ],
      [
        (candidate) => {
          candidate.cases[cacheCaseIndex].artifact_regression_gates[0]
            .mutations[1].source =
              "cases/localized-template-cache/verifier/mutants/cache-key.comment-duplicate.mjs";
        },
        /must have unique replacement content/u,
      ],
      [
        (candidate) => {
          candidate.cases[cacheCaseIndex].artifact_regression_gates[0]
            .mutations[0].source =
              "cases/localized-template-cache/workspace/src/cache-key.mjs";
        },
        /must stay outside the candidate workspace/u,
      ],
      [
        (candidate) => {
          candidate.cases[cacheCaseIndex].artifact_regression_gates[0]
            .mutations[0].source =
              "cases/localized-template-cache/verifier/missing.mjs";
        },
        /must be a readable regular file/u,
      ],
      [
        (candidate) => {
          candidate.cases[cacheCaseIndex].artifact_regression_gates[0]
            .mutations[0].source =
              "cases/localized-template-cache/verifier/mutants/cache-key.invalid-shape.mjs";
        },
        /must contain only one direct named function export/u,
      ],
      [
        (candidate) => {
          candidate.cases[cacheCaseIndex].artifact_regression_gates[0]
            .mutations[0].source =
              "cases/localized-template-cache/verifier/mutants/cache-key.invalid-syntax.mjs";
        },
        /must be syntactically valid/u,
      ],
      [
        (candidate) => {
          candidate.cases[cacheCaseIndex].artifact_regression_gates[0]
            .mutations[0].source =
              "cases/localized-template-cache/verifier/mutants";
        },
        /must be a regular file/u,
      ],
      [
        (candidate) => {
          candidate.cases[cacheCaseIndex].artifact_regression_gates = [];
        },
        /must be a non-empty array/u,
      ],
      [
        (candidate) => {
          candidate.cases[cacheCaseIndex].artifact_regression_gates = {};
        },
        /must be a non-empty array/u,
      ],
      [
        (candidate) => {
          candidate.cases[cacheCaseIndex].verifier_files = [
            "cases/localized-template-cache/workspace/test/resolver.test.mjs",
          ];
        },
        /outside the candidate workspace/u,
      ],
    ];
    if (process.platform !== "win32") {
      const fixtureRoot = path.join(
        copiedRoot,
        "cases",
        "localized-template-cache",
      );
      await symlink("workspace", path.join(fixtureRoot, "workspace-link"));
      await symlink(
        "cache-key.boundary-erasure.mjs",
        path.join(fixtureRoot, "verifier", "mutants", "mutant-link.mjs"),
      );
      invalidCases.push(
        [
          (candidate) => {
            candidate.cases[cacheCaseIndex].workspace =
              "cases/localized-template-cache/workspace-link";
          },
          /workspace must be a direct directory/u,
        ],
        [
          (candidate) => {
            candidate.cases[cacheCaseIndex].artifact_regression_gates[0]
              .mutations[0].source =
                "cases/localized-template-cache/verifier/mutants/mutant-link.mjs";
          },
          /mutations\[0\]\.source must be a regular file/u,
        ],
      );
    }
    for (const [mutate, expected] of invalidCases) {
      const candidate = structuredClone(baseline);
      mutate(candidate);
      await writeFile(copiedSuitePath, `${JSON.stringify(candidate, null, 2)}\n`);
      await assert.rejects(loadDevelopmentSuite(copiedSuitePath), expected);
    }
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("the runner isolates one plugin and preserves workflow-neutral prompts", async () => {
  const args = buildClaudeArgs({
    model: "sonnet",
    pluginDirectory: "/tmp/workflow-under-test",
    prompt: "Implement the task in this repository.",
  });

  assert.deepEqual(args.slice(0, 2), ["-p", "Implement the task in this repository."]);
  assert.equal(args.filter((value) => value === "--plugin-dir").length, 1);
  assert.ok(args.includes("/tmp/workflow-under-test"));
  assert.ok(args.includes("--strict-mcp-config"));
  assert.ok(args.includes("--no-session-persistence"));
  assert.ok(!args.join(" ").includes("superpowers-6.1.1"));
  assert.ok(!args.join(" ").includes("leanpowers-0.2.0"));
});

test("the Codex runner is writable, non-interactive, ephemeral, and model-paired", () => {
  const args = buildCodexArgs({
    effort: "low",
    model: "gpt-5.3-codex-spark",
    prompt: "Implement the task in this repository.",
    workspace: "/tmp/disposable-workspace",
  });

  assert.equal(args[0], "exec");
  assert.ok(args.includes("workspace-write"));
  assert.ok(args.includes("--ephemeral"));
  assert.ok(!args.includes("--ignore-user-config"));
  assert.ok(args.includes('approval_policy="never"'));
  assert.ok(args.includes('model_reasoning_effort="low"'));
  assert.ok(args.includes("features.multi_agent=true"));
  assert.ok(!args.join(" ").includes("superpowers-6.1.1"));
  assert.ok(!args.join(" ").includes("leanpowers-0.2.0"));
});

test("LeanPowers activation requires an unambiguous first-progress route declaration", () => {
  const message = "Activating the `route` workflow with standard? strict owner selection.";
  const declaredRisk = extractDeclaredRisk(message);

  assert.equal(declaredRisk, "strict");
  assert.equal(
    reportsWorkflowActivation({
      entrypoint: "$leanpowers:route",
      message,
      workflow: "leanpowers-0.2.0",
    }),
    false,
  );
  assert.equal(
    reportsWorkflowActivation({
      entrypoint: "$superpowers:using-superpowers",
      message: "Using `superpowers:using-superpowers` to establish the workflow.",
      workflow: "superpowers-6.1.1",
    }),
    true,
  );
  assert.equal(
    reportsWorkflowActivation({
      entrypoint: "$superpowers:using-superpowers",
      message: "I’m invoking `superpowers:using-superpowers` now, then proceeding.",
      workflow: "superpowers-6.1.1",
    }),
    true,
  );
  assert.equal(
    reportsWorkflowActivation({
      entrypoint: "$superpowers:using-superpowers",
      message:
        "Applying `superpowers:using-superpowers` first to follow repository workflow, then inspecting the defect.",
      workflow: "superpowers-6.1.1",
    }),
    true,
  );
  for (const nonActivation of [
    "Before applying `superpowers:using-superpowers`, inspect the repository.",
    "Can we apply `superpowers:using-superpowers` here?",
    "Applying a patch recommended by `superpowers:using-superpowers`.",
  ]) {
    assert.equal(
      reportsWorkflowActivation({
        entrypoint: "$superpowers:using-superpowers",
        message: nonActivation,
        workflow: "superpowers-6.1.1",
      }),
      false,
      nonActivation,
    );
  }
  assert.equal(
    reportsWorkflowActivation({
      entrypoint: "$leanpowers:route",
      message: "leanpowers:route | workflow=build | risk=strict",
      workflow: "leanpowers-0.2.0",
    }),
    true,
  );
  assert.equal(
    reportsWorkflowActivation({
      entrypoint: "$leanpowers:route",
      message:
        "Routing selected: `leanpowers:route` workflow is `build`; risk is `strict`; required gates are `[independent_review, current_evidence]`.",
      workflow: "leanpowers-0.2.0",
    }),
    true,
  );
  for (const unavailable of [
    "I am not using the route workflow.",
    "The route workflow is unavailable in this session.",
    "The route skill isn't available despite risk: strict and required_gates.",
    "The route workflow cannot be used despite risk: strict and required_gates.",
    "Unable to use the route workflow; risk: strict; required_gates are known.",
    "I cannot use `leanpowers:route` here.",
    "Routing this through LeanPowers workflow now; risk: strict.",
    "entrypoint: build\nrisk: strict",
    "entrypoint: leanpowers:route\nThe route workflow is unavailable.",
    "entrypoint: leanpowers:route if available",
    "entrypoint: leanpowers:route not activated",
    "entrypoint: leanpowers:route\nActivation did not succeed.",
    "entrypoint: leanpowers:route\nActivation was unsuccessful.",
    "Using a router helper instead.",
    "If available, use the route workflow.",
  ]) {
    assert.equal(
      reportsWorkflowActivation({
        entrypoint: "$leanpowers:route",
        message: unavailable,
        workflow: "leanpowers-0.2.0",
      }),
      false,
      unavailable,
    );
  }
});

test("LeanPowers route declaration accepts compact semantic and legacy forms", () => {
  assert.deepEqual(
    parseLeanRouteLedger([
      "entrypoint: leanpowers:route",
      "workflow: build",
      "risk: strict",
      "required_gates: [independent_review, current_evidence]",
    ].join("\n")),
    {
      workflow: "build",
      risk: "strict",
      required_gates: "[independent_review, current_evidence]",
    },
  );
  assert.deepEqual(
    parseLeanRouteLedger("leanpowers:route | workflow=debug | risk=standard"),
    {
      workflow: "debug",
      risk: "standard",
      required_gates: "[current_evidence]",
    },
  );
  assert.deepEqual(
    parseLeanRouteLedger(
      "Starting in workflow `leanpowers:route` with `OWNER=debug` and `RISK=standard`. I will inspect first.",
    ),
    {
      workflow: "debug",
      risk: "standard",
      required_gates: "[current_evidence]",
    },
  );
  assert.deepEqual(
    parseLeanRouteLedger(
      "Running in the `leanpowers:route` workflow with `OWNER=debug` and `RISK=standard` per your trace/diff request.",
    ),
    {
      workflow: "debug",
      risk: "standard",
      required_gates: "[current_evidence]",
    },
  );
  assert.deepEqual(
    parseLeanRouteLedger(
      "Workflow decision: `leanpowers:route` with `OWNER=debug` and `RISK=standard` based on user-provided reproducible/root-cause requirement.",
    ),
    {
      workflow: "debug",
      risk: "standard",
      required_gates: "[current_evidence]",
    },
  );
  assert.deepEqual(
    parseLeanRouteLedger(
      "`leanpowers:route | workflow=debug | risk=standard` was used for this task.",
    ),
    {
      workflow: "debug",
      risk: "standard",
      required_gates: "[current_evidence]",
    },
  );
  for (const nonActivation of [
    "Running in the `leanpowers:route` documentation with `OWNER=debug` and `RISK=standard` per the example.",
    "Running in the `leanpowers:route` example with `OWNER=debug` and `RISK=standard` per the documentation.",
    "Workflow decision example: `leanpowers:route` with `OWNER=debug` and `RISK=standard` based on documentation.",
    "`leanpowers:route | workflow=debug | risk=standard` was not used for this task.",
  ]) {
    assert.equal(parseLeanRouteLedger(nonActivation), null, nonActivation);
  }
  for (const declaration of [
    "Using leanpowers:route with owner=debug and risk=standard.",
    "entrypoint: leanpowers:route\nworkflow: debug\nrisk: standard",
  ]) {
    assert.deepEqual(parseLeanRouteLedger(declaration), {
      workflow: "debug",
      risk: "standard",
      required_gates: "[current_evidence]",
    });
  }
  for (const hiddenPrefix of [
    [
      "````text",
      "leanpowers:route | workflow=build | risk=strict | gates=[independent_review, current_evidence]",
      "```",
      "Activation failed.",
      "````",
    ].join("\n"),
    "> leanpowers:route | workflow=build | risk=strict | gates=[independent_review, current_evidence]",
    "    ```text\n    leanpowers:route | workflow=build | risk=strict\n    ```",
  ]) {
    const declaration = `${hiddenPrefix}\nleanpowers:route | workflow=debug | risk=standard`;
    assert.deepEqual(parseLeanRouteLedger(declaration), {
      workflow: "debug",
      risk: "standard",
      required_gates: "[current_evidence]",
    });
    assert.equal(extractDeclaredRisk(declaration), "standard");
    assert.equal(reportsWorkflowActivation({
      entrypoint: "$leanpowers:route",
      message: declaration,
      workflow: "leanpowers-0.2.0",
    }), true);
  }
  const visibleLegacyAfterHiddenExample = [
    "> example only: leanpowers:route | workflow=build | risk=strict",
    "entrypoint: leanpowers:route",
    "workflow: debug",
    "risk: standard",
    "required_gates: [current_evidence]",
  ].join("\n");
  assert.deepEqual(parseLeanRouteLedger(visibleLegacyAfterHiddenExample), {
    workflow: "debug",
    risk: "standard",
    required_gates: "[current_evidence]",
  });
  assert.equal(reportsWorkflowActivation({
    entrypoint: "$leanpowers:route",
    message: visibleLegacyAfterHiddenExample,
    workflow: "leanpowers-0.2.0",
  }), true);
  assert.equal(
    parseLeanRouteLedger(
      "Leanpowers route selected: `debug` workflow at `standard` risk. I will inspect first.",
    ),
    null,
  );
  assert.deepEqual(
    parseLeanRouteLedger(
      "leanpowers:route: owner=debug; risk=standard; gates=[current_evidence]",
    ),
    {
      workflow: "debug",
      risk: "standard",
      required_gates: "[current_evidence]",
    },
  );
  assert.deepEqual(
    parseLeanRouteLedger(
      "leanpowers:route | workflow=review | risk=strict | gates=[current_evidence, independent_review]",
    ),
    {
      workflow: "review",
      risk: "strict",
      required_gates: "[independent_review, current_evidence]",
    },
  );
  assert.deepEqual(
    parseLeanRouteLedger(
      "Routing selected: `leanpowers:route` workflow is `debug`; risk is `standard`; required gate is `[current_evidence]`.",
    ),
    {
      workflow: "debug",
      risk: "standard",
      required_gates: "[current_evidence]",
    },
  );
  for (const declaration of [
    "Following leanpowers:route | workflow=debug | risk=standard",
    "Invoking leanpowers:route | workflow=debug | risk=standard",
    "leanpowers:route workflow: debug, risk: standard",
    "Starting with the `leanpowers:route` workflow: owner=`debug`, risk=`standard`.",
  ]) {
    assert.deepEqual(parseLeanRouteLedger(declaration), {
      workflow: "debug",
      risk: "standard",
      required_gates: "[current_evidence]",
    });
  }
  assert.deepEqual(
    parseLeanRouteLedger(
      "Routing selected: leanpowers:route workflow is debug; risk is standard; I will not change the public API.",
    ),
    {
      workflow: "debug",
      risk: "standard",
      required_gates: "[current_evidence]",
    },
  );
  assert.deepEqual(
    parseLeanRouteLedger(
      "leanpowers:route | workflow=debug | risk=standard; if validation fails I will debug.",
    ),
    {
      workflow: "debug",
      risk: "standard",
      required_gates: "[current_evidence]",
    },
  );
  for (const declaration of [
    "leanpowers:route | workflow=debug | risk=standard; existing workflow is not changed.",
    "leanpowers:route | workflow=debug | risk=standard; risk is not increased by this fix.",
    "leanpowers:route | workflow=debug | risk=standard; required gates are not modified.",
    "leanpowers:route | workflow=debug | risk=standard; workflow is not build.",
    "leanpowers:route | workflow=debug | risk=standard; risk is not strict.",
    "leanpowers:route | workflow=debug | risk=standard; gates are not [independent_review, current_evidence].",
    "leanpowers:route | workflow=debug | risk=standard\nI will not use the network.",
    "leanpowers:route | workflow=debug | risk=standard\nI am not using the parent repository.",
    "leanpowers:route | workflow=debug | risk=standard\nI did not use the cached result.",
  ]) {
    assert.deepEqual(parseLeanRouteLedger(declaration), {
      workflow: "debug",
      risk: "standard",
      required_gates: "[current_evidence]",
    });
  }
  assert.deepEqual(
    parseLeanRouteLedger([
      "entrypoint: leanpowers:route",
      "workflow: build",
      "risk: strict",
      "required_gates: [independent_review, current_evidence]",
      "",
      "Inspecting the implementation next.",
    ].join("\n")),
    {
      workflow: "build",
      risk: "strict",
      required_gates: "[independent_review, current_evidence]",
    },
  );
  assert.deepEqual(
    parseLeanRouteLedger([
      "entrypoint: leanpowers:route",
      "workflow: verify",
      "risk: standard",
      "required_gates: [current_evidence]",
    ].join("\n")),
    {
      workflow: "verify",
      risk: "standard",
      required_gates: "[current_evidence]",
    },
  );
  for (const invalid of [
    "entrypoint: leanpowers:route\nworkflow: OWNER\nrisk: strict\nrequired_gates: [independent_review, current_evidence]",
    "- entrypoint: leanpowers:route\nworkflow: build\nrisk: strict\nrequired_gates: [independent_review, current_evidence]",
    "entrypoint: leanpowers:route\nworkflow: build\nrisk: strict\nrequired_gates: [current_evidence]",
    "entrypoint: leanpowers:route\nworkflow: build\nrisk: lean\nrequired_gates: [independent_review, current_evidence]",
    "entrypoint: leanpowers:route\nworkflow: build\nrisk: strict\nrequired_gates: [independent_review, current_evidence]\nprose without a blank line",
    "entrypoint: leanpowers:route\nworkflow: build\nrisk: strict\nrequired_gates: [independent_review, current_evidence]\n\n\nprose after two blank lines",
    "\nentrypoint: leanpowers:route\nworkflow: build\nrisk: strict\nrequired_gates: [independent_review, current_evidence]",
    " entrypoint: leanpowers:route\nworkflow: build\nrisk: strict\nrequired_gates: [independent_review, current_evidence]",
    "entrypoint: leanpowers:route\nworkflow: build\nrisk: strict\nrequired_gates: [independent_review, current_evidence]\n \nprose after whitespace",
    "leanpowers:route | workflow=build | workflow=debug | risk=standard",
    "leanpowers:route | workflow=OWNER | risk=standard",
    "leanpowers:route | workflow=debug | risk=lean | risk=strict",
    "leanpowers:route | workflow=debug | risk=standard | gates=[independent_review, current_evidence]",
    "leanpowers:route | workflow=review | risk=strict | gates=current_evidence",
    "leanpowers:route | workflow=review | risk=strict | gates=[current_evidence",
    "leanpowers:route | workflow=review | risk=strict | gates=none",
    "leanpowers:route | workflow=review | risk=strict | required_gates=disabled",
    "leanpowers:route | workflow=debug | risk=standard | workflow=OWNER | risk=RISK",
    "leanpowers:route | workflow=debug | risk=standard\nworkflow=OWNER | risk=RISK",
    "leanpowers:route | workflow=debug | workflow=debug | risk=standard",
    "leanpowers:route | workflow=debug | risk=standard | risk=standard",
    "leanpowers:route | workflow=debug-ish | risk=standard",
    "leanpowers:route | workflow=debug | risk=standard-ish",
    "leanpowers:route | workflow=debug | risk=standard | workflow=\"build\"",
    "leanpowers:route | workflow=debug | risk=standard | gates=\"none\"",
    "leanpowers:route | workflow=debug | risk=standard | unknown=anything",
    "leanpowers:route | workflow=debug/build | risk=standard",
    "leanpowers:route | workflow=debug\"build\" | risk=standard",
    "leanpowers:route | workflow=debug坏 | risk=standard",
    "leanpowers:route | workflow=debug | risk=standard/strict",
    "leanpowers:route | workflow=debug | risk=standard坏",
    "leanpowers:route | workflow=debug | risk=standard | gates=[current_evidence]/none",
    "leanpowers:route | workflow=debug | risk=standard | gates=[current_evidence]\"junk\"",
    "leanpowers:route | workflow=debug | risk=standard | 未知=anything",
    "Invoking leanpowers:route failed | workflow=debug | risk=standard",
    "Using leanpowers:route? workflow is build; risk is standard",
    "Previous workflow=build and risk=standard; now considering leanpowers:route.",
    "Considering leanpowers:route | workflow=build | risk=lean",
    "If available, leanpowers:route | workflow=build | risk=lean",
    "Maybe leanpowers:route | workflow=build | risk=lean",
    "not leanpowers:route | workflow=build | risk=lean",
    "I am not using leanpowers:route | workflow=build | risk=lean",
    "I did not select leanpowers:route | workflow=build | risk=lean",
    "without leanpowers:route | workflow=build | risk=lean",
    "skipping leanpowers:route | workflow=build | risk=lean",
    "declining leanpowers:route | workflow=build | risk=lean",
    "leanpowers:route | workflow=build | risk=lean; do not use workflow=build",
    "leanpowers:route | workflow=build | risk=lean; workflow is not build",
    "leanpowers:route | workflow=build | risk=lean; owner is not build",
    "leanpowers:route | workflow=build | risk=lean; risk is not lean",
    "leanpowers:route | workflow=build | risk=lean; gates are not [current_evidence]",
    "leanpowers:route | workflow=build | risk=lean; not workflow build",
    "leanpowers:route | workflow=debug | risk=standard | activation failed",
    "leanpowers:route | workflow=debug | risk=standard; activation was not successful.",
    "leanpowers:route | workflow=debug | risk=standard; activation is unsuccessful.",
    "leanpowers:route | workflow=debug | risk=standard; activation is false.",
    "leanpowers:route | workflow=debug | risk=standard; this route is not active.",
    "leanpowers:route | workflow=debug | risk=standard; this route wasn’t active.",
    "leanpowers:route | workflow=debug | risk=standard\nI didn’t use it.",
    "leanpowers:route | workflow=debug | risk=standard\nI haven’t selected it.",
    "leanpowers:route | workflow=debug | risk=standard\nI won’t follow this route.",
    "leanpowers:route | workflow=debug | risk=standard\nI do not intend to use leanpowers:route.",
    "leanpowers:route | workflow=build | risk=lean\nI did not activate it.",
    [
      "entrypoint: leanpowers:route",
      "workflow: build",
      "risk: strict",
      "required_gates: [independent_review, current_evidence]",
      "",
      "I am not using this workflow.",
    ].join("\n"),
    [
      "entrypoint: leanpowers:route",
      "workflow: build",
      "risk: strict",
      "required_gates: [independent_review, current_evidence]",
      "",
      "Activation did not succeed.",
    ].join("\n"),
  ]) {
    assert.equal(parseLeanRouteLedger(invalid), null, invalid);
  }
  for (const conflicting of [
    "Starting in workflow leanpowers:route with OWNER=debug and RISK=standard. workflow is build; risk is strict.",
    "Starting in workflow leanpowers:route with OWNER=debug and RISK=standard; required_gates=[]",
    "leanpowers:route | workflow=debug | risk=standard\nworkflow is build; risk is strict",
    "leanpowers:route | workflow=debug | risk=standard\nrequired_gates=[]",
    "leanpowers:route | workflow=debug | risk=standard\nworkflow is not debug",
    "leanpowers:route | workflow=debug | risk=standard\nrisk is not standard",
    "leanpowers:route | workflow=debug | risk=standard\nrequired_gates are not [current_evidence]",
    "leanpowers:route | workflow=debug | risk=standard\nworkflow: release",
    "leanpowers:route | workflow=debug | risk=standard\nworkflow: build and risk: strict",
    "leanpowers:route | workflow=debug | risk=standard\nrisk=high",
    "leanpowers:route | workflow=debug | risk=standard\ngates=none",
    "leanpowers:route | workflow=debug | risk=standard\nworkflow: \"release\"",
    "leanpowers:route | workflow=debug | risk=standard\nrisk: \"high\"",
    "leanpowers:route | workflow=debug | risk=standard\nworkflow:",
    [
      "entrypoint: leanpowers:route",
      "workflow: debug",
      "risk: standard",
      "",
      "workflow: build",
      "risk: strict",
    ].join("\n"),
  ]) {
    assert.equal(parseLeanRouteLedger(conflicting), null, conflicting);
  }
  const conflictingTrace = parseCodexResult(
    capsuleTraceEvents({
      routeDeclaration:
        "leanpowers:route | workflow=debug | risk=standard\nworkflow is build; risk is strict",
    }).map(JSON.stringify).join("\n"),
    capsuleTraceOptions("debug"),
  ).workflow_trace.capsule_stage;
  assert.equal(conflictingTrace.route_declarations_consistent, false);
  assert.equal(conflictingTrace.highest_presented_risk, "strict");
  const negatedTrace = parseCodexResult(
    capsuleTraceEvents({
      routeDeclaration:
        "leanpowers:route | workflow=debug | risk=standard\nworkflow is not debug",
    }).map(JSON.stringify).join("\n"),
    capsuleTraceOptions("debug"),
  ).workflow_trace.capsule_stage;
  assert.equal(negatedTrace.route_declarations_consistent, false);
  const malformedStructuredTrace = parseCodexResult(
    capsuleTraceEvents({
      routeDeclaration:
        "leanpowers:route | workflow=debug | risk=standard\nworkflow=bogus",
    }).map(JSON.stringify).join("\n"),
    capsuleTraceOptions("debug"),
  ).workflow_trace.capsule_stage;
  assert.equal(malformedStructuredTrace.route_declarations_consistent, false);
  const malformedQuotedTrace = parseCodexResult(
    capsuleTraceEvents({
      routeDeclaration:
        "leanpowers:route | workflow=debug | risk=standard\nworkflow: \"release\"",
    }).map(JSON.stringify).join("\n"),
    capsuleTraceOptions("debug"),
  ).workflow_trace.capsule_stage;
  assert.equal(malformedQuotedTrace.route_declarations_consistent, false);
  const expectedSemanticRoute = {
    workflow: "debug",
    risk: "standard",
    required_gates: "[current_evidence]",
  };
  for (const validWithProse of [
    "leanpowers:route | workflow=debug | risk=standard\nThe workflow is now active.",
    "Using leanpowers:route with owner=debug and risk=standard.\nThe risk is acceptable because the change is local.",
    "leanpowers:route | workflow=debug | risk=standard\nI will inspect the existing workflow: source resolution.",
    "leanpowers:route | workflow=debug | risk=standard\nworkflow is not build; risk is not strict",
    "leanpowers:route | workflow=debug | risk=standard\nworkflow: debug and risk: standard",
    "leanpowers:route | workflow=debug | risk=standard\nowner=debug and risk=standard and gates=[current_evidence]",
  ]) {
    assert.deepEqual(
      parseLeanRouteLedger(validWithProse),
      expectedSemanticRoute,
      validWithProse,
    );
  }
  assert.deepEqual(
    parseLeanRouteLedger(
      "Invoking leanpowers:route to investigate a failed test | workflow=debug | risk=standard",
    ),
    expectedSemanticRoute,
  );
});

test("agent and verifier environments expose only a fixed non-sensitive allowlist", () => {
  const env = benchmarkEnvironment("/tmp/isolated-home", {
    BENCHMARK_MARKER: "fixture",
  });

  assert.equal(env.HOME, "/tmp/isolated-home");
  assert.equal(env.CODEX_HOME, "/tmp/isolated-home");
  assert.equal(env.TMPDIR, "/tmp/isolated-home/tmp");
  assert.equal(env.BENCHMARK_MARKER, "fixture");
  assert.ok(!("NODE_TEST_CONTEXT" in env));
  assert.ok(!("AWS_SECRET_ACCESS_KEY" in env));
  assert.ok(!env.PATH.includes(os.homedir()));
});

test("Linux verifier runtime roots are narrow and ancestor-minimizable", () => {
  const absolutePath = (...segments) => path.posix.join("/", ...segments);
  assert.equal(
    approvedLinuxRuntimeRoot("/opt/toolchains/node-24/bin/node"),
    "/opt/toolchains/node-24",
  );
  assert.equal(
    approvedLinuxRuntimeRoot(
      absolutePath("home", "runner", ".nvm", "versions", "node", "v24", "bin", "node"),
    ),
    absolutePath("home", "runner", ".nvm", "versions", "node", "v24"),
  );
  for (const executable of [
    "/bin/node",
    absolutePath("home", "runner", "bin", "node"),
    absolutePath("root", "bin", "node"),
    "/tmp/bin/node",
    "/var/tmp/bin/node",
    "/node",
  ]) {
    assert.throws(
      () => approvedLinuxRuntimeRoot(executable),
      /bounded bin directory|too broad/u,
      executable,
    );
  }
});

test("Claude usage is parsed without treating missing telemetry as zero", () => {
  assert.deepEqual(
    parseClaudeResult(JSON.stringify({
      type: "result",
      subtype: "success",
      result: "Done",
      num_turns: 7,
      duration_ms: 3210,
      usage: {
        input_tokens: 10,
        output_tokens: 20,
        cache_creation_input_tokens: 30,
        cache_read_input_tokens: 40,
      },
    })),
    {
      completed: true,
      final_message: "Done",
      turns: 7,
      duration_ms: 3210,
      tokens: {
        input: 10,
        output: 20,
        cache_creation_input: 30,
        cache_read_input: 40,
        total_context: 100,
      },
    },
  );

  assert.equal(parseClaudeResult('{"result":"Done"}').tokens, null);
});

test("Codex JSONL usage and completion are independently parsed", () => {
  const parsed = parseCodexResult([
    JSON.stringify({ type: "thread.started", thread_id: "fixture" }),
    JSON.stringify({ type: "turn.started" }),
    JSON.stringify({
      type: "item.completed",
      item: { type: "command_execution", command: "npm test" },
    }),
    JSON.stringify({
      type: "item.completed",
      item: { type: "agent_message", text: "Done" },
    }),
    JSON.stringify({
      type: "turn.completed",
      usage: {
        input_tokens: 100,
        cached_input_tokens: 40,
        output_tokens: 20,
        reasoning_output_tokens: 10,
      },
    }),
  ].join("\n"));

  assert.deepEqual(parsed, {
    completed: true,
    final_message: "Done",
    first_progress_message: "Done",
    turns: 1,
    tool_calls: 1,
    tokens: {
      input: 100,
      cached_input: 40,
      output: 20,
      reasoning_output: 10,
      total: 120,
      uncached_plus_output: 80,
      telemetry_complete: true,
    },
    tool_calls_by_type: { command_execution: 1 },
    workflow_trace: {
      read_calls: 0,
      read_output_chars: 0,
      skills_observed: [],
      independent_review_pass_observed: false,
      quality_independent_review_pass_observed: false,
      quality_independent_review_context_observed: false,
      quality_independent_review_current_validation_observed: false,
      independent_review_contract_verbatim_observed: false,
      independent_review_skill_invoked: false,
      independent_review_sole_wait_target_observed: false,
      reviewer_workspace_mutation_check_observed: false,
      reviewer_workspace_mutation_observed: false,
      strict_review_protocol_observed: false,
      strict_review_cycle_count: 0,
      duplicate_strict_collab_call_id_observed: false,
      unexpected_strict_collab_tool_observed: false,
      post_change_spawn_calls: 0,
      post_change_wait_calls: 0,
    },
  });
  assert.equal(parseCodexResult('{"type":"turn.failed"}').tokens, null);
  assert.equal(
    parseCodexResult([
      JSON.stringify({
        type: "item.completed",
        item: { type: "agent_message", text: "first" },
      }),
      JSON.stringify({
        type: "item.completed",
        item: { type: "agent_message", text: "final names leanpowers:route" },
      }),
    ].join("\n")).first_progress_message,
    "first",
  );
});

test("Codex usage preserves incomplete telemetry and rejects impossible cache values", () => {
  const missing = parseCodexResult(JSON.stringify({
    type: "turn.completed",
    usage: { input_tokens: 100, output_tokens: 20 },
  }));
  assert.equal(missing.tokens.cached_input, null);
  assert.equal(missing.tokens.uncached_plus_output, null);
  assert.equal(missing.tokens.telemetry_complete, false);

  const impossible = parseCodexResult(JSON.stringify({
    type: "turn.completed",
    usage: { input_tokens: 100, cached_input_tokens: 120, output_tokens: 20 },
  }));
  assert.equal(impossible.tokens.telemetry_complete, false);
  assert.equal(impossible.tokens.uncached_plus_output, null);

  for (const usage of [
    { input_tokens: 100, cached_input_tokens: 0, output_tokens: -1 },
    { input_tokens: -1, cached_input_tokens: 0, output_tokens: 20 },
    { input_tokens: 0, cached_input_tokens: 0, output_tokens: 0 },
    { input_tokens: 1.5, cached_input_tokens: 0, output_tokens: 1 },
  ]) {
    const invalid = parseCodexResult(JSON.stringify({
      type: "turn.completed",
      usage,
    }));
    assert.equal(invalid.tokens.total, null, JSON.stringify(usage));
    assert.equal(invalid.tokens.telemetry_complete, false, JSON.stringify(usage));
  }
});

test("Codex trace records tool types and exact workflow file reads", () => {
  const parsed = parseCodexResult([
    JSON.stringify({
      type: "item.completed",
      item: {
        type: "command_execution",
        command: "sed -n 1,200p /plugin/skills/build/SKILL.md",
        aggregated_output: "build workflow",
      },
    }),
    JSON.stringify({
      type: "item.completed",
      item: { type: "file_change", changes: [] },
    }),
    JSON.stringify({
      type: "turn.completed",
      usage: { input_tokens: 10, cached_input_tokens: 0, output_tokens: 5 },
    }),
  ].join("\n"));

  assert.deepEqual(parsed.tool_calls_by_type, { command_execution: 1, file_change: 1 });
  assert.deepEqual(parsed.workflow_trace, {
    read_calls: 1,
    read_output_chars: 14,
    skills_observed: ["build"],
    independent_review_pass_observed: false,
    quality_independent_review_pass_observed: false,
    quality_independent_review_context_observed: false,
    quality_independent_review_current_validation_observed: false,
    independent_review_contract_verbatim_observed: false,
    independent_review_skill_invoked: false,
    independent_review_sole_wait_target_observed: false,
    reviewer_workspace_mutation_check_observed: false,
    reviewer_workspace_mutation_observed: false,
    strict_review_protocol_observed: false,
    strict_review_cycle_count: 0,
    duplicate_strict_collab_call_id_observed: false,
    unexpected_strict_collab_tool_observed: false,
    post_change_spawn_calls: 0,
    post_change_wait_calls: 0,
  });
});

test("Codex trace observes the complete debug capsule stage protocol", () => {
  const parsed = parseCodexResult(
    capsuleTraceEvents().map(JSON.stringify).join("\n"),
    capsuleTraceOptions("debug"),
  );

  assert.deepEqual(parsed.workflow_trace.capsule_stage, passingCapsuleStage("debug"));

  const literalShellSyntax = parseCodexResult(
    capsuleTraceEvents({
      discoverCommand: "rg --files .; rg -n -- 'cache$(literal)' .",
    }).map(JSON.stringify).join("\n"),
    capsuleTraceOptions("debug"),
  );
  assert.deepEqual(
    literalShellSyntax.workflow_trace.capsule_stage,
    passingCapsuleStage("debug"),
  );
  const leadingHyphenLiteral = parseCodexResult(
    capsuleTraceEvents({
      discoverCommand: "rg --files .; rg -n -- '--no-ignore' .",
    }).map(JSON.stringify).join("\n"),
    capsuleTraceOptions("debug"),
  );
  assert.deepEqual(
    leadingHyphenLiteral.workflow_trace.capsule_stage,
    passingCapsuleStage("debug"),
  );

  const reproAndTestValidation = parseCodexResult(
    capsuleTraceEvents({
      validationCommand: `${capsuleReproductionContract.command} && npm test`,
    }).map(JSON.stringify).join("\n"),
    capsuleTraceOptions("debug"),
  );
  assert.deepEqual(
    reproAndTestValidation.workflow_trace.capsule_stage,
    {
      ...passingCapsuleStage("debug"),
      post_change_reproduction_replayed: true,
      post_change_validation_mode: "combined",
    },
  );
  const wrappedReproAndTestValidation = parseCodexResult(
    capsuleTraceEvents({
      validationCommand:
        `/bin/zsh -lc '${capsuleReproductionContract.command} && npm test'`,
    }).map(JSON.stringify).join("\n"),
    capsuleTraceOptions("debug"),
  );
  assert.deepEqual(
    wrappedReproAndTestValidation.workflow_trace.capsule_stage,
    {
      ...passingCapsuleStage("debug"),
      post_change_reproduction_replayed: true,
      post_change_validation_mode: "combined",
    },
  );
  const validationWithoutReplay = parseCodexResult(
    capsuleTraceEvents({ validationCommand: "npm test" })
      .map(JSON.stringify)
      .join("\n"),
    capsuleTraceOptions("debug"),
  ).workflow_trace.capsule_stage;
  assert.equal(validationWithoutReplay.validation_observed, false);
  assert.equal(validationWithoutReplay.post_change_reproduction_replayed, false);
  assert.equal(validationWithoutReplay.capsule_green_path_observed, false);
  assert.equal(validationWithoutReplay.protocol_observed, false);
  const separateReproAndTestValidation = parseCodexResult(
    capsuleTraceEvents({ separatePostReproduction: true }).map(JSON.stringify).join("\n"),
    capsuleTraceOptions("debug"),
  );
  assert.deepEqual(
    separateReproAndTestValidation.workflow_trace.capsule_stage,
    {
      ...passingCapsuleStage("debug"),
      final_validation_budget_observed: false,
      capsule_green_path_observed: false,
      post_change_command_calls: 2,
      post_change_reproduction_replayed: true,
      quality_validation_mode: "separate",
      post_change_validation_mode: "separate",
    },
  );
  const reproductionBeforeRead = parseCodexResult(
    capsuleTraceEvents({ reproduceBeforeRead: true }).map(JSON.stringify).join("\n"),
    capsuleTraceOptions("debug"),
  ).workflow_trace.capsule_stage;
  assert.equal(reproductionBeforeRead.reproduce_observed, true);
  assert.equal(reproductionBeforeRead.ordered_reproduce_observed, true);
  assert.equal(reproductionBeforeRead.pre_change_stage_protocol_observed, true);
  assert.equal(reproductionBeforeRead.capsule_green_path_observed, true);
});

test("capsule clause-to-test ledger must appear before PATCH, not only in final", () => {
  const stage = parseCodexResult(
    capsuleTraceEvents({
      prePatchLedger: null,
      finalMessage: "Clause → test ledger:\n- preserve behavior → tests pass",
    }).map(JSON.stringify).join("\n"),
    capsuleTraceOptions("debug"),
  ).workflow_trace.capsule_stage;

  assert.equal(stage.pre_patch_clause_test_ledger_observed, false);
  assert.equal(stage.protocol_observed, false);

  for (const prePatchLedger of [
    "Clause→test ledger:\n- preserve behavior → existing regression\n- benchmark fixture change → focused change test",
    [
      "Clause→test ledger:",
      "- preserve behavior → existing regression",
      "- benchmark fixture change → focused change test",
      "Counterexample: behavior=current→changed",
    ].join("\n"),
    [
      "Clause→test ledger:",
      "- preserve behavior → existing regression",
      "- benchmark fixture change → focused change test",
      "Counterexample: behavior=current→current→preserve current behavior",
    ].join("\n"),
    [
      "Clause→test ledger:",
      "- preserve behavior → existing regression",
      "- benchmark fixture change → focused change test",
      "Counterexample: unrelated=alpha→beta→unrelated outcome",
    ].join("\n"),
    [
      "Clause→test ledger:",
      "- preserve behavior → existing regression",
      "- benchmark fixture change → focused change test",
      "Counterexample: behavior=current→arbitrary-multi-property-state→totally unrelated outcome",
    ].join("\n"),
    [
      "Clause→test ledger:",
      "- preserve behavior → existing regression",
      "- benchmark fixture change → focused change test",
      "Counterexample: cache locale→banana→must keep locale normalization",
    ].join("\n"),
    [
      "Clause→test ledger:",
      "- preserve behavior → existing regression",
      "- benchmark fixture change → focused change test",
      "Counterexample: behavior=fixture locale en→locale en fixture→preserve current behavior",
    ].join("\n"),
    [
      "Clause→test ledger:",
      "- preserve behavior → existing regression",
      "- benchmark fixture change → focused change test",
      "Counterexample: behavior=case=fixture,value=current→case=fixture,value=current->changed→preserve current behavior",
    ].join("\n"),
    [
      "Clause→test ledger:",
      "- preserve behavior → existing regression",
      "- benchmark fixture change → focused change test",
      "Counterexample: behavior=case=fixture,value=current→fixture=case,value=changed→preserve current behavior",
    ].join("\n"),
    [
      "Clause→test ledger:",
      "- preserve behavior → existing regression",
      "- benchmark fixture change → focused change test",
      "Counterexample: behavior=case=fixture,value=name=current,locale=en→case=fixture,value=name=changed,locale=fr,error=on→preserve current behavior",
    ].join("\n"),
    [
      "Clause→test ledger:",
      "- preserve behavior → existing regression",
      "- benchmark fixture change → focused change test",
      "Counterexample: behavior=current→changed→preserve current behavior",
      "Counterexample: fixture=old→new→focused change",
    ].join("\n"),
  ]) {
    const invalidCounterexample = parseCodexResult(
      capsuleTraceEvents({ prePatchLedger }).map(JSON.stringify).join("\n"),
      capsuleTraceOptions("debug"),
    ).workflow_trace.capsule_stage;
    assert.equal(invalidCounterexample.pre_patch_counterexample_observed, false);
    assert.equal(invalidCounterexample.protocol_observed, true);
  }

  const validCounterexample = parseCodexResult(
    capsuleTraceEvents().map(JSON.stringify).join("\n"),
    capsuleTraceOptions("debug"),
  ).workflow_trace.capsule_stage;
  assert.equal(validCounterexample.pre_patch_counterexample_observed, true);
  assert.equal(validCounterexample.pre_patch_counterexample_transition_observed, true);
  assert.equal(validCounterexample.counterexample_presentation_count, 1);
  assert.equal(validCounterexample.clause_test_mapping_count, 2);

  const compactLedger = parseCodexResult(
    capsuleTraceEvents({
      prePatchLedger: [
        "Clause→test ledger: preserve behavior→existing regression; benchmark fixture change→focused change test",
        "Counterexample: behavior=case=fixture,value=current→case=fixture,value=changed→preserve current behavior",
      ].join("\n"),
    }).map(JSON.stringify).join("\n"),
    capsuleTraceOptions("debug"),
  ).workflow_trace.capsule_stage;
  assert.equal(compactLedger.pre_patch_clause_test_ledger_structure_observed, false);
  assert.equal(compactLedger.clause_test_mapping_count, 0);
  assert.equal(compactLedger.pre_patch_counterexample_observed, false);
  assert.equal(compactLedger.protocol_observed, false);

  for (const mappings of [
    [
      "- NOT EVIDENCE preserve behavior → existing regression",
      "- benchmark fixture change → focused change test",
    ],
    [
      "- preserve behavior → existing regression",
      "- Preserve behavior → Existing regression",
    ],
    [
      "- preserve behavior → not evidence → existing regression",
      "- benchmark fixture change → focused change test",
    ],
    [
      "- fictional preserve behavior → existing regression",
      "- pretend benchmark fixture change → focused change test",
    ],
  ]) {
    const invalidMappings = parseCodexResult(
      capsuleTraceEvents({
        prePatchLedger: [
          "Clause→test ledger:",
          ...mappings,
          "Counterexample: behavior=case=fixture,value=current→case=fixture,value=changed→preserve current behavior",
        ].join("\n"),
      }).map(JSON.stringify).join("\n"),
      capsuleTraceOptions("debug"),
    ).workflow_trace.capsule_stage;
    assert.ok(invalidMappings.clause_test_mapping_count < 2);
    assert.equal(
      invalidMappings.protocol_observed,
      invalidMappings.grounded_clause_test_mapping_count > 0,
    );
  }

  const observedBugRestatement = parseCodexResult(
    capsuleTraceEvents({
      prePatchLedger: [
        "Clause→test ledger:",
        "- locale normalization remains intact → locale normalization regression",
        "- unambiguous cache identity → separator characters test",
        "Counterexample: same-name+different-locale+separator chars→templateCacheKey returning name causes locale collision→must key by both name and normalized locale",
      ].join("\n"),
    }).map(JSON.stringify).join("\n"),
    {
      ...capsuleTraceOptions("debug"),
      expectedReviewContract:
        "Keep locale normalization intact. Cache identity must remain unambiguous with separator characters.",
    },
  ).workflow_trace.capsule_stage;
  assert.equal(observedBugRestatement.pre_patch_counterexample_structure_observed, false);
  assert.equal(observedBugRestatement.pre_patch_counterexample_observed, false);
  assert.equal(observedBugRestatement.protocol_observed, true);

  const disguisedBugRestatement = parseCodexResult(
    capsuleTraceEvents({
      prePatchLedger: [
        "Clause→test ledger:",
        "- locale normalization remains intact → locale normalization regression",
        "- unambiguous cache identity → separator characters test",
        "Counterexample: cache identity=same-name+different-locale+separator chars→templateCacheKey returning name causes locale collision→must preserve unambiguous cache identity",
      ].join("\n"),
    }).map(JSON.stringify).join("\n"),
    {
      ...capsuleTraceOptions("debug"),
      expectedReviewContract:
        "Keep locale normalization intact. Cache identity must remain unambiguous with separator characters.",
    },
  ).workflow_trace.capsule_stage;
  assert.equal(disguisedBugRestatement.pre_patch_counterexample_structure_observed, true);
  assert.equal(disguisedBugRestatement.pre_patch_counterexample_transition_observed, false);
  assert.equal(disguisedBugRestatement.pre_patch_counterexample_observed, false);
  assert.equal(disguisedBugRestatement.protocol_observed, true);

  const unrelatedContext = parseCodexResult(
    capsuleTraceEvents({
      prePatchLedger: [
        "Clause→test ledger:",
        "- preserve behavior → existing regression",
        "- benchmark fixture change → focused change test",
        "Counterexample: behavior=fruit=banana,value=apple→fruit=banana,value=kiwi→preserve current behavior",
      ].join("\n"),
    }).map(JSON.stringify).join("\n"),
    capsuleTraceOptions("debug"),
  ).workflow_trace.capsule_stage;
  assert.equal(unrelatedContext.pre_patch_counterexample_transition_observed, true);
  assert.equal(unrelatedContext.pre_patch_counterexample_observed, false);
  assert.equal(unrelatedContext.protocol_observed, true);

  const negatedBoundary = parseCodexResult(
    capsuleTraceEvents({
      prePatchLedger: [
        "Clause→test ledger:",
        "- preserve behavior → existing regression",
        "- benchmark fixture change → focused change test",
        "Counterexample: behavior=case=fixture,value=current→case=fixture,value=changed→do not preserve current behavior",
      ].join("\n"),
    }).map(JSON.stringify).join("\n"),
    capsuleTraceOptions("debug"),
  ).workflow_trace.capsule_stage;
  assert.equal(negatedBoundary.pre_patch_counterexample_transition_observed, true);
  assert.equal(negatedBoundary.pre_patch_counterexample_observed, false);
  assert.equal(negatedBoundary.protocol_observed, true);

  const implicitNegatedBoundary = parseCodexResult(
    capsuleTraceEvents({
      prePatchLedger: [
        "Clause→test ledger:",
        "- preserve behavior → existing regression",
        "- benchmark fixture change → focused change test",
        "Counterexample: behavior=case=fixture,value=current→case=fixture,value=changed→fails to preserve current behavior",
      ].join("\n"),
    }).map(JSON.stringify).join("\n"),
    capsuleTraceOptions("debug"),
  ).workflow_trace.capsule_stage;
  assert.equal(implicitNegatedBoundary.pre_patch_counterexample_transition_observed, true);
  assert.equal(implicitNegatedBoundary.pre_patch_counterexample_observed, false);
  assert.equal(implicitNegatedBoundary.protocol_observed, true);

  for (const boundary of [
    "doesn't preserve current behavior",
    "doesn’t preserve current behavior",
  ]) {
    const contractionBoundary = parseCodexResult(
      capsuleTraceEvents({
        prePatchLedger: [
          "Clause→test ledger:",
          "- preserve behavior → existing regression",
          "- benchmark fixture change → focused change test",
          `Counterexample: behavior=case=fixture,value=current→case=fixture,value=changed→${boundary}`,
        ].join("\n"),
      }).map(JSON.stringify).join("\n"),
      capsuleTraceOptions("debug"),
    ).workflow_trace.capsule_stage;
    assert.equal(contractionBoundary.pre_patch_counterexample_transition_observed, true);
    assert.equal(contractionBoundary.pre_patch_counterexample_observed, false);
    assert.equal(contractionBoundary.protocol_observed, true);
  }

  const repeatedPacket = parseCodexResult(
    capsuleTraceEvents({
      prePatchProgress: [[
        "Clause→test ledger:",
        "- preserve behavior → existing regression",
        "- benchmark fixture change → focused change test",
        "Counterexample: behavior=current→changed→preserve current behavior",
      ].join("\n")],
    }).map(JSON.stringify).join("\n"),
    capsuleTraceOptions("debug"),
  ).workflow_trace.capsule_stage;
  assert.equal(repeatedPacket.pre_patch_clause_test_ledger_packet_count, 2);
  assert.equal(repeatedPacket.pre_patch_clause_test_ledger_structure_observed, false);
  assert.equal(repeatedPacket.protocol_observed, false);

  const repeatedHeaderInOneMessage = parseCodexResult(
    capsuleTraceEvents({
      prePatchLedger: [
        "Clause→test ledger:",
        "- preserve behavior → existing regression",
        "- benchmark fixture change → focused change test",
        "Counterexample: behavior=current→changed→preserve current behavior",
        "Clause→test ledger:",
      ].join("\n"),
    }).map(JSON.stringify).join("\n"),
    capsuleTraceOptions("debug"),
  ).workflow_trace.capsule_stage;
  assert.equal(repeatedHeaderInOneMessage.pre_patch_clause_test_ledger_packet_count, 2);
  assert.equal(repeatedHeaderInOneMessage.protocol_observed, false);

  const fencedPacket = parseCodexResult(
    capsuleTraceEvents({
      prePatchLedger: [
        "```text",
        "Clause→test ledger:",
        "- preserve behavior → existing regression",
        "- benchmark fixture change → focused change test",
        "Counterexample: behavior=current→changed→preserve current behavior",
        "```",
      ].join("\n"),
    }).map(JSON.stringify).join("\n"),
    capsuleTraceOptions("debug"),
  ).workflow_trace.capsule_stage;
  assert.equal(fencedPacket.pre_patch_clause_test_ledger_packet_count, 0);
  assert.equal(fencedPacket.protocol_observed, false);

  const lateEvents = capsuleTraceEvents({ prePatchLedger: null });
  const patchStart = lateEvents.findIndex((event) =>
    event.type === "item.started" && event.item?.type === "file_change"
  );
  lateEvents.splice(patchStart + 1, 0, {
    type: "item.completed",
    item: {
      type: "agent_message",
      text: "Here is the Clause→boundary ledger after PATCH started.",
    },
  });
  const lateStage = parseCodexResult(
    lateEvents.map(JSON.stringify).join("\n"),
    capsuleTraceOptions("debug"),
  ).workflow_trace.capsule_stage;
  assert.equal(lateStage.pre_patch_clause_test_ledger_observed, false);

  const promiseStage = parseCodexResult(
    capsuleTraceEvents({ prePatchLedger: "Clause→test ledger will follow." })
      .map(JSON.stringify)
      .join("\n"),
    capsuleTraceOptions("debug"),
  ).workflow_trace.capsule_stage;
  assert.equal(promiseStage.pre_patch_clause_test_ledger_observed, false);

  const duplicateStage = parseCodexResult(
    capsuleTraceEvents({
      finalMessage: "Clause→test ledger:\n- preserve behavior → tests pass",
    }).map(JSON.stringify).join("\n"),
    capsuleTraceOptions("debug"),
  ).workflow_trace.capsule_stage;
  assert.equal(duplicateStage.post_patch_clause_test_ledger_observed, true);
  assert.equal(duplicateStage.protocol_observed, false);

  const narrativeStage = parseCodexResult(
    capsuleTraceEvents({
      finalMessage: "Pre-PATCH clause→test ledger was emitted earlier; tests pass.",
    }).map(JSON.stringify).join("\n"),
    capsuleTraceOptions("debug"),
  ).workflow_trace.capsule_stage;
  assert.equal(narrativeStage.post_patch_clause_test_ledger_observed, false);
  assert.equal(narrativeStage.protocol_observed, true);

  const unrelatedStage = parseCodexResult(
    capsuleTraceEvents({
      prePatchLedger: "Clause→test ledger:\n- unrelated greeting → unrelated check",
    }).map(JSON.stringify).join("\n"),
    capsuleTraceOptions("debug"),
  ).workflow_trace.capsule_stage;
  assert.equal(unrelatedStage.pre_patch_clause_test_ledger_structure_observed, false);
  assert.equal(unrelatedStage.pre_patch_clause_test_ledger_observed, false);
  assert.equal(unrelatedStage.grounded_clause_test_mapping_count, 0);
  assert.equal(unrelatedStage.protocol_observed, false);

  const twoClauseOptions = {
    ...capsuleTraceOptions("debug"),
    expectedReviewContract: "Preserve current behavior. Reject malformed input.",
  };
  const missingClauseStage = parseCodexResult(
    capsuleTraceEvents().map(JSON.stringify).join("\n"),
    twoClauseOptions,
  ).workflow_trace.capsule_stage;
  assert.equal(missingClauseStage.pre_patch_clause_test_ledger_observed, true);
  assert.equal(missingClauseStage.distinct_boundary_coverage_observed, false);
  assert.equal(missingClauseStage.clause_coverage_observed, false);
  const reusedMappingStage = parseCodexResult(
    capsuleTraceEvents({
      prePatchLedger: "Clause→test ledger:\n- preserve behavior and reject input → one generic test",
    }).map(JSON.stringify).join("\n"),
    twoClauseOptions,
  ).workflow_trace.capsule_stage;
  assert.equal(reusedMappingStage.pre_patch_clause_test_ledger_observed, true);
  assert.equal(reusedMappingStage.distinct_boundary_coverage_observed, false);
  assert.equal(reusedMappingStage.clause_coverage_observed, false);
  const duplicatedPreserveStage = parseCodexResult(
    capsuleTraceEvents({
      prePatchLedger: [
        "Clause→test ledger:",
        "- preserve current behavior → behavior regression",
        "- preserve locale behavior → locale regression",
        "Counterexample: locale=valid→invalid→reject invalid locale",
      ].join("\n"),
    }).map(JSON.stringify).join("\n"),
    {
      ...capsuleTraceOptions("debug"),
      expectedReviewContract: "Preserve current behavior. Reject invalid locale.",
    },
  ).workflow_trace.capsule_stage;
  assert.equal(duplicatedPreserveStage.pre_patch_clause_test_ledger_observed, true);
  assert.equal(duplicatedPreserveStage.distinct_boundary_coverage_observed, false);
  assert.equal(duplicatedPreserveStage.clause_coverage_observed, false);
  assert.equal(duplicatedPreserveStage.protocol_observed, true);
  const duplicateBoundaryStage = parseCodexResult(
    capsuleTraceEvents({
      prePatchLedger: [
        "Clause→test ledger:",
        "- preserve cache identity → cache identity regression",
        "- preserve cache identity for loader → second cache identity test",
        "Counterexample: locale=en→fr→preserve locale normalization",
      ].join("\n"),
    }).map(JSON.stringify).join("\n"),
    {
      ...capsuleTraceOptions("debug"),
      expectedReviewContract:
        "Preserve cache identity. Preserve locale normalization.",
    },
  ).workflow_trace.capsule_stage;
  assert.equal(duplicateBoundaryStage.pre_patch_clause_test_ledger_observed, true);
  assert.equal(duplicateBoundaryStage.task_boundary_count, 2);
  assert.equal(duplicateBoundaryStage.distinct_boundary_coverage_observed, false);
  assert.equal(duplicateBoundaryStage.clause_coverage_observed, false);
  assert.equal(duplicateBoundaryStage.protocol_observed, true);
  const completeClauseStage = parseCodexResult(
    capsuleTraceEvents({
      prePatchLedger: [
        "Clause→test ledger:",
        "- preserve current behavior → existing regression",
        "- reject malformed input → rejection test",
      ].join("\n"),
    }).map(JSON.stringify).join("\n"),
    twoClauseOptions,
  ).workflow_trace.capsule_stage;
  assert.equal(completeClauseStage.pre_patch_clause_test_ledger_observed, true);

  const normalizedMarkerStage = parseCodexResult(
    capsuleTraceEvents({
      prePatchLedger: [
        "Clause→test ledger:",
        "- preserve cache identity → same-locale cache test",
        "- unambiguous cache identity → separator regression test",
        "Counterexample: cache identity=cache=welcome,value=en→cache=welcome,value=fr→unambiguous cache identity",
      ].join("\n"),
    }).map(JSON.stringify).join("\n"),
    {
      ...capsuleTraceOptions("debug"),
      expectedReviewContract: "Cache identity must remain unambiguous.",
    },
  ).workflow_trace.capsule_stage;
  assert.equal(normalizedMarkerStage.pre_patch_clause_test_ledger_observed, true);
  assert.equal(normalizedMarkerStage.protocol_observed, true);

  const naturalRouteStage = parseCodexResult(
    capsuleTraceEvents({
      routeDeclaration:
        "Routing selected: `leanpowers:route` workflow is `debug`; risk is `standard`; required gate is `[current_evidence]`.",
      validationCommand: `${capsuleReproductionContract.command} && npm test`,
    }).map(JSON.stringify).join("\n"),
    capsuleTraceOptions("debug"),
  ).workflow_trace.capsule_stage;
  assert.equal(naturalRouteStage.route_ledger_occurrences, 1);
  assert.equal(naturalRouteStage.ledger_before_tools_observed, true);
  assert.equal(naturalRouteStage.canonical_route_declaration_observed, false);
  assert.equal(naturalRouteStage.protocol_observed, true);

  const strictEscalationStage = parseCodexResult(
    capsuleTraceEvents({
      expectedWorkflow: "build",
      routeDeclaration: "leanpowers:route | workflow=build | risk=standard",
      prePatchProgress: ["leanpowers:risk | risk=strict"],
    }).map(JSON.stringify).join("\n"),
    capsuleTraceOptions("build"),
  ).workflow_trace.capsule_stage;
  assert.equal(strictEscalationStage.highest_presented_risk, "strict");
  assert.equal(strictEscalationStage.ordinary_stop_observed, null);

  for (const progress of [
    "New evidence raises this to risk=strict; independent review is required.",
    "New evidence means risk escalated to strict.",
    "Escalating the risk from standard to strict.",
    "Escalating from standard to strict risk.",
    "The risk is now strict.",
    "Switching this task to strict risk.",
    "Risk classification is strict.",
    "The risk has become strict.",
    "The risk is not strict.",
    "If validation fails, risk=strict.",
    "Unless validation succeeds, risk=strict.",
    "Maybe the risk escalated to strict.",
    "If validation fails, I am switching this task to strict risk.",
    "Switching this task to strict risk if validation fails.",
    "We decided against switching this task to strict risk.",
    "The fixture contains the literal string risk=strict for parser testing.",
    "Risk classification is not strict.",
    "The risk has not become strict.",
    "> leanpowers:risk | risk=strict",
    "```text\nleanpowers:risk | risk=strict\n```",
    "~~~text\nleanpowers:risk | risk=strict\n~~~",
    "    leanpowers:risk | risk=strict",
  ]) {
    const stage = parseCodexResult(
      capsuleTraceEvents({
        expectedWorkflow: "build",
        routeDeclaration: "leanpowers:route | workflow=build | risk=standard",
        prePatchProgress: [progress],
      }).map(JSON.stringify).join("\n"),
      capsuleTraceOptions("build"),
    ).workflow_trace.capsule_stage;
    assert.equal(stage.highest_presented_risk, "standard", progress);
  }

  const sameSentenceOptions = {
    ...capsuleTraceOptions("debug"),
    expectedReviewContract: "Accept only the exact format; reject drift and preserve compatibility.",
  };
  const collapsedSentenceStage = parseCodexResult(
    capsuleTraceEvents({
      prePatchLedger: "Clause→test ledger:\n- only exact reject preserve → one format test",
    }).map(JSON.stringify).join("\n"),
    sameSentenceOptions,
  ).workflow_trace.capsule_stage;
  assert.equal(collapsedSentenceStage.pre_patch_clause_test_ledger_observed, true);
  assert.equal(collapsedSentenceStage.distinct_boundary_coverage_observed, false);

  const asciiStage = parseCodexResult(
    capsuleTraceEvents({
      prePatchLedger: [
        "Clause->boundary ledger before edit:",
        "1) preserve backward compatibility -> integration contract",
        "2) integration contract compatibility -> boundary test",
        "Counterexample: compatibility=current→changed→preserve integration contract",
      ].join("\n"),
    }).map(JSON.stringify).join("\n"),
    {
      ...capsuleTraceOptions("debug"),
      expectedReviewContract:
        "Preserve backward compatibility for the integration contract.",
    },
  ).workflow_trace.capsule_stage;
  assert.equal(asciiStage.pre_patch_clause_test_ledger_observed, false);
  assert.equal(asciiStage.pre_patch_clause_test_ledger_packet_count, 0);
  assert.equal(asciiStage.protocol_observed, false);
});

test("capsule stages allow one evidence-backed retry without hiding its cost", () => {
  const malformedQuotedRead = [
    "/bin/zsh -lc \"printf '",
    "--- src/index.mjs ---",
    "cat src/index.mjs",
    "printf '",
    "--- test/index.test.mjs ---",
    "cat test/index.test.mjs\"",
  ].join("\n");
  const stage = parseCodexResult(
    capsuleTraceEvents({
      failedDiscoverAttempts: [{
        command: "/bin/zsh -lc \"rg --files .; rg -n -- 'cache|locale' .\"",
        output: "zsh: rg: interrupted",
        exitCode: 1,
      }],
      failedReadAttempts: [{
        command: malformedQuotedRead,
        output: "zsh: command not found: --- src/index.mjs ---",
        exitCode: 0,
      }],
    }).map(JSON.stringify).join("\n"),
    capsuleTraceOptions("debug"),
  ).workflow_trace.capsule_stage;

  assert.equal(stage.protocol_observed, true);
  assert.equal(stage.pre_change_stage_protocol_observed, true);
  assert.equal(stage.pre_change_command_calls, 5);
  assert.equal(stage.stage_retry_calls, 2);
  assert.deepEqual(stage.stage_attempts, { discover: 2, read: 2, reproduce: 1 });
  assert.equal(stage.unexpected_pre_change_command_calls, 0);
});

test("capsule stages reject malformed fake reads, excess retries, and post-success rereads", () => {
  const malformedQuotedRead = "/bin/zsh -lc \"printf 'cat src/index.mjs; cat test/index.test.mjs'\"";
  const mutations = [
    {
      readCommand: malformedQuotedRead,
    },
    {
      failedReadAttempts: [
        { command: "tail -n +1 src/index.mjs", output: "source", exitCode: 1 },
        { command: "tail -n +1 test/index.test.mjs", output: "test", exitCode: 1 },
      ],
    },
    {
      extraReadAfterSuccess: true,
    },
  ];

  for (const mutation of mutations) {
    const stage = parseCodexResult(
      capsuleTraceEvents(mutation).map(JSON.stringify).join("\n"),
      capsuleTraceOptions("debug"),
    ).workflow_trace.capsule_stage;
    assert.equal(stage.protocol_observed, false);
    assert.equal(stage.pre_change_stage_protocol_observed, false);
  }
});

test("capsule retries require concrete evidence and completed stages never reopen", () => {
  const cleanFakeRead = [
    "/bin/zsh -lc \"printf '",
    "tail -n +1 -- src/index.mjs",
    "tail -n +1 -- test/index.test.mjs",
    "'\"",
  ].join("\n");
  const unsupportedRetry = parseCodexResult(
    capsuleTraceEvents({
      failedReadAttempts: [{
        command: cleanFakeRead,
        output: "fabricated source and test contents",
        exitCode: 0,
      }],
    }).map(JSON.stringify).join("\n"),
    capsuleTraceOptions("debug"),
  ).workflow_trace.capsule_stage;
  assert.equal(unsupportedRetry.read_observed, true);
  assert.equal(unsupportedRetry.malformed_read_calls, 1);
  assert.equal(unsupportedRetry.unexpected_pre_change_command_calls, 1);
  assert.equal(unsupportedRetry.pre_change_stage_protocol_observed, false);

  const emptyReadRetry = parseCodexResult(
    capsuleTraceEvents({
      failedReadAttempts: [{
        command: "tail -n +1 -- src/index.mjs test/index.test.mjs package.json",
        output: "",
        exitCode: 0,
      }],
    }).map(JSON.stringify).join("\n"),
    capsuleTraceOptions("debug"),
  ).workflow_trace.capsule_stage;
  assert.equal(emptyReadRetry.protocol_observed, true);
  assert.equal(emptyReadRetry.stage_retry_calls, 1);
  assert.equal(emptyReadRetry.malformed_read_calls, 1);

  const reproductionRetry = parseCodexResult(
    capsuleTraceEvents({
      failedReproductionAttempts: [{
        output: "temporary runtime failure",
        exitCode: 1,
      }],
    }).map(JSON.stringify).join("\n"),
    capsuleTraceOptions("debug"),
  ).workflow_trace.capsule_stage;
  assert.equal(reproductionRetry.protocol_observed, true);
  assert.equal(reproductionRetry.stage_retry_calls, 1);
  assert.deepEqual(reproductionRetry.stage_attempts, {
    discover: 1,
    read: 1,
    reproduce: 2,
  });

  const reopenedRead = parseCodexResult(
    capsuleTraceEvents({ extraReadAfterReproduce: true }).map(JSON.stringify).join("\n"),
    capsuleTraceOptions("debug"),
  ).workflow_trace.capsule_stage;
  assert.equal(reopenedRead.protocol_observed, false);
  assert.equal(reopenedRead.extra_read_calls, 1);
  assert.equal(reopenedRead.unexpected_pre_change_command_calls, 1);
});

test("lean and standard capsules stop every tool after successful validation", () => {
  const stage = parseCodexResult(
    capsuleTraceEvents({ postValidationReview: true }).map(JSON.stringify).join("\n"),
    capsuleTraceOptions("debug"),
  ).workflow_trace.capsule_stage;

  assert.equal(stage.validation_observed, true);
  assert.equal(stage.post_validation_tool_calls, 2);
  assert.equal(stage.ordinary_stop_observed, false);
  assert.equal(stage.protocol_observed, false);
});

test("quality validation uses the latest relevant test and reproduction evidence", () => {
  const completedCommand = (command, exitCode = 0) => ({
    type: "item.completed",
    item: {
      type: "command_execution",
      command,
      aggregated_output: exitCode === 0 ? "pass" : "fail",
      exit_code: exitCode,
      status: "completed",
    },
  });
  const stageWithCommandAfterCombined = (command, exitCode) => {
    const events = capsuleTraceEvents();
    const combinedIndex = events.findIndex(({ item }) =>
      item?.type === "command_execution" &&
      String(item.command).includes(" && npm test")
    );
    assert.notEqual(combinedIndex, -1);
    events.splice(combinedIndex + 1, 0, completedCommand(command, exitCode));
    return parseCodexResult(
      events.map(JSON.stringify).join("\n"),
      capsuleTraceOptions("debug"),
    ).workflow_trace.capsule_stage;
  };

  const fresherPassingTest = stageWithCommandAfterCombined("npm test", 0);
  assert.equal(fresherPassingTest.quality_validation_observed, true);
  assert.equal(fresherPassingTest.quality_validation_mode, "separate");

  const fresherFailingTest = stageWithCommandAfterCombined("npm test", 1);
  assert.equal(fresherFailingTest.quality_validation_observed, false);

  const laterFailingReproduction = stageWithCommandAfterCombined(
    capsuleReproductionContract.command,
    1,
  );
  assert.equal(laterFailingReproduction.quality_validation_observed, false);

  const separated = capsuleTraceEvents({ separatePostReproduction: true });
  const reproductionIndex = separated.findLastIndex(({ item }) =>
    item?.type === "command_execution" &&
    item.command === capsuleReproductionContract.command
  );
  assert.notEqual(reproductionIndex, -1);
  separated.splice(
    reproductionIndex + 1,
    0,
    completedCommand("git status --short"),
  );
  const readBetweenEvidence = parseCodexResult(
    separated.map(JSON.stringify).join("\n"),
    capsuleTraceOptions("debug"),
  ).workflow_trace.capsule_stage;
  assert.equal(readBetweenEvidence.validation_observed, false);
  assert.equal(readBetweenEvidence.quality_validation_observed, true);
  assert.equal(readBetweenEvidence.quality_validation_mode, "separate");
});

test("distilled live failures preserve quality-bearing stage truth", () => {
  const failedDiscoverThenNoncanonicalRetry = parseCodexResult(
    capsuleTraceEvents({
      discoverCommand: "rg -n -- 'localized|locale|template|cache' src test repro",
      failedDiscoverAttempts: [{
        command: "rg --files . | head -n 300; rg -n -- 'localized|locale|template|cache' src/**/*.js",
        output: "zsh: no matches found: src/**/*.js",
        exitCode: 1,
      }],
      extraReadAfterReproduce: true,
    }).map(JSON.stringify).join("\n"),
    capsuleTraceOptions("debug"),
  ).workflow_trace.capsule_stage;
  assert.equal(failedDiscoverThenNoncanonicalRetry.discover_observed, false);
  assert.equal(failedDiscoverThenNoncanonicalRetry.protocol_observed, false);
  assert.equal(failedDiscoverThenNoncanonicalRetry.stage_attempts.discover, 1);
  assert.ok(failedDiscoverThenNoncanonicalRetry.out_of_order_stage_calls >= 3);

  const malformedReadWithDiagnostic = [
    "/bin/zsh -lc \"printf '",
    "--- src/index.mjs ---",
    "cat src/index.mjs",
    "printf '",
    "--- package.json ---",
    "cat package.json\"",
  ].join("\n");
  const recoveredRead = parseCodexResult(
    capsuleTraceEvents({
      failedReadAttempts: [{
        command: malformedReadWithDiagnostic,
        output: "printf zsh:5: command not found: --- src/index.mjs ---",
        exitCode: 0,
      }],
    }).map(JSON.stringify).join("\n"),
    capsuleTraceOptions("debug"),
  ).workflow_trace.capsule_stage;
  assert.equal(recoveredRead.protocol_observed, true);
  assert.equal(recoveredRead.malformed_read_calls, 1);
  assert.equal(recoveredRead.stage_retry_calls, 1);

  const oldChainedRetry = parseCodexResult(
    capsuleTraceEvents({
      failedReadAttempts: [{
        command: malformedReadWithDiagnostic,
        output: "printf zsh:5: command not found: --- src/index.mjs ---",
        exitCode: 0,
      }],
      readCommand: "echo source; cat src/index.mjs; cat test/index.test.mjs; cat package.json",
      postValidationReview: true,
    }).map(JSON.stringify).join("\n"),
    capsuleTraceOptions("debug"),
  ).workflow_trace.capsule_stage;
  assert.equal(oldChainedRetry.read_observed, false);
  assert.equal(oldChainedRetry.post_validation_tool_calls, 2);
  assert.equal(oldChainedRetry.ordinary_stop_observed, false);
  assert.equal(oldChainedRetry.protocol_observed, false);
});

test("distilled real r1 trace preserves quality and capsule budget", () => {
  const canonicalRoute = [
    "entrypoint: leanpowers:route",
    "workflow: debug",
    "risk: standard",
    "required_gates: [current_evidence]",
  ].join("\n");
  const parsed = parseCodexResult(
    capsuleTraceEvents({
      finalMessage: canonicalRoute,
      routeDeclaration:
        "Starting in workflow `leanpowers:route` with `OWNER=debug` and `RISK=standard`. I will inspect first.",
    }).map(JSON.stringify).join("\n"),
    capsuleTraceOptions("debug"),
  );
  const stage = parsed.workflow_trace.capsule_stage;
  assert.equal(stage.route_ledger_occurrences, 2);
  assert.equal(stage.route_declarations_consistent, true);
  assert.equal(stage.ledger_before_tools_observed, true);
  assert.equal(stage.quality_pre_change_evidence_observed, true);
  assert.equal(stage.quality_validation_observed, true);
  assert.equal(stage.protocol_observed, true);
  assert.deepEqual(evaluateWorkflowConformance({
    activation_reported: true,
    declared_risk: "standard",
    declared_workflow: "debug",
    expected_workflow: "debug",
    risk_level: "standard",
    route_ledger_reported: true,
    telemetry: { workflow_trace: parsed.workflow_trace },
    workflow: "leanpowers-0.2.0",
  }), { status: "PASS", reasons: [] });
});

test("distilled real r2 route requires exact reproduction replay after patch", () => {
  const events = capsuleTraceEvents({
    discoverCommand: "rg -n -- 'cache|locale' src test",
    extraPostCommand: true,
    patchBatches: 2,
    routeDeclaration:
      "Starting with the `leanpowers:route` workflow: owner=`debug`, risk=`standard`.",
  });
  const readIndex = events.findIndex(({ item }) =>
    item?.type === "command_execution" &&
    String(item.command).includes("tail -n +1 --")
  );
  assert.notEqual(readIndex, -1);
  events.splice(readIndex, 1, {
    type: "item.completed",
    item: {
      type: "command_execution",
      command: "head -n 200 -- src/index.mjs",
      aggregated_output: "src/index.mjs contents",
      exit_code: 0,
      status: "completed",
    },
  });
  const firstPatchCompletion = events.findIndex(({ type, item }) =>
    type === "item.completed" && item?.type === "file_change"
  );
  assert.notEqual(firstPatchCompletion, -1);
  events.splice(firstPatchCompletion + 1, 0, {
    type: "item.completed",
    item: {
      type: "command_execution",
      command: "sed -n '1,240p' test/index.test.mjs",
      aggregated_output: "test/index.test.mjs contents",
      exit_code: 0,
      status: "completed",
    },
  });
  const validationIndex = events.findIndex(({ item }) =>
    item?.type === "command_execution" &&
    String(item.command).includes(" && npm test")
  );
  assert.notEqual(validationIndex, -1);
  events.splice(validationIndex, 0, {
    type: "item.completed",
    item: {
      type: "command_execution",
      command: "cat package.json",
      aggregated_output: "package metadata",
      exit_code: 0,
      status: "completed",
    },
  });

  const parsed = parseCodexResult(
    events.map(JSON.stringify).join("\n"),
    capsuleTraceOptions("debug"),
  );
  const stage = parsed.workflow_trace.capsule_stage;
  assert.equal(stage.route_ledger_occurrences, 1);
  assert.equal(stage.route_declarations_consistent, true);
  assert.equal(stage.ledger_before_tools_observed, true);
  assert.equal(stage.discover_observed, false);
  assert.equal(stage.pre_change_stage_protocol_observed, false);
  assert.equal(stage.quality_pre_change_evidence_observed, true);
  assert.equal(stage.quality_patch_observed, true);
  assert.equal(stage.validation_observed, false);
  assert.equal(stage.quality_validation_observed, true);
  assert.equal(stage.quality_post_validation_tool_calls, 1);
  assert.equal(stage.quality_ordinary_stop_observed, false);
  assert.equal(stage.protocol_observed, false);
  assert.deepEqual(evaluateWorkflowConformance({
    activation_reported: true,
    declared_risk: "standard",
    declared_workflow: "debug",
    expected_workflow: "debug",
    risk_level: "standard",
    route_ledger_reported: true,
    telemetry: { workflow_trace: parsed.workflow_trace },
    workflow: "leanpowers-0.2.0",
  }), { status: "PASS", reasons: [] });

  const missingReplayEvents = structuredClone(events);
  const combinedValidation = missingReplayEvents.find(({ item }) =>
    item?.type === "command_execution" &&
    String(item.command).includes(" && npm test")
  );
  assert.ok(combinedValidation);
  combinedValidation.item.command = "npm test";
  const missingReplay = parseCodexResult(
    missingReplayEvents.map(JSON.stringify).join("\n"),
    capsuleTraceOptions("debug"),
  );
  assert.equal(
    missingReplay.workflow_trace.capsule_stage.quality_validation_observed,
    false,
  );
  assert.deepEqual(evaluateWorkflowConformance({
    activation_reported: true,
    declared_risk: "standard",
    declared_workflow: "debug",
    expected_workflow: "debug",
    risk_level: "standard",
    route_ledger_reported: true,
    telemetry: { workflow_trace: missingReplay.workflow_trace },
    workflow: "leanpowers-0.2.0",
  }), {
    status: "FAIL",
    reasons: ["supported successful post-edit validation was not observed"],
  });
});

test("capsule READ accepts one boundary-preserving tail batch and requires grounded paths", () => {
  const portableBatch = parseCodexResult(
    capsuleTraceEvents({
      readCommand: "tail -n +1 -- 'src/index.mjs' \"test/index.test.mjs\" package.json",
    }).map(JSON.stringify).join("\n"),
    capsuleTraceOptions("debug"),
  ).workflow_trace.capsule_stage;
  assert.equal(portableBatch.protocol_observed, true);
  assert.equal(portableBatch.validation_metadata_read_observed, true);

  const diagnosticWordsInSource = parseCodexResult(
    capsuleTraceEvents({
      discoverOutput: [
        "src/index.mjs",
        "test/index.test.mjs",
        "package.json",
        "src/index.mjs:1:syntax error",
        "src/index.mjs:2:printf zsh:5: command not found: ---",
        "test/index.test.mjs:4:assert.match(error, /command not found/)",
      ].join("\n"),
      readOutput: [
        "syntax error",
        "printf zsh:5: command not found: ---",
        "assert.match(error, /command not found/)",
      ].join("\n"),
    }).map(JSON.stringify).join("\n"),
    capsuleTraceOptions("debug"),
  ).workflow_trace.capsule_stage;
  assert.equal(
    diagnosticWordsInSource.protocol_observed,
    true,
    JSON.stringify(diagnosticWordsInSource),
  );

  const omittedPatchTargets = parseCodexResult(
    capsuleTraceEvents({
      readCommand: "tail -n +1 -- package.json README.md",
    }).map(JSON.stringify).join("\n"),
    capsuleTraceOptions("debug"),
  ).workflow_trace.capsule_stage;
  assert.equal(omittedPatchTargets.read_observed, true);
  assert.equal(omittedPatchTargets.validation_metadata_read_observed, true);
  assert.equal(omittedPatchTargets.patch_targets_read_observed, false);
  assert.equal(omittedPatchTargets.protocol_observed, false);

  const omittedCaller = parseCodexResult(
    capsuleTraceEvents({
      discoverOutput: [
        "src/index.mjs",
        "src/caller.mjs",
        "test/index.test.mjs",
        "package.json",
        "src/index.mjs:1:cache",
        "src/caller.mjs:3:cache",
        "test/index.test.mjs:1:test",
      ].join("\n"),
    }).map(JSON.stringify).join("\n"),
    capsuleTraceOptions("debug"),
  ).workflow_trace.capsule_stage;
  assert.deepEqual(omittedCaller.grounded_candidate_paths, [
    "src/caller.mjs",
    "src/index.mjs",
    "test/index.test.mjs",
  ]);
  assert.deepEqual(omittedCaller.required_read_paths, [
    "src/caller.mjs",
    "src/index.mjs",
    "test/index.test.mjs",
  ]);
  assert.equal(omittedCaller.patch_targets_read_observed, true);
  assert.equal(omittedCaller.grounded_candidates_read_observed, false);
  assert.equal(omittedCaller.protocol_observed, false);

  const undiscoveredPatchTargets = parseCodexResult(
    capsuleTraceEvents({
      discoverOutput: [
        "src/other.mjs",
        "test/other.test.mjs",
        "package.json",
        "src/other.mjs:1:cache",
        "test/other.test.mjs:1:test",
      ].join("\n"),
      readCommand: "tail -n +1 -- src/other.mjs test/other.test.mjs package.json",
    }).map(JSON.stringify).join("\n"),
    capsuleTraceOptions("debug"),
  ).workflow_trace.capsule_stage;
  assert.deepEqual(undiscoveredPatchTargets.required_read_paths, [
    "src/index.mjs",
    "src/other.mjs",
    "test/index.test.mjs",
    "test/other.test.mjs",
  ]);
  assert.equal(undiscoveredPatchTargets.patch_targets_read_observed, false);
  assert.equal(undiscoveredPatchTargets.grounded_candidates_read_observed, true);
  assert.equal(undiscoveredPatchTargets.protocol_observed, false);

  const omittedManifest = parseCodexResult(
    capsuleTraceEvents({
      readCommand: "tail -n +1 -- src/index.mjs test/index.test.mjs",
    }).map(JSON.stringify).join("\n"),
    capsuleTraceOptions("debug"),
  ).workflow_trace.capsule_stage;
  assert.equal(omittedManifest.read_observed, true);
  assert.equal(omittedManifest.validation_metadata_read_observed, false);
  assert.equal(omittedManifest.protocol_observed, false);

  for (const readCommand of [
    "tail -n +1 -- =cat src/index.mjs package.json",
    "tail -n +1 -- ~/secret src/index.mjs package.json",
    "tail -n +1 -- src/index.mjs package.json # test/index.test.mjs",
    "/bin/zsh -lc \"tail -n +1 -- src\\index.mjs test\\index.test.mjs package.json\"",
  ]) {
    const unsafe = parseCodexResult(
      capsuleTraceEvents({ readCommand }).map(JSON.stringify).join("\n"),
      capsuleTraceOptions("debug"),
    ).workflow_trace.capsule_stage;
    assert.equal(unsafe.read_observed, false, readCommand);
    assert.equal(unsafe.protocol_observed, false, readCommand);
  }
});

test("debug capsule stage protocol rejects one-property trace regressions", () => {
  const trailingWhitespaceLedger = [
    "entrypoint: leanpowers:route  ",
    "workflow: debug  ",
    "risk: standard  ",
    "required_gates: [current_evidence]  ",
    "",
    "Done",
  ].join("\n");
  for (const mutation of [
    { duplicateLedger: true },
    { finalMessage: trailingWhitespaceLedger },
    {
      finalMessage:
        "`leanpowers:route | workflow=debug | risk=standard` was used for this task.",
    },
  ]) {
    const repeatedRoute = parseCodexResult(
      capsuleTraceEvents(mutation).map(JSON.stringify).join("\n"),
      capsuleTraceOptions("debug"),
    ).workflow_trace.capsule_stage;
    assert.equal(repeatedRoute.route_ledger_occurrences, 2);
    assert.equal(repeatedRoute.route_declarations_consistent, true);
    assert.equal(repeatedRoute.ledger_keys_after_initial_observed, false);
    assert.equal(repeatedRoute.protocol_observed, true);
  }
  for (const initialExtra of [
    "leanpowers:risk | risk=strict",
    "leanpowers:route | workflow=debug | risk=strict | gates=[independent_review, current_evidence]",
  ]) {
    const sameMessageUpgrade = parseCodexResult(
      capsuleTraceEvents({
        routeDeclaration:
          "leanpowers:route | workflow=debug | risk=standard",
        initialExtra,
      }).map(JSON.stringify).join("\n"),
      capsuleTraceOptions("debug"),
    ).workflow_trace.capsule_stage;
    assert.equal(sameMessageUpgrade.route_declarations_consistent, true);
    assert.equal(sameMessageUpgrade.risk_monotonic_observed, true);
    assert.equal(sameMessageUpgrade.highest_presented_risk, "strict");
    assert.equal(sameMessageUpgrade.protocol_observed, true);
  }

  const hiddenBeforeVisibleRoute = parseCodexResult(
    capsuleTraceEvents({
      routeDeclaration: [
        "```text",
        "leanpowers:route | workflow=build | risk=strict | gates=[independent_review, current_evidence]",
        "Activation failed.",
        "```",
        "> leanpowers:route | workflow=build | risk=strict | gates=[independent_review, current_evidence]",
        "    leanpowers:route | workflow=build | risk=strict | gates=[independent_review, current_evidence]",
        "leanpowers:route | workflow=debug | risk=standard",
      ].join("\n"),
    }).map(JSON.stringify).join("\n"),
    capsuleTraceOptions("debug"),
  ).workflow_trace.capsule_stage;
  assert.equal(hiddenBeforeVisibleRoute.route_ledger_occurrences, 1);
  assert.equal(hiddenBeforeVisibleRoute.route_declarations_consistent, true);
  assert.equal(hiddenBeforeVisibleRoute.highest_presented_risk, "standard");
  assert.equal(hiddenBeforeVisibleRoute.ledger_before_tools_observed, true);
  assert.equal(hiddenBeforeVisibleRoute.protocol_observed, true);

  const listFencedExample = parseCodexResult(
    capsuleTraceEvents({
      initialExtra: [
        "- ```text",
        "  leanpowers:route | workflow=build | risk=strict | gates=[independent_review, current_evidence]",
        "  leanpowers:risk | risk=strict",
        "  ```",
      ].join("\n"),
    }).map(JSON.stringify).join("\n"),
    capsuleTraceOptions("debug"),
  ).workflow_trace.capsule_stage;
  assert.equal(listFencedExample.route_ledger_occurrences, 1);
  assert.equal(listFencedExample.route_declarations_consistent, true);
  assert.equal(listFencedExample.highest_presented_risk, "standard");
  assert.equal(listFencedExample.protocol_observed, true);

  for (const finalMessage of [
    "Not using leanpowers:route | workflow=debug | risk=standard",
    [
      "Not using leanpowers:route",
      "workflow: debug",
      "risk: standard",
      "required_gates: [current_evidence]",
    ].join("\n"),
    [
      "Maybe leanpowers:route",
      "workflow: debug",
      "risk: strict",
      "required_gates: [independent_review, current_evidence]",
    ].join("\n"),
  ]) {
    const negatedStructuredRepeat = parseCodexResult(
      capsuleTraceEvents({ finalMessage }).map(JSON.stringify).join("\n"),
      capsuleTraceOptions("debug"),
    ).workflow_trace.capsule_stage;
    assert.equal(negatedStructuredRepeat.route_ledger_occurrences, 2);
    assert.equal(negatedStructuredRepeat.route_declarations_consistent, false);
    assert.equal(negatedStructuredRepeat.protocol_observed, false);
  }

  const looseLedgerKey = parseCodexResult(
    capsuleTraceEvents({ finalMessage: "workflow: debug" })
      .map(JSON.stringify).join("\n"),
    capsuleTraceOptions("debug"),
  ).workflow_trace.capsule_stage;
  assert.equal(looseLedgerKey.route_ledger_occurrences, 1);
  assert.equal(looseLedgerKey.ledger_keys_after_initial_observed, true);
  assert.equal(looseLedgerKey.protocol_observed, true);
  const upgradedRisk = parseCodexResult(
    capsuleTraceEvents({
      prePatchProgress: ["leanpowers:risk | risk=strict"],
    }).map(JSON.stringify).join("\n"),
    capsuleTraceOptions("debug"),
  ).workflow_trace.capsule_stage;
  assert.equal(upgradedRisk.highest_presented_risk, "strict");
  assert.equal(upgradedRisk.risk_monotonic_observed, true);
  assert.equal(upgradedRisk.protocol_observed, true);

  const upgradedRoute = parseCodexResult(
    capsuleTraceEvents({
      prePatchProgress: [
        "leanpowers:route | workflow=debug | risk=strict | gates=[independent_review, current_evidence]",
      ],
    }).map(JSON.stringify).join("\n"),
    capsuleTraceOptions("debug"),
  ).workflow_trace.capsule_stage;
  assert.equal(upgradedRoute.route_ledger_occurrences, 2);
  assert.equal(upgradedRoute.route_declarations_consistent, true);
  assert.equal(upgradedRoute.risk_monotonic_observed, true);
  assert.equal(upgradedRoute.highest_presented_risk, "strict");
  assert.equal(upgradedRoute.protocol_observed, true);

  const downgradedRisk = parseCodexResult(
    capsuleTraceEvents({
      prePatchProgress: ["leanpowers:risk | risk=strict"],
      finalMessage: [
        "entrypoint: leanpowers:route",
        "workflow: debug",
        "risk: standard",
        "required_gates: [current_evidence]",
      ].join("\n"),
    }).map(JSON.stringify).join("\n"),
    capsuleTraceOptions("debug"),
  ).workflow_trace.capsule_stage;
  assert.equal(downgradedRisk.route_declarations_consistent, true);
  assert.equal(downgradedRisk.highest_presented_risk, "strict");
  assert.equal(downgradedRisk.risk_monotonic_observed, false);
  assert.equal(downgradedRisk.protocol_observed, false);

  const invalidStrictGates = parseCodexResult(
    capsuleTraceEvents({
      prePatchProgress: [
        "leanpowers:route | workflow=debug | risk=strict | gates=[current_evidence]",
      ],
    }).map(JSON.stringify).join("\n"),
    capsuleTraceOptions("debug"),
  ).workflow_trace.capsule_stage;
  assert.equal(invalidStrictGates.route_declarations_consistent, false);
  assert.equal(invalidStrictGates.highest_presented_risk, "strict");
  assert.equal(invalidStrictGates.protocol_observed, false);

  const deniedLegacyRepeat = parseCodexResult(
    capsuleTraceEvents({
      finalMessage: [
        "entrypoint: leanpowers:route  ",
        "workflow: debug  ",
        "risk: standard  ",
        "required_gates: [current_evidence]  ",
        "",
        "Activation failed.",
      ].join("\n"),
    }).map(JSON.stringify).join("\n"),
    capsuleTraceOptions("debug"),
  ).workflow_trace.capsule_stage;
  assert.equal(deniedLegacyRepeat.route_ledger_occurrences, 2);
  assert.equal(deniedLegacyRepeat.route_declarations_consistent, false);
  assert.equal(deniedLegacyRepeat.ledger_before_tools_observed, true);
  assert.equal(deniedLegacyRepeat.protocol_observed, false);

  for (const mutation of [
    {
      routeDeclaration: [
        "entrypoint: leanpowers:route",
        "workflow: debug",
        "risk: standard",
        "required_gates: [current_evidence]",
        "Starting without the required blank separator.",
      ].join("\n"),
    },
    {
      finalMessage: [
        "entrypoint: leanpowers:route",
        "workflow: debug",
        "risk: standard",
        "required_gates: [current_evidence]",
        "Done without the required blank separator.",
      ].join("\n"),
    },
    {
      routeDeclaration: [
        "entrypoint: leanpowers:route",
        "workflow: debug",
        "risk: standard",
        "required_gates: [current_evidence]",
        "",
        "",
        "Starting after two blank lines.",
      ].join("\n"),
    },
    {
      finalMessage: [
        "entrypoint: leanpowers:route",
        "workflow: debug",
        "risk: standard",
        "required_gates: [current_evidence]",
        "",
        "",
        "Done after two blank lines.",
      ].join("\n"),
    },
  ]) {
    const malformedLegacySuffix = parseCodexResult(
      capsuleTraceEvents(mutation).map(JSON.stringify).join("\n"),
      capsuleTraceOptions("debug"),
    ).workflow_trace.capsule_stage;
    assert.equal(malformedLegacySuffix.route_declarations_consistent, false);
    assert.equal(malformedLegacySuffix.protocol_observed, false);
  }

  const cases = [
    [{ finalMessage: "leanpowers:route | workflow=build | risk=standard" }, "route_declarations_consistent"],
    [{ ledgerAfterDiscover: true }, "ledger_before_tools_observed"],
    [{ workflowRead: true }, "workflow_read_calls"],
    [{ discoverCommand: "rg -n -- 'cache|locale' ." }, "discover_observed"],
    [{ discoverCommand: "rg --files; rg -n -- 'cache|locale' ." }, "discover_observed"],
    [{ discoverCommand: "rg --files .; rg -n -- 'cache|locale'" }, "discover_observed"],
    [{ discoverCommand: "rg --files .; rg -n -- 'cache|locale' /tmp/workspace ." }, "discover_observed"],
    [{ discoverCommand: String.raw`rg --files .; rg -n -- 'cache\|locale' .` }, "discover_observed"],
    [{ discoverCommand: "rg --files .; rg -n -- \"cache|locale\" ." }, "discover_observed"],
    [{ discoverCommand: "rg --files .; rg -n -- {cache,..} ." }, "discover_observed"],
    [{ discoverCommand: "rg --files .; rg -n -f ../patterns ." }, "discover_observed"],
    [{ discoverCommand: "rg --files .; rg -n '--no-ignore' ." }, "discover_observed"],
    [{ discoverCommand: "rg --files .; rg -n '--pre=/bin/cat' ." }, "discover_observed"],
    [{ discoverCommand: "rg --files .; rg -n -- '.' ." }, "discover_observed"],
    [{ discoverCommand: "rg --files .; rg -n -- '.*' ." }, "discover_observed"],
    [{ discoverCommand: "rg --files .; rg -n -- '.' src test" }, "discover_observed"],
    [{ discoverCommand: "rg --files .; rg --sort path -n -- '.' ." }, "discover_observed"],
    [{ discoverCommand: "cd . && rg --files .; rg -n -- 'cache|locale' ." }, "discover_observed"],
    [{ discoverCommand: "cd /tmp/workspace && rg --files .; rg -n -- 'cache|locale' ." }, "discover_observed"],
    [{ discoverCommand: "cd$IFS/tmp/workspace && rg --files .; rg -n -- 'cache|locale' ." }, "discover_observed"],
    [{ discoverCommand: "pushd /tmp/workspace; rg --files .; rg -n -- 'cache|locale' ." }, "discover_observed"],
    [{ discoverCommand: "command -- cd /tmp/workspace; rg --files .; rg -n -- 'cache|locale' ." }, "discover_observed"],
    [{ discoverCommand: "eval 'cd /tmp/workspace'; rg --files .; rg -n -- 'cache|locale' ." }, "discover_observed"],
    [{ discoverCommand: "runner=cd; $runner /tmp/workspace; rg --files .; rg -n -- 'cache|locale' ." }, "discover_observed"],
    [{ discoverCommand: "rg --files .; rg -n -- \"$(cd /tmp/workspace && printf cache)\" ." }, "discover_observed"],
    [{ discoverCommand: "rg --files .; rg -n -- \"can't $(cd /tmp/workspace && printf cache)\" ." }, "discover_observed"],
    [{ discoverCommand: "rg --files .; rg -n -- \"`cd /tmp/workspace; printf cache`\" ." }, "discover_observed"],
    [{ discoverCommand: "rg --files .; rg -n -- cache <(printf cache) ." }, "discover_observed"],
    [{ discoverCommand: "rg --files .; rg -n -- cache =(printf cache) ." }, "discover_observed"],
    [{
      discoverCommand: "rg --files . | rg -n -- 'src|test' .",
      discoverOutput: "1:src/index.mjs\n2:test/index.test.mjs",
    }, "discover_observed"],
    [{ readCommand: "cat src/index.mjs" }, "read_observed"],
    [{ reproduceCommand: "npm test", reproduceOutput: "pass" }, "reproduce_observed"],
    [{ reproduceOutput: "arbitrary executable output" }, "reproduce_observed"],
    [{ patchBatches: 2 }, "patch_batches"],
    [{ patchPaths: ["src/index.mjs", "src/helper.mjs"] }, "test_patch_observed"],
    [{ nonReviewTail: true }, "patch_batches"],
    [{ validationExitCode: 1 }, "validation_observed"],
    [{ validationCommand: "node -e \"console.log('test')\"" }, "validation_observed"],
    [{ validationCommand: "npm --version test" }, "validation_observed"],
    [{ validationCommand: "node --test --help" }, "validation_observed"],
    [{ validationCommand: "npm run test --if-present" }, "validation_observed"],
    [{ validationCommand: "cargo test --no-run" }, "validation_observed"],
    [{ validationCommand: "pytest --collect-only" }, "validation_observed"],
    [{ validationCommand: "node repro/other.mjs && npm test" }, "validation_observed"],
    [{
      validationCommand: `npm test && ${capsuleReproductionContract.command}`,
    }, "validation_observed"],
    [{
      validationCommand: `${capsuleReproductionContract.command} && npm test && npm test`,
    }, "validation_observed"],
    [{
      validationCommand: `${capsuleReproductionContract.command} || npm test`,
    }, "validation_observed"],
    [{
      validationCommand: `${capsuleReproductionContract.command}; npm test`,
    }, "validation_observed"],
    [{
      validationCommand: `${capsuleReproductionContract.command} | npm test`,
    }, "validation_observed"],
    [{ extraPreCommand: true }, "pre_change_command_calls"],
    [{ extraPostCommand: true }, "post_change_command_calls"],
    [{ postValidationReview: true }, "ordinary_stop_observed"],
  ];

  for (const [mutation, field] of cases) {
    const stage = parseCodexResult(
      capsuleTraceEvents(mutation).map(JSON.stringify).join("\n"),
      capsuleTraceOptions("debug"),
    ).workflow_trace.capsule_stage;
    assert.equal(stage.protocol_observed, false, field);
    assert.notDeepEqual(stage[field], passingCapsuleStage("debug")[field], field);
    if (field === "route_declarations_consistent") {
      assert.equal(stage.ledger_before_tools_observed, true);
    }
  }
});

test("build capsule stage protocol omits reproduction but keeps all other gates", () => {
  const stage = parseCodexResult(
    capsuleTraceEvents({ expectedWorkflow: "build" }).map(JSON.stringify).join("\n"),
    capsuleTraceOptions("build"),
  ).workflow_trace.capsule_stage;

  assert.deepEqual(stage, passingCapsuleStage("build"));

  const chainedStage = parseCodexResult(
    capsuleTraceEvents({
      expectedWorkflow: "build",
      validationCommand: `${capsuleReproductionContract.command} && npm test`,
    }).map(JSON.stringify).join("\n"),
    capsuleTraceOptions("build"),
  ).workflow_trace.capsule_stage;
  assert.equal(chainedStage.validation_observed, false);
  assert.equal(chainedStage.protocol_observed, false);
});

test("process stdout callbacks preserve complete line order across chunks", async () => {
  const lines = [];
  const result = await runProcess(process.execPath, [
    "-e",
    [
      "process.stdout.write('first\\nsec');",
      "setTimeout(() => process.stdout.write('ond\\r\\nthird'), 10);",
    ].join(""),
  ], {
    onStdoutLine: async (line) => {
      if (line === "first") await new Promise((resolve) => setTimeout(resolve, 20));
      lines.push(line);
    },
  });

  assert.equal(result.exitCode, 0);
  assert.deepEqual(lines, ["first", "second", "third"]);
});

test("process output limits terminate noisy verifier commands", async () => {
  const result = await runProcess(
    process.execPath,
    ["-e", 'process.stdout.write("x".repeat(100_000)); setInterval(() => {}, 1000);'],
    { maxOutputBytes: 1_024, timeoutMs: 10_000 },
  );
  assert.equal(result.outputLimitExceeded, true);
  assert.ok(Buffer.byteLength(result.stdout) <= 1_024);
  assert.notEqual(result.exitCode, 0);
});

test("process stdout callback failures reject the process result", async () => {
  await assert.rejects(
    runProcess(process.execPath, ["-e", "console.log('line')"], {
      onStdoutLine() {
        throw new Error("stdout callback failed");
      },
    }),
    /stdout callback failed/u,
  );
});

test("reviewer mutation tracker correlates the designated spawn and completed wait", async () => {
  const fingerprints = ["before", "after"];
  const tracker = createReviewerWorkspaceMutationTracker(async () => fingerprints.shift());
  const events = [
    {
      type: "item.started",
      item: {
        id: "spawn-reviewer",
        type: "collab_tool_call",
        tool: "spawn_agent",
        prompt: "$leanpowers:review\nReview the strict-risk diff.",
      },
    },
    {
      type: "item.completed",
      item: {
        id: "spawn-reviewer",
        type: "collab_tool_call",
        tool: "spawn_agent",
        receiver_thread_ids: ["reviewer"],
        status: "completed",
      },
    },
    {
      type: "item.started",
      item: {
        id: "wait-reviewer",
        type: "collab_tool_call",
        tool: "wait",
        receiver_thread_ids: ["reviewer"],
      },
    },
    {
      type: "item.completed",
      item: {
        id: "wait-reviewer",
        type: "collab_tool_call",
        tool: "wait",
        agents_states: {
          reviewer: { status: "completed", message: "not the required schema" },
        },
        status: "completed",
      },
    },
  ];

  for (const event of events) await tracker.onStdoutLine(JSON.stringify(event));

  assert.deepEqual([...tracker.mutations()], [["reviewer", true]]);
  assert.deepEqual(fingerprints, []);
});

test("reviewer mutation tracking covers conservative strict upgrades", () => {
  assert.equal(tracksReviewerWorkspaceMutations("leanpowers-0.2.0"), true);
  assert.equal(tracksReviewerWorkspaceMutations("superpowers-6.1.1"), false);
});

test("Codex trace proves independent review only after reviewer spawn and completed wait", () => {
  const contract = "Prefix sha256=; hexadecimal characters in either case.";
  const packet = strictReviewPrompt(contract);
  const parsed = parseCodexResult([
    JSON.stringify({
      type: "item.completed",
      item: {
        type: "file_change",
        changes: [{ path: "src/index.mjs", kind: "update" }],
        status: "completed",
      },
    }),
    JSON.stringify({
      type: "item.completed",
      item: {
        type: "command_execution",
        command: "npm test",
        exit_code: 0,
        status: "completed",
      },
    }),
    JSON.stringify({
      type: "item.started",
      item: {
        id: "spawn-reviewer",
        type: "collab_tool_call",
        tool: "spawn_agent",
        receiver_thread_ids: [],
        prompt: packet,
        status: "in_progress",
      },
    }),
    JSON.stringify({
      type: "item.completed",
      item: {
        id: "spawn-reviewer",
        type: "collab_tool_call",
        tool: "spawn_agent",
        prompt: packet,
        receiver_thread_ids: ["reviewer"],
        agents_states: { reviewer: { status: "running" } },
        status: "completed",
      },
    }),
    JSON.stringify({
      type: "item.started",
      item: {
        id: "wait-reviewer",
        type: "collab_tool_call",
        tool: "wait",
        receiver_thread_ids: ["reviewer"],
        agents_states: {},
        status: "in_progress",
      },
    }),
    JSON.stringify({
      type: "item.completed",
      item: {
        id: "wait-reviewer",
        type: "collab_tool_call",
        tool: "wait",
        agents_states: {
          reviewer: {
            status: "completed",
            message: "verdict: pass\nfindings: []\nunverified_areas: []",
          },
        },
        status: "completed",
      },
    }),
    JSON.stringify({
      type: "turn.completed",
      usage: { input_tokens: 10, cached_input_tokens: 0, output_tokens: 5 },
    }),
  ].join("\n"), {
    expectedReviewContract: contract,
    reviewerWorkspaceMutations: new Map([["reviewer", false]]),
  });

  assert.equal(parsed.workflow_trace.independent_review_pass_observed, true);
  assert.equal(
    parsed.workflow_trace.independent_review_contract_verbatim_observed,
    true,
  );
  assert.equal(parsed.workflow_trace.independent_review_skill_invoked, true);
  assert.equal(
    parsed.workflow_trace.independent_review_sole_wait_target_observed,
    true,
  );
  assert.equal(parsed.workflow_trace.post_change_spawn_calls, 1);
  assert.equal(parsed.workflow_trace.post_change_wait_calls, 1);
  assert.equal(parsed.workflow_trace.strict_review_protocol_observed, true);
  assert.equal(parsed.workflow_trace.strict_review_cycle_count, 1);
  assert.deepEqual(
    evaluateWorkflowConformance({
      workflow: "leanpowers-0.2.0",
      activation_reported: true,
      route_ledger_reported: true,
      expected_workflow: "build",
      declared_workflow: "build",
      declared_risk: "strict",
      risk_level: "standard",
      telemetry: {
        ...parsed,
        workflow_trace: {
          ...parsed.workflow_trace,
          capsule_stage: passingCapsuleStage("build"),
        },
      },
    }),
    { status: "PASS", reasons: [] },
  );
  assert.equal(
    parseCodexResult([
      JSON.stringify({
        type: "item.completed",
        item: {
          type: "collab_tool_call",
          tool: "spawn_agent",
          prompt: `$leanpowers:review\n\nOriginal task:\n${contract}\n\nReviewer context:\nReview the strict-risk diff.`,
          receiver_thread_ids: ["reviewer"],
          status: "completed",
        },
      }),
      JSON.stringify({
        type: "item.completed",
        item: {
          type: "collab_tool_call",
          tool: "wait",
          agents_states: {
            reviewer: {
              status: "completed",
              message: "verdict: pass\nfindings: []\nunverified_areas: []",
            },
          },
          status: "completed",
        },
      }),
    ].join("\n"), { expectedReviewContract: contract })
      .workflow_trace.independent_review_contract_verbatim_observed,
    true,
  );
  assert.equal(
    parseCodexResult([
      JSON.stringify({
        type: "item.completed",
        item: {
          type: "collab_tool_call",
          tool: "spawn_agent",
          prompt: "Review a paraphrased contract.",
          receiver_thread_ids: ["reviewer"],
          status: "completed",
        },
      }),
      JSON.stringify({
        type: "item.completed",
        item: {
          type: "collab_tool_call",
          tool: "wait",
          agents_states: {
            reviewer: {
              status: "completed",
              message: "verdict: pass\nfindings: []\nunverified_areas: []",
            },
          },
          status: "completed",
        },
      }),
    ].join("\n"), { expectedReviewContract: contract })
      .workflow_trace.independent_review_contract_verbatim_observed,
    false,
  );
  for (const prompt of [
    `$leanpowers:review\nReview first.\nOriginal task:\n${contract}\n\nReviewer context:\nContext.`,
    `$leanpowers:review\n\n\nOriginal task:\n${contract}\n\nReviewer context:\nContext.`,
    `$leanpowers:review\nOriginal task: ${contract}\n\nReviewer context:\nContext.`,
    `$leanpowers:review\nOriginal task:\n${contract} Added requirement.\n\nReviewer context:\nContext.`,
  ]) {
    assert.equal(
      parseCodexResult([
        JSON.stringify({
          type: "item.completed",
          item: {
            type: "collab_tool_call",
            tool: "spawn_agent",
            prompt,
            receiver_thread_ids: ["reviewer"],
            status: "completed",
          },
        }),
        JSON.stringify({
          type: "item.completed",
          item: {
            type: "collab_tool_call",
            tool: "wait",
            agents_states: {
              reviewer: {
                status: "completed",
                message: "verdict: pass\nfindings: []\nunverified_areas: []",
              },
            },
            status: "completed",
          },
        }),
      ].join("\n"), { expectedReviewContract: contract })
        .workflow_trace.independent_review_contract_verbatim_observed,
      false,
    );
  }

  const extraFailedSpawn = parseCodexResult([
    JSON.stringify({
      type: "item.completed",
      item: {
        type: "collab_tool_call",
        tool: "spawn_agent",
        prompt: `$leanpowers:review\nOriginal task:\n${contract}\n\nReviewer context:\nReview the strict-risk diff.`,
        receiver_thread_ids: ["reviewer"],
        status: "completed",
      },
    }),
    JSON.stringify({
      type: "item.completed",
      item: {
        type: "collab_tool_call",
        tool: "spawn_agent",
        prompt: "fallback reviewer",
        status: "failed",
      },
    }),
    JSON.stringify({
      type: "item.completed",
      item: {
        type: "collab_tool_call",
        tool: "wait",
        agents_states: {
          reviewer: {
            status: "completed",
            message: "verdict: pass\nfindings: []\nunverified_areas: []",
          },
        },
        status: "completed",
      },
    }),
  ].join("\n"), { expectedReviewContract: contract });
  assert.equal(extraFailedSpawn.workflow_trace.independent_review_pass_observed, true);
  assert.equal(extraFailedSpawn.workflow_trace.post_change_spawn_calls, 2);
  assert.equal(extraFailedSpawn.workflow_trace.strict_review_protocol_observed, false);

  const unrelatedWaitTarget = parseCodexResult([
    JSON.stringify({
      type: "item.completed",
      item: {
        type: "collab_tool_call",
        tool: "spawn_agent",
        prompt: `$leanpowers:review\nOriginal task:\n${contract}\n\nReviewer context:\nReview the strict-risk diff.`,
        receiver_thread_ids: ["reviewer"],
        status: "completed",
      },
    }),
    JSON.stringify({
      type: "item.started",
      item: {
        id: "wait-with-observer",
        type: "collab_tool_call",
        tool: "wait",
        receiver_thread_ids: ["reviewer", "observer"],
        agents_states: {},
        status: "in_progress",
      },
    }),
    JSON.stringify({
      type: "item.completed",
      item: {
        id: "wait-with-observer",
        type: "collab_tool_call",
        tool: "wait",
        agents_states: {
          reviewer: {
            status: "completed",
            message: "verdict: pass\nfindings: []\nunverified_areas: []",
          },
        },
        status: "completed",
      },
    }),
  ].join("\n"), { expectedReviewContract: contract });
  assert.equal(unrelatedWaitTarget.workflow_trace.independent_review_pass_observed, true);
  assert.equal(
    unrelatedWaitTarget.workflow_trace.independent_review_sole_wait_target_observed,
    false,
  );
});

test("strict review protocol accepts remediated fresh cycles and rejects one-property regressions", () => {
  const contract = "Preserve the exact authorization boundary.";
  const prompt = strictReviewPrompt(contract);
  const event = (item) => ({ type: "item.completed", item });
  const spawnEvents = (id, reviewer, reviewPrompt = prompt) => [
    {
      type: "item.started",
      item: {
        id,
        type: "collab_tool_call",
        tool: "spawn_agent",
        prompt: reviewPrompt,
        receiver_thread_ids: [],
        status: "in_progress",
      },
    },
    event({
      id,
      type: "collab_tool_call",
      tool: "spawn_agent",
      prompt: reviewPrompt,
      receiver_thread_ids: [reviewer],
      status: "completed",
    }),
  ];
  const waitEvents = (id, reviewer, message) => [
    {
      type: "item.started",
      item: {
        id,
        type: "collab_tool_call",
        tool: "wait",
        receiver_thread_ids: [reviewer],
        status: "in_progress",
      },
    },
    event({
      id,
      type: "collab_tool_call",
      tool: "wait",
      agents_states: { [reviewer]: { status: "completed", message } },
      status: "completed",
    }),
  ];
  const finding = [
    "verdict: changes_required",
    "findings:",
    "  - severity: medium",
    "    location: src/index.mjs:1",
    "    evidence: boundary is missing",
    "    impact: invalid input passes",
    "    repair: enforce the boundary",
    "unverified_areas: []",
  ].join("\n");
  const pass = "verdict: pass\nfindings: []\nunverified_areas: []";
  const buildTrace = ({
    initialCommand = "npm test",
    initialCommandExit = 0,
    command = "npm test",
    commandExit = 0,
    firstVerdict = finding,
    secondReviewer = "reviewer-2",
  } = {}) => [
    event({
      type: "file_change",
      changes: [{ path: "test/index.test.mjs", kind: "update" }],
      status: "completed",
    }),
    event({
      type: "command_execution",
      command: initialCommand,
      exit_code: initialCommandExit,
      status: "completed",
    }),
    ...spawnEvents("spawn-1", "reviewer-1"),
    ...waitEvents("wait-1", "reviewer-1", firstVerdict),
    event({
      type: "file_change",
      changes: [{ path: "src/index.mjs", kind: "update" }],
      status: "completed",
    }),
    event({
      type: "command_execution",
      command,
      exit_code: commandExit,
      status: "completed",
    }),
    ...spawnEvents("spawn-2", secondReviewer),
    ...waitEvents("wait-2", secondReviewer, pass),
  ];
  const parse = (events, reviewerWorkspaceMutations = new Map([
    ["reviewer-1", false],
    ["reviewer-2", false],
    ["reviewer-extra", false],
  ]), options = {}) => parseCodexResult(events.map(JSON.stringify).join("\n"), {
    expectedReviewContract: contract,
    reviewerWorkspaceMutations,
    ...options,
  }).workflow_trace;

  const valid = parse(buildTrace());
  assert.equal(valid.strict_review_protocol_observed, true);
  assert.equal(valid.quality_independent_review_current_validation_observed, true);
  const compactBoundaryPacket = prompt.replace(
    `${contract}\n\nReviewer context:`,
    `${contract}\nReviewer context:`,
  );
  assert.equal(parse([
    event({
      type: "file_change",
      changes: [{ path: "src/index.mjs", kind: "update" }],
      status: "completed",
    }),
    event({
      type: "command_execution",
      command: "npm test",
      exit_code: 0,
      status: "completed",
    }),
    ...spawnEvents("spawn-compact", "reviewer-compact", compactBoundaryPacket),
    ...waitEvents("wait-compact", "reviewer-compact", pass),
  ], new Map([["reviewer-compact", false]])).strict_review_protocol_observed, true);
  assert.equal(parse(buildTrace({
    initialCommand: "/bin/zsh -lc 'npm test'",
    command: "/bin/zsh -lc 'npm test'",
  })).strict_review_protocol_observed, true);
  const compositeValidation = `${capsuleReproductionContract.command} && npm test`;
  const compositePacket = strictReviewPrompt(contract, {
    testEvidence: `exit=0; command=${compositeValidation}`,
  });
  const composite = parse([
    event({
      type: "file_change",
      changes: [{ path: "src/index.mjs", kind: "update" }],
      status: "completed",
    }),
    event({
      type: "command_execution",
      command: compositeValidation,
      exit_code: 0,
      status: "completed",
    }),
    ...spawnEvents("spawn-composite", "reviewer-composite", compositePacket),
    ...waitEvents("wait-composite", "reviewer-composite", pass),
  ], new Map([["reviewer-composite", false]]), {
    expectedWorkflow: "debug",
    reproductionContract: capsuleReproductionContract,
  });
  assert.equal(composite.strict_review_protocol_observed, true);
  assert.equal(
    composite.quality_independent_review_current_validation_observed,
    true,
  );
  const staleGreenReview = [
    event({
      type: "file_change",
      changes: [{ path: "src/index.mjs", kind: "update" }],
      status: "completed",
    }),
    event({
      type: "command_execution",
      command: "npm test",
      exit_code: 0,
      status: "completed",
    }),
    event({
      type: "command_execution",
      command: "npm test",
      exit_code: 1,
      status: "completed",
    }),
    ...spawnEvents("spawn-stale", "reviewer-stale"),
    ...waitEvents("wait-stale", "reviewer-stale", pass),
  ];
  const staleReview = parse(
    staleGreenReview,
    new Map([["reviewer-stale", false]]),
  );
  assert.equal(
    staleReview.quality_independent_review_current_validation_observed,
    false,
  );
  const laterRecovery = parse(
    [
      ...staleGreenReview,
      event({
        type: "command_execution",
        command: "npm test",
        exit_code: 0,
        status: "completed",
      }),
    ],
    new Map([["reviewer-stale", false]]),
  );
  assert.equal(
    laterRecovery.quality_independent_review_current_validation_observed,
    false,
  );
  assert.equal(valid.duplicate_strict_collab_call_id_observed, false);
  assert.equal(valid.unexpected_strict_collab_tool_observed, false);
  assert.equal(valid.strict_review_cycle_count, 2);
  assert.equal(valid.post_change_spawn_calls, 1);
  assert.equal(valid.post_change_wait_calls, 1);

  for (const invalid of [
    buildTrace({ initialCommandExit: 1 }),
    buildTrace({ initialCommand: "pwd" }),
    buildTrace({ initialCommand: "npm test || true" }),
    buildTrace({ initialCommand: "npm test\ntrue" }),
    buildTrace({ initialCommand: "npm test & true" }),
    buildTrace({ initialCommand: "! npm test" }),
    buildTrace({ initialCommand: "/bin/zsh -lc ' npm test '" }),
    buildTrace({ commandExit: 1 }),
    buildTrace({ command: "pwd" }),
    buildTrace({ command: "npm test || true" }),
    buildTrace({ command: "npm test\ntrue" }),
    buildTrace({ command: "npm test & true" }),
    buildTrace({ command: "! npm test" }),
    buildTrace({ command: "/bin/zsh -lc ' npm test '" }),
    buildTrace({ command: "npm test -- --test-name-pattern different" }),
    buildTrace({ firstVerdict: "verdict: blocked\nfindings: []\nunverified_areas: [tests]" }),
    buildTrace({ firstVerdict: "verdict: changes_required\nfindings:\n  - nonsense\nunverified_areas: []" }),
    buildTrace({ firstVerdict: "verdict: changes_required\nfindings:\n  - severity: medium\n    location:   \n    evidence: boundary missing\n    impact: invalid input passes\n    repair: enforce boundary\nunverified_areas: []" }),
    buildTrace({ firstVerdict: finding.replace("unverified_areas: []", "unverified_areas: [   ]") }),
    buildTrace({ secondReviewer: "reviewer-1" }),
    buildTrace().filter((event) => event.item?.type !== "command_execution"),
    buildTrace().filter((event) => event.item?.type !== "file_change" || event.item.changes.length === 0),
    [...buildTrace(), ...spawnEvents("spawn-extra", "reviewer-extra")],
    [...buildTrace(), ...spawnEvents("spawn-2", "reviewer-extra")],
    [...buildTrace(), event({
      id: "message-reviewer",
      type: "collab_tool_call",
      tool: "send_message",
      status: "completed",
    })],
    (() => {
      const trace = buildTrace();
      trace.splice(8, 0, event({
        type: "file_change",
        changes: [{ path: "src/after-test.mjs", kind: "update" }],
        status: "completed",
      }));
      const expandedPacket = strictReviewPrompt(contract, {
        paths: "src/index.mjs, test/index.test.mjs, src/after-test.mjs",
      });
      trace[9].item.prompt = expandedPacket;
      trace[10].item.prompt = expandedPacket;
      return trace;
    })(),
  ]) {
    assert.equal(parse(invalid).strict_review_protocol_observed, false);
  }
  assert.equal(
    parse(buildTrace(), new Map([
      ["reviewer-1", true],
      ["reviewer-2", false],
    ])).strict_review_protocol_observed,
    false,
  );
  for (const invalidPacket of [
    prompt.replace("Ledger: exact clauses -> positive and negative evidence", "Ledger:"),
    prompt.replace("Ledger: exact clauses -> positive and negative evidence", "Ledger:   "),
    prompt.replace("Ledger: exact clauses -> positive and negative evidence", "Ledger: []"),
    prompt.replace("Paths: src/index.mjs, test/index.test.mjs\n", ""),
    prompt.replace("Paths: src/index.mjs, test/index.test.mjs", "Paths:   "),
    prompt.replace("Paths: src/index.mjs, test/index.test.mjs", "Paths: []"),
    prompt.replace("Paths: src/index.mjs, test/index.test.mjs", "Paths: test/index.test.mjs"),
    prompt.replace("Test: exit=0; command=npm test", "Test: exit=0; command={exact validation command}"),
    prompt.replace("Test: exit=0; command=npm test", "Test: exit=1; command=npm test"),
    prompt.replace("Test: exit=0; command=npm test", "Test: exit=0; command=npm test; 47/47 passed"),
    `summary first\n${prompt}`,
  ]) {
    const trace = parse([
      event({
        type: "file_change",
        changes: [{ path: "src/index.mjs", kind: "update" }],
        status: "completed",
      }),
      event({
        type: "command_execution",
        command: "npm test",
        exit_code: 0,
        status: "completed",
      }),
      ...spawnEvents("spawn-only", "reviewer-only", invalidPacket),
      ...waitEvents("wait-only", "reviewer-only", pass),
    ], new Map([["reviewer-only", false]]));
    assert.equal(trace.strict_review_protocol_observed, false);
  }
  const mismatchedCommandPacket = strictReviewPrompt(contract, {
    testEvidence: "exit=0; command=node --test tests/claimed.mjs",
  });
  assert.equal(parse([
    event({
      type: "file_change",
      changes: [{ path: "src/index.mjs", kind: "update" }],
      status: "completed",
    }),
    event({
      type: "command_execution",
      command: "node --test tests/actual.mjs",
      aggregated_output: "1 test passed",
      exit_code: 0,
      status: "completed",
    }),
    ...spawnEvents("spawn-mismatch", "reviewer-mismatch", mismatchedCommandPacket),
    ...waitEvents("wait-mismatch", "reviewer-mismatch", pass),
  ], new Map([["reviewer-mismatch", false]])).strict_review_protocol_observed, false);
  const quotedWhitespacePacket = strictReviewPrompt(contract, {
    testEvidence: "exit=0; command=node --test --test-name-pattern='foo bar'",
  });
  assert.equal(parse([
    event({
      type: "file_change",
      changes: [{ path: "src/index.mjs", kind: "update" }],
      status: "completed",
    }),
    event({
      type: "command_execution",
      command: "node --test --test-name-pattern='foo  bar'",
      aggregated_output: "1 test passed",
      exit_code: 0,
      status: "completed",
    }),
    ...spawnEvents("spawn-whitespace", "reviewer-whitespace", quotedWhitespacePacket),
    ...waitEvents("wait-whitespace", "reviewer-whitespace", pass),
  ], new Map([["reviewer-whitespace", false]])).strict_review_protocol_observed, false);
  for (const [id, testEvidence, command] of [
    ["leading", "exit=0; command= npm test", "/bin/zsh -lc ' npm test'"],
    ["trailing", "exit=0; command=npm test ", "/bin/zsh -lc \"npm test \""],
  ]) {
    const edgeWhitespacePacket = strictReviewPrompt(contract, { testEvidence });
    assert.equal(parse([
      event({
        type: "file_change",
        changes: [{ path: "src/index.mjs", kind: "update" }],
        status: "completed",
      }),
      event({
        type: "command_execution",
        command,
        aggregated_output: "1 test passed",
        exit_code: 0,
        status: "completed",
      }),
      ...spawnEvents(`spawn-${id}`, `reviewer-${id}`, edgeWhitespacePacket),
      ...waitEvents(`wait-${id}`, `reviewer-${id}`, pass),
    ], new Map([[`reviewer-${id}`, false]])).strict_review_protocol_observed, false);
  }
});

test("non-schema review keeps structural telemetry independent from its verdict", () => {
  const contract = "Preserve the exact authorization boundary.";
  const raw = [
    {
      type: "item.started",
      item: {
        id: "spawn-reviewer",
        type: "collab_tool_call",
        tool: "spawn_agent",
        prompt: `$leanpowers:review\nOriginal task:\n${contract}\n\nReviewer context:\nReview it.`,
      },
    },
    {
      type: "item.completed",
      item: {
        id: "spawn-reviewer",
        type: "collab_tool_call",
        tool: "spawn_agent",
        prompt: `$leanpowers:review\nOriginal task:\n${contract}\n\nReviewer context:\nReview it.`,
        receiver_thread_ids: ["reviewer"],
        status: "completed",
      },
    },
    {
      type: "item.started",
      item: {
        id: "wait-reviewer",
        type: "collab_tool_call",
        tool: "wait",
        receiver_thread_ids: ["reviewer"],
      },
    },
    {
      type: "item.completed",
      item: {
        id: "wait-reviewer",
        type: "collab_tool_call",
        tool: "wait",
        agents_states: {
          reviewer: { status: "completed", message: "I changed the implementation." },
        },
        status: "completed",
      },
    },
  ].map(JSON.stringify).join("\n");
  const trace = parseCodexResult(raw, {
    expectedReviewContract: contract,
    reviewerWorkspaceMutations: new Map([["reviewer", true]]),
  }).workflow_trace;

  assert.equal(trace.independent_review_pass_observed, false);
  assert.equal(trace.independent_review_contract_verbatim_observed, true);
  assert.equal(trace.independent_review_skill_invoked, true);
  assert.equal(trace.independent_review_sole_wait_target_observed, true);
  assert.equal(trace.reviewer_workspace_mutation_check_observed, true);
  assert.equal(trace.reviewer_workspace_mutation_observed, true);
});

test("Codex trace rejects failed, unrelated, or out-of-order review evidence", () => {
  const event = (item) => JSON.stringify({ type: "item.completed", item });
  const turn = JSON.stringify({
    type: "turn.completed",
    usage: { input_tokens: 10, cached_input_tokens: 0, output_tokens: 5 },
  });
  const spawn = (status = "completed") => event({
    type: "collab_tool_call",
    tool: "spawn_agent",
    prompt: "Review the strict-risk diff.",
    receiver_thread_ids: ["reviewer"],
    status,
  });
  const wait = (agentId = "reviewer") => event({
    type: "collab_tool_call",
    tool: "wait",
    agents_states: {
      [agentId]: {
        status: "completed",
        message: "verdict: pass\nfindings: []\nunverified_areas: []",
      },
    },
    status: "completed",
  });

  for (const raw of [
    [spawn("failed"), wait(), turn],
    [spawn(), wait("other-agent"), turn],
    [wait(), spawn(), turn],
    [event({ type: "agent_message", text: "verdict: pass\nfindings: []\nunverified_areas: []" }), turn],
  ]) {
    assert.equal(
      parseCodexResult(raw.join("\n")).workflow_trace.independent_review_pass_observed,
      false,
    );
  }
});

test("Codex trace requires a passing review after the final file change", () => {
  const event = (item) => JSON.stringify({ type: "item.completed", item });
  const spawn = event({
    type: "collab_tool_call",
    tool: "spawn_agent",
    prompt: "Run an independent review.",
    receiver_thread_ids: ["reviewer"],
    status: "completed",
  });
  const wait = (message) => event({
    type: "collab_tool_call",
    tool: "wait",
    agents_states: { reviewer: { status: "completed", message } },
    status: "completed",
  });
  const change = event({ type: "file_change", changes: [] });
  const secondSpawn = event({
    type: "collab_tool_call",
    tool: "spawn_agent",
    prompt: "Run another independent review.",
    receiver_thread_ids: ["reviewer-2"],
    status: "completed",
  });
  const mixedWait = (status) => event({
    type: "collab_tool_call",
    tool: "wait",
    agents_states: {
      reviewer: {
        status: "completed",
        message: "verdict: pass\nfindings: []\nunverified_areas: []",
      },
      "reviewer-2": {
        status,
        message:
          status === "completed"
            ? "verdict: pass\nfindings: []\nunverified_areas: []"
            : null,
      },
    },
    status: "completed",
  });
  const turn = JSON.stringify({
    type: "turn.completed",
    usage: { input_tokens: 10, cached_input_tokens: 0, output_tokens: 5 },
  });

  for (const raw of [
    [spawn, wait("verdict: changes_required"), turn],
    [spawn, wait("PASS is not granted; changes are required"), turn],
    [spawn, change, wait("verdict: pass\nfindings: []\nunverified_areas: []"), turn],
    [spawn, wait("PASS — no blockers"), change, turn],
    [spawn, wait("verdict: pass\nfindings:\n  - severity: critical\nunverified_areas: []"), turn],
    [spawn, wait("verdict: pass\nfindings: []\nunverified_areas: [tests]"), turn],
    [spawn, wait("verdict: pass\nfindings: []"), turn],
    [spawn, wait("```yaml\nverdict: pass\nfindings: []\nunverified_areas: []\n```"), turn],
    [spawn, wait("VERDICT: PASS\nfindings: []\nunverified_areas: []"), turn],
    [spawn, wait("verdict: pass\nfindings: []\nunverified_areas: []\n"), turn],
    [spawn, wait("verdict: pass\nfindings: []\nunverified_areas: []\nverdict: changes_required"), turn],
    [spawn, secondSpawn, mixedWait("running"), turn],
    [spawn, secondSpawn, mixedWait("failed"), turn],
    [
      spawn,
      wait("verdict: pass\nfindings: []\nunverified_areas: []"),
      wait("verdict: changes_required\nfindings: []\nunverified_areas: []"),
      turn,
    ],
  ]) {
    assert.equal(
      parseCodexResult(raw.join("\n")).workflow_trace.independent_review_pass_observed,
      false,
    );
  }
  assert.equal(
    parseCodexResult([
      change,
      spawn,
      wait("verdict: pass\nfindings: []\nunverified_areas: []"),
      turn,
    ].join("\n"))
      .workflow_trace.independent_review_pass_observed,
    true,
  );
});

test("changed-path evaluation separates product changes, workflow artifacts, and violations", () => {
  assert.deepEqual(
    evaluateChangedPaths(
      ["src/index.mjs", "test/index.test.mjs", "docs/plans/task.md", "notes.txt"],
      {
        product: ["src/**", "test/**"],
        workflow: ["docs/plans/**"],
      },
    ),
    {
      product: ["src/index.mjs", "test/index.test.mjs"],
      workflow: ["docs/plans/task.md"],
      violations: ["notes.txt"],
    },
  );
});

test("a task passes only with agent completion, tests, and scope intact", () => {
  const passing = {
    agent_exit_code: 0,
    agent_timed_out: false,
    agent_completed: true,
    activation_reported: true,
    case_snapshot: {
      mutants_sha256: testArtifactGateContractManifestSha256([]),
      verifier_sha256: "b".repeat(64),
      workspace_sha256: "c".repeat(64),
    },
    head_unchanged: true,
    verifier_workspace_unchanged: true,
    verifier: {
      visible: {
        exit_code: 0,
        output_limited: false,
        output: "pass",
        sandbox: "macos-seatbelt-hermetic-v2",
        signal: null,
        timed_out: false,
      },
      hidden: {
        exit_code: 0,
        output_limited: false,
        output: "pass",
        sandbox: "macos-seatbelt-hermetic-v2",
        signal: null,
        timed_out: false,
      },
      artifact_regression: null,
    },
    required_artifact_regression_gate_ids: [],
    required_artifact_regression_gates: [],
    changes: { violations: [] },
  };

  assert.deepEqual(evaluateRunOutcome(passing), { status: "PASS", reasons: [] });
  for (const mutation of [
    { agent_exit_code: 1 },
    { agent_timed_out: true },
    { agent_completed: false },
    { head_unchanged: false },
    { verifier_workspace_unchanged: false },
    { verifier: { visible: { exit_code: 0, timed_out: true }, hidden: { exit_code: 0, timed_out: false } } },
    { verifier: { visible: { exit_code: 0, timed_out: false }, hidden: { exit_code: 0, timed_out: true } } },
    { verifier: { visible: { exit_code: 1, timed_out: false }, hidden: { exit_code: 0, timed_out: false } } },
    { verifier: { visible: { exit_code: 0, timed_out: false }, hidden: { exit_code: 1, timed_out: false } } },
    { changes: { violations: ["outside.txt"] } },
  ]) {
    const run = {
      ...structuredClone(passing),
      ...structuredClone(mutation),
    };
    assert.equal(evaluateRunOutcome(run).status, "FAIL", JSON.stringify(mutation));
  }
  assert.equal(
    evaluateRunOutcome({ ...structuredClone(passing), activation_reported: false }).status,
    "PASS",
  );

  const artifactPassing = structuredClone(passing);
  const replacementSha256 = "d".repeat(64);
  const mutationManifestSha256 = testArtifactFamilyManifestSha256({
    id: "seeded-defect",
    policy: "all-kill",
    target: "src/index.mjs",
    exportName: "targetFunction",
    digests: [replacementSha256],
  });
  artifactPassing.required_artifact_regression_gate_ids = ["seeded-defect"];
  artifactPassing.required_artifact_regression_gates = [{
    id: "seeded-defect",
    policy: "all-kill",
    target: "src/index.mjs",
    export_name: "targetFunction",
    member_count: 1,
    mutation_manifest_sha256: mutationManifestSha256,
  }];
  artifactPassing.case_snapshot.mutants_sha256 =
    testArtifactGateContractManifestSha256(
      artifactPassing.required_artifact_regression_gates,
    );
  artifactPassing.verifier.artifact_regression = {
    required_gate_ids: ["seeded-defect"],
    status: "PASS",
    gates: [{
      id: "seeded-defect",
      policy: "all-kill",
      status: "PASS",
      target: "src/index.mjs",
      export_name: "targetFunction",
      member_count: 1,
      mutation_manifest_sha256: mutationManifestSha256,
      changed_visible_test_paths: ["test/index.test.mjs"],
      candidate_visible_test_paths: ["test/index.test.mjs"],
      members: [{
        index: 1,
        replacement_sha256: replacementSha256,
        baseline_tests_mutant_visible: {
          exit_code: 0,
          output_limited: false,
          sandbox: "macos-seatbelt-hermetic-v2",
          timed_out: false,
          signal: null,
          output: "pass",
        },
        candidate_tests_mutant_visible: {
          exit_code: 1,
          output_limited: false,
          sandbox: "macos-seatbelt-hermetic-v2",
          timed_out: false,
          signal: null,
          output: "failed regression",
        },
        killed: true,
      }],
      reasons: [],
    }],
  };
  assert.equal(evaluateRunOutcome(artifactPassing).status, "PASS");

  const unexpectedArtifactField = structuredClone(artifactPassing);
  unexpectedArtifactField.verifier.artifact_regression.extra = true;
  assert.deepEqual(evaluateRunOutcome(unexpectedArtifactField), {
    status: "FAIL",
    reasons: ["artifact regression evidence contained unexpected fields"],
  });

  for (const artifactRegression of [
    null,
    {
      required_gate_ids: ["seeded-defect"],
      status: "FAIL",
      gates: [],
    },
    {
      required_gate_ids: ["seeded-defect"],
      status: "FAIL",
      gates: [
        { id: "seeded-defect", status: "FAIL", reasons: ["mutant survived"] },
      ],
    },
    {
      required_gate_ids: ["seeded-defect"],
      status: "FAIL",
      gates: [
        { id: "seeded-defect", status: "PASS", reasons: [] },
        { id: "seeded-defect", status: "PASS", reasons: [] },
      ],
    },
    {
      required_gate_ids: ["seeded-defect"],
      status: "FAIL",
      gates: [
        { id: "seeded-defect", status: "PASS", reasons: [] },
        { id: "unexpected", status: "PASS", reasons: [] },
      ],
    },
  ]) {
    const run = structuredClone(artifactPassing);
    run.verifier.artifact_regression = artifactRegression;
    assert.equal(evaluateRunOutcome(run).status, "FAIL");
  }
  const duplicatedRequired = structuredClone(artifactPassing);
  duplicatedRequired.required_artifact_regression_gate_ids = [
    "seeded-defect",
    "seeded-defect",
  ];
  duplicatedRequired.verifier.artifact_regression.required_gate_ids = [
    "seeded-defect",
    "seeded-defect",
  ];
  assert.equal(evaluateRunOutcome(duplicatedRequired).status, "FAIL");

  const malformedMutations = [
    (run) => delete run.required_artifact_regression_gate_ids,
    (run) => {
      run.required_artifact_regression_gate_ids = {};
    },
    (run) => delete run.required_artifact_regression_gates,
    (run) => {
      run.required_artifact_regression_gates = [null];
    },
    (run) => delete run.required_artifact_regression_gates[0].target,
    (run) => {
      run.required_artifact_regression_gates[0].extra = true;
    },
    (run) => {
      run.required_artifact_regression_gates[0].policy = "majority-kill";
    },
    (run) => {
      run.required_artifact_regression_gates[0].member_count = 0;
    },
    (run) => {
      run.required_artifact_regression_gates[0].mutation_manifest_sha256 = "short";
    },
    (run) => {
      run.verifier.artifact_regression.required_gate_ids = null;
    },
    (run) => {
      run.verifier.artifact_regression.private_member_details = [];
    },
    (run) => {
      run.verifier.artifact_regression.gates = null;
    },
    (run) => {
      run.verifier.artifact_regression.gates = [null];
    },
    (run) => {
      run.verifier.artifact_regression.gates[0].member_count = 2;
    },
    (run) => {
      run.verifier.artifact_regression.gates[0].mutation_manifest_sha256 =
        "e".repeat(64);
    },
    (run) => delete run.verifier.artifact_regression.gates[0].members[0]
      .baseline_tests_mutant_visible,
    (run) => {
      run.verifier.artifact_regression.gates[0].members[0]
        .candidate_tests_mutant_visible.exit_code = 0;
    },
    (run) => {
      run.verifier.artifact_regression.gates[0].members[0]
        .candidate_tests_mutant_visible.exit_code = -1;
      run.verifier.artifact_regression.gates[0].members[0].killed = true;
    },
    (run) => {
      run.verifier.artifact_regression.gates[0].members[0]
        .candidate_tests_mutant_visible.sandbox = "claimed";
    },
    (run) => {
      run.verifier.artifact_regression.gates[0].members[0].index = 2;
    },
    (run) => {
      run.verifier.artifact_regression.gates[0].members[0]
        .replacement_sha256 = "f".repeat(64);
    },
    (run) => {
      run.verifier.artifact_regression.gates[0].members[0].replacement_text =
        "private mutation";
    },
    (run) => {
      run.verifier.artifact_regression.gates[0].candidate_visible_test_paths = [];
    },
    (run) => {
      run.verifier.artifact_regression.gates[0].mutations = ["private mutant"];
    },
    (run) => {
      run.required_artifact_regression_gate_ids = [];
      run.required_artifact_regression_gates = [];
      run.verifier.artifact_regression = null;
    },
    (run) => delete run.verifier.visible.output,
    (run) => delete run.verifier.visible.output_limited,
    (run) => delete run.verifier.visible.signal,
    (run) => {
      run.verifier.visible.sandbox = "claimed";
      run.verifier.hidden.sandbox = "claimed";
    },
    (run) => delete run.case_snapshot,
    (run) => {
      run.case_snapshot.workspace_sha256 = "short";
    },
    (run) => {
      run.case_snapshot.extra = "unexpected";
    },
  ];
  for (const mutate of malformedMutations) {
    const malformed = structuredClone(artifactPassing);
    mutate(malformed);
    assert.doesNotThrow(() => evaluateRunOutcome(malformed));
    assert.equal(evaluateRunOutcome(malformed).status, "FAIL");
  }
});

test("workflow declaration and risk classification are separate conformance evidence", () => {
  assert.deepEqual(
    evaluateWorkflowConformance({
      workflow: "leanpowers-0.2.0",
      activation_reported: true,
      route_ledger_reported: true,
      expected_workflow: "build",
      declared_workflow: "build",
      declared_risk: "strict",
      risk_level: "strict",
      telemetry: {
        workflow_trace: {
          capsule_stage: passingCapsuleStage("build"),
          independent_review_pass_observed: true,
          quality_independent_review_pass_observed: true,
          quality_independent_review_context_observed: true,
          quality_independent_review_current_validation_observed: true,
          independent_review_contract_verbatim_observed: true,
          independent_review_skill_invoked: true,
          independent_review_sole_wait_target_observed: true,
          reviewer_workspace_mutation_check_observed: true,
          strict_review_protocol_observed: true,
          post_change_spawn_calls: 1,
          post_change_wait_calls: 1,
        },
      },
    }),
    { status: "PASS", reasons: [] },
  );
  assert.deepEqual(
    evaluateWorkflowConformance({
      workflow: "leanpowers-0.2.0",
      activation_reported: true,
      route_ledger_reported: true,
      expected_workflow: "build",
      declared_workflow: "build",
      declared_risk: "lean",
      risk_level: "standard",
      telemetry: { workflow_trace: { capsule_stage: passingCapsuleStage("build") } },
    }),
    { status: "FAIL", reasons: ["declared lean risk instead of standard"] },
  );
  assert.deepEqual(
    evaluateWorkflowConformance({
      workflow: "leanpowers-0.2.0",
      activation_reported: true,
      route_ledger_reported: true,
      expected_workflow: "build",
      declared_workflow: "build",
      declared_risk: "strict",
      risk_level: "standard",
      telemetry: {
        workflow_trace: {
          capsule_stage: passingCapsuleStage("build"),
          independent_review_pass_observed: true,
          quality_independent_review_pass_observed: true,
          quality_independent_review_context_observed: true,
          quality_independent_review_current_validation_observed: true,
          independent_review_contract_verbatim_observed: true,
          independent_review_skill_invoked: true,
          independent_review_sole_wait_target_observed: true,
          reviewer_workspace_mutation_check_observed: true,
          strict_review_protocol_observed: true,
        },
      },
    }),
    { status: "PASS", reasons: [] },
  );
  assert.deepEqual(
    evaluateWorkflowConformance({
      workflow: "leanpowers-0.2.0",
      activation_reported: true,
      route_ledger_reported: true,
      expected_workflow: "build",
      declared_workflow: "build",
      declared_risk: "standard",
      risk_level: "lean",
      telemetry: { workflow_trace: { capsule_stage: passingCapsuleStage("build") } },
    }),
    { status: "PASS", reasons: [] },
  );
  assert.deepEqual(
    evaluateWorkflowConformance({
      workflow: "leanpowers-0.2.0",
      activation_reported: true,
      route_ledger_reported: true,
      expected_workflow: "build",
      declared_workflow: "build",
      declared_risk: "strict",
      risk_level: "standard",
      telemetry: { workflow_trace: { capsule_stage: passingCapsuleStage("build") } },
    }),
    {
      status: "FAIL",
      reasons: [
        "current passing independent review was not observed",
        "passing independent review lacked current validation context",
        "reviewer workspace mutation check was not observed",
      ],
    },
  );
  const presentedStrictCapsule = passingCapsuleStage("build");
  presentedStrictCapsule.highest_presented_risk = "strict";
  assert.deepEqual(
    evaluateWorkflowConformance({
      workflow: "leanpowers-0.2.0",
      activation_reported: true,
      route_ledger_reported: true,
      expected_workflow: "build",
      declared_workflow: "build",
      declared_risk: "standard",
      risk_level: "standard",
      telemetry: { workflow_trace: { capsule_stage: presentedStrictCapsule } },
    }),
    {
      status: "FAIL",
      reasons: [
        "current passing independent review was not observed",
        "passing independent review lacked current validation context",
        "reviewer workspace mutation check was not observed",
      ],
    },
  );
  assert.deepEqual(
    evaluateWorkflowConformance({
      workflow: "leanpowers-0.2.0",
      activation_reported: true,
      route_ledger_reported: true,
      expected_workflow: "debug",
      declared_workflow: "build",
      declared_risk: "strict",
      risk_level: "strict",
      telemetry: {
        workflow_trace: {
          capsule_stage: passingCapsuleStage("debug"),
          independent_review_pass_observed: true,
          quality_independent_review_pass_observed: true,
          quality_independent_review_context_observed: true,
          quality_independent_review_current_validation_observed: true,
          independent_review_contract_verbatim_observed: true,
          independent_review_skill_invoked: true,
          independent_review_sole_wait_target_observed: true,
          reviewer_workspace_mutation_check_observed: true,
          strict_review_protocol_observed: true,
          post_change_spawn_calls: 1,
          post_change_wait_calls: 1,
        },
      },
    }),
    { status: "FAIL", reasons: ["declared build workflow instead of debug"] },
  );
  assert.equal(
    evaluateWorkflowConformance({
      workflow: "leanpowers-0.2.0",
      activation_reported: false,
      declared_risk: "standard",
      risk_level: "strict",
      telemetry: { workflow_trace: { independent_review_pass_observed: false } },
    }).status,
    "FAIL",
  );
  assert.equal(
    evaluateWorkflowConformance({
      workflow: "leanpowers-0.2.0",
      activation_reported: true,
      declared_risk: null,
      risk_level: "standard",
      telemetry: { workflow_trace: { independent_review_pass_observed: false } },
    }).status,
    "FAIL",
  );
  assert.equal(
    evaluateWorkflowConformance({
      workflow: "leanpowers-0.2.0",
      activation_reported: true,
      declared_risk: "strict",
      risk_level: "strict",
      telemetry: { workflow_trace: { independent_review_pass_observed: false } },
    }).status,
    "FAIL",
  );
  assert.equal(
    evaluateWorkflowConformance({
      workflow: "leanpowers-0.2.0",
      activation_reported: true,
      declared_risk: "strict",
      risk_level: "strict",
      telemetry: {
        workflow_trace: {
          independent_review_pass_observed: true,
          quality_independent_review_pass_observed: true,
          quality_independent_review_context_observed: false,
          quality_independent_review_current_validation_observed: true,
          independent_review_contract_verbatim_observed: false,
          independent_review_skill_invoked: true,
          independent_review_sole_wait_target_observed: true,
          reviewer_workspace_mutation_check_observed: true,
          strict_review_protocol_observed: true,
          post_change_spawn_calls: 1,
          post_change_wait_calls: 1,
        },
      },
    }).status,
    "FAIL",
  );
  for (const [workflowTrace, expectedReason] of [
    [{
      independent_review_pass_observed: true,
      quality_independent_review_pass_observed: true,
      quality_independent_review_context_observed: true,
      quality_independent_review_current_validation_observed: true,
      independent_review_contract_verbatim_observed: true,
      independent_review_skill_invoked: false,
      independent_review_sole_wait_target_observed: true,
      reviewer_workspace_mutation_check_observed: true,
      strict_review_protocol_observed: true,
      post_change_spawn_calls: 1,
      post_change_wait_calls: 1,
    }, null],
    [{
      independent_review_pass_observed: true,
      quality_independent_review_pass_observed: true,
      quality_independent_review_context_observed: true,
      quality_independent_review_current_validation_observed: true,
      independent_review_contract_verbatim_observed: true,
      independent_review_skill_invoked: true,
      independent_review_sole_wait_target_observed: true,
      reviewer_workspace_mutation_check_observed: true,
      strict_review_protocol_observed: false,
      post_change_spawn_calls: 2,
      post_change_wait_calls: 1,
    }, null],
    [{
      independent_review_pass_observed: true,
      quality_independent_review_pass_observed: true,
      quality_independent_review_context_observed: true,
      quality_independent_review_current_validation_observed: true,
      independent_review_contract_verbatim_observed: true,
      independent_review_skill_invoked: true,
      independent_review_sole_wait_target_observed: false,
      reviewer_workspace_mutation_check_observed: true,
      strict_review_protocol_observed: true,
      post_change_spawn_calls: 1,
      post_change_wait_calls: 1,
    }, null],
    [{
      independent_review_pass_observed: true,
      quality_independent_review_pass_observed: true,
      quality_independent_review_context_observed: true,
      quality_independent_review_current_validation_observed: true,
      independent_review_contract_verbatim_observed: true,
      independent_review_skill_invoked: true,
      independent_review_sole_wait_target_observed: true,
      reviewer_workspace_mutation_check_observed: false,
      strict_review_protocol_observed: true,
      post_change_spawn_calls: 1,
      post_change_wait_calls: 1,
    }, "reviewer workspace mutation check was not observed"],
    [{
      independent_review_pass_observed: true,
      quality_independent_review_pass_observed: true,
      quality_independent_review_context_observed: true,
      quality_independent_review_current_validation_observed: true,
      independent_review_contract_verbatim_observed: true,
      independent_review_skill_invoked: true,
      independent_review_sole_wait_target_observed: true,
      reviewer_workspace_mutation_check_observed: true,
      reviewer_workspace_mutation_observed: true,
      strict_review_protocol_observed: true,
      post_change_spawn_calls: 1,
      post_change_wait_calls: 1,
    }, "designated reviewer mutated the workspace"],
  ]) {
    const conformance = evaluateWorkflowConformance({
      workflow: "leanpowers-0.2.0",
      activation_reported: true,
      route_ledger_reported: true,
      expected_workflow: "build",
      declared_workflow: "build",
      declared_risk: "strict",
      risk_level: "strict",
      telemetry: {
        workflow_trace: {
          ...workflowTrace,
          capsule_stage: passingCapsuleStage("build"),
        },
      },
    });
    assert.deepEqual(
      conformance,
      expectedReason === null
        ? { status: "PASS", reasons: [] }
        : { status: "FAIL", reasons: [expectedReason] },
    );
  }
});

test("capsule stage telemetry independently gates workflow conformance", () => {
  const passing = {
    workflow: "leanpowers-0.2.0",
    activation_reported: true,
    route_ledger_reported: true,
    expected_workflow: "build",
    declared_workflow: "build",
    declared_risk: "lean",
    risk_level: "lean",
    telemetry: {
      workflow_trace: { capsule_stage: passingCapsuleStage("build") },
    },
  };
  assert.deepEqual(evaluateWorkflowConformance(passing), { status: "PASS", reasons: [] });

  const mutations = [
    [null, "capsule stage trace was unavailable"],
    [{ route_ledger_occurrences: 2 }, null],
    [{ route_declarations_consistent: false }, "route declarations were missing or conflicting"],
    [{ risk_monotonic_observed: false }, "route risk was downgraded after an upgrade"],
    [{ ledger_before_tools_observed: false }, "route ledger was not emitted before task tools"],
    [{ ledger_keys_after_initial_observed: true }, null],
    [{ workflow_read_calls: 1 }, null],
    [{
      pre_change_command_calls: 3,
      stage_retry_calls: 1,
      stage_attempts: { discover: 2, read: 1, reproduce: 0 },
    }, null],
    [{ pre_change_stage_protocol_observed: false }, null],
    [{ discover_observed: false }, null],
    [{ read_observed: false }, null],
    [{ validation_metadata_read_observed: false }, null],
    [{ patch_targets_read_observed: false }, null],
    [{ grounded_candidates_read_observed: false }, null],
    [{ quality_grounded_candidates_read_observed: false }, null],
    [{ pre_patch_clause_test_ledger_observed: false }, null],
    [{ clause_coverage_observed: false }, null],
    [{ pre_patch_counterexample_observed: false }, null],
    [{ post_patch_clause_test_ledger_observed: true }, null],
    [{ patch_batches: 2 }, null],
    [{ implementation_patch_observed: false }, null],
    [{ test_patch_observed: false }, null],
    [{ multi_file_patch_observed: false }, null],
    [{ post_change_command_calls: 2 }, null],
    [{
      validation_observed: false,
      ordinary_stop_observed: false,
    }, null],
    [{
      post_validation_tool_calls: 1,
      ordinary_stop_observed: false,
    }, null],
    [{ quality_pre_change_evidence_observed: false }, "ordered pre-change source and reproduction evidence was not observed"],
    [{ quality_read_observed: false }, "pre-change source READ evidence was not observed"],
    [{ quality_patch_targets_read_observed: false }, "READ omitted discovered files that were later changed"],
    [{ quality_patch_observed: false }, null],
    [{ quality_validation_observed: false }, "supported successful post-edit validation was not observed"],
  ];
  for (const [mutation, expectedReason] of mutations) {
    const run = structuredClone(passing);
    run.telemetry.workflow_trace.capsule_stage = mutation === null
      ? null
      : { ...passingCapsuleStage("build"), ...mutation };
    assert.deepEqual(
      evaluateWorkflowConformance(run),
      expectedReason === null
        ? { status: "PASS", reasons: [] }
        : { status: "FAIL", reasons: [expectedReason] },
    );
  }

  const debugRun = structuredClone(passing);
  debugRun.expected_workflow = "debug";
  debugRun.declared_workflow = "debug";
  debugRun.telemetry.workflow_trace.capsule_stage = {
    ...passingCapsuleStage("debug"),
    reproduce_observed: false,
  };
  assert.deepEqual(evaluateWorkflowConformance(debugRun), {
    status: "FAIL",
    reasons: ["pre-edit executable REPRODUCE was not observed"],
  });

  const effectFailureRun = structuredClone(passing);
  effectFailureRun.required_artifact_regression_gate_ids = ["seeded-defect"];
  effectFailureRun.verifier = {
    artifact_regression: {
      status: "FAIL",
      gates: [{ id: "seeded-defect", status: "FAIL", reasons: ["survived"] }],
    },
  };
  assert.deepEqual(evaluateWorkflowConformance(effectFailureRun), {
    status: "PASS",
    reasons: [],
  });
});

test("raw benchmark output cannot be written into tracked repository paths", () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  assert.throws(
    () => resolveDevelopmentOutputDirectory(path.join(root, "docs", "raw-run")),
    /evals\/results/,
  );
  assert.match(
    resolveDevelopmentOutputDirectory(path.join(root, "evals", "results", "local-run")),
    /evals\/results\/local-run$/,
  );
  assert.equal(
    resolveDevelopmentOutputDirectory("/tmp/leanpowers-development-run"),
    "/tmp/leanpowers-development-run",
  );
});

test("partial case runs are complete for their declared selected scope", async () => {
  const suite = await loadDevelopmentSuite(suitePath);
  const selectedCases = [suite.cases[0]];
  const runs = [
    { workflow: "superpowers-6.1.1" },
    { workflow: "leanpowers-0.2.0" },
  ].map((run) => ({
    ...run,
    case_id: selectedCases[0].id,
    case_snapshot: caseSnapshotContract(selectedCases[0]),
    repetition: 1,
    activation_reported: true,
    changes: { product: [], violations: [], workflow: [] },
    outcome: { status: "PASS", reasons: [] },
    telemetry: { tokens: null, turns: null },
    wall_seconds: 1,
  }));
  const result = makePilotResult(suite, {}, runs, 1, selectedCases);

  assert.equal(result.completion, "complete");
  assert.deepEqual(result.cases, [{
    id: selectedCases[0].id,
    scenario_class: selectedCases[0].scenario_class,
    risk_level: selectedCases[0].risk_level,
    expected_workflow: selectedCases[0].expected_workflow,
  }]);
  assert.equal(result.aggregate["leanpowers-0.2.0"].median_uncached_plus_output_tokens, null);
});

test("paired reductions are calculated per matched pair and prioritize both-PASS runs", async () => {
  const suite = await loadDevelopmentSuite(suitePath);
  const selectedCases = [suite.cases[0], suite.cases[1]];
  const run = (workflow, caseId, repetition, total, fresh, wall, tools, reads, status) => ({
    workflow,
    case_id: caseId,
    case_snapshot: caseSnapshotContract(
      selectedCases.find(({ id }) => id === caseId),
    ),
    risk_level: caseId === selectedCases[0].id ? "lean" : "standard",
    repetition,
    activation_reported: true,
    changes: { product: [], violations: [], workflow: [] },
    outcome: { status, reasons: [] },
    verifier: { artifact_regression: null },
    workflow_conformance: { status: "PASS", reasons: [] },
    telemetry: {
      tokens: { total, uncached_plus_output: fresh },
      turns: 1,
      tool_calls: tools,
      workflow_trace: { read_calls: reads },
    },
    wall_seconds: wall,
  });
  const runs = [
    run("superpowers-6.1.1", selectedCases[0].id, 1, 100, 80, 10, 10, 4, "PASS"),
    run("leanpowers-0.2.0", selectedCases[0].id, 1, 60, 60, 8, 8, 2, "PASS"),
    run("superpowers-6.1.1", selectedCases[1].id, 1, 200, 100, 20, 20, 5, "PASS"),
    run("leanpowers-0.2.0", selectedCases[1].id, 1, 20, 10, 2, 2, 1, "FAIL"),
  ];
  const result = makePilotResult(suite, {}, runs, 1, selectedCases);

  assert.deepEqual(result.paired.both_pass_pairs, {
    count: 1,
    required_pair_count: 2,
    token_pairs: 1,
    model_token_shares: [{
      at_or_below_60: true,
      case_id: selectedCases[0].id,
      repetition: 1,
      share_pct: 60,
    }],
    median_token_share_pct: 60,
    max_token_share_pct: 60,
    token_share_at_or_below_60_count: 1,
    stable_token_share_at_or_below_60: false,
    fresh_token_pairs: 1,
    wall_pairs: 1,
    tool_call_pairs: 1,
    workflow_read_pairs: 1,
    median_token_reduction_pct: 40,
    median_fresh_token_reduction_pct: 25,
    median_wall_reduction_pct: 20,
    median_tool_call_reduction_pct: 20,
    median_workflow_read_reduction_pct: 50,
  });
  assert.equal(result.paired.all_pairs.count, 2);
  assert.equal(result.paired.all_pairs.median_token_reduction_pct, 65);
  assert.equal(result.paired.by_risk.lean.both_pass_pairs.count, 1);
  assert.equal(result.paired.by_risk.standard.both_pass_pairs.count, 0);
  assert.equal(result.paired.conformant_pass_pairs.count, 1);
  assert.equal(
    result.paired.conformant_pass_pairs.stable_token_share_at_or_below_60,
    false,
  );

  const overTargetRuns = structuredClone(runs);
  overTargetRuns.find((candidate) =>
    candidate.workflow === "leanpowers-0.2.0" &&
    candidate.case_id === selectedCases[0].id
  ).telemetry.tokens.total = 61;
  const overTarget = makePilotResult(suite, {}, overTargetRuns, 1, selectedCases);
  assert.equal(
    overTarget.paired.both_pass_pairs.stable_token_share_at_or_below_60,
    false,
  );
  assert.equal(overTarget.paired.both_pass_pairs.max_token_share_pct, 61);

  const allTaskPassingRuns = structuredClone(runs);
  allTaskPassingRuns.at(-1).outcome.status = "PASS";
  const allTaskPassing = makePilotResult(
    suite,
    {},
    allTaskPassingRuns,
    1,
    selectedCases,
  );
  assert.equal(
    allTaskPassing.paired.both_pass_pairs.stable_token_share_at_or_below_60,
    true,
  );

  const roundedBoundaryRuns = structuredClone(allTaskPassingRuns);
  roundedBoundaryRuns[0].telemetry.tokens.total = 10_000;
  roundedBoundaryRuns[1].telemetry.tokens.total = 6_001;
  const roundedBoundary = makePilotResult(
    suite,
    {},
    roundedBoundaryRuns,
    1,
    selectedCases,
  );
  assert.equal(roundedBoundary.paired.both_pass_pairs.max_token_share_pct, 60.01);
  assert.equal(
    roundedBoundary.paired.both_pass_pairs.stable_token_share_at_or_below_60,
    false,
  );

  const missingTelemetryRuns = structuredClone(allTaskPassingRuns);
  missingTelemetryRuns[1].telemetry.tokens.total = null;
  assert.equal(
    makePilotResult(suite, {}, missingTelemetryRuns, 1, selectedCases)
      .paired.both_pass_pairs.stable_token_share_at_or_below_60,
    false,
  );

  for (const invalidCandidateTotal of [0, -1]) {
    const invalidCandidateRuns = structuredClone(allTaskPassingRuns);
    for (const candidate of invalidCandidateRuns.filter(
      ({ workflow }) => workflow === "leanpowers-0.2.0",
    )) {
      candidate.telemetry.tokens.total = invalidCandidateTotal;
    }
    const invalidCandidate = makePilotResult(
      suite,
      {},
      invalidCandidateRuns,
      1,
      selectedCases,
    );
    assert.deepEqual(
      invalidCandidate.paired.both_pass_pairs.model_token_shares,
      [],
    );
    assert.equal(
      invalidCandidate.paired.both_pass_pairs
        .stable_token_share_at_or_below_60,
      false,
    );
  }

  const nonconformantHighTokenRuns = structuredClone(allTaskPassingRuns);
  nonconformantHighTokenRuns.at(-1).telemetry.tokens.total = 180;
  nonconformantHighTokenRuns.at(-1).workflow_conformance.status = "FAIL";
  const nonconformantHighToken = makePilotResult(
    suite,
    {},
    nonconformantHighTokenRuns,
    1,
    selectedCases,
  );
  assert.equal(
    nonconformantHighToken.paired.conformant_pass_pairs
      .stable_token_share_at_or_below_60,
    false,
  );
  assert.equal(nonconformantHighToken.paired.both_pass_pairs.max_token_share_pct, 90);

  const incomplete = makePilotResult(
    suite,
    {},
    allTaskPassingRuns.slice(0, 2),
    1,
    selectedCases,
  );
  assert.equal(incomplete.completion, "incomplete");
  assert.equal(
    incomplete.paired.both_pass_pairs.stable_token_share_at_or_below_60,
    null,
  );
  const mismatchedSnapshotRuns = structuredClone(allTaskPassingRuns);
  mismatchedSnapshotRuns[0].case_snapshot.workspace_sha256 = "f".repeat(64);
  const mismatchedSnapshot = makePilotResult(
    suite,
    {},
    mismatchedSnapshotRuns,
    1,
    selectedCases,
  );
  assert.equal(mismatchedSnapshot.completion, "incomplete");
  assert.equal(
    mismatchedSnapshot.paired.both_pass_pairs.stable_token_share_at_or_below_60,
    null,
  );
  const report = renderDevelopmentReport({
    ...result,
    activation_mode: "explicit-entrypoint",
    evidence_level: "paired-development-pilot",
    runtime: {
      codex_version: "codex-test",
      effort: "low",
      model: "test-model",
      workflow_revisions: {
        "leanpowers-0.2.0": "lean-revision",
        "superpowers-6.1.1": "upstream-revision",
      },
    },
  });
  assert.match(report, /Max Lean token share/u);
  assert.match(report, /Run matrix: \*\*complete\*\*/u);
  assert.match(report, new RegExp(`Suite manifest: ${suite.suite_sha256}`, "u"));
  assert.match(report, /Workspace snapshot \| Hidden verifier snapshot \| Fault-family snapshot/u);
  assert.match(report, /1\/2 \| no/u);
  const incompleteReport = renderDevelopmentReport({
    ...incomplete,
    activation_mode: "explicit-entrypoint",
    evidence_level: "paired-development-pilot",
    runtime: {
      codex_version: "codex-test",
      effort: "low",
      model: "test-model",
      workflow_revisions: {
        "leanpowers-0.2.0": "lean-revision",
        "superpowers-6.1.1": "upstream-revision",
      },
    },
  });
  assert.match(incompleteReport, /Run matrix: \*\*incomplete\*\*/u);
  assert.match(incompleteReport, /1\/1 \| n\/a/u);
  const artifactReportResult = structuredClone(result);
  artifactReportResult.runs[0].verifier.artifact_regression = { status: "PASS" };
  const artifactReport = renderDevelopmentReport({
    ...artifactReportResult,
    activation_mode: "explicit-entrypoint",
    evidence_level: "paired-development-pilot",
    runtime: {
      codex_version: "codex-test",
      effort: "low",
      model: "test-model",
      workflow_revisions: {
        "leanpowers-0.2.0": "lean-revision",
        "superpowers-6.1.1": "upstream-revision",
      },
    },
  });
  assert.match(artifactReport, /superpowers-6\.1\.1 \| PASS \| PASS \| yes \| PASS/u);
});

test("completion and pairing reject duplicate runs that mask a missing counterpart", async () => {
  const suite = await loadDevelopmentSuite(suitePath);
  const selectedCases = [suite.cases[0]];
  const duplicate = {
    workflow: "leanpowers-0.2.0",
    case_id: selectedCases[0].id,
    case_snapshot: caseSnapshotContract(selectedCases[0]),
    risk_level: "lean",
    repetition: 1,
    outcome: { status: "PASS", reasons: [] },
    telemetry: { tokens: { total: 10 }, tool_calls: 1, workflow_trace: { read_calls: 1 } },
    wall_seconds: 1,
    changes: { violations: [], workflow: [] },
    activation_reported: true,
  };
  const result = makePilotResult(
    suite,
    {},
    [duplicate, structuredClone(duplicate)],
    1,
    selectedCases,
  );

  assert.equal(result.completion, "incomplete");
  assert.equal(result.paired.all_pairs.count, 0);
});

test("Git scope inspection stays anchored to the immutable baseline commit", async () => {
  const workspace = await mkdtemp(path.join(os.tmpdir(), "leanpowers-git-baseline-"));
  const git = (...args) => execFileSync("git", args, {
    cwd: workspace,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
  try {
    git("init", "--quiet");
    git("config", "user.name", "Benchmark Runner");
    git("config", "user.email", "benchmark@example.invalid");
    await writeFile(path.join(workspace, "package.json"), "{}\n");
    git("add", ".");
    git("commit", "--quiet", "--no-gpg-sign", "-m", "baseline");
    const baselineHead = git("rev-parse", "HEAD");
    const pristineFingerprint = await fingerprintBenchmarkWorkspace({
      baselineHead,
      workspace,
    });
    assert.equal(
      await fingerprintBenchmarkWorkspace({ baselineHead, workspace }),
      pristineFingerprint,
    );

    if (process.platform !== "win32") {
      const fifo = path.join(workspace, "unsupported.fifo");
      const created = await runProcess("mkfifo", [fifo]);
      assert.equal(created.exitCode, 0);
      await assert.rejects(
        fingerprintBenchmarkWorkspace({ baselineHead, workspace }),
        /unsupported workspace entry/u,
      );
      await rm(fifo, { force: true });
    }

    await writeFile(path.join(workspace, "outside.txt"), "committed by agent\n");
    assert.notEqual(
      await fingerprintBenchmarkWorkspace({ baselineHead, workspace }),
      pristineFingerprint,
    );
    git("add", ".");
    git("commit", "--quiet", "--no-gpg-sign", "-m", "agent commit");
    const state = await inspectBenchmarkGitState({ baselineHead, workspace });

    assert.notEqual(state.final_head, baselineHead);
    assert.deepEqual(state.changed_paths, ["outside.txt"]);
    assert.match(state.workspace_patch, /outside\.txt/u);
  } finally {
    await rm(workspace, { force: true, recursive: true });
  }
});

test("staged test renames restore both sides of the baseline counterfactual", async () => {
  const suite = await loadDevelopmentSuite(suitePath);
  const benchmarkCase = suite.cases.find(
    ({ id }) => id === "localized-template-cache",
  );
  const root = await mkdtemp(path.join(os.tmpdir(), "lp-staged-rename-"));
  try {
    const workspace = path.join(root, "workspace");
    await materializeWorkspaceSnapshot(
      benchmarkCase.workspace_snapshot,
      workspace,
    );
    const baselineTest = path.join(workspace, "test", "resolver.test.mjs");
    await writeFile(
      baselineTest,
      `${await readFile(baselineTest, "utf8")}\n${collisionRegressionBlock}`,
    );
    const baselineHead = initializeFixtureGit(workspace);
    await writeFile(
      path.join(workspace, "src", "cache-key.mjs"),
      collisionFreeCacheKeySource,
    );
    await rename(
      baselineTest,
      path.join(workspace, "test", "resolver-renamed.test.mjs"),
    );
    execFileSync("git", ["add", "-A"], {
      cwd: workspace,
      stdio: "ignore",
    });
    const state = await inspectBenchmarkGitState({ baselineHead, workspace });
    assert.deepEqual(state.changed_paths, [
      "src/cache-key.mjs",
      "test/resolver-renamed.test.mjs",
      "test/resolver.test.mjs",
    ]);
    const result = await runArtifactRegressionGates({
      baselineHead,
      changedPaths: state.changed_paths,
      gates: await hydratedCacheArtifactGates(),
      testGlobs: benchmarkCase.change_policy.tests,
      workspace,
    });
    assert.equal(result.status, "FAIL");
    assert.deepEqual(result.gates[0].reasons, [
      "baseline-test counterfactual already killed a semantic fault",
    ]);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("pristine fixtures pass visible tests but fail hidden acceptance tests", async () => {
  const suite = await loadDevelopmentSuite(suitePath);

  for (const benchmarkCase of suite.cases) {
    const root = await mkdtemp(path.join(os.tmpdir(), `leanpowers-${benchmarkCase.id}-`));
    try {
      const workspace = path.join(root, "workspace");
      await cp(new URL(benchmarkCase.workspace, suitePath), workspace, {
        recursive: true,
      });
      const result = await runVerifier({
        workspace,
        verifierSnapshots: benchmarkCase.verifier_snapshots,
      });

      assert.equal(result.visible.exit_code, 0, `${benchmarkCase.id} visible tests`);
      assert.notEqual(result.hidden.exit_code, 0, `${benchmarkCase.id} hidden tests`);
      assert.ok(result.hidden.output.includes("fail"), benchmarkCase.id);
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  }
});

test("hidden verification exposes neither semantic phase paths nor verifier files", async () => {
  const suite = await loadDevelopmentSuite(suitePath);
  const benchmarkCase = suite.cases.find(({ id }) => id === "localized-template-cache");
  const root = await mkdtemp(path.join(os.tmpdir(), "lp-phase-probe-"));
  try {
    const workspace = path.join(root, "workspace");
    await cp(new URL(benchmarkCase.workspace, suitePath), workspace, {
      recursive: true,
    });
    await writeFile(
      path.join(workspace, "src", "cache-key.mjs"),
      [
        'import { readdirSync } from "node:fs";',
        "",
        "export function templateCacheKey(name, locale) {",
        '  const phasePathVisible = process.cwd().includes("hidden-workspace");',
        '  const injectedVerifierVisible = readdirSync("test").some((file) =>',
        '    file.startsWith("benchmark-hidden-"));',
        "  if (phasePathVisible || injectedVerifierVisible) {",
        "    return JSON.stringify([name, locale]);",
        "  }",
        "  return `${name}:${locale}`;",
        "}",
        "",
      ].join("\n"),
    );
    const result = await runVerifier({
      workspace,
      verifierSnapshots: benchmarkCase.verifier_snapshots,
    });
    assert.equal(result.visible.exit_code, 0, result.visible.output);
    assert.notEqual(result.hidden.exit_code, 0, result.hidden.output);
    assert.match(result.hidden.output, /collision-free/u);
    assert.ok(!JSON.stringify(result).includes("hidden-workspace"));
    assert.ok(!JSON.stringify(result).includes("benchmark-hidden-"));
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("localized cache hidden acceptance rejects sampled delimiter-composite keys", async () => {
  const suite = await loadDevelopmentSuite(suitePath);
  const benchmarkCase = suite.cases.find(({ id }) => id === "localized-template-cache");
  assert.ok(benchmarkCase);

  for (const [index, separator] of [":", "|", "/", "\u001f", "::", "<->"].entries()) {
    const root = await mkdtemp(path.join(os.tmpdir(), `leanpowers-cache-separator-${index}-`));
    try {
      const workspace = path.join(root, "workspace");
      await cp(new URL(benchmarkCase.workspace, suitePath), workspace, {
        recursive: true,
      });
      await writeFile(
        path.join(workspace, "src", "cache-key.mjs"),
        `export function templateCacheKey(name, locale) {\n  return \`${"${name}"}${separator}${"${locale}"}\`;\n}\n`,
      );
      const result = await runVerifier({
        workspace,
        verifierFiles: benchmarkCase.verifier_files.map((file) =>
          new URL(file, suitePath)
        ),
      });

      assert.equal(result.visible.exit_code, 0, `${separator} visible tests`);
      assert.notEqual(result.hidden.exit_code, 0, `${separator} hidden tests`);
      assert.match(result.hidden.output, /collision-free/u);
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  }
});

test("localized cache hidden acceptance rejects either omitted identity component", async () => {
  const suite = await loadDevelopmentSuite(suitePath);
  const benchmarkCase = suite.cases.find(({ id }) => id === "localized-template-cache");
  assert.ok(benchmarkCase);

  for (const [index, expression] of ["name", "locale"].entries()) {
    const root = await mkdtemp(path.join(os.tmpdir(), `leanpowers-cache-omission-${index}-`));
    try {
      const workspace = path.join(root, "workspace");
      await cp(new URL(benchmarkCase.workspace, suitePath), workspace, {
        recursive: true,
      });
      await writeFile(
        path.join(workspace, "src", "cache-key.mjs"),
        `export function templateCacheKey(name, locale) {\n  return ${expression};\n}\n`,
      );
      const result = await runVerifier({
        workspace,
        verifierFiles: benchmarkCase.verifier_files.map((file) =>
          new URL(file, suitePath)
        ),
      });
      assert.equal(result.visible.exit_code, 0);
      assert.notEqual(result.hidden.exit_code, 0);
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  }
});

test("localized cache regression adequacy satisfies pre-registered semantic fault families", async () => {
  const suite = await loadDevelopmentSuite(suitePath);
  const benchmarkCase = suite.cases.find(({ id }) => id === "localized-template-cache");
  assert.ok(benchmarkCase?.artifact_regression_gates);

  const root = await mkdtemp(path.join(os.tmpdir(), "leanpowers-cache-mutation-"));
  try {
    const workspace = path.join(root, "workspace");
    await cp(new URL(benchmarkCase.workspace, suitePath), workspace, {
      recursive: true,
    });
    const baselineHead = initializeFixtureGit(workspace);
    await writeFile(
      path.join(workspace, "src", "cache-key.mjs"),
      collisionFreeCacheKeySource,
    );

    const gates = await hydratedCacheArtifactGates();
    const verifierFiles = benchmarkCase.verifier_files.map((file) =>
      new URL(file, suitePath)
    );
    const normal = await runVerifier({
      workspace,
      verifierFiles,
    });
    assert.equal(normal.visible.exit_code, 0, normal.visible.output);
    assert.equal(normal.hidden.exit_code, 0, normal.hidden.output);

    const insufficient = await runArtifactRegressionGates({
      baselineHead,
      changedPaths: ["src/cache-key.mjs"],
      gates,
      testGlobs: benchmarkCase.change_policy.tests,
      workspace,
    });
    assert.equal(insufficient.status, "FAIL");
    assert.deepEqual(insufficient.gates[0].changed_visible_test_paths, []);
    assert.deepEqual(insufficient.gates[0].reasons, [
      "no candidate visible test delta",
    ]);

    const regressionPath = path.join(workspace, "test", "resolver.test.mjs");
    const existingTests = await readFile(regressionPath, "utf8");
    await writeFile(
      regressionPath,
      `${existingTests}\n${collisionRegressionBlock}`,
    );
    const adequateNormal = await runVerifier({ workspace, verifierFiles });
    assert.equal(
      adequateNormal.visible.exit_code,
      0,
      adequateNormal.visible.output,
    );
    assert.equal(
      adequateNormal.hidden.exit_code,
      0,
      adequateNormal.hidden.output,
    );
    const fingerprintBefore = await fingerprintBenchmarkWorkspace({
      baselineHead,
      workspace,
    });
    const adequate = await runArtifactRegressionGates({
      baselineHead,
      changedPaths: ["src/cache-key.mjs", "test/resolver.test.mjs"],
      gates,
      testGlobs: benchmarkCase.change_policy.tests,
      workspace,
    });
    assert.equal(adequate.status, "PASS");
    assert.deepEqual(adequate.required_gate_ids, [
      "component-inclusion",
      "collision-free-composition",
    ]);
    for (const gate of adequate.gates) {
      assert.deepEqual(gate.changed_visible_test_paths, [
        "test/resolver.test.mjs",
      ]);
      assert.equal(gate.member_count, gate.members.length);
      assert.match(gate.mutation_manifest_sha256, /^[a-f0-9]{64}$/u);
      assert.ok(gate.members.every((member) =>
        member.baseline_tests_mutant_visible.exit_code === 0
      ));
      assert.ok(gate.members.some((member) => member.killed));
    }
    assert.equal(adequate.gates[0].policy, "all-kill");
    assert.equal(adequate.gates[1].policy, "all-kill");
    assert.match(
      adequate.gates[1].members.find(({ killed }) => killed)
        .candidate_tests_mutant_visible.output,
      /delimiter-colliding tuples/u,
    );
    assert.equal(
      await fingerprintBenchmarkWorkspace({ baselineHead, workspace }),
      fingerprintBefore,
    );
    const serializedEvidence = JSON.stringify(adequate);
    assert.match(serializedEvidence, /component-inclusion/u);
    assert.match(serializedEvidence, /collision-free-composition/u);
    assert.match(serializedEvidence, /src\/cache-key\.mjs/u);
    assert.match(serializedEvidence, /mutation_manifest_sha256/u);
    assert.match(serializedEvidence, /replacement_sha256/u);
    assert.match(serializedEvidence, /sandbox/u);
    for (const gate of gates) {
      for (const mutation of gate.mutations) {
        assert.ok(!serializedEvidence.includes(mutation.replacement));
      }
    }
    assert.ok(!serializedEvidence.includes("naive-colon"));
    assert.ok(!serializedEvidence.includes(".source"));
    assert.ok(!serializedEvidence.includes(workspace));
    assert.ok(!serializedEvidence.includes(os.homedir()));
    assert.ok(!serializedEvidence.includes("file://"));
    const publicEvidence = summarizeArtifactRegressionEvidence(adequate);
    const publicSerialized = JSON.stringify(publicEvidence);
    assert.deepEqual(Object.keys(publicEvidence).sort(), [
      "gates",
      "required_gate_ids",
      "status",
    ]);
    assert.equal(publicEvidence.gates[0].baseline_pass_count, 2);
    assert.equal(publicEvidence.gates[0].candidate_complete_count, 2);
    assert.equal(publicEvidence.gates[0].killed_member_count, 2);
    assert.equal(publicEvidence.gates[1].baseline_pass_count, 1);
    assert.equal(publicEvidence.gates[1].candidate_complete_count, 1);
    assert.equal(publicEvidence.gates[1].killed_member_count, 1);
    assert.doesNotMatch(publicSerialized, /replacement_sha256|members|delimiter-colliding|a:b/u);
    assert.match(publicSerialized, /evidence_sha256/u);

    await writeFile(
      regressionPath,
      `${existingTests}\n${componentOnlyRegressionBlock}`,
    );
    const componentOnly = await runArtifactRegressionGates({
      baselineHead,
      changedPaths: ["src/cache-key.mjs", "test/resolver.test.mjs"],
      gates,
      testGlobs: benchmarkCase.change_policy.tests,
      workspace,
    });
    assert.equal(componentOnly.status, "FAIL");
    assert.equal(componentOnly.gates[0].status, "PASS");
    assert.equal(componentOnly.gates[1].status, "FAIL");
    assert.deepEqual(componentOnly.gates[1].reasons, [
      "candidate visible tests did not kill every semantic fault member",
    ]);

    await writeFile(
      regressionPath,
      `${existingTests}\n${componentOnlyRegressionBlock}\n${nonBoundaryAnagramRegressionBlock}`,
    );
    const anagramOnly = await runArtifactRegressionGates({
      baselineHead,
      changedPaths: ["src/cache-key.mjs", "test/resolver.test.mjs"],
      gates,
      testGlobs: benchmarkCase.change_policy.tests,
      workspace,
    });
    assert.equal(anagramOnly.status, "FAIL");
    assert.equal(anagramOnly.gates[0].status, "PASS");
    assert.equal(anagramOnly.gates[1].status, "FAIL");
    assert.equal(anagramOnly.gates[1].members[0].killed, false);
    assert.equal(
      anagramOnly.gates[1].members[0].candidate_tests_mutant_visible.exit_code,
      0,
    );
    assert.deepEqual(anagramOnly.gates[1].reasons, [
      "candidate visible tests did not kill every semantic fault member",
    ]);

    for (const separator of ["|", "<->", "XYZ"]) {
      await writeFile(
        regressionPath,
        `${existingTests}\n${collisionRegressionBlockFor(separator)}`,
      );
      const alternateRepresentative = await runArtifactRegressionGates({
        baselineHead,
        changedPaths: ["src/cache-key.mjs", "test/resolver.test.mjs"],
        gates,
        testGlobs: benchmarkCase.change_policy.tests,
        workspace,
      });
      assert.equal(
        alternateRepresentative.status,
        "PASS",
        `separator ${separator}`,
      );
      assert.equal(alternateRepresentative.gates[1].members[0].killed, true);
    }
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("artifact regression gates attribute mutant kills only to substantive test deltas", async () => {
  const suite = await loadDevelopmentSuite(suitePath);
  const benchmarkCase = suite.cases.find(({ id }) => id === "localized-template-cache");
  const gates = await hydratedCacheArtifactGates();
  const root = await mkdtemp(path.join(os.tmpdir(), "leanpowers-artifact-matrix-"));
  const createWorkspace = async (name) => {
    const workspace = path.join(root, name);
    await cp(new URL(benchmarkCase.workspace, suitePath), workspace, {
      recursive: true,
    });
    return workspace;
  };
  const runGate = (workspace, baselineHead, changedPaths, selectedGates = gates) =>
    runArtifactRegressionGates({
      baselineHead,
      changedPaths,
      gates: selectedGates,
      testGlobs: benchmarkCase.change_policy.tests,
      workspace,
    });
  try {
    const variableExportShape = await createWorkspace("variable-export-shape");
    const variableExportHead = initializeFixtureGit(variableExportShape);
    await writeFile(
      path.join(variableExportShape, "src", "cache-key.mjs"),
      collisionFreeCacheKeyConstExportSource,
    );
    await writeFile(
      path.join(variableExportShape, "test", "collision.test.mjs"),
      collisionRegressionSource,
    );
    const variableExportNormal = await runVerifier({
      workspace: variableExportShape,
      verifierFiles: benchmarkCase.verifier_files.map((file) =>
        new URL(file, suitePath)
      ),
    });
    assert.equal(
      variableExportNormal.visible.exit_code,
      0,
      variableExportNormal.visible.output,
    );
    assert.equal(
      variableExportNormal.hidden.exit_code,
      0,
      variableExportNormal.hidden.output,
    );
    const variableExportResult = await runGate(
      variableExportShape,
      variableExportHead,
      ["src/cache-key.mjs", "test/collision.test.mjs"],
    );
    assert.equal(
      variableExportResult.status,
      "PASS",
      JSON.stringify(variableExportResult),
    );

    const regexLiteralTarget = await createWorkspace("regex-literal-target");
    await writeFile(
      path.join(regexLiteralTarget, "test", "resolver.test.mjs"),
      baselineWithoutTargetImportSource,
    );
    const regexLiteralHead = initializeFixtureGit(regexLiteralTarget);
    await writeFile(
      path.join(regexLiteralTarget, "src", "cache-key.mjs"),
      collisionFreeCacheKeyWithRegexSource,
    );
    await writeFile(
      path.join(regexLiteralTarget, "test", "collision.test.mjs"),
      collisionRegressionSource,
    );
    const regexLiteralResult = await runGate(
      regexLiteralTarget,
      regexLiteralHead,
      ["src/cache-key.mjs", "test/collision.test.mjs"],
    );
    assert.equal(regexLiteralResult.status, "PASS", JSON.stringify(regexLiteralResult));

    const nestedTemplateTarget = await createWorkspace("nested-template-target");
    const nestedTemplateHead = initializeFixtureGit(nestedTemplateTarget);
    await writeFile(
      path.join(nestedTemplateTarget, "src", "cache-key.mjs"),
      collisionFreeCacheKeyWithNestedTemplateSource,
    );
    await writeFile(
      path.join(nestedTemplateTarget, "test", "collision.test.mjs"),
      collisionRegressionSource,
    );
    const nestedTemplateResult = await runGate(
      nestedTemplateTarget,
      nestedTemplateHead,
      ["src/cache-key.mjs", "test/collision.test.mjs"],
    );
    assert.equal(
      nestedTemplateResult.status,
      "PASS",
      JSON.stringify(nestedTemplateResult),
    );

    const added = await createWorkspace("added");
    const addedHead = initializeFixtureGit(added);
    await writeFile(path.join(added, "src", "cache-key.mjs"), collisionFreeCacheKeySource);
    await writeFile(
      path.join(added, "test", "collision.test.mjs"),
      collisionRegressionSource,
    );
    const addedResult = await runGate(added, addedHead, [
      "src/cache-key.mjs",
      "test/collision.test.mjs",
    ]);
    assert.equal(addedResult.status, "PASS", JSON.stringify(addedResult));
    assert.deepEqual(addedResult.gates[0].changed_visible_test_paths, [
      "test/collision.test.mjs",
    ]);

    const collisionOnly = await createWorkspace("collision-only");
    const collisionOnlyHead = initializeFixtureGit(collisionOnly);
    await writeFile(
      path.join(collisionOnly, "src", "cache-key.mjs"),
      collisionFreeCacheKeySource,
    );
    await writeFile(
      path.join(collisionOnly, "test", "collision.test.mjs"),
      delimiterOnlyRegressionSource,
    );
    const collisionOnlyResult = await runGate(
      collisionOnly,
      collisionOnlyHead,
      ["src/cache-key.mjs", "test/collision.test.mjs"],
    );
    assert.equal(collisionOnlyResult.status, "FAIL");
    assert.equal(collisionOnlyResult.gates[0].status, "FAIL");
    assert.equal(collisionOnlyResult.gates[1].status, "PASS");

    const deleted = await createWorkspace("deleted");
    const deletedHead = initializeFixtureGit(deleted);
    await writeFile(path.join(deleted, "src", "cache-key.mjs"), collisionFreeCacheKeySource);
    await rm(path.join(deleted, "test", "resolver.test.mjs"));
    const deletedResult = await runGate(deleted, deletedHead, [
      "src/cache-key.mjs",
      "test/resolver.test.mjs",
    ]);
    assert.deepEqual(deletedResult.gates[0].reasons, [
      "no candidate visible test delta",
    ]);

    const renamed = await createWorkspace("renamed");
    const renamedHead = initializeFixtureGit(renamed);
    await writeFile(path.join(renamed, "src", "cache-key.mjs"), collisionFreeCacheKeySource);
    await rename(
      path.join(renamed, "test", "resolver.test.mjs"),
      path.join(renamed, "test", "resolver-renamed.test.mjs"),
    );
    const renamedResult = await runGate(renamed, renamedHead, [
      "src/cache-key.mjs",
      "test/resolver.test.mjs",
      "test/resolver-renamed.test.mjs",
    ]);
    assert.deepEqual(renamedResult.gates[0].reasons, [
      "candidate visible tests did not kill every semantic fault member",
    ]);

    const survivor = await createWorkspace("survivor");
    const survivorHead = initializeFixtureGit(survivor);
    await writeFile(path.join(survivor, "src", "cache-key.mjs"), collisionFreeCacheKeySource);
    const survivorTest = path.join(survivor, "test", "resolver.test.mjs");
    await writeFile(
      survivorTest,
      `${await readFile(survivorTest, "utf8")}\ntest("unrelated arithmetic", () => assert.equal(2 + 2, 4));\n`,
    );
    const survivorResult = await runGate(survivor, survivorHead, [
      "src/cache-key.mjs",
      "test/resolver.test.mjs",
    ]);
    assert.deepEqual(survivorResult.gates[0].reasons, [
      "candidate visible tests did not kill every semantic fault member",
    ]);

    const unrelatedExport = await createWorkspace("unrelated-export");
    const unrelatedExportHead = initializeFixtureGit(unrelatedExport);
    await writeFile(
      path.join(unrelatedExport, "src", "cache-key.mjs"),
      collisionFreeCacheKeyWithExtraExportSource,
    );
    await writeFile(
      path.join(unrelatedExport, "test", "candidate-export.test.mjs"),
      candidateOnlyExportTestSource,
    );
    const unrelatedExportResult = await runGate(
      unrelatedExport,
      unrelatedExportHead,
      ["src/cache-key.mjs", "test/candidate-export.test.mjs"],
    );
    assert.equal(unrelatedExportResult.status, "FAIL");
    assert.ok(unrelatedExportResult.gates.every((gate) =>
      gate.members.every((member) =>
        member.candidate_tests_mutant_visible.exit_code === 0
      )
    ));
    assert.ok(unrelatedExportResult.gates.every((gate) =>
      gate.reasons.includes(
        "candidate visible tests did not kill every semantic fault member",
      )
    ));

    const defaultExport = await createWorkspace("default-export");
    const defaultExportHead = initializeFixtureGit(defaultExport);
    await writeFile(
      path.join(defaultExport, "src", "cache-key.mjs"),
      collisionFreeCacheKeyWithDefaultExportSource,
    );
    await writeFile(
      path.join(defaultExport, "test", "candidate-default.test.mjs"),
      candidateOnlyDefaultExportTestSource,
    );
    const defaultExportResult = await runGate(
      defaultExport,
      defaultExportHead,
      ["src/cache-key.mjs", "test/candidate-default.test.mjs"],
    );
    assert.equal(defaultExportResult.status, "FAIL");
    assert.ok(defaultExportResult.gates.every((gate) =>
      gate.members.every((member) =>
        member.candidate_tests_mutant_visible.exit_code === 0 &&
        member.killed === false
      )
    ));

    const layoutProbe = await createWorkspace("layout-probe");
    const layoutProbeHead = initializeFixtureGit(layoutProbe);
    await writeFile(
      path.join(layoutProbe, "src", "cache-key.mjs"),
      collisionFreeCacheKeySource,
    );
    await writeFile(
      path.join(layoutProbe, "test", "layout.test.mjs"),
      candidateLayoutProbeSource,
    );
    const normalLayout = await runVerifier({
      workspace: layoutProbe,
      verifierFiles: benchmarkCase.verifier_files.map((file) =>
        new URL(file, suitePath)
      ),
    });
    assert.equal(normalLayout.visible.exit_code, 0, normalLayout.visible.output);
    assert.equal(normalLayout.hidden.exit_code, 0, normalLayout.hidden.output);
    const layoutResult = await runGate(
      layoutProbe,
      layoutProbeHead,
      ["src/cache-key.mjs", "test/layout.test.mjs"],
    );
    assert.equal(layoutResult.status, "FAIL");
    assert.ok(layoutResult.gates.every((gate) =>
      gate.members.every((member) =>
        member.candidate_tests_mutant_visible.exit_code === 0 &&
        member.killed === false
      )
    ));

    const phaseProbe = await createWorkspace("phase-probe");
    const phaseProbeHead = initializeFixtureGit(phaseProbe);
    await writeFile(
      path.join(phaseProbe, "src", "cache-key.mjs"),
      collisionFreeCacheKeySource,
    );
    const phaseProbeTest = path.join(phaseProbe, "test", "resolver.test.mjs");
    await writeFile(
      phaseProbeTest,
      `${await readFile(phaseProbeTest, "utf8")}\n` +
        'test("does not infer mutation phase from cwd", () => {\n' +
        '  if (process.cwd().includes("artifact-candidate")) throw new Error("phase leak");\n' +
        "});\n",
    );
    const phaseProbeResult = await runGate(phaseProbe, phaseProbeHead, [
      "src/cache-key.mjs",
      "test/resolver.test.mjs",
    ]);
    assert.deepEqual(phaseProbeResult.gates[0].reasons, [
      "candidate visible tests did not kill every semantic fault member",
    ]);
    assert.ok(!JSON.stringify(phaseProbeResult).includes("artifact-candidate"));

    const baselineKill = await createWorkspace("baseline-kill");
    const baselineTest = path.join(baselineKill, "test", "resolver.test.mjs");
    await writeFile(
      baselineTest,
      `${await readFile(baselineTest, "utf8")}\n${collisionRegressionBlock}`,
    );
    const baselineKillHead = initializeFixtureGit(baselineKill);
    await writeFile(
      path.join(baselineKill, "src", "cache-key.mjs"),
      collisionFreeCacheKeySource,
    );
    await writeFile(
      baselineTest,
      `${await readFile(baselineTest, "utf8")}\n// candidate-only touch\n`,
    );
    const baselineKillResult = await runGate(baselineKill, baselineKillHead, [
      "src/cache-key.mjs",
      "test/resolver.test.mjs",
    ]);
    assert.deepEqual(baselineKillResult.gates[0].reasons, [
      "baseline-test counterfactual already killed a semantic fault",
    ]);
    assert.deepEqual(baselineKillResult.gates[1].reasons, [
      "baseline-test counterfactual already killed a semantic fault",
    ]);

    const changedSnapshot = structuredClone(gates[0]);
    changedSnapshot.mutations[0].replacement += "// changed after suite load\n";
    const changedSnapshotResult = await runGate(
      survivor,
      survivorHead,
      ["src/cache-key.mjs", "test/resolver.test.mjs"],
      [changedSnapshot],
    );
    assert.deepEqual(changedSnapshotResult.gates[0].reasons, [
      "mutation family snapshot did not match replacement content",
    ]);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("verifier copies are phase-isolated, preserve candidate files, and redact paths", async () => {
  const suite = await loadDevelopmentSuite(suitePath);
  const benchmarkCase = suite.cases.find(({ id }) => id === "localized-template-cache");
  const root = await mkdtemp(path.join(os.tmpdir(), "leanpowers-verifier-isolation-"));
  try {
    const workspace = path.join(root, "workspace");
    await cp(new URL(benchmarkCase.workspace, suitePath), workspace, {
      recursive: true,
    });
    const ownedHiddenPath = path.join(
      workspace,
      "test",
      "benchmark-hidden-01.test.mjs",
    );
    const hostReadSentinel = path.join(root, "host-read-sentinel.txt");
    await writeFile(hostReadSentinel, "host-only\n");
    const ownedHidden = [
      'import assert from "node:assert/strict";',
      'import test from "node:test";',
      'import { readFileSync, readdirSync, writeFileSync } from "node:fs";',
      'import net from "node:net";',
      'import os from "node:os";',
      'import path from "node:path";',
      `const originalSentinel = ${JSON.stringify(path.join(workspace, "sandbox-escape.txt"))};`,
      `const hostReadSentinel = ${JSON.stringify(hostReadSentinel)};`,
      "console.log(process.cwd());",
      "console.log(process.env.HOME);",
      "console.log(os.userInfo().username);",
      "console.log(new URL(import.meta.url).href);",
      'test("candidate tests cannot mutate the verifier workspace", () => {',
      "  assert.throws(() => writeFileSync(path.join(process.cwd(), \"package.json\"), \"{}\"), (error) =>",
      '    ["EACCES", "EPERM", "EROFS"].includes(error?.code));',
      "});",
      'test("cannot read host files outside the evaluation root", () => {',
      "  assert.throws(() => readFileSync(hostReadSentinel), (error) =>",
      '    ["EACCES", "EPERM", "ENOENT"].includes(error?.code));',
      "});",
      'test("cannot read host identity files", () => {',
      '  assert.throws(() => readFileSync("/etc/passwd"), (error) =>',
      '    ["EACCES", "EPERM", "ENOENT"].includes(error?.code));',
      "});",
      'test("hidden verifier source is not injected into candidate files", () => {',
      '  assert.deepEqual(readdirSync("test").filter((file) => file.startsWith("benchmark-hidden-")),',
      '    ["benchmark-hidden-01.test.mjs"]);',
      "});",
      'test("cannot write the original workspace", () => {',
      '  assert.throws(() => writeFileSync(originalSentinel, "escaped"), (error) =>',
      '    ["EACCES", "EPERM", "EROFS"].includes(error?.code));',
      "});",
      'test("cannot open an external network connection", async () => {',
      "  await new Promise((resolve, reject) => {",
      '    const socket = net.createConnection({ host: "1.1.1.1", port: 80 });',
      "    const timer = setTimeout(() => { socket.destroy(); reject(new Error(\"network attempt timed out\")); }, 1500);",
      "    socket.once(\"connect\", () => { clearTimeout(timer); socket.destroy(); reject(new Error(\"network was reachable\")); });",
      "    socket.once(\"error\", (error) => {",
      "      clearTimeout(timer);",
      '      if (["EACCES", "ENETDOWN", "ENETUNREACH", "EPERM"].includes(error?.code)) resolve();',
      "      else reject(error);",
      "    });",
      "  });",
      "});",
      "",
    ].join("\n");
    await writeFile(ownedHiddenPath, ownedHidden);
    const baselineHead = initializeFixtureGit(workspace);
    const fingerprint = await fingerprintBenchmarkWorkspace({ baselineHead, workspace });
    const result = await runVerifier({
      workspace,
      verifierFiles: benchmarkCase.verifier_files.map((file) =>
        new URL(file, suitePath)
      ),
    });
    assert.equal(result.visible.exit_code, 0, result.visible.output);
    assert.notEqual(result.hidden.exit_code, 0, result.hidden.output);
    assert.equal(await readFile(ownedHiddenPath, "utf8"), ownedHidden);
    await assert.rejects(readFile(path.join(workspace, "sandbox-escape.txt")));
    assert.equal(
      await fingerprintBenchmarkWorkspace({ baselineHead, workspace }),
      fingerprint,
    );
    const evidence = JSON.stringify(result);
    assert.ok(!evidence.includes(workspace));
    assert.ok(!evidence.includes(os.homedir()));
    assert.ok(!evidence.includes(os.userInfo().username));
    assert.ok(!evidence.includes("file://"));
    assert.doesNotMatch(evidence, /\/private\/(?:tmp|var)\//u);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("workspace symlinks fail verifier and artifact gates without touching the target", {
  skip: process.platform === "win32",
}, async () => {
  const suite = await loadDevelopmentSuite(suitePath);
  const benchmarkCase = suite.cases.find(({ id }) => id === "localized-template-cache");
  const root = await mkdtemp(path.join(os.tmpdir(), "leanpowers-symlink-"));
  try {
    const workspace = path.join(root, "workspace");
    await cp(new URL(benchmarkCase.workspace, suitePath), workspace, {
      recursive: true,
    });
    const baselineHead = initializeFixtureGit(workspace);
    const target = path.join(workspace, "src", "cache-key.mjs");
    const original = await readFile(target, "utf8");
    const testPath = path.join(workspace, "test", "resolver.test.mjs");
    await writeFile(
      testPath,
      `${await readFile(testPath, "utf8")}\n${collisionRegressionBlock}`,
    );
    await symlink(target, path.join(workspace, ".git", "candidate-target-link"));
    const verifier = await runVerifier({
      workspace,
      verifierFiles: benchmarkCase.verifier_files.map((file) =>
        new URL(file, suitePath)
      ),
    });
    assert.equal(
      verifier.visible.output,
      "workspace symlinks are unsupported by the verifier",
    );
    const artifact = await runArtifactRegressionGates({
      baselineHead,
      changedPaths: ["test/resolver.test.mjs"],
      gates: await hydratedCacheArtifactGates(),
      testGlobs: benchmarkCase.change_policy.tests,
      workspace,
    });
    assert.deepEqual(artifact.gates[0].reasons, [
      "workspace symlinks are unsupported by artifact regression gates",
    ]);
    assert.equal(await readFile(target, "utf8"), original);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("pilot suite and fixture paths contain no machine-specific values", async () => {
  const raw = await readFile(suitePath, "utf8");
  assert.ok(!raw.includes(os.homedir()));
  assert.ok(!raw.includes("file://"));
});
