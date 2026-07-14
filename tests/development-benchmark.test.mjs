import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  benchmarkEnvironment,
  buildClaudeArgs,
  buildCodexArgs,
  createReviewerWorkspaceMutationTracker,
  evaluateChangedPaths,
  evaluateRunOutcome,
  evaluateWorkflowConformance,
  extractDeclaredRisk,
  fingerprintBenchmarkWorkspace,
  inspectBenchmarkGitState,
  loadDevelopmentSuite,
  makePilotResult,
  parseClaudeResult,
  parseCodexResult,
  parseLeanRouteLedger,
  resolveDevelopmentOutputDirectory,
  reportsWorkflowActivation,
  runProcess,
  runVerifier,
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
    pre_patch_counterexample_observed: true,
    post_patch_clause_test_ledger_observed: false,
    patch_batches: 1,
    patch_file_events: 2,
    patch_paths: ["src/index.mjs", "test/index.test.mjs"],
    implementation_patch_observed: true,
    test_patch_observed: true,
    multi_file_patch_observed: true,
    post_change_command_calls: 1,
    validation_observed: true,
    post_change_validation_mode: workflow === "debug" ? "combined" : "canonical",
    final_validation_budget_observed: true,
    capsule_green_path_observed: true,
    post_change_reproduction_replayed: workflow === "debug",
    post_validation_tool_calls: 0,
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
    "Counterexample: behavior=current→changed→preserve current behavior",
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

  assert.equal(suite.schema_version, 1);
  assert.equal(suite.evidence_level, "paired-development-pilot");
  assert.equal(suite.repetitions, 2);
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
    "entrypoint: leanpowers:route\nworkflow: build\nrisk: strict",
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
  assert.deepEqual(
    parseLeanRouteLedger(
      "Invoking leanpowers:route to investigate a failed test | workflow=debug | risk=standard",
    ),
    {
      workflow: "debug",
      risk: "standard",
      required_gates: "[current_evidence]",
    },
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
      post_change_validation_mode: "separate",
    },
  );
  const outOfOrderReproduction = parseCodexResult(
    capsuleTraceEvents({ reproduceBeforeRead: true }).map(JSON.stringify).join("\n"),
    capsuleTraceOptions("debug"),
  ).workflow_trace.capsule_stage;
  assert.equal(outOfOrderReproduction.reproduce_observed, true);
  assert.equal(outOfOrderReproduction.ordered_reproduce_observed, false);
  assert.equal(outOfOrderReproduction.pre_change_stage_protocol_observed, false);
  assert.equal(outOfOrderReproduction.capsule_green_path_observed, false);
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
      "Counterexample: behavior=current→changed→preserve current behavior",
      "Counterexample: fixture=old→new→focused change",
    ].join("\n"),
  ]) {
    const invalidCounterexample = parseCodexResult(
      capsuleTraceEvents({ prePatchLedger }).map(JSON.stringify).join("\n"),
      capsuleTraceOptions("debug"),
    ).workflow_trace.capsule_stage;
    assert.equal(invalidCounterexample.pre_patch_counterexample_observed, false);
    assert.equal(invalidCounterexample.protocol_observed, false);
  }

  const validCounterexample = parseCodexResult(
    capsuleTraceEvents().map(JSON.stringify).join("\n"),
    capsuleTraceOptions("debug"),
  ).workflow_trace.capsule_stage;
  assert.equal(validCounterexample.pre_patch_counterexample_observed, true);
  assert.equal(validCounterexample.counterexample_presentation_count, 1);
  assert.equal(validCounterexample.clause_test_mapping_count, 2);

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
  assert.equal(unrelatedStage.pre_patch_clause_test_ledger_structure_observed, true);
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
  assert.equal(duplicatedPreserveStage.protocol_observed, false);
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
  assert.equal(duplicateBoundaryStage.protocol_observed, false);
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
        "Counterexample: cache=welcome-en→welcome-fr→unambiguous cache identity",
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

test("distilled live failures preserve ordered-stage truth", () => {
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
  assert.equal(failedDiscoverThenNoncanonicalRetry.stage_attempts.discover, 2);
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
  const cases = [
    [{ duplicateLedger: true }, "route_ledger_occurrences"],
    [{ finalMessage: trailingWhitespaceLedger }, "route_ledger_occurrences"],
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
  assert.equal(parse([
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
  }).strict_review_protocol_observed, true);
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
    head_unchanged: true,
    verifier: {
      visible: { exit_code: 0, timed_out: false },
      hidden: { exit_code: 0, timed_out: false },
    },
    changes: { violations: [] },
  };

  assert.deepEqual(evaluateRunOutcome(passing), { status: "PASS", reasons: [] });
  for (const mutation of [
    { agent_exit_code: 1 },
    { agent_timed_out: true },
    { agent_completed: false },
    { head_unchanged: false },
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
        "passing reviewer did not explicitly invoke leanpowers:review",
        "strict wait did not target only the designated reviewer",
        "reviewer workspace mutation check was not observed",
        "strict review cycles violated the one-reviewer protocol",
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
        "passing reviewer did not explicitly invoke leanpowers:review",
        "strict wait did not target only the designated reviewer",
        "reviewer workspace mutation check was not observed",
        "strict review cycles violated the one-reviewer protocol",
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
      independent_review_contract_verbatim_observed: true,
      independent_review_skill_invoked: false,
      independent_review_sole_wait_target_observed: true,
      reviewer_workspace_mutation_check_observed: true,
      strict_review_protocol_observed: true,
      post_change_spawn_calls: 1,
      post_change_wait_calls: 1,
    }, "passing reviewer did not explicitly invoke leanpowers:review"],
    [{
      independent_review_pass_observed: true,
      independent_review_contract_verbatim_observed: true,
      independent_review_skill_invoked: true,
      independent_review_sole_wait_target_observed: true,
      reviewer_workspace_mutation_check_observed: true,
      strict_review_protocol_observed: false,
      post_change_spawn_calls: 2,
      post_change_wait_calls: 1,
    }, "strict review cycles violated the one-reviewer protocol"],
    [{
      independent_review_pass_observed: true,
      independent_review_contract_verbatim_observed: true,
      independent_review_skill_invoked: true,
      independent_review_sole_wait_target_observed: false,
      reviewer_workspace_mutation_check_observed: true,
      strict_review_protocol_observed: true,
      post_change_spawn_calls: 1,
      post_change_wait_calls: 1,
    }, "strict wait did not target only the designated reviewer"],
    [{
      independent_review_pass_observed: true,
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
    assert.deepEqual(conformance, { status: "FAIL", reasons: [expectedReason] });
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
    [{ route_ledger_occurrences: 2 }, "route ledger was not emitted exactly once"],
    [{ ledger_before_tools_observed: false }, "route ledger was not emitted before task tools"],
    [{ ledger_keys_after_initial_observed: true }, null],
    [{ workflow_read_calls: 1 }, "capsule reloaded a Skill or reference"],
    [{
      pre_change_command_calls: 3,
      stage_retry_calls: 1,
      stage_attempts: { discover: 2, read: 1, reproduce: 0 },
    }, null],
    [{ pre_change_stage_protocol_observed: false }, "ordered pre-change stages with bounded evidence-backed retries were not observed"],
    [{ discover_observed: false }, "content-aware DISCOVER was not observed"],
    [{ read_observed: false }, "batched READ was not observed"],
    [{ validation_metadata_read_observed: false }, "READ omitted discovered validation metadata"],
    [{ patch_targets_read_observed: false }, "READ omitted discovered files that were later changed"],
    [{ grounded_candidates_read_observed: false }, "READ omitted grounded implementation, caller, or test candidates"],
    [{ pre_patch_clause_test_ledger_observed: false }, "pre-PATCH clause-to-test ledger was not observed"],
    [{ clause_coverage_observed: false }, "pre-PATCH clause-to-test ledger did not cover required boundaries"],
    [{ pre_patch_counterexample_observed: false }, "grounded pre-PATCH counterexample was not observed"],
    [{ post_patch_clause_test_ledger_observed: true }, "clause-to-test ledger was repeated after PATCH"],
    [{ patch_batches: 2 }, "one contiguous multi-file PATCH batch was not observed"],
    [{ implementation_patch_observed: false }, "one contiguous multi-file PATCH batch was not observed"],
    [{ test_patch_observed: false }, "one contiguous multi-file PATCH batch was not observed"],
    [{ multi_file_patch_observed: false }, "one contiguous multi-file PATCH batch was not observed"],
    [{ post_change_command_calls: 2 }, null],
    [{
      validation_observed: false,
      ordinary_stop_observed: false,
    }, "supported successful post-edit validation was not observed"],
    [{
      post_validation_tool_calls: 1,
      ordinary_stop_observed: false,
    }, "lean or standard capsule continued tooling after successful validation"],
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
    repetition: 1,
    activation_reported: true,
    changes: { violations: [], workflow: [] },
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
    risk_level: caseId === selectedCases[0].id ? "lean" : "standard",
    repetition,
    activation_reported: true,
    changes: { violations: [], workflow: [] },
    outcome: { status, reasons: [] },
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
    token_pairs: 1,
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
});

test("completion and pairing reject duplicate runs that mask a missing counterpart", async () => {
  const suite = await loadDevelopmentSuite(suitePath);
  const selectedCases = [suite.cases[0]];
  const duplicate = {
    workflow: "leanpowers-0.2.0",
    case_id: selectedCases[0].id,
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
        verifierFiles: benchmarkCase.verifier_files.map((file) =>
          new URL(file, suitePath)
        ),
      });

      assert.equal(result.visible.exit_code, 0, `${benchmarkCase.id} visible tests`);
      assert.notEqual(result.hidden.exit_code, 0, `${benchmarkCase.id} hidden tests`);
      assert.ok(result.hidden.output.includes("fail"), benchmarkCase.id);
    } finally {
      await rm(root, { force: true, recursive: true });
    }
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

test("pilot suite and fixture paths contain no machine-specific values", async () => {
  const raw = await readFile(suitePath, "utf8");
  assert.ok(!raw.includes(os.homedir()));
  assert.ok(!raw.includes("file://"));
});
