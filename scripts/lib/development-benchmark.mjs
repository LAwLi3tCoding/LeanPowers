import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import {
  access,
  chmod,
  cp,
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  readlink,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const WORKFLOWS = new Set(["superpowers-6.1.1", "leanpowers-0.2.0"]);
const PROJECT_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const SAFE_LOCAL_RESULTS_ROOT = path.join(PROJECT_ROOT, "evals", "results");
const TELEMETRY_ENV = Object.freeze({
  CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
  DISABLE_TELEMETRY: "1",
  SUPERPOWERS_DISABLE_TELEMETRY: "1",
});
const FALLBACK_BENCHMARK_PATH = [
  "/opt/homebrew/bin",
  "/usr/local/bin",
  "/usr/bin",
  "/bin",
  "/usr/sbin",
  "/sbin",
].join(path.delimiter);

export function benchmarkEnvironment(home, overrides = {}) {
  return {
    CI: "1",
    CODEX_HOME: home,
    GIT_CONFIG_NOSYSTEM: "1",
    HOME: home,
    LANG: "C.UTF-8",
    LC_ALL: "C",
    NO_COLOR: "1",
    PATH: FALLBACK_BENCHMARK_PATH,
    SHELL: process.platform === "win32" ? "cmd.exe" : "/bin/sh",
    TERM: "dumb",
    TMPDIR: path.join(home, "tmp"),
    ...TELEMETRY_ENV,
    ...overrides,
  };
}

export async function loadDevelopmentSuite(input) {
  const suiteUrl = toFileUrl(input);
  const suite = JSON.parse(await readFile(suiteUrl, "utf8"));
  const errors = [];

  if (suite.schema_version !== 1) errors.push("schema_version must equal 1");
  if (suite.evidence_level !== "paired-development-pilot") {
    errors.push("evidence_level must equal paired-development-pilot");
  }
  if (!Number.isInteger(suite.repetitions) || suite.repetitions < 1) {
    errors.push("repetitions must be a positive integer");
  }
  if (!Array.isArray(suite.workflow_order) || suite.workflow_order.length < suite.repetitions) {
    errors.push("workflow_order must define every repetition");
  } else {
    for (const [index, order] of suite.workflow_order.entries()) {
      if (
        !Array.isArray(order) ||
        order.length !== 2 ||
        new Set(order).size !== 2 ||
        order.some((workflow) => !WORKFLOWS.has(workflow))
      ) {
        errors.push(`workflow_order[${index}] must contain each workflow once`);
      }
    }
  }
  if (suite.activation_mode !== "explicit-entrypoint") {
    errors.push("activation_mode must equal explicit-entrypoint");
  }
  for (const workflow of WORKFLOWS) {
    if (typeof suite.workflow_entrypoints?.[workflow] !== "string") {
      errors.push(`workflow_entrypoints must define ${workflow}`);
    }
  }
  if (!Array.isArray(suite.cases) || suite.cases.length === 0) {
    errors.push("cases must be a non-empty array");
  } else {
    const ids = new Set();
    for (const [index, benchmarkCase] of suite.cases.entries()) {
      if (!benchmarkCase?.id || ids.has(benchmarkCase.id)) {
        errors.push(`cases[${index}].id must be unique and non-empty`);
      }
      ids.add(benchmarkCase?.id);
      if (!benchmarkCase?.scenario_class || !benchmarkCase?.task) {
        errors.push(`cases[${index}] must declare scenario_class and task`);
      }
      if (!["lean", "standard", "strict"].includes(benchmarkCase?.risk_level)) {
        errors.push(`cases[${index}].risk_level must be lean, standard, or strict`);
      }
      if (!["shape", "build", "debug", "review", "verify", "ship", "adapt"].includes(
        benchmarkCase?.expected_workflow,
      )) {
        errors.push(`cases[${index}].expected_workflow must name one LeanPowers owner`);
      }
      for (const field of ["workspace", ...(benchmarkCase?.verifier_files ?? [])]) {
        if (!isSafeRelativePath(field)) {
          errors.push(`cases[${index}] contains an unsafe relative path`);
        }
      }
      if (!Array.isArray(benchmarkCase?.verifier_files) || benchmarkCase.verifier_files.length === 0) {
        errors.push(`cases[${index}].verifier_files must be non-empty`);
      }
      if (!benchmarkCase?.change_policy?.product || !benchmarkCase?.change_policy?.workflow) {
        errors.push(`cases[${index}].change_policy must declare product and workflow globs`);
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`Invalid development benchmark suite:\n${errors.join("\n")}`);
  }
  return suite;
}

export function buildClaudeArgs({
  model,
  pluginDirectory,
  prompt,
  effort = "medium",
  maxBudgetUsd,
}) {
  const args = [
    "-p",
    prompt,
    "--plugin-dir",
    pluginDirectory,
    "--model",
    model,
    "--effort",
    effort,
    "--setting-sources",
    "local",
    "--tools",
    "default",
    "--allowedTools",
    [
      "Read",
      "Edit",
      "Write",
      "Glob",
      "Grep",
      "Skill",
      "Agent",
      "Bash(node *)",
      "Bash(npm test*)",
      "Bash(git status*)",
      "Bash(git diff*)",
    ].join(","),
    "--permission-mode",
    "dontAsk",
    "--strict-mcp-config",
    "--mcp-config",
    '{"mcpServers":{}}',
    "--no-chrome",
    "--no-session-persistence",
    "--output-format",
    "json",
  ];
  if (maxBudgetUsd !== undefined) {
    args.push("--max-budget-usd", String(maxBudgetUsd));
  }
  return args;
}

export function buildCodexArgs({ model, prompt, workspace, effort = "low" }) {
  return [
    "exec",
    "--json",
    "--sandbox",
    "workspace-write",
    "-c",
    'approval_policy="never"',
    "-c",
    `model_reasoning_effort="${effort}"`,
    "-c",
    "features.multi_agent=true",
    "--skip-git-repo-check",
    "--ephemeral",
    "-m",
    model,
    "-C",
    workspace,
    prompt,
  ];
}

export function parseClaudeResult(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw.trim());
  } catch {
    return {
      completed: false,
      final_message: "",
      turns: null,
      duration_ms: null,
      tokens: null,
    };
  }
  const usage = parsed?.usage;
  const tokenFields = {
    input: finiteNumber(usage?.input_tokens),
    output: finiteNumber(usage?.output_tokens),
    cache_creation_input: finiteNumber(usage?.cache_creation_input_tokens),
    cache_read_input: finiteNumber(usage?.cache_read_input_tokens),
  };
  const hasTokenTelemetry = Object.values(tokenFields).some((value) => value !== null);
  const tokens = hasTokenTelemetry
    ? {
        input: tokenFields.input ?? 0,
        output: tokenFields.output ?? 0,
        cache_creation_input: tokenFields.cache_creation_input ?? 0,
        cache_read_input: tokenFields.cache_read_input ?? 0,
        total_context: Object.values(tokenFields).reduce(
          (total, value) => total + (value ?? 0),
          0,
        ),
      }
    : null;
  return {
    completed:
      parsed?.subtype === "success" &&
      parsed?.is_error !== true &&
      typeof parsed?.result === "string",
    final_message: typeof parsed?.result === "string" ? parsed.result : "",
    turns: finiteNumber(parsed?.num_turns),
    duration_ms: finiteNumber(parsed?.duration_ms),
    tokens,
  };
}

export function parseCodexResult(
  raw,
  {
    expectedReviewContract = null,
    reviewerWorkspaceMutations = new Map(),
  } = {},
) {
  const events = raw
    .split(/\r?\n/u)
    .filter((line) => line.trim().startsWith("{"))
    .flatMap((line) => {
      try {
        return [JSON.parse(line)];
      } catch {
        return [];
      }
    });
  const usageEvent = [...events].reverse().find((event) => event?.type === "turn.completed");
  const usage = usageEvent?.usage;
  const hasUsage = Boolean(usage) && [
    usage.input_tokens,
    usage.cached_input_tokens,
    usage.output_tokens,
    usage.reasoning_output_tokens,
  ].some(Number.isFinite);
  const input = finiteNumber(usage?.input_tokens);
  const cachedInput = finiteNumber(usage?.cached_input_tokens);
  const output = finiteNumber(usage?.output_tokens);
  const cacheValid = input !== null && cachedInput !== null && cachedInput >= 0 && cachedInput <= input;
  const telemetryComplete = cacheValid && output !== null;
  const completedItems = events.filter((event) => event?.type === "item.completed");
  const toolItems = completedItems.filter(
    (event) => !["agent_message", "reasoning"].includes(event?.item?.type),
  );
  const toolCallsByType = Object.fromEntries(
    [...new Set(toolItems.map((event) => event?.item?.type ?? "unknown"))]
      .sort()
      .map((type) => [type, toolItems.filter((event) => (event?.item?.type ?? "unknown") === type).length]),
  );
  const workflowReads = completedItems.filter((event) => {
    if (event?.item?.type !== "command_execution") return false;
    return /\/(?:skills\/[^/\s]+\/SKILL\.md|references\/[^/\s]+\.md)/u
      .test(event?.item?.command ?? "");
  });
  const skillsObserved = [...new Set(workflowReads.flatMap((event) =>
    [...String(event?.item?.command ?? "").matchAll(
      /\/skills\/([^/\s]+)\/SKILL\.md/gu,
    )].map((match) => match[1])
  ))].sort();
  const finalFileChangeIndex = events.findLastIndex(
    (event) =>
      event?.type === "item.completed" && event?.item?.type === "file_change",
  );
  const firstFileChangeIndex = events.findIndex(
    (event) =>
      event?.type === "item.completed" && event?.item?.type === "file_change",
  );
  const startedCollabCalls = new Map();
  const collabCallLifecycles = new Map();
  const observedChangedPaths = new Set();
  const reviewAgentSpawns = new Map();
  const reviewCycles = [];
  const strictCycleSpawnAttempts = new Set();
  const strictCycleWaitAttempts = new Set();
  const postChangeSpawnAttempts = new Set();
  const postChangeWaitAttempts = new Set();
  let duplicateStrictCollabCallIdObserved = false;
  let unexpectedStrictCollabToolObserved = false;
  let latestIndependentReview = null;
  events.forEach((event, index) => {
    const item = event?.item;
    if (event?.type === "item.completed" && item?.type === "file_change") {
      for (const change of item.changes ?? []) {
        const changedPath = benchmarkObservedPath(change?.path);
        if (changedPath) observedChangedPaths.add(changedPath);
      }
    }
    if (
      item?.type === "collab_tool_call" &&
      typeof item.id === "string" &&
      (event?.type === "item.started" || event?.type === "item.completed")
    ) {
      const lifecycle = collabCallLifecycles.get(item.id) ?? {
        completed: false,
        started: false,
      };
      const duplicate = event.type === "item.started"
        ? lifecycle.started || lifecycle.completed
        : lifecycle.completed;
      if (duplicate && index > firstFileChangeIndex) {
        duplicateStrictCollabCallIdObserved = true;
      }
      lifecycle[event.type === "item.started" ? "started" : "completed"] = true;
      collabCallLifecycles.set(item.id, lifecycle);
    }
    if (
      event?.type === "item.started" &&
      item?.type === "collab_tool_call" &&
      typeof item.id === "string"
    ) {
      startedCollabCalls.set(item.id, item);
    }
    const startedCall =
      typeof item?.id === "string" ? startedCollabCalls.get(item.id) : null;
    const attemptKey =
      typeof item?.id === "string" ? item.id : `${item?.tool ?? "unknown"}:${index}`;
    if (
      item?.type === "collab_tool_call" &&
      index > firstFileChangeIndex &&
      !["spawn_agent", "wait"].includes(item.tool)
    ) {
      unexpectedStrictCollabToolObserved = true;
    }
    if (
      item?.type === "collab_tool_call" &&
      item.tool === "spawn_agent" &&
      index > firstFileChangeIndex &&
      (event?.type === "item.started" ||
        (event?.type === "item.completed" && !startedCall))
    ) {
      strictCycleSpawnAttempts.add(attemptKey);
    }
    if (
      item?.type === "collab_tool_call" &&
      item.tool === "wait" &&
      index > firstFileChangeIndex &&
      (event?.type === "item.started" ||
        (event?.type === "item.completed" && !startedCall))
    ) {
      strictCycleWaitAttempts.add(attemptKey);
    }
    if (
      item?.type === "collab_tool_call" &&
      item.tool === "spawn_agent" &&
      index > finalFileChangeIndex &&
      (event?.type === "item.started" ||
        (event?.type === "item.completed" && !startedCall))
    ) {
      postChangeSpawnAttempts.add(attemptKey);
    }
    if (
      item?.type === "collab_tool_call" &&
      item.tool === "wait" &&
      index > finalFileChangeIndex &&
      (event?.type === "item.started" ||
        (event?.type === "item.completed" && !startedCall))
    ) {
      postChangeWaitAttempts.add(attemptKey);
    }
    if (event?.type !== "item.completed") return;
    if (
      item?.type === "collab_tool_call" &&
      item.tool === "spawn_agent" &&
      item.status === "completed" &&
      index > firstFileChangeIndex &&
      isReviewerPrompt(item.prompt)
    ) {
      for (const agentId of item.receiver_thread_ids ?? []) {
        reviewAgentSpawns.set(agentId, {
          contract_verbatim: hasExactCodexReviewContract(
            item.prompt,
            expectedReviewContract,
          ),
          packet: parseCompleteCodexReviewPacket(
            item.prompt,
            expectedReviewContract,
            observedChangedPaths,
          ),
          index,
          review_skill_invoked:
            /^\$leanpowers:review\r?\n/u.test(String(item.prompt ?? "")),
          sole_spawn_target: (item.receiver_thread_ids ?? []).length === 1,
        });
      }
      return;
    }
    if (
      item?.type === "collab_tool_call" &&
      item.tool === "wait"
    ) {
      if (item.status !== "completed") return;
      const requestedAgentIds =
        typeof item.id === "string"
          ? startedCollabCalls.get(item.id)?.receiver_thread_ids
          : null;
      const completedReviews = [];
      for (const [agentId, state] of Object.entries(item.agents_states ?? {})) {
        const spawn = reviewAgentSpawns.get(agentId);
        if (spawn?.index < index) {
          completedReviews.push({
            agent_id: agentId,
            contract_verbatim: spawn.contract_verbatim,
            packet_complete: spawn.packet !== null,
            test_command: spawn.packet?.test_command ?? null,
            verdict:
              state?.status === "completed"
                ? classifyReviewVerdict(state?.message)
                : null,
            review_skill_invoked: spawn.review_skill_invoked,
            workspace_mutation_check_observed:
              reviewerWorkspaceMutations.has(agentId),
            workspace_mutation_observed:
              reviewerWorkspaceMutations.get(agentId) === true,
            sole_spawn_target: spawn.sole_spawn_target,
            spawn_index: spawn.index,
          });
        }
      }
      if (completedReviews.length > 0) {
        const soleWaitTarget =
          Array.isArray(requestedAgentIds) &&
          requestedAgentIds.length === 1 &&
          completedReviews.length === 1 &&
          requestedAgentIds[0] === completedReviews[0].agent_id &&
          completedReviews[0].sole_spawn_target;
        reviewCycles.push({
          reviews: completedReviews,
          sole_wait_target: soleWaitTarget,
          wait_index: index,
        });
        if (completedReviews.every((review) => review.spawn_index > finalFileChangeIndex)) {
          latestIndependentReview = {
            contract_verbatim: completedReviews.every(
              (review) => review.contract_verbatim,
            ),
            pass: completedReviews.every((review) => review.verdict === "pass"),
            review_skill_invoked: completedReviews.every(
              (review) => review.review_skill_invoked,
            ),
            workspace_mutation_check_observed: completedReviews.every(
              (review) => review.workspace_mutation_check_observed,
            ),
            workspace_mutation_observed: completedReviews.some(
              (review) => review.workspace_mutation_observed,
            ),
            sole_wait_target: soleWaitTarget,
          };
        }
      }
    }
  });
  const reviewerIds = new Set();
  const strictReviewProtocolObserved =
    reviewCycles.length > 0 &&
    !duplicateStrictCollabCallIdObserved &&
    !unexpectedStrictCollabToolObserved &&
    strictCycleSpawnAttempts.size === reviewCycles.length &&
    strictCycleWaitAttempts.size === reviewCycles.length &&
    reviewCycles.every((cycle, cycleIndex) => {
      if (cycle.reviews.length !== 1 || !cycle.sole_wait_target) return false;
      const review = cycle.reviews[0];
      if (
        !review.contract_verbatim ||
        !review.packet_complete ||
        !review.review_skill_invoked ||
        !review.workspace_mutation_check_observed ||
        review.workspace_mutation_observed ||
        reviewerIds.has(review.agent_id)
      ) {
        return false;
      }
      reviewerIds.add(review.agent_id);
      const previousWaitIndex = cycleIndex === 0
        ? -1
        : reviewCycles[cycleIndex - 1].wait_index;
      const lastChangeIndex = events.findLastIndex(
        (event, eventIndex) =>
          eventIndex > previousWaitIndex &&
          eventIndex < review.spawn_index &&
          event?.type === "item.completed" &&
          event?.item?.type === "file_change" &&
          event?.item?.status === "completed" &&
          Array.isArray(event?.item?.changes) &&
          event.item.changes.length > 0,
      );
      if (lastChangeIndex < 0) return false;
      const currentValidationObserved = events.some((event, eventIndex) => {
        if (
          eventIndex <= lastChangeIndex ||
          eventIndex >= review.spawn_index ||
          event?.type !== "item.completed" ||
          event?.item?.type !== "command_execution" ||
          event?.item?.status !== "completed" ||
          event?.item?.exit_code !== 0
        ) {
          return false;
        }
        const command = canonicalValidationCommand(event.item.command);
        return command !== null && command === review.test_command;
      });
      if (!currentValidationObserved) return false;
      const isFinalCycle = cycleIndex === reviewCycles.length - 1;
      if (isFinalCycle) {
        return review.spawn_index > finalFileChangeIndex && review.verdict === "pass";
      }
      return review.verdict === "changes_required";
    });
  const finalMessage = [...events].reverse().find(
    (event) => event?.type === "item.completed" && event?.item?.type === "agent_message",
  );
  const firstProgressMessage = events.find(
    (event) => event?.type === "item.completed" && event?.item?.type === "agent_message",
  );
  return {
    completed:
      Boolean(usageEvent) &&
      !events.some((event) => event?.type === "turn.failed" || event?.type === "error"),
    final_message: typeof finalMessage?.item?.text === "string" ? finalMessage.item.text : "",
    first_progress_message:
      typeof firstProgressMessage?.item?.text === "string" ? firstProgressMessage.item.text : "",
    turns: events.filter((event) => event?.type === "turn.started").length,
    tool_calls: toolItems.length,
    tool_calls_by_type: toolCallsByType,
    workflow_trace: {
      read_calls: workflowReads.length,
      read_output_chars: workflowReads.reduce(
        (total, event) => total + String(event?.item?.aggregated_output ?? "").length,
        0,
      ),
      skills_observed: skillsObserved,
      independent_review_pass_observed: latestIndependentReview?.pass === true,
      independent_review_contract_verbatim_observed:
        latestIndependentReview?.contract_verbatim === true,
      independent_review_skill_invoked:
        latestIndependentReview?.review_skill_invoked === true,
      independent_review_sole_wait_target_observed:
        latestIndependentReview?.sole_wait_target === true,
      reviewer_workspace_mutation_check_observed:
        latestIndependentReview?.workspace_mutation_check_observed === true,
      reviewer_workspace_mutation_observed:
        latestIndependentReview?.workspace_mutation_observed === true,
      strict_review_protocol_observed: strictReviewProtocolObserved,
      strict_review_cycle_count: reviewCycles.length,
      duplicate_strict_collab_call_id_observed:
        duplicateStrictCollabCallIdObserved,
      unexpected_strict_collab_tool_observed:
        unexpectedStrictCollabToolObserved,
      post_change_spawn_calls: postChangeSpawnAttempts.size,
      post_change_wait_calls: postChangeWaitAttempts.size,
    },
    tokens: hasUsage
      ? {
          input,
          cached_input: cachedInput,
          output,
          reasoning_output: finiteNumber(usage?.reasoning_output_tokens),
          total: input !== null && output !== null ? input + output : null,
          uncached_plus_output: telemetryComplete ? input - cachedInput + output : null,
          telemetry_complete: telemetryComplete,
        }
      : null,
  };
}

export function createReviewerWorkspaceMutationTracker(snapshotWorkspace) {
  if (typeof snapshotWorkspace !== "function") {
    throw new TypeError("snapshotWorkspace must be a function");
  }
  const pendingSpawns = new Map();
  const reviewerSpawns = new Map();
  const startedWaitTargets = new Map();
  const mutationByAgent = new Map();

  const onStdoutLine = async (line) => {
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      return;
    }
    const item = event?.item;
    if (
      event?.type === "item.started" &&
      item?.type === "collab_tool_call" &&
      item.tool === "spawn_agent" &&
      typeof item.id === "string" &&
      isReviewerPrompt(item.prompt)
    ) {
      pendingSpawns.set(item.id, await snapshotWorkspace());
      return;
    }
    if (
      event?.type === "item.completed" &&
      item?.type === "collab_tool_call" &&
      item.tool === "spawn_agent" &&
      typeof item.id === "string"
    ) {
      if (!pendingSpawns.has(item.id)) return;
      const before = pendingSpawns.get(item.id);
      pendingSpawns.delete(item.id);
      if (item.status !== "completed") return;
      for (const agentId of item.receiver_thread_ids ?? []) {
        reviewerSpawns.set(agentId, before);
      }
      return;
    }
    if (
      event?.type === "item.started" &&
      item?.type === "collab_tool_call" &&
      item.tool === "wait" &&
      typeof item.id === "string"
    ) {
      startedWaitTargets.set(item.id, item.receiver_thread_ids);
      return;
    }
    if (
      event?.type !== "item.completed" ||
      item?.type !== "collab_tool_call" ||
      item.tool !== "wait" ||
      item.status !== "completed"
    ) {
      return;
    }
    const requestedAgentIds =
      typeof item.id === "string"
        ? startedWaitTargets.get(item.id)
        : item.receiver_thread_ids;
    const candidateAgentIds = Array.isArray(requestedAgentIds)
      ? requestedAgentIds
      : Object.keys(item.agents_states ?? {});
    const completedReviewerIds = candidateAgentIds.filter((agentId) =>
      reviewerSpawns.has(agentId) &&
      !mutationByAgent.has(agentId) &&
      isTerminalAgentState(item.agents_states?.[agentId]?.status)
    );
    if (completedReviewerIds.length === 0) return;
    const after = await snapshotWorkspace();
    for (const agentId of completedReviewerIds) {
      mutationByAgent.set(agentId, reviewerSpawns.get(agentId) !== after);
    }
  };

  return {
    mutations: () => new Map(mutationByAgent),
    onStdoutLine,
  };
}

function isReviewerPrompt(prompt) {
  return /(?:\breview\b|reviewer|审查|复核)/iu.test(String(prompt ?? ""));
}

function isTerminalAgentState(status) {
  return ["cancelled", "completed", "errored", "failed", "shutdown"].includes(status);
}

function hasExactCodexReviewContract(prompt, expectedReviewContract) {
  if (
    typeof prompt !== "string" ||
    typeof expectedReviewContract !== "string" ||
    expectedReviewContract.length === 0
  ) {
    return false;
  }
  return codexReviewContractPrefixes(expectedReviewContract, true)
    .some((prefix) => prompt.startsWith(prefix));
}

function parseCompleteCodexReviewPacket(
  prompt,
  expectedReviewContract,
  observedChangedPaths = new Set(),
) {
  if (
    typeof prompt !== "string" ||
    typeof expectedReviewContract !== "string" ||
    expectedReviewContract.length === 0
  ) {
    return null;
  }
  const prefix = codexReviewContractPrefixes(expectedReviewContract, false)
    .find((candidate) => prompt.startsWith(candidate));
  if (!prefix) return null;
  const lines = prompt.slice(prefix.length).split("\n");
  if (
    lines.length !== 9 ||
    lines[0] !== "Sole reviewer; read diff/code; do not edit/delegate." ||
    !hasPopulatedPacketField(lines[1], "Ledger") ||
    !hasPopulatedPacketField(lines[2], "Paths") ||
    !hasPopulatedPacketField(lines[3], "Test") ||
    lines[4] !== "Return Review YAML raw—no JSON/fence/heading/prose. Pass: exactly these three lines:" ||
    lines[5] !== "" ||
    lines[6] !== "verdict: pass" ||
    lines[7] !== "findings: []" ||
    lines[8] !== "unverified_areas: []"
  ) {
    return null;
  }
  const testEvidence = lines[3].slice("Test: ".length);
  const validationEvidence = parseValidationEvidence(testEvidence);
  const ledger = lines[1].slice("Ledger: ".length).trim();
  const declaredPaths = new Set(
    lines[2]
      .slice("Paths: ".length)
      .match(/[A-Za-z0-9._/-]+/gu) ?? [],
  );
  if (
    isSemanticallyEmptyPacketValue(ledger) ||
    declaredPaths.size === 0 ||
    [...observedChangedPaths].some((changedPath) => !declaredPaths.has(changedPath)) ||
    validationEvidence === null
  ) {
    return null;
  }
  return validationEvidence;
}

function codexReviewContractPrefixes(expectedReviewContract, allowInvocationGap) {
  const invocationPrefixes = allowInvocationGap
    ? ["$leanpowers:review\n", "$leanpowers:review\n\n"]
    : ["$leanpowers:review\n"];
  return invocationPrefixes.flatMap((invocation) => [
    `${invocation}Original task:\n${expectedReviewContract}\n\nReviewer context:\n`,
    `${invocation}Original task:\n${expectedReviewContract}\nReviewer context:\n`,
  ]);
}

function hasPopulatedPacketField(line, name) {
  const prefix = `${name}: `;
  if (typeof line !== "string" || !line.startsWith(prefix)) return false;
  const value = line.slice(prefix.length).trim();
  return value.length > 0 && !/[{}]/u.test(value);
}

function isSemanticallyEmptyPacketValue(value) {
  return /^(?:\[\]|n\/a|none|null|tbd)$/iu.test(String(value ?? "").trim());
}

function benchmarkObservedPath(value) {
  const normalized = String(value ?? "").replace(/\\/gu, "/");
  if (!normalized) return null;
  const workspaceMarker = "/workspace/";
  const markerIndex = normalized.lastIndexOf(workspaceMarker);
  return markerIndex >= 0
    ? normalized.slice(markerIndex + workspaceMarker.length)
    : normalized.replace(/^\.\//u, "");
}

function parseValidationEvidence(evidence) {
  const match = String(evidence ?? "").match(/^exit=0; command=(.+)$/u);
  if (!match) return null;
  const testCommand = canonicalValidationCommand(match[1]);
  return testCommand === null ? null : { test_command: testCommand };
}

function canonicalValidationCommand(command) {
  let text = String(command ?? "");
  const shellPrefix = /^(?:(?:\/(?:usr\/)?bin\/)?(?:bash|sh|zsh))\s+-lc\s+/u;
  if (shellPrefix.test(text)) {
    const wrapped = text.match(
      /^(?:(?:\/(?:usr\/)?bin\/)?(?:bash|sh|zsh))\s+-lc\s+(['"])([\s\S]*)\1$/u,
    );
    if (!wrapped) return null;
    text = wrapped[2];
  }
  if (
    text.length === 0 ||
    text !== text.trim() ||
    /[\r\n;&|`!<>#$]/u.test(text) ||
    !/^(?:bun|cargo|go|gradle|make|mvn|node|npm|pnpm|pytest|yarn)\b/iu.test(text) ||
    validationCommandFragment(text) === null
  ) {
    return null;
  }
  return text;
}

function validationCommandFragment(command) {
  const text = String(command ?? "");
  const match = text.match(
    /\b(?:bun|cargo|go|gradle|make|mvn|node|npm|pnpm|yarn)\b[^;&|\r\n]{0,80}\b(?:build|check|lint|test|typecheck)\b|\bpytest\b/iu,
  );
  return match ? match[0].replace(/\s+/gu, " ").trim().toLowerCase() : null;
}

export function isPassingReviewVerdict(message) {
  return String(message ?? "").replace(/\r\n/gu, "\n") ===
    "verdict: pass\nfindings: []\nunverified_areas: []";
}

export function classifyReviewVerdict(message) {
  if (isPassingReviewVerdict(message)) return "pass";
  const lines = String(message ?? "").replace(/\r\n/gu, "\n").split("\n");
  if (lines[0] !== "verdict: changes_required" || lines[1] !== "findings:") {
    return null;
  }
  let index = 2;
  let findings = 0;
  while (/^  - severity: (?:critical|high|medium|low)$/u.test(lines[index] ?? "")) {
    if (
      !/^    location: \S(?:.*\S)?$/u.test(lines[index + 1] ?? "") ||
      !/^    evidence: \S(?:.*\S)?$/u.test(lines[index + 2] ?? "") ||
      !/^    impact: \S(?:.*\S)?$/u.test(lines[index + 3] ?? "") ||
      !/^    repair: \S(?:.*\S)?$/u.test(lines[index + 4] ?? "")
    ) {
      return null;
    }
    findings += 1;
    index += 5;
  }
  if (
    findings === 0 ||
    index !== lines.length - 1 ||
    !/^unverified_areas: (?:\[\]|\[\S(?:[^\]\r\n]*\S)?\])$/u.test(lines[index] ?? "")
  ) {
    return null;
  }
  return "changes_required";
}

export function evaluateChangedPaths(changedPaths, policy) {
  const result = { product: [], workflow: [], violations: [] };
  for (const changedPath of [...changedPaths].sort()) {
    if (policy.product.some((pattern) => matchGlob(changedPath, pattern))) {
      result.product.push(changedPath);
    } else if (policy.workflow.some((pattern) => matchGlob(changedPath, pattern))) {
      result.workflow.push(changedPath);
    } else {
      result.violations.push(changedPath);
    }
  }
  return result;
}

export function evaluateRunOutcome(run) {
  const reasons = [];
  if (run.agent_exit_code !== 0) reasons.push("agent exited non-zero");
  if (run.agent_timed_out) reasons.push("agent timed out");
  if (!run.agent_completed) reasons.push("agent did not complete a turn");
  if (!run.head_unchanged) reasons.push("agent moved the benchmark Git HEAD");
  if (run.verifier.visible.timed_out) reasons.push("visible regression suite timed out");
  if (run.verifier.hidden.timed_out) reasons.push("hidden verifier timed out");
  if (run.verifier.visible.exit_code !== 0) reasons.push("visible regression suite failed");
  if (run.verifier.hidden.exit_code !== 0) reasons.push("hidden verifier failed");
  if (run.changes.violations.length > 0) reasons.push("changed paths violated scope policy");
  return {
    status: reasons.length === 0 ? "PASS" : "FAIL",
    reasons,
  };
}

export function evaluateWorkflowConformance(run) {
  const reasons = [];
  if (!run.activation_reported) reasons.push("top-level workflow declaration was not reported");
  if (run.workflow === "leanpowers-0.2.0") {
    if (!run.route_ledger_reported) {
      reasons.push("exact four-line LeanPowers route-ledger prefix was not reported");
    }
    if (
      run.expected_workflow &&
      run.declared_workflow !== run.expected_workflow
    ) {
      reasons.push(
        `declared ${run.declared_workflow ?? "no"} workflow instead of ${run.expected_workflow}`,
      );
    }
    if (!run.declared_risk) {
      reasons.push("risk declaration was not reported");
    } else if (run.declared_risk !== run.risk_level) {
      reasons.push(`declared ${run.declared_risk} risk instead of ${run.risk_level}`);
    }
    if (
      run.risk_level === "strict" &&
      !run.telemetry?.workflow_trace?.independent_review_pass_observed
    ) {
      reasons.push("current passing independent review was not observed");
    } else if (
      run.risk_level === "strict" &&
      !run.telemetry?.workflow_trace?.independent_review_contract_verbatim_observed
    ) {
      reasons.push("passing independent review did not receive the verbatim task contract");
    }
    if (
      run.risk_level === "strict" &&
      !run.telemetry?.workflow_trace?.independent_review_skill_invoked
    ) {
      reasons.push("passing reviewer did not explicitly invoke leanpowers:review");
    }
    if (
      run.risk_level === "strict" &&
      !run.telemetry?.workflow_trace?.independent_review_sole_wait_target_observed
    ) {
      reasons.push("strict wait did not target only the designated reviewer");
    }
    if (
      run.risk_level === "strict" &&
      !run.telemetry?.workflow_trace?.reviewer_workspace_mutation_check_observed
    ) {
      reasons.push("reviewer workspace mutation check was not observed");
    } else if (
      run.risk_level === "strict" &&
      run.telemetry?.workflow_trace?.reviewer_workspace_mutation_observed
    ) {
      reasons.push("designated reviewer mutated the workspace");
    }
    if (
      run.risk_level === "strict" &&
      !run.telemetry?.workflow_trace?.strict_review_protocol_observed
    ) {
      reasons.push("strict review cycles violated the one-reviewer protocol");
    }
  }
  return { status: reasons.length === 0 ? "PASS" : "FAIL", reasons };
}

export function resolveDevelopmentOutputDirectory(outputDirectory) {
  const resolved = path.resolve(outputDirectory);
  if (
    isSameOrAncestor(PROJECT_ROOT, resolved) &&
    !isSameOrAncestor(SAFE_LOCAL_RESULTS_ROOT, resolved)
  ) {
    throw new Error("Repository-local benchmark output must stay under ignored evals/results/");
  }
  return resolved;
}

export async function runVerifier({ environment = {}, workspace, verifierFiles }) {
  const injected = [];
  const verifierHome = await mkdtemp(path.join(os.tmpdir(), "leanpowers-verifier-home-"));
  try {
    await mkdir(path.join(verifierHome, "tmp"), { recursive: true });
    const env = benchmarkEnvironment(verifierHome, environment);
    const visible = await runProcess("npm", ["test"], {
      cwd: workspace,
      env,
      timeoutMs: 120_000,
    });
    for (const [index, verifierFile] of verifierFiles.entries()) {
      const target = path.join(
        workspace,
        "test",
        `benchmark-hidden-${String(index + 1).padStart(2, "0")}.test.mjs`,
      );
      await cp(verifierFile, target);
      injected.push(target);
    }
    const hidden = await runProcess("npm", ["test"], {
      cwd: workspace,
      env,
      timeoutMs: 120_000,
    });
    return {
      visible: publicCommandResult(visible),
      hidden: publicCommandResult(hidden),
    };
  } finally {
    await Promise.all(injected.map((target) => rm(target, { force: true })));
    await rm(verifierHome, { force: true, recursive: true });
  }
}

export async function runDevelopmentPilot({
  suitePath,
  outputDirectory,
  superpowersMarketplace,
  leanpowersMarketplace,
  model,
  codexExecutable = "codex",
  authFile = path.join(
    process.env.CODEX_HOME ?? path.join(os.homedir(), ".codex"),
    "auth.json",
  ),
  repetitions,
  caseIds,
  onProgress = () => {},
}) {
  outputDirectory = resolveDevelopmentOutputDirectory(outputDirectory);
  const suiteUrl = toFileUrl(suitePath);
  const suite = await loadDevelopmentSuite(suiteUrl);
  const selectedCases = caseIds?.length
    ? suite.cases.filter((benchmarkCase) => caseIds.includes(benchmarkCase.id))
    : suite.cases;
  if (selectedCases.length === 0) {
    throw new Error("No benchmark cases matched --case");
  }
  const runRepetitions = repetitions ?? suite.repetitions;
  if (!Number.isInteger(runRepetitions) || runRepetitions < 1 || runRepetitions > suite.repetitions) {
    throw new Error(`repetitions must be between 1 and ${suite.repetitions}`);
  }

  const homeRoot = await mkdtemp(path.join(os.tmpdir(), "leanpowers-codex-homes-"));
  try {
    const toolchain = await resolveBenchmarkToolchain(codexExecutable);
    codexExecutable = toolchain.codex;
    const workflowRevisions = {
      "superpowers-6.1.1": await cleanGitRevision(superpowersMarketplace, {
        officialOrigin: "github.com/obra/superpowers",
        tag: "v6.1.1",
      }),
      "leanpowers-0.2.0": await cleanGitRevision(leanpowersMarketplace),
    };
    const homes = await prepareCodexHomes({
      authFile,
      codexExecutable,
      homeRoot,
      leanpowersMarketplace,
      superpowersMarketplace,
      toolchain,
    });
    const runtime = {
      codex_version: (
        await runProcess(codexExecutable, ["--version"], { timeoutMs: 30_000 })
      ).stdout.trim(),
      model: model ?? suite.model_default,
      effort: suite.effort,
      sandbox: "workspace-write",
      approval: "never",
      user_plugins: "isolated",
      workflow_revisions: workflowRevisions,
    };
    const runs = [];
    const pendingArtifacts = [];
    for (let repetition = 0; repetition < runRepetitions; repetition += 1) {
      const order = suite.workflow_order[repetition];
      for (const benchmarkCase of selectedCases) {
        for (const workflow of order) {
          const runId = `r${repetition + 1}-${benchmarkCase.id}-${workflow}`;
          onProgress({ type: "start", runId, workflow, caseId: benchmarkCase.id });
          const execution = await runSingleCase({
            benchmarkCase,
            codexExecutable,
            codexHome: homes[workflow],
            entrypoint: suite.workflow_entrypoints[workflow],
            effort: suite.effort,
            model: runtime.model,
            repetition: repetition + 1,
            runId,
            suiteUrl,
            toolchain,
            workflow,
          });
          const { result, artifacts } = execution;
          runs.push(result);
          pendingArtifacts.push({ runId, artifacts });
          onProgress({ type: "end", ...result });
        }
      }
    }

    const result = makePilotResult(suite, runtime, runs, runRepetitions, selectedCases);
    await mkdir(outputDirectory, { recursive: true });
    await materializeRunArtifacts(outputDirectory, pendingArtifacts);
    await writeFile(
      path.join(outputDirectory, "pilot-result.json"),
      `${JSON.stringify(result, null, 2)}\n`,
    );
    await writeFile(
      path.join(outputDirectory, "pilot-report.md"),
      renderDevelopmentReport(result),
    );
    return result;
  } finally {
    await rm(homeRoot, { force: true, recursive: true });
  }
}

export function renderDevelopmentReport(result) {
  const aggregate = aggregateRuns(result.runs);
  const paired = aggregatePairedRuns(result.runs);
  const rows = result.runs.map((run) =>
    [
      run.case_id,
      run.risk_level,
      String(run.repetition),
      run.workflow,
      run.outcome.status,
      run.workflow_conformance.status,
      run.activation_reported ? "yes" : "no",
      displayMetric(run.telemetry.tokens?.total),
      displayMetric(run.telemetry.tokens?.uncached_plus_output),
      displayMetric(round(run.wall_seconds, 1)),
      displayMetric(run.telemetry.tool_calls),
      displayMetric(run.telemetry.workflow_trace?.read_calls),
      String(run.changes.product.length),
      String(run.changes.workflow.length),
      String(run.changes.violations.length),
    ].join(" | ")
  );
  const summaryRows = [...WORKFLOWS].map((workflow) => {
    const metrics = aggregate[workflow];
    return [
      workflow,
      `${metrics.passed}/${metrics.total}`,
      displayMetric(metrics.median_tokens),
      displayMetric(metrics.median_uncached_plus_output_tokens),
      displayMetric(metrics.median_wall_seconds),
      displayMetric(metrics.median_tool_calls),
      displayMetric(metrics.median_workflow_read_calls),
      String(metrics.activation_failures),
      String(metrics.conformance_failures),
      String(metrics.scope_violations),
    ].join(" | ");
  });
  const failures = result.runs
    .filter((run) => run.outcome.status === "FAIL")
    .map((run) => `- ${run.run_id}: ${run.outcome.reasons.join("; ")}`);
  return [
    "# Paired development-effects pilot",
    "",
    `Evidence level: **${result.evidence_level}**. This is real coding and independent executable verification, but it is not the full 11-scenario release benchmark.`,
    "",
    `Runtime: ${result.runtime.codex_version}; model: ${result.runtime.model}; effort: ${result.runtime.effort}.`,
    "",
    `Revisions: Superpowers ${result.runtime.workflow_revisions["superpowers-6.1.1"]}; LeanPowers ${result.runtime.workflow_revisions["leanpowers-0.2.0"]}.`,
    "",
    `Activation: ${result.activation_mode}. Each run explicitly invokes its installed top-level workflow entrypoint and must name it in the first agent progress message before the identical engineering task.`,
    "",
    "Superpowers 6.1.1 is the upstream baseline and inspiration for LeanPowers. This report measures a bounded tradeoff under the listed conditions; it is not a winner ranking.",
    "",
    "## Aggregate",
    "",
    "Workflow | Task PASS | Median model tokens | Median fresh tokens | Median wall seconds | Median tool calls | Median workflow reads | Declaration failures | Conformance failures | Scope violations",
    "--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---:",
    ...summaryRows,
    "",
    "## Paired reductions",
    "",
    "Population | Matched pairs | Median model-token reduction | Median fresh-token reduction | Median wall reduction | Median tool-call reduction | Median workflow-read reduction",
    "--- | ---: | ---: | ---: | ---: | ---: | ---:",
    pairedRow("Task PASS + workflow conformant (primary)", paired.conformant_pass_pairs),
    pairedRow("Primary: lean", paired.by_risk.lean.conformant_pass_pairs),
    pairedRow("Primary: standard", paired.by_risk.standard.conformant_pass_pairs),
    pairedRow("Primary: strict", paired.by_risk.strict.conformant_pass_pairs),
    pairedRow("Both workflows PASS", paired.both_pass_pairs),
    pairedRow("All matched runs", paired.all_pairs),
    "",
    "## Paired runs",
    "",
    "Case | Risk | Rep | Workflow | Task | Conformance | Declared | Model tokens | Fresh tokens | Wall seconds | Tool calls | Workflow reads | Product files | Workflow artifacts | Scope violations",
    "--- | --- | ---: | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---:",
    ...rows,
    "",
    "## Failed-run reasons",
    "",
    failures.length > 0 ? failures.join("\n") : "None.",
    "",
    "## Interpretation boundary",
    "",
    "- Task PASS requires successful agent completion, no timeout, both visible and hidden test success, and no changed-path scope violation. Workflow declaration and risk-routing conformance are reported separately.",
    "- LeanPowers conformance requires the exact four-line route-ledger prefix. Each strict review cycle requires a complete packet, one fresh reviewer, one matching wait, and no workspace mutation; findings require a nonempty repair plus successful matching validation before another cycle, and the final cycle must return the exact empty passing verdict after the final edit.",
    "- Codex JSONL does not expose raw spawn arguments such as `fork_context`; observable spawn/wait behavior is checked dynamically, while exact argument shape is covered by static workflow tests and remains a runtime telemetry gap.",
    "- Model tokens sum Codex input and output tokens. Fresh tokens are uncached input plus output. Reasoning output is already included in output and is never double-counted. Missing or impossible telemetry is shown as n/a, never zero.",
    "- Workflow reads are exact observed Skill/reference file reads from command traces. They are an attribution proxy, not workflow-only token telemetry.",
    "- Paired reductions are computed within each identical case and repetition before taking the median. Each metric shows its own valid sample count; incomplete telemetry is excluded from that metric only. The task-PASS-and-conformant population is primary, so failing faster or skipping workflow gates never counts as an improvement.",
    "- Codex CLI does not expose a deterministic seed, so paired repetitions reduce noise but do not eliminate it.",
    "- The three cases cover a small feature, an unknown-cause cache defect, and a security-compatible API extension. They do not establish universal non-inferiority.",
    "- Raw transcripts remain local and are written only after every run finishes. Disposable workspaces are destroyed after each run and are not publication artifacts.",
    "",
  ].join("\n");
}

function pairedRow(label, metrics) {
  return [
    label,
    String(metrics.count),
    displayPairedMetric(metrics.median_token_reduction_pct, metrics.token_pairs),
    displayPairedMetric(metrics.median_fresh_token_reduction_pct, metrics.fresh_token_pairs),
    displayPairedMetric(metrics.median_wall_reduction_pct, metrics.wall_pairs),
    displayPairedMetric(metrics.median_tool_call_reduction_pct, metrics.tool_call_pairs),
    displayPairedMetric(metrics.median_workflow_read_reduction_pct, metrics.workflow_read_pairs),
  ].join(" | ");
}

async function runSingleCase({
  benchmarkCase,
  codexExecutable,
  codexHome,
  entrypoint,
  effort,
  model,
  repetition,
  runId,
  suiteUrl,
  toolchain,
  workflow,
}) {
  const runRoot = await mkdtemp(path.join(os.tmpdir(), "leanpowers-development-run-"));
  const workspace = path.join(runRoot, "workspace");
  const runHome = path.join(runRoot, "home");
  try {
    await cp(new URL(benchmarkCase.workspace, suiteUrl), workspace, { recursive: true });
    await cp(codexHome, runHome, { recursive: true });
    const baselineHead = await initializeGit(workspace, toolchain);
    await mkdir(path.join(runHome, "tmp"), { recursive: true });

    const prompt = [
      entrypoint,
      "",
      "Work on the engineering task below in the current disposable repository.",
      "Follow the activated workflow and name it in your first progress update.",
      "Work autonomously and verify the result.",
      "The evaluator will inject additional tests only after you exit, so do not assume visible tests are complete.",
      "Read and modify only the current disposable repository; do not inspect parent, sibling, home, environment, or evaluator files.",
      "Do not access the network, install packages, create commits, push, or create another worktree.",
      "",
      benchmarkCase.task,
    ].join("\n");
    const args = buildCodexArgs({
      effort,
      model,
      prompt,
      workspace,
    });
    const reviewerMutationTracker =
      workflow === "leanpowers-0.2.0" && benchmarkCase.risk_level === "strict"
        ? createReviewerWorkspaceMutationTracker(() =>
            fingerprintBenchmarkWorkspace({
              baselineHead,
              environment: toolchain.environment,
              gitExecutable: toolchain.git,
              workspace,
            })
          )
        : null;
    const startedAt = Date.now();
    const agent = await runProcess(codexExecutable, args, {
      cwd: workspace,
      env: benchmarkEnvironment(runHome, toolchain.environment),
      onStdoutLine: reviewerMutationTracker?.onStdoutLine,
      timeoutMs: 600_000,
    });
    const wallSeconds = (Date.now() - startedAt) / 1000;
    const telemetry = parseCodexResult(agent.stdout, {
      expectedReviewContract: benchmarkCase.task,
      reviewerWorkspaceMutations: reviewerMutationTracker?.mutations(),
    });
    const routeLedger = parseLeanRouteLedger(telemetry.first_progress_message);
    const declaredRisk = extractDeclaredRisk(telemetry.first_progress_message);
    const activationReported = reportsWorkflowActivation({
      entrypoint,
      message: telemetry.first_progress_message,
      workflow,
    });

    const gitState = await inspectBenchmarkGitState({
      baselineHead,
      environment: toolchain.environment,
      gitExecutable: toolchain.git,
      workspace,
    });
    const headUnchanged = gitState.final_head === baselineHead;
    const changedPaths = gitState.changed_paths;
    const changes = evaluateChangedPaths(changedPaths, benchmarkCase.change_policy);
    const verifier = await runVerifier({
      environment: toolchain.environment,
      workspace,
      verifierFiles: benchmarkCase.verifier_files.map((file) => new URL(file, suiteUrl)),
    });
    const workspacePatch = gitState.workspace_patch;
    const result = {
      run_id: runId,
      workflow,
      case_id: benchmarkCase.id,
      scenario_class: benchmarkCase.scenario_class,
      risk_level: benchmarkCase.risk_level,
      expected_workflow: benchmarkCase.expected_workflow,
      declared_risk: declaredRisk,
      declared_workflow: routeLedger?.workflow ?? null,
      route_ledger_reported:
        workflow === "leanpowers-0.2.0" ? routeLedger !== null : null,
      repetition,
      agent_exit_code: agent.exitCode,
      agent_timed_out: agent.timedOut,
      agent_completed: telemetry.completed,
      activation_reported: activationReported,
      head_unchanged: headUnchanged,
      wall_seconds: wallSeconds,
      telemetry: {
        turns: telemetry.turns,
        tool_calls: telemetry.tool_calls,
        tool_calls_by_type: telemetry.tool_calls_by_type,
        workflow_trace: telemetry.workflow_trace,
        tokens: telemetry.tokens,
      },
      changes,
      verifier,
    };
    result.outcome = evaluateRunOutcome(result);
    result.workflow_conformance = evaluateWorkflowConformance(result);
    return {
      result,
      artifacts: {
        agent_stderr: agent.stderr,
        agent_stdout: agent.stdout,
        final_message: telemetry.final_message,
        verifier,
        workspace_patch: workspacePatch,
      },
    };
  } finally {
    await rm(runRoot, { force: true, recursive: true });
  }
}

export function makePilotResult(suite, runtime, runs, repetitions, selectedCases) {
  return {
    schema_version: 1,
    suite_id: suite.suite_id,
    evidence_level: suite.evidence_level,
    activation_mode: suite.activation_mode,
    completion: hasCompleteRunMatrix(runs, selectedCases, repetitions)
      ? "complete"
      : "incomplete",
    runtime,
    repetitions,
    cases: selectedCases.map(({ id, scenario_class, risk_level, expected_workflow }) => ({
      id,
      scenario_class,
      risk_level,
      expected_workflow,
    })),
    runs,
    aggregate: aggregateRuns(runs),
    paired: aggregatePairedRuns(runs),
  };
}

function aggregateRuns(runs) {
  return Object.fromEntries([...WORKFLOWS].map((workflow) => {
    const selected = runs.filter((run) => run.workflow === workflow);
    return [workflow, {
      total: selected.length,
      passed: selected.filter((run) => run.outcome.status === "PASS").length,
      median_tokens: median(selected.map((run) => run.telemetry.tokens?.total)),
      median_cached_input_tokens: median(
        selected.map((run) => run.telemetry.tokens?.cached_input),
      ),
      median_uncached_plus_output_tokens: median(
        selected.map((run) => run.telemetry.tokens?.uncached_plus_output),
      ),
      median_output_tokens: median(selected.map((run) => run.telemetry.tokens?.output)),
      median_tool_calls: median(selected.map((run) => run.telemetry.tool_calls)),
      median_workflow_read_calls: median(
        selected.map((run) => run.telemetry.workflow_trace?.read_calls),
      ),
      median_workflow_read_output_chars: median(
        selected.map((run) => run.telemetry.workflow_trace?.read_output_chars),
      ),
      median_wall_seconds: round(median(selected.map((run) => run.wall_seconds)), 1),
      median_turns: median(selected.map((run) => run.telemetry.turns)),
      scope_violations: selected.reduce((sum, run) => sum + run.changes.violations.length, 0),
      activation_failures: selected.filter((run) => !run.activation_reported).length,
      conformance_failures: selected.filter(
        (run) => run.workflow_conformance?.status === "FAIL",
      ).length,
      workflow_artifacts: selected.reduce((sum, run) => sum + run.changes.workflow.length, 0),
    }];
  }));
}

function aggregatePairedRuns(runs) {
  const groups = new Map();
  for (const run of runs) {
    const key = `${run.case_id}\u0000${run.repetition}`;
    const group = groups.get(key) ?? Object.fromEntries(
      [...WORKFLOWS].map((workflow) => [workflow, []]),
    );
    if (WORKFLOWS.has(run.workflow)) group[run.workflow].push(run);
    groups.set(key, group);
  }
  const pairs = [...groups.values()]
    .filter((group) => [...WORKFLOWS].every((workflow) => group[workflow].length === 1))
    .map((group) => Object.fromEntries(
      [...WORKFLOWS].map((workflow) => [workflow, group[workflow][0]]),
    ));
  const bothPass = pairs.filter((group) =>
    [...WORKFLOWS].every((workflow) => group[workflow].outcome.status === "PASS")
  );
  const conformantPass = bothPass.filter((group) =>
    [...WORKFLOWS].every(
      (workflow) => group[workflow].workflow_conformance?.status === "PASS",
    )
  );
  const byRisk = Object.fromEntries(["lean", "standard", "strict"].map((risk) => {
    const selected = pairs.filter((pair) => pair["leanpowers-0.2.0"].risk_level === risk);
    return [risk, {
      all_pairs: summarizePairs(selected),
      both_pass_pairs: summarizePairs(selected.filter((pair) =>
        [...WORKFLOWS].every((workflow) => pair[workflow].outcome.status === "PASS")
      )),
      conformant_pass_pairs: summarizePairs(selected.filter((pair) =>
        [...WORKFLOWS].every((workflow) =>
          pair[workflow].outcome.status === "PASS" &&
          pair[workflow].workflow_conformance?.status === "PASS"
        )
      )),
    }];
  }));
  return {
    all_pairs: summarizePairs(pairs),
    both_pass_pairs: summarizePairs(bothPass),
    conformant_pass_pairs: summarizePairs(conformantPass),
    by_risk: byRisk,
  };
}

function hasCompleteRunMatrix(runs, selectedCases, repetitions) {
  const expected = new Map();
  for (let repetition = 1; repetition <= repetitions; repetition += 1) {
    for (const benchmarkCase of selectedCases) {
      for (const workflow of WORKFLOWS) {
        expected.set(`${benchmarkCase.id}\u0000${repetition}\u0000${workflow}`, 0);
      }
    }
  }
  for (const run of runs) {
    const key = `${run.case_id}\u0000${run.repetition}\u0000${run.workflow}`;
    if (!expected.has(key)) return false;
    expected.set(key, expected.get(key) + 1);
  }
  return [...expected.values()].every((count) => count === 1);
}

function summarizePairs(pairs) {
  const reduction = (selector) => pairs.flatMap((pair) => {
    const baseline = selector(pair["superpowers-6.1.1"]);
    const candidate = selector(pair["leanpowers-0.2.0"]);
    if (!Number.isFinite(baseline) || !Number.isFinite(candidate) || baseline <= 0) {
      return [];
    }
    return [(1 - candidate / baseline) * 100];
  });
  const token = reduction((run) => run.telemetry.tokens?.total);
  const fresh = reduction((run) => run.telemetry.tokens?.uncached_plus_output);
  const wall = reduction((run) => run.wall_seconds);
  const tools = reduction((run) => run.telemetry.tool_calls);
  const workflowReads = reduction((run) => run.telemetry.workflow_trace?.read_calls);
  return {
    count: pairs.length,
    token_pairs: token.length,
    fresh_token_pairs: fresh.length,
    wall_pairs: wall.length,
    tool_call_pairs: tools.length,
    workflow_read_pairs: workflowReads.length,
    median_token_reduction_pct: round(median(token), 1),
    median_fresh_token_reduction_pct: round(median(fresh), 1),
    median_wall_reduction_pct: round(median(wall), 1),
    median_tool_call_reduction_pct: round(median(tools), 1),
    median_workflow_read_reduction_pct: round(median(workflowReads), 1),
  };
}

async function prepareCodexHomes({
  authFile,
  codexExecutable,
  homeRoot,
  leanpowersMarketplace,
  superpowersMarketplace,
  toolchain,
}) {
  const definitions = {};
  for (const [workflow, sourceRoot] of Object.entries({
    "superpowers-6.1.1": superpowersMarketplace,
    "leanpowers-0.2.0": leanpowersMarketplace,
  })) {
    definitions[workflow] = await stageBenchmarkMarketplace({
      homeRoot,
      sourceRoot: path.resolve(sourceRoot),
      workflow,
    });
  }
  const homes = {};
  for (const [workflow, definition] of Object.entries(definitions)) {
    const home = path.join(homeRoot, workflow);
    await mkdir(home, { recursive: true, mode: 0o700 });
    await mkdir(path.join(home, "tmp"), { recursive: true });
    await cp(authFile, path.join(home, "auth.json"));
    await chmod(path.join(home, "auth.json"), 0o600);
    const env = benchmarkEnvironment(home, toolchain.environment);
    const addMarketplace = await runProcess(
      codexExecutable,
      ["plugin", "marketplace", "add", definition.marketplace, "--json"],
      { env, timeoutMs: 60_000 },
    );
    if (addMarketplace.exitCode !== 0) {
      throw new Error(`Cannot add ${workflow} marketplace: ${addMarketplace.stderr}`);
    }
    const install = await runProcess(
      codexExecutable,
      ["plugin", "add", definition.selector, "--json"],
      { env, timeoutMs: 60_000 },
    );
    if (install.exitCode !== 0) {
      throw new Error(`Cannot install ${workflow}: ${install.stderr}`);
    }
    const installed = JSON.parse(install.stdout);
    if (installed.version !== workflow.split("-").at(-1)) {
      throw new Error(`Installed ${workflow} with unexpected version ${installed.version}`);
    }
    homes[workflow] = home;
  }
  return homes;
}

async function stageBenchmarkMarketplace({ homeRoot, sourceRoot, workflow }) {
  const expectedName = workflow.startsWith("superpowers-") ? "superpowers" : "leanpowers";
  const expectedVersion = workflow.split("-").at(-1);
  const pluginSource = expectedName === "superpowers"
    ? sourceRoot
    : path.join(sourceRoot, "plugins", "codex", "leanpowers");
  const manifest = JSON.parse(
    await readFile(path.join(pluginSource, ".codex-plugin", "plugin.json"), "utf8"),
  );
  if (manifest.name !== expectedName || manifest.version !== expectedVersion) {
    throw new Error(
      `Expected ${expectedName} ${expectedVersion}, found ${manifest.name ?? "unknown"} ${manifest.version ?? "unknown"}`,
    );
  }

  const marketplaceName = `benchmark-${expectedName}`;
  const marketplaceRoot = path.join(homeRoot, "marketplaces", marketplaceName);
  const pluginTarget = path.join(marketplaceRoot, "plugin");
  await mkdir(path.join(marketplaceRoot, ".agents", "plugins"), { recursive: true });
  if (expectedName === "leanpowers") {
    await cp(pluginSource, pluginTarget, { recursive: true });
  } else {
    await mkdir(pluginTarget, { recursive: true });
    for (const entry of [".codex-plugin", "skills", "assets", "LICENSE", "README.md"]) {
      await cp(path.join(pluginSource, entry), path.join(pluginTarget, entry), {
        recursive: true,
      });
    }
  }
  await writeFile(
    path.join(marketplaceRoot, ".agents", "plugins", "marketplace.json"),
    `${JSON.stringify({
      name: marketplaceName,
      plugins: [
        {
          name: expectedName,
          source: { source: "local", path: "./plugin" },
          policy: { installation: "AVAILABLE", authentication: "ON_INSTALL" },
          category: "Developer Tools",
        },
      ],
    }, null, 2)}\n`,
  );
  return {
    marketplace: marketplaceRoot,
    selector: `${expectedName}@${marketplaceName}`,
  };
}

async function cleanGitRevision(repository, { officialOrigin, tag } = {}) {
  const root = path.resolve(repository);
  const revision = await runProcess("git", ["rev-parse", "HEAD"], {
    cwd: root,
    timeoutMs: 30_000,
  });
  const status = await runProcess("git", ["status", "--porcelain"], {
    cwd: root,
    timeoutMs: 30_000,
  });
  if (revision.exitCode !== 0 || status.exitCode !== 0) {
    throw new Error("Benchmark workflow source must be a readable Git checkout");
  }
  if (status.stdout.trim()) {
    throw new Error("Benchmark workflow source must be clean before a live run");
  }
  if (tag) {
    const taggedRevision = await runProcess("git", ["rev-parse", `${tag}^{commit}`], {
      cwd: root,
      timeoutMs: 30_000,
    });
    if (taggedRevision.exitCode !== 0 || taggedRevision.stdout.trim() !== revision.stdout.trim()) {
      throw new Error(`Benchmark workflow source HEAD must equal ${tag}`);
    }
  }
  if (officialOrigin) {
    const origin = await runProcess("git", ["remote", "get-url", "origin"], {
      cwd: root,
      timeoutMs: 30_000,
    });
    if (origin.exitCode !== 0 || normalizeGitHubOrigin(origin.stdout.trim()) !== officialOrigin) {
      throw new Error(`Benchmark workflow source must use official origin ${officialOrigin}`);
    }
  }
  return revision.stdout.trim();
}

async function initializeGit(workspace, toolchain) {
  const commands = [
    ["init", "--quiet"],
    ["config", "user.name", "Benchmark Runner"],
    ["config", "user.email", "benchmark@example.invalid"],
    ["add", "."],
    ["commit", "--quiet", "--no-gpg-sign", "-m", "benchmark fixture"],
  ];
  for (const args of commands) {
    const result = await runProcess(toolchain.git, args, {
      cwd: workspace,
      env: benchmarkEnvironment(workspace, toolchain.environment),
      timeoutMs: 30_000,
    });
    if (result.exitCode !== 0) {
      throw new Error(`Failed to initialize benchmark workspace: ${result.stderr}`);
    }
  }
  return gitHead(workspace, toolchain);
}

async function gitHead(workspace, toolchain) {
  const result = await runProcess(
    toolchain.git,
    ["rev-parse", "HEAD"],
    {
      cwd: workspace,
      env: benchmarkEnvironment(workspace, toolchain.environment),
      timeoutMs: 30_000,
    },
  );
  if (result.exitCode !== 0) {
    throw new Error(`Cannot inspect benchmark HEAD: ${result.stderr}`);
  }
  return result.stdout.trim();
}

export async function inspectBenchmarkGitState({
  baselineHead,
  environment = {},
  gitExecutable = "git",
  workspace,
}) {
  const toolchain = { environment, git: gitExecutable };
  return {
    final_head: await gitHead(workspace, toolchain),
    changed_paths: await gitChangedPaths(workspace, baselineHead, toolchain),
    workspace_patch: await gitWorkspacePatch(workspace, baselineHead, toolchain),
  };
}

export async function fingerprintBenchmarkWorkspace({
  baselineHead,
  environment = {},
  gitExecutable = "git",
  workspace,
}) {
  await assertNoUnsupportedWorkspaceEntries(workspace);
  const env = benchmarkEnvironment(workspace, environment);
  const [diff, untracked] = await Promise.all([
    runProcess(
      gitExecutable,
      ["diff", "--binary", "--full-index", "--no-ext-diff", "--no-textconv", baselineHead, "--", "."],
      { cwd: workspace, env, timeoutMs: 30_000 },
    ),
    runProcess(
      gitExecutable,
      ["ls-files", "--others", "--exclude-standard", "-z"],
      { cwd: workspace, env, timeoutMs: 30_000 },
    ),
  ]);
  if (diff.exitCode !== 0 || untracked.exitCode !== 0) {
    throw new Error(`Cannot fingerprint benchmark workspace: ${diff.stderr || untracked.stderr}`);
  }

  const hash = createHash("sha256");
  updateFingerprint(hash, "tracked-patch", diff.stdout);
  const untrackedPaths = untracked.stdout.split("\0").filter(Boolean).sort();
  for (const relativePath of untrackedPaths) {
    const target = path.resolve(workspace, relativePath);
    if (!isSameOrAncestor(workspace, target) || target === path.resolve(workspace)) {
      throw new Error("Cannot fingerprint an unsafe untracked path");
    }
    const stat = await lstat(target);
    if (!stat.isSymbolicLink() && !stat.isFile()) {
      throw new Error("Cannot fingerprint an unsupported untracked entry");
    }
    const kind = stat.isSymbolicLink() ? "symlink" : "file";
    const contents = stat.isSymbolicLink()
      ? await readlink(target)
      : await readFile(target);
    updateFingerprint(
      hash,
      `untracked:${relativePath}:${kind}:${stat.mode.toString(8)}`,
      contents,
    );
  }
  return hash.digest("hex");
}

async function assertNoUnsupportedWorkspaceEntries(workspace, directory = workspace) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (directory === workspace && entry.name === ".git") continue;
    const target = path.join(directory, entry.name);
    const stat = await lstat(target);
    if (stat.isDirectory()) {
      await assertNoUnsupportedWorkspaceEntries(workspace, target);
    } else if (!stat.isFile() && !stat.isSymbolicLink()) {
      throw new Error("Cannot fingerprint an unsupported workspace entry");
    }
  }
}

function updateFingerprint(hash, label, contents) {
  const labelBytes = Buffer.from(label);
  const contentBytes = Buffer.isBuffer(contents) ? contents : Buffer.from(contents);
  hash.update(`${labelBytes.length}:`);
  hash.update(labelBytes);
  hash.update(`${contentBytes.length}:`);
  hash.update(contentBytes);
}

async function gitChangedPaths(workspace, baselineHead, toolchain) {
  const env = benchmarkEnvironment(workspace, toolchain.environment);
  const tracked = await runProcess(
    toolchain.git,
    ["diff", "--name-only", "--relative", baselineHead, "--", "."],
    { cwd: workspace, env, timeoutMs: 30_000 },
  );
  const untracked = await runProcess(
    toolchain.git,
    ["ls-files", "--others", "--exclude-standard"],
    { cwd: workspace, env, timeoutMs: 30_000 },
  );
  if (tracked.exitCode !== 0 || untracked.exitCode !== 0) {
    throw new Error(`Cannot inspect benchmark changes: ${tracked.stderr || untracked.stderr}`);
  }
  return [...new Set(`${tracked.stdout}\n${untracked.stdout}`
    .split(/\r?\n/u)
    .filter(Boolean)
  )];
}

async function gitWorkspacePatch(workspace, baselineHead, toolchain) {
  const env = benchmarkEnvironment(workspace, toolchain.environment);
  const intent = await runProcess(toolchain.git, ["add", "--intent-to-add", "."], {
    cwd: workspace,
    env,
    timeoutMs: 30_000,
  });
  if (intent.exitCode !== 0) {
    throw new Error(`Cannot stage benchmark intent for diff capture: ${intent.stderr}`);
  }
  const diff = await runProcess(toolchain.git, ["diff", "--binary", baselineHead, "--", "."], {
    cwd: workspace,
    env,
    timeoutMs: 30_000,
  });
  if (diff.exitCode !== 0) {
    throw new Error(`Cannot capture benchmark workspace diff: ${diff.stderr}`);
  }
  return diff.stdout;
}

async function materializeRunArtifacts(outputDirectory, pendingArtifacts) {
  for (const { runId, artifacts } of pendingArtifacts) {
    const runDirectory = path.join(outputDirectory, "raw", runId);
    await mkdir(runDirectory, { recursive: true });
    await Promise.all([
      writeFile(path.join(runDirectory, "codex.stdout.jsonl"), artifacts.agent_stdout),
      writeFile(path.join(runDirectory, "codex.stderr.log"), artifacts.agent_stderr),
      writeFile(path.join(runDirectory, "final-message.md"), artifacts.final_message),
      writeFile(
        path.join(runDirectory, "verifier.json"),
        `${JSON.stringify(artifacts.verifier, null, 2)}\n`,
      ),
      writeFile(path.join(runDirectory, "workspace.patch"), artifacts.workspace_patch),
    ]);
  }
}

async function resolveBenchmarkToolchain(codexExecutable) {
  const [codex, git, node, npm] = await Promise.all([
    resolveExecutable(codexExecutable),
    resolveExecutable("git"),
    resolveExecutable("node"),
    resolveExecutable("npm"),
  ]);
  const shell = process.platform === "win32"
    ? process.env.ComSpec ?? "cmd.exe"
    : await resolveExecutable(process.env.SHELL ?? "sh");
  const executableDirectories = [codex, git, node, npm, shell]
    .filter(path.isAbsolute)
    .map(path.dirname);
  const systemDirectories = process.platform === "win32"
    ? []
    : ["/usr/local/bin", "/usr/bin", "/bin", "/usr/sbin", "/sbin"];
  return {
    codex,
    git,
    environment: {
      PATH: [...new Set([...executableDirectories, ...systemDirectories])].join(path.delimiter),
      SHELL: shell,
    },
  };
}

async function resolveExecutable(command) {
  if (path.isAbsolute(command)) {
    try {
      await access(command, fsConstants.X_OK);
      return command;
    } catch {
      throw new Error(`Required benchmark executable is unavailable: ${command}`);
    }
  }
  const locator = process.platform === "win32" ? "where" : "which";
  const result = await runProcess(locator, [command], { timeoutMs: 30_000 });
  const resolved = result.stdout.split(/\r?\n/u).find(Boolean)?.trim();
  if (result.exitCode !== 0 || !resolved || !path.isAbsolute(resolved)) {
    throw new Error(`Required benchmark executable is unavailable: ${command}`);
  }
  try {
    await access(resolved, fsConstants.X_OK);
  } catch {
    throw new Error(`Required benchmark executable is unavailable: ${command}`);
  }
  return resolved;
}

function normalizeGitHubOrigin(origin) {
  return origin
    .replace(/^git@github\.com:/u, "github.com/")
    .replace(/^https?:\/\/github\.com\//u, "github.com/")
    .replace(/\.git$/u, "");
}

export async function runProcess(
  command,
  args,
  {
    cwd,
    env = process.env,
    onStdoutLine,
    timeoutMs = 120_000,
  } = {},
) {
  return new Promise((resolve, reject) => {
    const detached = process.platform !== "win32";
    const child = spawn(command, args, {
      cwd,
      detached,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stdoutLineBuffer = "";
    let stderr = "";
    let timedOut = false;
    let forceKillTimer;
    let callbackError = null;
    let callbackSequence = Promise.resolve();
    let settled = false;
    const queueStdoutLine = (line) => {
      if (typeof onStdoutLine !== "function") return;
      callbackSequence = callbackSequence
        .then(() => callbackError === null ? onStdoutLine(line) : undefined)
        .catch((error) => {
          callbackError ??= error;
        });
    };
    const timer = setTimeout(() => {
      timedOut = true;
      killProcessTree(child, "SIGTERM");
      forceKillTimer = setTimeout(() => killProcessTree(child, "SIGKILL"), 5_000);
    }, timeoutMs);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      if (typeof onStdoutLine !== "function") return;
      stdoutLineBuffer += chunk;
      let newlineIndex;
      while ((newlineIndex = stdoutLineBuffer.indexOf("\n")) !== -1) {
        const rawLine = stdoutLineBuffer.slice(0, newlineIndex);
        stdoutLineBuffer = stdoutLineBuffer.slice(newlineIndex + 1);
        queueStdoutLine(rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine);
      }
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearTimeout(forceKillTimer);
      reject(error);
    });
    child.on("close", async (code, signal) => {
      if (settled) return;
      clearTimeout(timer);
      clearTimeout(forceKillTimer);
      if (stdoutLineBuffer.length > 0) {
        queueStdoutLine(
          stdoutLineBuffer.endsWith("\r")
            ? stdoutLineBuffer.slice(0, -1)
            : stdoutLineBuffer,
        );
      }
      await callbackSequence;
      settled = true;
      if (callbackError) {
        reject(callbackError);
        return;
      }
      resolve({
        exitCode: code ?? (signal ? 128 : 1),
        signal,
        stderr,
        stdout,
        timedOut,
      });
    });
  });
}

function killProcessTree(child, signal) {
  if (!child.pid) return;
  if (process.platform !== "win32") {
    try {
      process.kill(-child.pid, signal);
      return;
    } catch {
      // Fall back to the direct child when the process group has already exited.
    }
  }
  child.kill(signal);
}

function publicCommandResult(result) {
  return {
    exit_code: result.exitCode,
    timed_out: result.timedOut,
    output: `${result.stdout}${result.stderr}`.slice(-20_000),
  };
}

function matchGlob(value, pattern) {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/gu, "\\$&")
    .replace(/\*\*/gu, "\u0000")
    .replace(/\*/gu, "[^/]*")
    .replace(/\u0000/gu, ".*");
  return new RegExp(`^${escaped}$`, "u").test(value);
}

function isSafeRelativePath(value) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    !path.isAbsolute(value) &&
    !value.split(/[\\/]/u).includes("..")
  );
}

function finiteNumber(value) {
  return Number.isFinite(value) ? value : null;
}

export function extractDeclaredRisk(message) {
  const text = String(message ?? "");
  const afterRisk = text.match(/\brisk(?:\s+(?:profile|level))?\s*[:=]?\s*`?(lean|standard|strict)`?/iu);
  if (afterRisk) return afterRisk[1].toLowerCase();
  const beforeRisk = text.match(/`?(lean|standard|strict)`?\s+risk\b/iu);
  if (beforeRisk) return beforeRisk[1].toLowerCase();
  const ownerOrMode = text.match(/\b(lean|standard|strict)\s+(?:owner|mode)\b/iu);
  return ownerOrMode ? ownerOrMode[1].toLowerCase() : null;
}

export function parseLeanRouteLedger(message) {
  const lines = String(message ?? "").split(/\r?\n/u);
  const suffix = lines.slice(4);
  const suffixValid =
    suffix.length === 0 ||
    (suffix.length === 1 && suffix[0] === "") ||
    (suffix.length >= 2 && suffix[0] === "" && suffix[1].trim().length > 0);
  if (
    lines.length < 4 ||
    lines[0] !== "entrypoint: leanpowers:route" ||
    !suffixValid
  ) {
    return null;
  }
  const workflow = lines[1].match(
    /^workflow: (shape|build|debug|review|verify|ship|adapt)$/u,
  )?.[1];
  const risk = lines[2].match(/^risk: (lean|standard|strict)$/u)?.[1];
  if (!workflow || !risk) return null;
  const requiredGates = lines[3].match(/^required_gates: (\[[^\]]*\])$/u)?.[1];
  const expectedGates =
    risk === "strict"
      ? "[independent_review, current_evidence]"
      : "[current_evidence]";
  if (requiredGates !== expectedGates) return null;
  return { workflow, risk, required_gates: requiredGates };
}

export function reportsWorkflowActivation({ entrypoint, message, workflow }) {
  const text = String(message ?? "");
  const aliases = [entrypoint.slice(1)];
  if (workflow === "leanpowers-0.2.0") aliases.push("route");
  const target = aliases
    .map((alias) => `\`?${escapeRegex(alias)}\`?(?:\\s+workflow)?`)
    .join("|");
  const negatedBefore = new RegExp(
    `\\b(?:not|without|skip(?:ping)?|declin(?:e|ing)|unavailable|unable(?:\\s+to)?|cannot|can't|won't|do not)\\b[^\\n.]{0,48}(?:${target})`,
    "iu",
  );
  const unavailableAfter = new RegExp(
    `(?:${target})[^\\n.]{0,32}(?:\\bunavailable\\b|\\bdisabled\\b|\\bnot available\\b|\\bisn't available\\b|\\bcannot be used\\b)`,
    "iu",
  );
  if (negatedBefore.test(text) || unavailableAfter.test(text)) return false;
  if (workflow === "leanpowers-0.2.0") {
    const activationDenied = /\b(?:not|never)\s+activat(?:e|ed|ing)\b|\b(?:activation|entrypoint|workflow|skill)\s+(?:is\s+)?(?:unavailable|disabled|failed)\b|\bactivation\s+(?:did\s+not\s+succeed|was\s+unsuccessful)\b/iu;
    const exactEntrypoint = new RegExp(
      `(?:^|\\n)\\s*(?:[-*]\\s*)?entrypoint\\s*[:=]\\s*\`?${escapeRegex(entrypoint.slice(1))}\`?\\s*(?=\\n|$)`,
      "iu",
    );
    return exactEntrypoint.test(text) && !activationDenied.test(text);
  }
  const structured = new RegExp(
    `(?:^|\\n)\\s*(?:[-*]\\s*)?(?:entrypoint|workflow|skill)\\s*[:=]\\s*(?:${target})(?:\\s|$)`,
    "iu",
  );
  const affirmative = new RegExp(
    `\\b(?:activat(?:e|ed|ing)|invok(?:e|ed|ing)|us(?:e|ed|ing)|follow(?:ed|ing)?|start(?:ed|ing)?(?:\\s+with)?)\\b[^\\n.]{0,64}(?:${target})`,
    "iu",
  );
  return structured.test(text) || affirmative.test(text);
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function median(values) {
  const valid = values.filter(Number.isFinite).sort((left, right) => left - right);
  if (valid.length === 0) return null;
  const middle = Math.floor(valid.length / 2);
  return valid.length % 2 === 1
    ? valid[middle]
    : (valid[middle - 1] + valid[middle]) / 2;
}

function round(value, digits) {
  if (!Number.isFinite(value)) return null;
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function displayMetric(value) {
  return Number.isFinite(value) ? String(value) : "n/a";
}

function displayPercent(value) {
  return Number.isFinite(value) ? `${value}%` : "n/a";
}

function displayPairedMetric(value, count) {
  return `${displayPercent(value)} (n=${count})`;
}

function toFileUrl(input) {
  if (input instanceof URL) return input;
  return pathToFileURL(path.resolve(input));
}

function isSameOrAncestor(parent, child) {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}
