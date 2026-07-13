#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { rankLessons, validateEvent } from "./learning-core.mjs";
import {
  deleteLearning,
  disableProject,
  enableProject,
  inspectLearningState,
  readLearningState,
  recordCandidate,
  resolveProject,
} from "./learning-store.mjs";

const COMMANDS = [
  "enable",
  "disable",
  "query",
  "record",
  "inspect",
  "forget",
  "clear",
  "delete",
  "doctor",
];
const MUTATIONS = new Set(["enable", "disable", "record", "forget", "clear", "delete"]);
const NODE_20_COMMANDS = new Set(["enable", "query", "record", "forget", "clear"]);
const INITIAL_CONFIDENCE = {
  preference: 1,
  correction: 0.9,
  outcome: 0.85,
  confirmation: 0.75,
};
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_STDIN_BYTES = 64 * 1024;
const SCHEMA_URLS = [
  new URL("../../../schemas/learning-config.schema.json", import.meta.url),
  new URL("../../../schemas/lesson-event.schema.json", import.meta.url),
];
const LOCK_CLEANUP_MESSAGES = {
  post_commit: "Learning mutation committed, but its owned project lock could not be removed.",
  after_failure: "Learning mutation failed and its owned project lock could not be removed.",
};

const HELP = `Usage: node learning.mjs <command>

Commands: enable disable query record inspect forget clear delete doctor

All commands except --help read exactly one request object as stdin JSON and write
exactly one JSON result envelope to stdout. Rule, evidence, and lesson text belong
only in stdin JSON, never in argv. Mutation requests require caller: "leader".

Exit codes: 0 success; 2 invalid input/schema; 3 learning disabled;
4 project mismatch; 5 write conflict; 6 storage/capability failure.
`;

const commandError = (code, message) => Object.assign(new Error(message), { code });

const isObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

function cleanupWarningFields(source) {
  if (!Array.isArray(source?.cleanup_warnings)) return {};
  const warnings = source.cleanup_warnings.flatMap((warning) => {
    if (
      warning?.code !== "STORAGE_LOCK_CLEANUP_FAILED" ||
      !Object.hasOwn(LOCK_CLEANUP_MESSAGES, warning.phase)
    ) {
      return [];
    }
    return [{
      code: "STORAGE_LOCK_CLEANUP_FAILED",
      phase: warning.phase,
      message: LOCK_CLEANUP_MESSAGES[warning.phase],
    }];
  });
  return warnings.length > 0 ? { cleanup_warnings: warnings } : {};
}

function requireClosedRequest(request, required, optional = []) {
  if (!isObject(request)) {
    throw commandError("INVALID_INPUT", "request must be a JSON object");
  }
  const allowed = new Set([...required, ...optional]);
  const extra = Object.keys(request).filter((key) => !allowed.has(key)).sort();
  if (extra.length > 0) {
    throw commandError("INVALID_INPUT", `request field is not allowed: ${extra[0]}`);
  }
  const missing = required.filter((key) => !Object.hasOwn(request, key));
  if (missing.length > 0) {
    throw commandError("INVALID_INPUT", `request field is required: ${missing[0]}`);
  }
}

function requireLeader(request) {
  if (request.caller !== "leader") {
    throw commandError("LEADER_REQUIRED", "learning mutations require caller leader");
  }
}

function requireUuid(value, field) {
  if (typeof value !== "string" || !UUID_V4_PATTERN.test(value)) {
    throw commandError("INVALID_INPUT", `${field} must be a UUID v4`);
  }
}

function requireString(value, field, maximum) {
  if (typeof value !== "string" || value.length === 0 || value.length > maximum) {
    throw commandError("INVALID_INPUT", `${field} must be a non-empty string of at most ${maximum} characters`);
  }
}

function requireStringList(value, field, maximum, itemMaximum) {
  if (!Array.isArray(value) || value.length > maximum) {
    throw commandError("INVALID_INPUT", `${field} must be an array of at most ${maximum} items`);
  }
  if (new Set(value).size !== value.length) {
    throw commandError("INVALID_INPUT", `${field} must not contain duplicates`);
  }
  for (const item of value) requireString(item, `${field}[]`, itemMaximum);
}

function requireCallerIfPresent(request) {
  if (Object.hasOwn(request, "caller") && typeof request.caller !== "string") {
    throw commandError("INVALID_INPUT", "caller must be a string");
  }
}

function dependenciesFor(request, context) {
  const {
    cwd: _cwd,
    randomUUID: _eventUuid,
    runtimeMajor: _runtimeMajor,
    storageRandomUUID,
    ...dependencies
  } = context;
  return {
    ...dependencies,
    caller: request.caller ?? dependencies.caller ?? "reader",
    ...(storageRandomUUID ? { randomUUID: storageRandomUUID } : {}),
  };
}

async function projectFor(request, context) {
  return resolveProject(context.cwd ?? process.cwd(), dependenciesFor(request, context));
}

const nowFor = (context) => (context.now ? context.now() : new Date().toISOString());
const uuidFor = (context) => (context.randomUUID ?? randomUUID)();
const runtimeMajorFor = (context) =>
  context.runtimeMajor ?? Number.parseInt(process.versions.node.split(".")[0], 10);

function requireNode20(context) {
  if (!Number.isInteger(runtimeMajorFor(context)) || runtimeMajorFor(context) < 20) {
    throw commandError("CAPABILITY_FAILURE", "Node.js 20 or newer is required");
  }
}

function validateQuery(request) {
  requireClosedRequest(request, ["workflow", "paths", "tags"], ["caller"]);
  requireCallerIfPresent(request);
  requireString(request.workflow, "workflow", 64);
  requireStringList(request.paths, "paths", 32, 500);
  requireStringList(request.tags, "tags", 32, 20);
  for (const candidate of request.paths) {
    if (/^(?:[/\\]|[A-Za-z]:[/\\])/.test(candidate) || candidate.split(/[/\\]/).includes("..")) {
      throw commandError("INVALID_INPUT", "paths must be safe relative paths");
    }
  }
}

function validateRecordRequest(request) {
  requireClosedRequest(
    request,
    ["caller", "kind", "scope", "rule", "evidence"],
    ["supersedes", "expires_at"],
  );
  requireLeader(request);
  if (!Object.hasOwn(INITIAL_CONFIDENCE, request.kind)) {
    throw commandError("INVALID_INPUT", "kind is not supported");
  }
  if (!isObject(request.scope)) {
    throw commandError("INVALID_INPUT", "scope must be an object");
  }
  requireClosedRequest(request.scope, ["workflows", "path_prefixes", "tags"]);
  if (!isObject(request.evidence)) {
    throw commandError("INVALID_INPUT", "evidence must be an object");
  }
  requireClosedRequest(request.evidence, ["source", "summary"]);
  if (Object.hasOwn(request, "supersedes")) {
    requireStringList(request.supersedes, "supersedes", 32, 128);
    for (const lessonId of request.supersedes) requireUuid(lessonId, "supersedes[]");
  }
}

function completeEvidence(request, project) {
  return {
    source: request.evidence.source,
    summary: request.evidence.summary,
    revision: project.revision,
  };
}

function candidateSnapshot(request, project, context, action, lessonId, eventId, confidence) {
  return {
    schema_version: 1,
    event_id: eventId,
    project_id: project.projectId,
    recorded_at: nowFor(context),
    action,
    lesson_id: lessonId,
    kind: request.kind,
    scope: structuredClone(request.scope),
    rule: request.rule,
    evidence: completeEvidence(request, project),
    confidence,
    supersedes: [...(request.supersedes ?? [])],
    expires_at: request.expires_at ?? null,
  };
}

function assertValidEvent(event) {
  const errors = validateEvent(event);
  if (errors.length > 0) {
    throw commandError("INVALID_INPUT", `invalid normalized candidate: ${errors.join("; ")}`);
  }
}

const sameStringSet = (left, right) =>
  Array.isArray(left) &&
  Array.isArray(right) &&
  left.length === right.length &&
  left.every((value) => right.includes(value));

const sameScope = (left, right) =>
  isObject(left) &&
  isObject(right) &&
  sameStringSet(left.workflows, right.workflows) &&
  sameStringSet(left.path_prefixes, right.path_prefixes) &&
  sameStringSet(left.tags, right.tags);

const normalizeSupportSummary = (value) =>
  typeof value === "string" ? value.normalize("NFKC").trim().replace(/\s+/g, " ") : null;

function hasSupportEvent(events, lessonId, evidence) {
  const summary = normalizeSupportSummary(evidence.summary);
  return events.some(
    (event) =>
      event.lesson_id === lessonId &&
      event.evidence &&
      normalizeSupportSummary(event.evidence.summary) === summary &&
      event.evidence.revision === evidence.revision,
  );
}

async function recordCommand(request, project, context, dependencies) {
  validateRecordRequest(request);
  const state = await readLearningState(project, dependencies);
  if (state.code === "LEARNING_DISABLED") {
    throw commandError("LEARNING_DISABLED", "learning is not enabled for this project");
  }
  const supersedes = request.supersedes ?? [];
  const activeIds = new Set(state.active.map((lesson) => lesson.lesson_id));
  for (const lessonId of supersedes) {
    if (!activeIds.has(lessonId)) {
      throw commandError("INVALID_INPUT", `superseded lesson is not active: ${lessonId}`);
    }
  }

  const matching = supersedes.length === 0
    ? state.active.find(
        (lesson) =>
          lesson.rule === request.rule &&
          sameScope(lesson.scope, request.scope),
      )
    : null;
  let event;
  if (matching) {
    const evidence = completeEvidence(request, project);
    if (hasSupportEvent(state.events, matching.lesson_id, evidence)) {
      return {
        ok: true,
        action: "reinforce",
        lesson_id: matching.lesson_id,
        confidence: matching.confidence,
        recorded: false,
        duplicate: true,
      };
    }
    event = {
      schema_version: 1,
      event_id: uuidFor(context),
      project_id: project.projectId,
      recorded_at: nowFor(context),
      action: "reinforce",
      lesson_id: matching.lesson_id,
      evidence,
      confidence: Number(Math.min(1, matching.confidence + 0.05).toFixed(12)),
    };
  } else {
    const action = supersedes.length > 0 ? "supersede" : "activate";
    event = candidateSnapshot(
      request,
      project,
      context,
      action,
      uuidFor(context),
      uuidFor(context),
      INITIAL_CONFIDENCE[request.kind],
    );
  }
  assertValidEvent(event);
  const result = await recordCandidate(project, event, dependencies);
  return {
    ok: true,
    action: event.action,
    event_id: event.event_id,
    lesson_id: event.lesson_id,
    recorded_at: event.recorded_at,
    confidence: event.confidence,
    compacted: result.compacted,
    recorded: true,
    duplicate: false,
    ...cleanupWarningFields(result),
  };
}

async function appendTargetEvent(action, lessonId, project, context, dependencies) {
  const event = {
    schema_version: 1,
    event_id: uuidFor(context),
    project_id: project.projectId,
    recorded_at: nowFor(context),
    action,
    ...(lessonId ? { lesson_id: lessonId } : {}),
  };
  assertValidEvent(event);
  const result = await recordCandidate(project, event, dependencies);
  return {
    ok: true,
    action,
    event_id: event.event_id,
    recorded_at: event.recorded_at,
    ...(lessonId ? { lesson_id: lessonId } : {}),
    ...cleanupWarningFields(result),
  };
}

async function inspectCommand(project, dependencies) {
  const state = await inspectLearningState(project, dependencies);
  return {
    ok: true,
    enabled: state.config?.enabled ?? false,
    active: state.active,
    inactive: state.inactive,
    event_count: state.events.length,
    archived_event_count: state.archiveEvents.length,
  };
}

async function checkSchemas() {
  try {
    const schemas = await Promise.all(
      SCHEMA_URLS.map(async (url) => JSON.parse(await readFile(url, "utf8"))),
    );
    if (
      schemas[0]?.properties?.schema_version?.const !== 1 ||
      !Array.isArray(schemas[1]?.oneOf) ||
      schemas[1].oneOf.length !== 5
    ) {
      throw new Error("learning schemas do not expose the required versioned contracts");
    }
  } catch (error) {
    throw commandError("CAPABILITY_FAILURE", "packaged learning schemas are unavailable");
  }
}

function exitCodeFor(error) {
  if (
    error?.code === "INVALID_INPUT" ||
    error?.code === "LEADER_REQUIRED" ||
    error?.code === "INVALID_LEARNING_CONFIG" ||
    error?.code === "INVALID_LEARNING_STATE" ||
    error?.code === "DUPLICATE_EVENT_ID" ||
    error?.code === "RAW_PROJECT_PATH"
  ) {
    return 2;
  }
  if (error?.code === "LEARNING_DISABLED") return 3;
  if (error?.code === "PROJECT_MISMATCH") return 4;
  if (error?.code === "WRITE_CONFLICT") return 5;
  if (
    error?.code === "CAPABILITY_FAILURE" ||
    error?.code === "PROJECT_RESOLUTION_FAILED" ||
    error?.code === "STORAGE_FAILURE" ||
    String(error?.code ?? "").startsWith("STORAGE_") ||
    /^(?:EACCES|EBUSY|EIO|EMFILE|ENFILE|ENOSPC|ENOTDIR|EROFS)$/.test(error?.code ?? "")
  ) {
    return 6;
  }
  return 6;
}

function errorResult(error) {
  const exitCode = exitCodeFor(error);
  const preserveCode = [2, 3, 4, 5].includes(exitCode) || error?.code === "CAPABILITY_FAILURE";
  const message =
    exitCode === 3
      ? "Learning is disabled for this project."
      : exitCode === 4
        ? "Learning state does not match the current project."
        : exitCode === 5
          ? "Learning state changed concurrently; retry the operation."
          : exitCode === 6 && error?.code === "CAPABILITY_FAILURE"
            ? "Required learning capability is unavailable."
            : exitCode === 6
              ? "Learning storage operation failed."
              : error?.message ?? "Invalid learning command input.";
  return {
    ok: false,
    code: preserveCode ? error.code ?? "INVALID_INPUT" : "STORAGE_FAILURE",
    message,
    exit_code: exitCode,
    ...cleanupWarningFields(error),
  };
}

export async function runCommand(command, request, context = {}) {
  try {
    if (!COMMANDS.includes(command)) {
      throw commandError("INVALID_INPUT", `unsupported command: ${String(command)}`);
    }
    if (!isObject(request)) {
      throw commandError("INVALID_INPUT", "request must be a JSON object");
    }
    if (MUTATIONS.has(command)) requireLeader(request);
    const dependencies = dependenciesFor(request, context);

    if (command === "doctor") {
      requireClosedRequest(request, [], ["caller"]);
      requireCallerIfPresent(request);
      requireNode20(context);
      const major = runtimeMajorFor(context);
      await checkSchemas();
      const doctorRequest = { ...request, caller: "reader" };
      const doctorDependencies = dependenciesFor(doctorRequest, context);
      const project = await projectFor(doctorRequest, context);
      const state = await readLearningState(project, doctorDependencies);
      return {
        ok: true,
        node: true,
        schemas: true,
        node_major: major,
        learning_enabled: state.config?.enabled ?? false,
      };
    }

    if (NODE_20_COMMANDS.has(command)) requireNode20(context);
    const project = await projectFor(request, context);
    if (command === "enable") {
      requireClosedRequest(request, ["caller"]);
      const result = await enableProject(project, nowFor(context), dependencies);
      return { ok: true, enabled: result.enabled, ...cleanupWarningFields(result) };
    }
    if (command === "disable") {
      requireClosedRequest(request, ["caller"]);
      const result = await disableProject(project, nowFor(context), dependencies);
      return { ok: true, enabled: result.enabled, ...cleanupWarningFields(result) };
    }
    if (command === "query") {
      validateQuery(request);
      const state = await readLearningState(project, dependencies);
      if (state.code === "LEARNING_DISABLED") {
        throw commandError("LEARNING_DISABLED", "learning is not enabled for this project");
      }
      return {
        ok: true,
        lessons: rankLessons(state.active, {
          projectId: project.projectId,
          workflow: request.workflow,
          paths: request.paths,
          tags: request.tags,
          now: nowFor(context),
          limit: 3,
          minConfidence: 0.7,
        }),
      };
    }
    if (command === "record") {
      return await recordCommand(request, project, context, dependencies);
    }
    if (command === "inspect") {
      requireClosedRequest(request, [], ["caller"]);
      requireCallerIfPresent(request);
      return await inspectCommand(project, dependencies);
    }
    if (command === "forget") {
      requireClosedRequest(request, ["caller", "lesson_id"]);
      requireUuid(request.lesson_id, "lesson_id");
      const state = await readLearningState(project, dependencies);
      if (state.code === "LEARNING_DISABLED") {
        throw commandError("LEARNING_DISABLED", "learning is not enabled for this project");
      }
      if (!state.active.some((lesson) => lesson.lesson_id === request.lesson_id)) {
        throw commandError("INVALID_INPUT", "forget requires one exact active lesson_id");
      }
      return await appendTargetEvent("forget", request.lesson_id, project, context, dependencies);
    }
    if (command === "clear") {
      requireClosedRequest(request, ["caller", "all"]);
      if (request.all !== true) {
        throw commandError("INVALID_INPUT", "clear requires all: true");
      }
      const state = await readLearningState(project, dependencies);
      if (state.code === "LEARNING_DISABLED") {
        throw commandError("LEARNING_DISABLED", "learning is not enabled for this project");
      }
      return await appendTargetEvent("clear", null, project, context, dependencies);
    }
    if (command === "delete") {
      requireClosedRequest(request, ["caller"], ["lesson_ids", "all"]);
      const hasIds = Object.hasOwn(request, "lesson_ids");
      const hasAll = Object.hasOwn(request, "all");
      if (hasIds === hasAll) {
        throw commandError("INVALID_INPUT", "delete requires exactly one of lesson_ids or all");
      }
      let storeRequest;
      if (hasAll) {
        if (request.all !== true) throw commandError("INVALID_INPUT", "delete all must equal true");
        storeRequest = { all: true };
      } else {
        requireStringList(request.lesson_ids, "lesson_ids", 32, 128);
        if (request.lesson_ids.length === 0) {
          throw commandError("INVALID_INPUT", "lesson_ids must not be empty");
        }
        for (const lessonId of request.lesson_ids) requireUuid(lessonId, "lesson_ids[]");
        storeRequest = { lessonIds: request.lesson_ids };
      }
      const result = await deleteLearning(project, storeRequest, dependencies);
      return {
        ok: true,
        deleted_lesson_ids: result.deletedLessonIds,
        ...cleanupWarningFields(result),
      };
    }
    throw commandError("INVALID_INPUT", `unsupported command: ${command}`);
  } catch (error) {
    return errorResult(error);
  }
}

async function readRequest() {
  const chunks = [];
  let size = 0;
  for await (const chunk of process.stdin) {
    size += Buffer.byteLength(chunk);
    if (size > MAX_STDIN_BYTES) {
      throw commandError("INVALID_INPUT", "stdin JSON exceeds 64 KiB");
    }
    chunks.push(chunk);
  }
  const input = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString("utf8");
  if (input.trim() === "") throw commandError("INVALID_INPUT", "stdin must contain one JSON object");
  let request;
  try {
    request = JSON.parse(input);
  } catch {
    throw commandError("INVALID_INPUT", "stdin must contain exactly one valid JSON object");
  }
  if (!isObject(request)) throw commandError("INVALID_INPUT", "stdin JSON must be an object");
  return request;
}

async function main(args) {
  if (args.length === 1 && args[0] === "--help") {
    process.stdout.write(HELP);
    return;
  }
  let result;
  if (args.length !== 1 || !COMMANDS.includes(args[0])) {
    result = errorResult(commandError("INVALID_INPUT", "expected exactly one supported command"));
  } else {
    try {
      result = await runCommand(args[0], await readRequest(), { cwd: process.cwd() });
    } catch (error) {
      result = errorResult(error);
    }
  }
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exitCode = result.ok ? 0 : result.exit_code;
}

const isMain =
  process.argv[1] &&
  (await realpath(process.argv[1]).catch(() => null)) ===
    (await realpath(fileURLToPath(import.meta.url)).catch(() => null));

if (isMain) {
  await main(process.argv.slice(2));
}
