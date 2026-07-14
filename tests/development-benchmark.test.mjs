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
  evaluateChangedPaths,
  evaluateRunOutcome,
  evaluateWorkflowConformance,
  extractDeclaredRisk,
  inspectBenchmarkGitState,
  loadDevelopmentSuite,
  makePilotResult,
  parseClaudeResult,
  parseCodexResult,
  resolveDevelopmentOutputDirectory,
  reportsWorkflowActivation,
  runVerifier,
} from "../scripts/lib/development-benchmark.mjs";

const suitePath = new URL(
  "../evals/development-effects/pilot-suite.json",
  import.meta.url,
);

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
    suite.cases.map(({ scenario_class, risk_level }) => [scenario_class, risk_level]),
    [
      ["small-explicit-feature", "lean"],
      ["unknown-cause-defect", "standard"],
      ["security-authorization-or-data-risk", "strict"],
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
  });
});

test("Codex trace proves independent review only after reviewer spawn and completed wait", () => {
  const contract = "Prefix sha256=; hexadecimal characters in either case.";
  const parsed = parseCodexResult([
    JSON.stringify({
      type: "item.completed",
      item: {
        type: "collab_tool_call",
        tool: "spawn_agent",
        prompt: `Review the strict-risk diff and tests. Original task: ${contract}`,
        receiver_thread_ids: ["reviewer"],
        agents_states: { reviewer: { status: "running" } },
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
    JSON.stringify({
      type: "turn.completed",
      usage: { input_tokens: 10, cached_input_tokens: 0, output_tokens: 5 },
    }),
  ].join("\n"), { expectedReviewContract: contract });

  assert.equal(parsed.workflow_trace.independent_review_pass_observed, true);
  assert.equal(
    parsed.workflow_trace.independent_review_contract_verbatim_observed,
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
      declared_risk: "strict",
      risk_level: "strict",
      telemetry: {
        workflow_trace: {
          independent_review_pass_observed: true,
          independent_review_contract_verbatim_observed: true,
        },
      },
    }),
    { status: "PASS", reasons: [] },
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
        },
      },
    }).status,
    "FAIL",
  );
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

    await writeFile(path.join(workspace, "outside.txt"), "committed by agent\n");
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
