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
} from "../scripts/lib/development-benchmark.mjs";

const suitePath = new URL(
  "../evals/development-effects/pilot-suite.json",
  import.meta.url,
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

test("LeanPowers activation requires its exact first-progress entrypoint marker", () => {
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
      message: "entrypoint: leanpowers:route\nworkflow: build\nrisk: strict",
      workflow: "leanpowers-0.2.0",
    }),
    true,
  );
  assert.equal(
    reportsWorkflowActivation({
      entrypoint: "$leanpowers:route",
      message: "- entrypoint: `leanpowers:route`\n- workflow: build\n- risk: strict",
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

test("LeanPowers route ledger starts with exactly four resolved plain lines", () => {
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
  ]) {
    assert.equal(parseLeanRouteLedger(invalid), null, invalid);
  }
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
  ])) => parseCodexResult(events.map(JSON.stringify).join("\n"), {
    expectedReviewContract: contract,
    reviewerWorkspaceMutations,
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
      expected_workflow: "debug",
      declared_workflow: "build",
      declared_risk: "strict",
      risk_level: "strict",
      telemetry: {
        workflow_trace: {
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
      telemetry: { workflow_trace: workflowTrace },
    });
    assert.deepEqual(conformance, { status: "FAIL", reasons: [expectedReason] });
  }
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

test("pilot suite and fixture paths contain no machine-specific values", async () => {
  const raw = await readFile(suitePath, "utf8");
  assert.ok(!raw.includes(os.homedir()));
  assert.ok(!raw.includes("file://"));
});
