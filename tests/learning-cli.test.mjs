import assert from "node:assert/strict";
import { execFile as execFileCallback, spawn } from "node:child_process";
import {
  access,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  unlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";

import { runCommand } from "../skills/adapt/scripts/learning.mjs";

const execFile = promisify(execFileCallback);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CLI = path.join(ROOT, "skills", "adapt", "scripts", "learning.mjs");
const NOW = "2026-07-13T12:00:00.000Z";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const POST_COMMIT_LOCK_WARNING = {
  code: "STORAGE_LOCK_CLEANUP_FAILED",
  phase: "post_commit",
  message: "Learning mutation committed, but its owned project lock could not be removed.",
};
const AFTER_FAILURE_LOCK_WARNING = {
  code: "STORAGE_LOCK_CLEANUP_FAILED",
  phase: "after_failure",
  message: "Learning mutation failed and its owned project lock could not be removed.",
};

const correctionCandidate = (overrides = {}) => ({
  caller: "leader",
  kind: "correction",
  scope: {
    workflows: ["debug"],
    path_prefixes: ["src/"],
    tags: ["coupon", "tenant-filter"],
  },
  rule: "Verify tenant scope before changing coupon query logic.",
  evidence: {
    source: "explicit_user_feedback",
    summary: "A verified correction established the bounded project rule.",
  },
  supersedes: [],
  expires_at: null,
  ...overrides,
});

const debugContext = {
  workflow: "debug",
  paths: ["src/coupon/service.mjs"],
  tags: ["coupon", "tenant-filter"],
};

async function temporaryDirectory(context, prefix = "leanpowers-cli-") {
  const root = await mkdtemp(path.join(os.tmpdir(), prefix));
  context.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

async function git(cwd, ...args) {
  return execFile("git", args, { cwd, encoding: "utf8" });
}

async function temporaryGitWorkspace(context) {
  const root = await temporaryDirectory(context, "leanpowers-cli-git-");
  await git(root, "init", "-q");
  await git(root, "config", "user.name", "LeanPowers Test");
  await git(root, "config", "user.email", "leanpowers@example.invalid");
  await writeFile(path.join(root, "package.json"), '{"name":"fixture"}\n');
  await mkdir(path.join(root, "src"));
  await writeFile(path.join(root, "src", "index.mjs"), "export const value = 1;\n");
  await git(root, "add", ".");
  await git(root, "commit", "-qm", "fixture");
  await git(root, "remote", "add", "origin", "git@github.com:leanpowers/fixture.git");
  return root;
}

async function runCli(cwd, command, request, options = {}) {
  const args = [CLI, command, ...(options.extraArgs ?? [])];
  const input = options.rawInput ?? `${JSON.stringify(request)}\n`;
  const result = await executeNode(args, { cwd, input });
  return cliResult(result.exitCode, result.stdout, result.stderr);
}

function executeNode(args, { cwd, input = "", timeout = 5000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd, stdio: ["pipe", "pipe", "pipe"] });
    const stdout = [];
    const stderr = [];
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`node child timed out after ${timeout}ms`));
    }, timeout);
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (exitCode, signal) => {
      clearTimeout(timer);
      if (signal) {
        reject(new Error(`node child exited from signal ${signal}`));
        return;
      }
      resolve({
        exitCode,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      });
    });
    child.stdin.end(input);
  });
}

function cliResult(exitCode, stdout, stderr) {
  const lines = stdout.split("\n");
  assert.equal(lines.at(-1), "", "stdout must end with one trailing newline");
  lines.pop();
  assert.equal(lines.length, 1, "stdout must contain exactly one JSON line");
  return { exitCode, json: JSON.parse(lines[0]), stdout, stderr };
}

async function enabledWorkspace(context) {
  const root = await temporaryGitWorkspace(context);
  const enabled = await runCli(root, "enable", { caller: "leader" });
  assert.equal(enabled.exitCode, 0);
  return root;
}

async function record(root, candidate = correctionCandidate()) {
  const result = await runCli(root, "record", candidate);
  assert.equal(result.exitCode, 0, result.stdout);
  return result.json;
}

test("help is static, lists the exact command surface, and does not parse stdin", async () => {
  const result = await executeNode([CLI, "--help"], {
    input: "this is deliberately not JSON",
  });

  assert.equal(result.exitCode, 0);
  assert.equal(result.stderr, "");
  assert.match(result.stdout, /^Usage:/);
  for (const command of [
    "enable",
    "disable",
    "query",
    "record",
    "inspect",
    "forget",
    "clear",
    "delete",
    "doctor",
  ]) {
    assert.match(result.stdout, new RegExp(`\\b${command}\\b`));
  }
  assert.match(result.stdout, /stdin JSON/i);
  assert.match(result.stdout, /stdout/i);
  assert.match(result.stdout, /0.*2.*3.*4.*5.*6/s);
  assert.equal(result.stdout.includes(ROOT), false);
});

test("query before enable returns disabled and creates no state", async (context) => {
  const workspace = await temporaryGitWorkspace(context);
  const result = await runCli(workspace, "query", debugContext);

  assert.equal(result.exitCode, 3);
  assert.equal(result.json.ok, false);
  assert.equal(result.json.code, "LEARNING_DISABLED");
  assert.equal(result.stderr, "");
  await assert.rejects(access(path.join(workspace, ".leanpowers")));
});

test("read commands without caller use reader identity and never recover stale state", async (context) => {
  for (const [command, request] of [
    ["query", debugContext],
    ["inspect", {}],
    ["doctor", {}],
  ]) {
    const workspace = await enabledWorkspace(context);
    const store = path.join(workspace, ".leanpowers");
    const backup = `${store}.backup-stale`;
    const marker = path.join(store, "reader-must-not-remove");
    await cp(store, backup, { recursive: true });
    await writeFile(marker, "canonical\n");

    const result = await runCli(workspace, command, request);

    assert.equal(result.exitCode, 6, command);
    assert.equal(result.json.code, "STORAGE_FAILURE", command);
    assert.equal(result.json.message, "Learning storage operation failed.", command);
    assert.equal(await readFile(marker, "utf8"), "canonical\n", command);
    assert.ok((await readdir(workspace)).includes(".leanpowers.backup-stale"), command);
  }
});

test("every non-help invocation is stdin-only and requires exactly one JSON object", async (context) => {
  const workspace = await temporaryGitWorkspace(context);
  const cases = [
    ["missing stdin", ""],
    ["malformed JSON", "{"],
    ["two JSON values", "{}\n{}\n"],
    ["array", "[]\n"],
    ["null", "null\n"],
  ];

  for (const [label, rawInput] of cases) {
    const result = await runCli(workspace, "doctor", null, { rawInput });
    assert.equal(result.exitCode, 2, label);
    assert.equal(result.json.ok, false, label);
    assert.equal(result.json.code, "INVALID_INPUT", label);
    assert.equal(result.stderr, "", label);
  }

  const extra = await runCli(workspace, "query", debugContext, { extraArgs: ["lesson text"] });
  assert.equal(extra.exitCode, 2);
  assert.equal(extra.json.code, "INVALID_INPUT");

  const unknown = await runCli(workspace, "learn", {});
  assert.equal(unknown.exitCode, 2);
  assert.equal(unknown.json.code, "INVALID_INPUT");
});

test("all six mutation commands reject a missing or non-leader caller", async (context) => {
  const workspace = await temporaryGitWorkspace(context);
  const requests = new Map([
    ["enable", {}],
    ["disable", { caller: "worker" }],
    ["record", correctionCandidate({ caller: "worker" })],
    ["forget", { caller: "worker", lesson_id: "00000000-0000-4000-8000-000000000001" }],
    ["clear", { caller: "worker", all: true }],
    ["delete", { caller: "worker", all: true }],
  ]);

  for (const [command, request] of requests) {
    const result = await runCli(workspace, command, request);
    assert.equal(result.exitCode, 2, command);
    assert.equal(result.json.code, "LEADER_REQUIRED", command);
  }
  await assert.rejects(access(path.join(workspace, ".leanpowers")));
});

test("enable, record, query, disable is a complete opt-in lifecycle", async (context) => {
  const workspace = await temporaryGitWorkspace(context);
  const enabled = await runCli(workspace, "enable", { caller: "leader" });
  assert.equal(enabled.exitCode, 0);
  assert.equal(enabled.json.enabled, true);

  const recorded = await runCli(workspace, "record", correctionCandidate());
  assert.equal(recorded.exitCode, 0);
  assert.equal(recorded.json.action, "activate");
  assert.match(recorded.json.event_id, UUID_PATTERN);
  assert.match(recorded.json.lesson_id, UUID_PATTERN);

  const queried = await runCli(workspace, "query", debugContext);
  assert.equal(queried.exitCode, 0);
  assert.equal(queried.json.lessons.length, 1);
  assert.equal(queried.json.lessons[0].lesson_id, recorded.json.lesson_id);
  assert.equal(queried.json.lessons[0].confidence, 0.9);

  const disabled = await runCli(workspace, "disable", { caller: "leader" });
  assert.equal(disabled.exitCode, 0);
  assert.equal(disabled.json.enabled, false);
  assert.equal((await runCli(workspace, "query", debugContext)).exitCode, 3);

  const inspected = await runCli(workspace, "inspect", {});
  assert.equal(inspected.exitCode, 0);
  assert.equal(inspected.json.enabled, false);
  assert.equal(inspected.json.active.length, 1);
});

test("record derives activate, reinforce, and supersede events", async (context) => {
  const workspace = await enabledWorkspace(context);
  const first = await record(workspace);
  const reinforced = await record(
    workspace,
    correctionCandidate({
      kind: "confirmation",
      evidence: {
        source: "verified_outcome",
        summary: "An independent verified outcome reinforced the same rule.",
      },
    }),
  );
  assert.equal(reinforced.action, "reinforce");
  assert.equal(reinforced.lesson_id, first.lesson_id);

  const replacement = await record(
    workspace,
    correctionCandidate({
      rule: "Verify organization and tenant scope before changing coupon query logic.",
      supersedes: [first.lesson_id],
    }),
  );
  assert.equal(replacement.action, "supersede");
  assert.notEqual(replacement.lesson_id, first.lesson_id);

  const inspected = await runCli(workspace, "inspect", {});
  assert.deepEqual(inspected.json.active.map((lesson) => lesson.lesson_id), [replacement.lesson_id]);
  assert.equal(inspected.json.inactive.some((lesson) => lesson.lesson_id === first.lesson_id), true);
});

test("duplicate support is idempotent and distinct support reinforces exactly once", async (context) => {
  const workspace = await enabledWorkspace(context);
  const ledger = path.join(workspace, ".leanpowers", "lessons.jsonl");
  const first = await record(workspace);
  const initialLines = (await readFile(ledger, "utf8")).trim().split("\n");

  const duplicateActivation = await record(workspace);
  assert.equal(duplicateActivation.action, "reinforce");
  assert.equal(duplicateActivation.lesson_id, first.lesson_id);
  assert.equal(duplicateActivation.recorded, false);
  assert.equal(duplicateActivation.duplicate, true);
  assert.equal(duplicateActivation.confidence, 0.9);
  assert.deepEqual((await readFile(ledger, "utf8")).trim().split("\n"), initialLines);

  const distinctCandidate = correctionCandidate({
    kind: "confirmation",
    evidence: {
      source: "verified_outcome",
      summary: "A distinct verified outcome independently supported the rule.",
    },
  });
  const distinct = await record(workspace, distinctCandidate);
  assert.equal(distinct.action, "reinforce");
  assert.equal(distinct.recorded, true);
  assert.equal(distinct.duplicate, false);
  assert.equal(distinct.confidence, 0.95);
  const afterDistinct = (await readFile(ledger, "utf8")).trim().split("\n");
  assert.equal(afterDistinct.length, initialLines.length + 1);

  const replay = await record(workspace, distinctCandidate);
  assert.equal(replay.action, "reinforce");
  assert.equal(replay.recorded, false);
  assert.equal(replay.duplicate, true);
  assert.equal(replay.confidence, 0.95);
  assert.deepEqual((await readFile(ledger, "utf8")).trim().split("\n"), afterDistinct);
});

test("record owns IDs, timestamp, project identity, revision, and initial confidence", async (context) => {
  const workspace = await temporaryGitWorkspace(context);
  const ids = [
    "00000000-0000-4000-8000-000000000001",
    "00000000-0000-4000-8000-000000000002",
    "00000000-0000-4000-8000-000000000003",
  ];
  const commandContext = {
    cwd: workspace,
    now: () => NOW,
    randomUUID: () => ids.shift(),
  };

  assert.equal((await runCommand("enable", { caller: "leader" }, commandContext)).enabled, true);
  const result = await runCommand("record", correctionCandidate(), commandContext);
  assert.equal(result.ok, true);
  assert.equal(result.event_id, "00000000-0000-4000-8000-000000000002");
  assert.equal(result.lesson_id, "00000000-0000-4000-8000-000000000001");
  assert.equal(result.recorded_at, NOW);
  assert.equal(result.confidence, 0.9);

  const event = JSON.parse(
    (await readFile(path.join(workspace, ".leanpowers", "lessons.jsonl"), "utf8")).trim(),
  );
  const config = JSON.parse(
    await readFile(path.join(workspace, ".leanpowers", "config.json"), "utf8"),
  );
  assert.equal(event.event_id, result.event_id);
  assert.equal(event.lesson_id, result.lesson_id);
  assert.equal(event.recorded_at, NOW);
  assert.equal(event.project_id, config.project_id);
  assert.match(event.evidence.revision, /^git:[a-f0-9]{40}:clean$/);
  assert.equal(event.confidence, 0.9);

  for (const kind of ["preference", "correction", "outcome", "confirmation"]) {
    const preferenceWorkspace = await enabledWorkspace(context);
    const recorded = await record(
      preferenceWorkspace,
      correctionCandidate({
        kind,
        rule: `Keep the ${kind} behavior project scoped.`,
        supersedes: [],
      }),
    );
    assert.equal(recorded.confidence, {
      preference: 1,
      correction: 0.9,
      outcome: 0.85,
      confirmation: 0.75,
    }[kind]);
  }
});

test("record rejects helper-owned fields, unsafe candidates, and full raw content", async (context) => {
  const workspace = await enabledWorkspace(context);
  for (const extra of [
    { event_id: "00000000-0000-4000-8000-000000000001" },
    { lesson_id: "00000000-0000-4000-8000-000000000002" },
    { project_id: `sha256:${"a".repeat(64)}` },
    { recorded_at: NOW },
    { confidence: 0.1 },
    { action: "activate" },
    { revision: "caller-owned" },
    { prompt: "complete user prompt: do not store this" },
  ]) {
    const result = await runCli(workspace, "record", correctionCandidate(extra));
    assert.equal(result.exitCode, 2, JSON.stringify(extra));
    assert.equal(result.json.code, "INVALID_INPUT", JSON.stringify(extra));
  }

  const unsafe = await runCli(
    workspace,
    "record",
    correctionCandidate({ rule: "Use password=do-not-store for this request." }),
  );
  assert.equal(unsafe.exitCode, 2);
  assert.equal(unsafe.json.code, "INVALID_INPUT");
});

test("Node 20 gate blocks learning work but leaves downgrade maintenance available", async (context) => {
  const blockedEnableWorkspace = await temporaryGitWorkspace(context);
  const blockedEnable = await runCommand("enable", { caller: "leader" }, {
    cwd: blockedEnableWorkspace,
    runtimeMajor: 19,
  });
  assert.equal(blockedEnable.ok, false);
  assert.equal(blockedEnable.code, "CAPABILITY_FAILURE");
  assert.equal(blockedEnable.exit_code, 6);
  assert.equal(blockedEnable.message, "Required learning capability is unavailable.");
  await assert.rejects(access(path.join(blockedEnableWorkspace, ".leanpowers")));

  const workspace = await enabledWorkspace(context);
  const first = await record(workspace);
  const ledger = path.join(workspace, ".leanpowers", "lessons.jsonl");
  const before = await readFile(ledger, "utf8");
  const blocked = [
    ["query", debugContext],
    [
      "record",
      correctionCandidate({
        evidence: {
          source: "verified_outcome",
          summary: "A runtime-gated outcome must not be persisted.",
        },
      }),
    ],
    ["forget", { caller: "leader", lesson_id: first.lesson_id }],
    ["clear", { caller: "leader", all: true }],
  ];
  for (const [command, request] of blocked) {
    const result = await runCommand(command, request, { cwd: workspace, runtimeMajor: 19 });
    assert.equal(result.ok, false, command);
    assert.equal(result.code, "CAPABILITY_FAILURE", command);
    assert.equal(result.exit_code, 6, command);
  }
  assert.equal(await readFile(ledger, "utf8"), before);

  const doctor = await runCommand("doctor", {}, { cwd: workspace, runtimeMajor: 19 });
  assert.equal(doctor.ok, false);
  assert.equal(doctor.code, "CAPABILITY_FAILURE");
  assert.equal(doctor.message, "Required learning capability is unavailable.");
  assert.equal(await readFile(ledger, "utf8"), before);

  const inspected = await runCommand("inspect", {}, { cwd: workspace, runtimeMajor: 19 });
  assert.equal(inspected.ok, true);
  assert.equal(inspected.active.length, 1);
  const disabled = await runCommand("disable", { caller: "leader" }, {
    cwd: workspace,
    runtimeMajor: 19,
  });
  assert.equal(disabled.ok, true);
  assert.equal(disabled.enabled, false);
  const deleted = await runCommand("delete", {
    caller: "leader",
    lesson_ids: [first.lesson_id],
  }, { cwd: workspace, runtimeMajor: 19 });
  assert.equal(deleted.ok, true);
  assert.deepEqual(deleted.deleted_lesson_ids, [first.lesson_id]);

  const boundaryWorkspace = await temporaryGitWorkspace(context);
  const boundary = await runCommand("enable", { caller: "leader" }, {
    cwd: boundaryWorkspace,
    runtimeMajor: 20,
  });
  assert.equal(boundary.ok, true);
});

test("query always applies project isolation, confidence floor, and three-lesson cap", async (context) => {
  const workspace = await enabledWorkspace(context);
  const recorded = [];
  for (let index = 0; index < 5; index += 1) {
    recorded.push(
      await record(
        workspace,
        correctionCandidate({
          rule: `Verify tenant scope using bounded project rule ${index}.`,
          evidence: {
            source: "verified_outcome",
            summary: `Verified bounded project outcome ${index}.`,
          },
        }),
      ),
    );
  }
  const result = await runCli(workspace, "query", debugContext);
  const config = JSON.parse(
    await readFile(path.join(workspace, ".leanpowers", "config.json"), "utf8"),
  );
  assert.equal(result.exitCode, 0);
  assert.equal(result.json.lessons.length, 3);
  assert.ok(result.json.lessons.every((lesson) => lesson.project_id === config.project_id));
  assert.ok(result.json.lessons.every((lesson) => lesson.confidence >= 0.7));
  assert.ok(result.json.lessons.every((lesson) => recorded.some((item) => item.lesson_id === lesson.lesson_id)));
});

test("inspect distinguishes active and inactive lessons and forget rejects ambiguity", async (context) => {
  const workspace = await enabledWorkspace(context);
  const first = await record(workspace);
  const second = await record(
    workspace,
    correctionCandidate({ rule: "Check organization scope before modifying coupon filters." }),
  );

  for (const request of [
    { caller: "leader" },
    { caller: "leader", lesson_ids: [first.lesson_id, second.lesson_id] },
    { caller: "leader", lesson_id: "not-a-uuid" },
  ]) {
    const result = await runCli(workspace, "forget", request);
    assert.equal(result.exitCode, 2);
    assert.equal(result.json.code, "INVALID_INPUT");
  }

  const forgotten = await runCli(workspace, "forget", {
    caller: "leader",
    lesson_id: first.lesson_id,
  });
  assert.equal(forgotten.exitCode, 0);
  assert.equal(forgotten.json.action, "forget");
  assert.equal(forgotten.json.lesson_id, first.lesson_id);

  const inspected = await runCli(workspace, "inspect", {});
  assert.deepEqual(inspected.json.active.map((lesson) => lesson.lesson_id), [second.lesson_id]);
  assert.deepEqual(inspected.json.inactive.map((lesson) => lesson.lesson_id), [first.lesson_id]);
});

test("clear requires an explicit all target and appends an auditable event", async (context) => {
  const workspace = await enabledWorkspace(context);
  await record(workspace);
  const before = (await readFile(path.join(workspace, ".leanpowers", "lessons.jsonl"), "utf8"))
    .trim()
    .split("\n");

  const ambiguous = await runCli(workspace, "clear", { caller: "leader" });
  assert.equal(ambiguous.exitCode, 2);
  assert.equal(ambiguous.json.code, "INVALID_INPUT");

  const cleared = await runCli(workspace, "clear", { caller: "leader", all: true });
  assert.equal(cleared.exitCode, 0);
  assert.equal(cleared.json.action, "clear");
  const after = (await readFile(path.join(workspace, ".leanpowers", "lessons.jsonl"), "utf8"))
    .trim()
    .split("\n");
  assert.equal(after.length, before.length + 1);
  assert.equal(JSON.parse(after.at(-1)).action, "clear");
  const inspected = await runCli(workspace, "inspect", {});
  assert.equal(inspected.json.active.length, 0);
  assert.equal(inspected.json.inactive.length, 1);
});

test("delete accepts exactly lesson_ids or all and reports physical reference closure", async (context) => {
  const workspace = await enabledWorkspace(context);
  const first = await record(workspace);
  const replacement = await record(
    workspace,
    correctionCandidate({
      rule: "Check organization and tenant scope before changing coupon filters.",
      supersedes: [first.lesson_id],
    }),
  );
  const survivor = await record(
    workspace,
    correctionCandidate({ rule: "Confirm coupon activity status before changing query code." }),
  );

  for (const request of [
    { caller: "leader" },
    { caller: "leader", lesson_ids: [] },
    { caller: "leader", lesson_ids: [first.lesson_id], all: true },
  ]) {
    const result = await runCli(workspace, "delete", request);
    assert.equal(result.exitCode, 2);
    assert.equal(result.json.code, "INVALID_INPUT");
  }

  const selected = await runCli(workspace, "delete", {
    caller: "leader",
    lesson_ids: [first.lesson_id],
  });
  assert.equal(selected.exitCode, 0);
  assert.deepEqual(new Set(selected.json.deleted_lesson_ids), new Set([first.lesson_id, replacement.lesson_id]));
  const persisted = await readFile(path.join(workspace, ".leanpowers", "lessons.jsonl"), "utf8");
  assert.equal(persisted.includes(first.lesson_id), false);
  assert.equal(persisted.includes(replacement.lesson_id), false);
  assert.equal(persisted.includes(survivor.lesson_id), true);

  const all = await runCli(workspace, "delete", { caller: "leader", all: true });
  assert.equal(all.exitCode, 0);
  assert.deepEqual(all.json.deleted_lesson_ids, [survivor.lesson_id]);
  assert.equal(await readFile(path.join(workspace, ".leanpowers", "lessons.jsonl"), "utf8"), "");
});

test("project mismatch, write conflict, and storage failure map to exact exit codes", async (context) => {
  const workspace = await enabledWorkspace(context);
  const configPath = path.join(workspace, ".leanpowers", "config.json");
  const config = JSON.parse(await readFile(configPath, "utf8"));
  config.project_id = `sha256:${"f".repeat(64)}`;
  await writeFile(configPath, `${JSON.stringify(config)}\n`);
  assert.equal(Object.hasOwn(debugContext, "projectId"), false);
  const queryMismatch = await runCli(workspace, "query", debugContext);
  assert.equal(queryMismatch.exitCode, 4);
  assert.equal(queryMismatch.json.code, "PROJECT_MISMATCH");
  const mismatch = await runCli(workspace, "inspect", {});
  assert.equal(mismatch.exitCode, 4);
  assert.equal(mismatch.json.code, "PROJECT_MISMATCH");

  const conflictWorkspace = await enabledWorkspace(context);
  let conflicts = 0;
  const conflict = await runCommand("record", correctionCandidate(), {
    cwd: conflictWorkspace,
    now: () => NOW,
    async beforeCommit() {
      conflicts += 1;
      await writeFile(
        path.join(conflictWorkspace, ".leanpowers", "concurrent-marker"),
        `${conflicts}\n`,
      );
    },
  });
  assert.equal(conflict.ok, false);
  assert.equal(conflict.code, "WRITE_CONFLICT");
  assert.equal(conflict.exit_code, 5);

  const clearConflictWorkspace = await enabledWorkspace(context);
  let clearConflicts = 0;
  const clearConflict = await runCommand("clear", { caller: "leader", all: true }, {
    cwd: clearConflictWorkspace,
    now: () => NOW,
    async beforeCommit() {
      clearConflicts += 1;
      await writeFile(
        path.join(clearConflictWorkspace, ".leanpowers", "concurrent-marker"),
        `${clearConflicts}\n`,
      );
    },
  });
  assert.equal(clearConflict.ok, false);
  assert.equal(clearConflict.code, "WRITE_CONFLICT");
  assert.equal(clearConflict.exit_code, 5);

  const storageWorkspace = await enabledWorkspace(context);
  const storage = await runCommand("record", correctionCandidate(), {
    cwd: storageWorkspace,
    now: () => NOW,
    fs: {
      async rename(source, destination) {
        if (
          String(source).includes(".leanpowers.replace-") &&
          String(destination).endsWith(".leanpowers")
        ) {
          throw new Error("injected storage failure");
        }
        return rename(source, destination);
      },
    },
  });
  assert.equal(storage.ok, false);
  assert.equal(storage.code, "STORAGE_FAILURE");
  assert.equal(storage.exit_code, 6);
  assert.equal(storage.message, "Learning storage operation failed.");
  assert.equal(JSON.stringify(storage).includes("injected storage failure"), false);
});

test("CLI reports lock cleanup truthfully for committed and failed mutations", async (context) => {
  const committedWorkspace = await temporaryGitWorkspace(context);
  const committed = await runCommand("enable", { caller: "leader" }, {
    cwd: committedWorkspace,
    now: () => NOW,
    fs: {
      async unlink(target) {
        if (String(target).endsWith(".leanpowers.lock/owner.json")) {
          throw Object.assign(new Error("injected lock owner unlink failure"), { code: "EIO" });
        }
        return unlink(target);
      },
    },
  });

  assert.equal(committed.ok, true);
  assert.equal(committed.enabled, true);
  assert.deepEqual(committed.cleanup_warnings, [POST_COMMIT_LOCK_WARNING]);
  assert.equal(
    JSON.parse(
      await readFile(path.join(committedWorkspace, ".leanpowers", "config.json"), "utf8"),
    ).enabled,
    true,
  );

  const failedWorkspace = await enabledWorkspace(context);
  let conflicts = 0;
  const failed = await runCommand("record", correctionCandidate(), {
    cwd: failedWorkspace,
    now: () => NOW,
    async beforeCommit() {
      conflicts += 1;
      await writeFile(
        path.join(failedWorkspace, ".leanpowers", "concurrent-marker"),
        `${conflicts}\n`,
      );
    },
    fs: {
      async unlink(target) {
        if (String(target).endsWith(".leanpowers.lock/owner.json")) {
          throw Object.assign(new Error("injected lock owner unlink failure"), { code: "EIO" });
        }
        return unlink(target);
      },
    },
  });

  assert.equal(failed.ok, false);
  assert.equal(failed.code, "WRITE_CONFLICT");
  assert.equal(failed.exit_code, 5);
  assert.deepEqual(failed.cleanup_warnings, [AFTER_FAILURE_LOCK_WARNING]);
});

test("public exit 6 envelopes sanitize project-resolution and unknown failures", async (context) => {
  const workspace = await temporaryGitWorkspace(context);
  const secretPath = path.join(workspace, "private", "secret.txt");
  const resolution = await runCommand("query", debugContext, {
    cwd: workspace,
    fs: {
      async realpath() {
        throw new Error(`cannot resolve ${secretPath}`);
      },
    },
  });
  assert.equal(resolution.exit_code, 6);
  assert.equal(resolution.code, "STORAGE_FAILURE");
  assert.equal(resolution.message, "Learning storage operation failed.");
  assert.equal(JSON.stringify(resolution).includes(secretPath), false);

  const enabled = await enabledWorkspace(context);
  const unknown = await runCommand("query", debugContext, {
    cwd: enabled,
    now() {
      throw new Error(`unknown failure at ${secretPath}`);
    },
  });
  assert.equal(unknown.exit_code, 6);
  assert.equal(unknown.code, "STORAGE_FAILURE");
  assert.equal(unknown.message, "Learning storage operation failed.");
  assert.equal(JSON.stringify(unknown).includes(secretPath), false);
  assert.equal(Object.hasOwn(unknown, "stack"), false);
});

test("doctor resolves schemas relative to the package and reports capability failure", async (context) => {
  const packageRoot = await temporaryDirectory(context, "leanpowers-package-");
  const scriptDirectory = path.join(packageRoot, "skills", "adapt", "scripts");
  await mkdir(scriptDirectory, { recursive: true });
  for (const file of ["learning.mjs", "learning-core.mjs", "learning-store.mjs"]) {
    await cp(path.join(ROOT, "skills", "adapt", "scripts", file), path.join(scriptDirectory, file));
  }
  await mkdir(path.join(packageRoot, "schemas"));
  for (const file of ["learning-config.schema.json", "lesson-event.schema.json"]) {
    await cp(path.join(ROOT, "schemas", file), path.join(packageRoot, "schemas", file));
  }
  const unrelatedCwd = await temporaryDirectory(context, "leanpowers-package-cwd-");
  const packagedCli = path.join(scriptDirectory, "learning.mjs");

  const healthy = await executeNode([packagedCli, "doctor"], {
    cwd: unrelatedCwd,
    input: "{}\n",
  });
  assert.equal(healthy.exitCode, 0);
  const healthyJson = JSON.parse(healthy.stdout);
  assert.equal(healthyJson.ok, true);
  assert.equal(healthyJson.schemas, true);

  await rm(path.join(packageRoot, "schemas", "lesson-event.schema.json"));
  const unhealthy = await executeNode([packagedCli, "doctor"], {
    cwd: unrelatedCwd,
    input: "{}\n",
  });
  assert.equal(unhealthy.exitCode, 6);
  const result = cliResult(unhealthy.exitCode, unhealthy.stdout, unhealthy.stderr);
  assert.equal(result.json.code, "CAPABILITY_FAILURE");
  assert.equal(result.json.message, "Required learning capability is unavailable.");
  assert.equal(result.stdout.includes(packageRoot), false);
  assert.equal(result.stdout.includes("ENOENT"), false);
  assert.equal(Object.hasOwn(result.json, "stack"), false);
});

test("helper stays package-bounded, dependency-free, and network-free", async (context) => {
  const workspace = await temporaryGitWorkspace(context);
  const sibling = await temporaryDirectory(context, "leanpowers-outside-");
  const sentinel = path.join(sibling, "sentinel.txt");
  await writeFile(sentinel, "unchanged\n");
  const source = await readFile(CLI, "utf8");

  assert.doesNotMatch(source, /node:(?:http|https|net|tls|dgram)|\bfetch\s*\(/);
  const importSpecifiers = [...source.matchAll(/\bfrom\s+["']([^"']+)["']/g)].map(
    (match) => match[1],
  );
  assert.ok(importSpecifiers.every((specifier) => specifier.startsWith("node:") || specifier.startsWith("./")));
  assert.equal((await runCli(workspace, "doctor", {})).exitCode, 0);
  assert.equal(await readFile(sentinel, "utf8"), "unchanged\n");
  await assert.rejects(access(path.join(workspace, ".leanpowers")));
});
