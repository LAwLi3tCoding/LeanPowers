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
  inspectBenchmarkGitState,
  loadDevelopmentSuite,
  makePilotResult,
  parseClaudeResult,
  parseCodexResult,
  resolveDevelopmentOutputDirectory,
  runVerifier,
} from "../scripts/lib/development-benchmark.mjs";

const suitePath = new URL(
  "../evals/development-effects/pilot-suite.json",
  import.meta.url,
);

test("development pilot declares three executable scenario classes", async () => {
  const suite = await loadDevelopmentSuite(suitePath);

  assert.equal(suite.schema_version, 1);
  assert.equal(suite.evidence_level, "paired-development-pilot");
  assert.equal(suite.repetitions, 2);
  assert.deepEqual(suite.workflow_entrypoints, {
    "superpowers-6.1.1": "$superpowers:using-superpowers",
    "leanpowers-0.2.0": "$leanpowers:route",
  });
  assert.deepEqual(
    suite.cases.map(({ scenario_class }) => scenario_class),
    [
      "small-explicit-feature",
      "unknown-cause-defect",
      "security-authorization-or-data-risk",
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
  assert.ok(!args.join(" ").includes("superpowers-6.1.1"));
  assert.ok(!args.join(" ").includes("leanpowers-0.2.0"));
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

test("a run passes only with activation, agent completion, tests, and scope intact", () => {
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
    { activation_reported: false },
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
  }]);
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
