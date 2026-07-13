import { createHash } from "node:crypto";

const ACTIONS = ["activate", "reinforce", "supersede", "forget", "clear"];
const KINDS = ["preference", "correction", "outcome", "confirmation"];
const PROJECT_ID_PATTERN = /^sha256:[a-f0-9]{64}$/;
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})[tT](\d{2}):(\d{2}):(\d{2})(\.\d+)?([zZ]|([+-])(\d{2}):(\d{2}))$/;

const EVENT_FIELDS = {
  activate: [
    "schema_version",
    "event_id",
    "project_id",
    "recorded_at",
    "action",
    "lesson_id",
    "kind",
    "scope",
    "rule",
    "evidence",
    "confidence",
    "supersedes",
    "expires_at",
  ],
  reinforce: [
    "schema_version",
    "event_id",
    "project_id",
    "recorded_at",
    "action",
    "lesson_id",
    "evidence",
    "confidence",
  ],
  supersede: [
    "schema_version",
    "event_id",
    "project_id",
    "recorded_at",
    "action",
    "lesson_id",
    "kind",
    "scope",
    "rule",
    "evidence",
    "confidence",
    "supersedes",
    "expires_at",
  ],
  forget: [
    "schema_version",
    "event_id",
    "project_id",
    "recorded_at",
    "action",
    "lesson_id",
  ],
  clear: ["schema_version", "event_id", "project_id", "recorded_at", "action"],
};

const isPlainObject = (value) =>
  value !== null &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);

const isDateTime = (value) => {
  if (typeof value !== "string") {
    return false;
  }
  const match = value.match(DATE_TIME_PATTERN);
  if (!match) {
    return false;
  }
  const [, yearText, monthText, dayText, hourText, minuteText, secondText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const offsetHour = match[10] === undefined ? 0 : Number(match[10]);
  const offsetMinute = match[11] === undefined ? 0 : Number(match[11]);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const fieldsAreValid =
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= daysInMonth[month - 1] &&
    hour <= 23 &&
    minute <= 59 &&
    second <= 60 &&
    offsetHour <= 23 &&
    offsetMinute <= 59;
  if (!fieldsAreValid || second < 60) {
    return fieldsAreValid;
  }

  const beforeLeap = Date.parse(
    `${yearText}-${monthText}-${dayText}T${hourText}:${minuteText}:59${
      match[7] ?? ""
    }${match[8].toUpperCase()}`,
  );
  const afterLeap = new Date(beforeLeap + 1000);
  return (
    !Number.isNaN(beforeLeap) &&
    afterLeap.getUTCDate() === 1 &&
    afterLeap.getUTCHours() === 0 &&
    afterLeap.getUTCMinutes() === 0 &&
    afterLeap.getUTCSeconds() === 0
  );
};

const dateTimeToMilliseconds = (value) => {
  if (!isDateTime(value)) {
    return null;
  }
  const match = value.match(DATE_TIME_PATTERN);
  const leapSecond = match[6] === "60";
  const normalized = `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${
    leapSecond ? "59" : match[6]
  }${match[7] ?? ""}${match[8].toUpperCase()}`;
  const timestamp = Date.parse(normalized);
  return Number.isNaN(timestamp) ? null : timestamp + (leapSecond ? 1000 : 0);
};

const validateClosedObject = (value, path, allowed, required, errors) => {
  if (!isPlainObject(value)) {
    errors.push(`${path}: must be an object`);
    return false;
  }
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(value).filter((key) => !allowedSet.has(key)).sort()) {
    errors.push(`${path}.${key}: is not allowed`);
  }
  for (const key of required) {
    if (!Object.hasOwn(value, key)) {
      errors.push(`${path}.${key}: is required`);
    }
  }
  return true;
};

const validateBoundedString = (value, path, maximum, errors) => {
  if (typeof value !== "string" || value.length === 0) {
    errors.push(`${path}: must be a non-empty string`);
  } else if (value.length > maximum) {
    errors.push(`${path}: must be at most ${maximum} characters`);
  }
};

const hasDuplicates = (values) => new Set(values).size !== values.length;

const isSafeRelativePath = (value) => {
  if (typeof value !== "string" || value.length === 0 || value.length > 500) {
    return false;
  }
  if (/^(?:[/\\]|[A-Za-z]:[/\\])/.test(value)) {
    return false;
  }
  return !value.split(/[/\\]/).includes("..");
};

const validateStringList = (
  value,
  path,
  { itemMaximum, itemValidator, itemMessage },
  errors,
) => {
  if (!Array.isArray(value)) {
    errors.push(`${path}: must be an array`);
    return;
  }
  if (value.length > 32) {
    errors.push(`${path}: must contain at most 32 items`);
  }
  if (hasDuplicates(value)) {
    errors.push(`${path}: must not contain duplicates`);
  }
  value.forEach((item, index) => {
    const itemPath = `${path}[${index}]`;
    if (itemValidator && !itemValidator(item)) {
      errors.push(`${itemPath}: ${itemMessage}`);
      return;
    }
    validateBoundedString(item, itemPath, itemMaximum, errors);
  });
};

const validateScope = (value, errors) => {
  const path = "$.scope";
  if (
    !validateClosedObject(
      value,
      path,
      ["workflows", "path_prefixes", "tags"],
      ["workflows", "path_prefixes", "tags"],
      errors,
    )
  ) {
    return;
  }
  if (Object.hasOwn(value, "workflows")) {
    validateStringList(value.workflows, `${path}.workflows`, { itemMaximum: 64 }, errors);
  }
  if (Object.hasOwn(value, "path_prefixes")) {
    validateStringList(
      value.path_prefixes,
      `${path}.path_prefixes`,
      {
        itemMaximum: 500,
        itemValidator: isSafeRelativePath,
        itemMessage: "must be relative and contain no '..' segments",
      },
      errors,
    );
  }
  if (Object.hasOwn(value, "tags")) {
    validateStringList(value.tags, `${path}.tags`, { itemMaximum: 20 }, errors);
  }
};

const validateEvidence = (value, errors) => {
  const path = "$.evidence";
  if (
    !validateClosedObject(
      value,
      path,
      ["source", "summary", "revision"],
      ["source", "summary", "revision"],
      errors,
    )
  ) {
    return;
  }
  if (Object.hasOwn(value, "source")) {
    validateBoundedString(value.source, `${path}.source`, 64, errors);
  }
  if (Object.hasOwn(value, "summary")) {
    validateBoundedString(value.summary, `${path}.summary`, 500, errors);
    if (typeof value.summary === "string" && containsForbiddenContent(value.summary)) {
      errors.push(`${path}.summary: contains forbidden sensitive or raw content`);
    }
  }
  if (
    Object.hasOwn(value, "revision") &&
    value.revision !== null &&
    (typeof value.revision !== "string" || value.revision.length === 0 || value.revision.length > 256)
  ) {
    errors.push(`${path}.revision: must be null or a string of at most 256 characters`);
  }
};

const validateConfidence = (value, path, errors) => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    errors.push(`${path}: must be a number between 0 and 1`);
  }
};

const validateUuidV4 = (value, path, errors) => {
  if (typeof value !== "string") {
    errors.push(`${path}: must be a string`);
  } else if (!UUID_V4_PATTERN.test(value)) {
    errors.push(`${path}: must be a UUID v4`);
  }
};

const validateLessonId = validateUuidV4;

export function validateConfig(value) {
  const errors = [];
  const fields = ["schema_version", "enabled", "project_id", "enabled_at"];
  if (!validateClosedObject(value, "$", fields, fields, errors)) {
    return errors;
  }
  if (Object.hasOwn(value, "schema_version") && value.schema_version !== 1) {
    errors.push("$.schema_version: must equal 1");
  }
  if (Object.hasOwn(value, "enabled") && typeof value.enabled !== "boolean") {
    errors.push("$.enabled: must be a boolean");
  }
  if (Object.hasOwn(value, "project_id")) {
    if (typeof value.project_id !== "string") {
      errors.push("$.project_id: must be a string");
    } else if (!PROJECT_ID_PATTERN.test(value.project_id)) {
      errors.push("$.project_id: must match sha256:<64 lowercase hex>");
    }
  }
  if (Object.hasOwn(value, "enabled_at") && !isDateTime(value.enabled_at)) {
    errors.push("$.enabled_at: must be an RFC 3339 date-time");
  }
  return errors;
}

export function validateEvent(value) {
  const errors = [];
  if (!isPlainObject(value)) {
    return ["$: must be an object"];
  }

  const action = ACTIONS.includes(value.action) ? value.action : null;
  const fields = action
    ? EVENT_FIELDS[action]
    : ["schema_version", "event_id", "project_id", "recorded_at", "action"];
  validateClosedObject(value, "$", fields, fields, errors);

  if (Object.hasOwn(value, "schema_version") && value.schema_version !== 1) {
    errors.push("$.schema_version: must equal 1");
  }
  if (Object.hasOwn(value, "event_id")) {
    validateUuidV4(value.event_id, "$.event_id", errors);
  }
  if (Object.hasOwn(value, "project_id")) {
    if (typeof value.project_id !== "string") {
      errors.push("$.project_id: must be a string");
    } else if (!PROJECT_ID_PATTERN.test(value.project_id)) {
      errors.push("$.project_id: must match sha256:<64 lowercase hex>");
    }
  }
  if (Object.hasOwn(value, "recorded_at") && !isDateTime(value.recorded_at)) {
    errors.push("$.recorded_at: must be an RFC 3339 date-time");
  }
  if (!Object.hasOwn(value, "action")) {
    return errors;
  }
  if (!action) {
    errors.push(`$.action: must be one of ${ACTIONS.join(", ")}`);
    return errors;
  }

  if (action !== "clear" && Object.hasOwn(value, "lesson_id")) {
    validateLessonId(value.lesson_id, "$.lesson_id", errors);
  }
  if (action === "activate" || action === "supersede") {
    if (Object.hasOwn(value, "kind") && !KINDS.includes(value.kind)) {
      errors.push(`$.kind: must be one of ${KINDS.join(", ")}`);
    }
    if (Object.hasOwn(value, "scope")) {
      validateScope(value.scope, errors);
    }
    if (Object.hasOwn(value, "rule")) {
      validateBoundedString(value.rule, "$.rule", 500, errors);
      if (typeof value.rule === "string" && containsForbiddenContent(value.rule)) {
        errors.push("$.rule: contains forbidden sensitive or raw content");
      }
    }
    if (Object.hasOwn(value, "supersedes")) {
      validateStringList(
        value.supersedes,
        "$.supersedes",
        {
          itemMaximum: 128,
          itemValidator: (item) =>
            typeof item !== "string" || UUID_V4_PATTERN.test(item),
          itemMessage: "must be a UUID v4",
        },
        errors,
      );
      if (
        action === "supersede" &&
        Array.isArray(value.supersedes) &&
        value.supersedes.length === 0
      ) {
        errors.push("$.supersedes: must contain at least one lesson ID");
      }
    }
    if (
      Object.hasOwn(value, "expires_at") &&
      value.expires_at !== null &&
      !isDateTime(value.expires_at)
    ) {
      errors.push("$.expires_at: must be null or an RFC 3339 date-time");
    }
  }
  if ((action === "activate" || action === "supersede" || action === "reinforce") && Object.hasOwn(value, "evidence")) {
    validateEvidence(value.evidence, errors);
  }
  if ((action === "activate" || action === "supersede" || action === "reinforce") && Object.hasOwn(value, "confidence")) {
    validateConfidence(value.confidence, "$.confidence", errors);
  }

  if (
    containsForbiddenContent(value) &&
    !errors.some((error) => error.includes("contains forbidden sensitive or raw content"))
  ) {
    errors.push("$: contains forbidden sensitive or raw content");
  }
  return errors;
}

const lessonFromEvent = (event) => ({
  lesson_id: event.lesson_id,
  project_id: event.project_id,
  kind: event.kind,
  scope: structuredClone(event.scope),
  rule: event.rule,
  evidence: structuredClone(event.evidence),
  confidence: event.confidence,
  supersedes: [...event.supersedes],
  expires_at: event.expires_at,
  active: true,
  activated_at: event.recorded_at,
  last_supported_at: event.recorded_at,
});

export function reduceLessonEvents(events, { projectId } = {}) {
  const active = new Map();
  const inactive = new Map();
  const errors = [];

  if (!Array.isArray(events)) {
    return { active: [], inactive: [], errors: ["$: must be an array"] };
  }

  const deactivate = (lessonId, event) => {
    const lesson = active.get(lessonId);
    if (!lesson) {
      return;
    }
    active.delete(lessonId);
    inactive.set(lessonId, {
      ...lesson,
      active: false,
      deactivated_at: event.recorded_at,
      deactivated_by: event.action,
    });
  };

  events.forEach((event, index) => {
    const eventErrors = validateEvent(event);
    if (eventErrors.length > 0) {
      errors.push(...eventErrors.map((error) => error.replace(/^\$/, `$[${index}]`)));
      return;
    }
    if (projectId && event.project_id !== projectId) {
      errors.push(`$[${index}].project_id: does not match the current project`);
      return;
    }

    if (event.action === "clear") {
      for (const lessonId of [...active.keys()]) {
        deactivate(lessonId, event);
      }
      return;
    }
    if (event.action === "forget") {
      deactivate(event.lesson_id, event);
      return;
    }
    if (event.action === "reinforce") {
      const lesson = active.get(event.lesson_id);
      if (!lesson) {
        return;
      }
      active.set(event.lesson_id, {
        ...lesson,
        evidence: structuredClone(event.evidence),
        confidence: Number(
          Math.max(
            lesson.confidence,
            Math.min(1, event.confidence, lesson.confidence + 0.05),
          ).toFixed(12),
        ),
        last_supported_at: event.recorded_at,
      });
      return;
    }
    if (event.action === "supersede") {
      for (const lessonId of event.supersedes) {
        deactivate(lessonId, event);
      }
    }
    const lesson = lessonFromEvent(event);
    inactive.delete(lesson.lesson_id);
    active.set(lesson.lesson_id, lesson);
  });

  return {
    active: [...active.values()],
    inactive: [...inactive.values()],
    errors,
  };
}

const relevanceTier = (lesson, workflow, paths, tags) => {
  const workflows = lesson.scope.workflows;
  const prefixes = lesson.scope.path_prefixes.map((path) => path.replaceAll("\\", "/"));
  const lessonTags = lesson.scope.tags;
  const workflowMatch = typeof workflow === "string" && workflows.includes(workflow);
  const tagMatch = lessonTags.some((tag) => tags.includes(tag));
  const exactPathMatch = prefixes.some((prefix) => paths.includes(prefix));
  const prefixPathMatch = prefixes.some((prefix) =>
    paths.some(
      (path) =>
        path === prefix ||
        path.startsWith(prefix.endsWith("/") ? prefix : `${prefix}/`),
    ),
  );

  if (exactPathMatch && workflowMatch && tagMatch) return 5;
  if (prefixPathMatch && workflowMatch) return 4;
  if (workflowMatch && tagMatch) return 3;
  if (workflowMatch) return 2;
  if (tagMatch) return 1;
  return 0;
};

const hasSafeScope = (lesson) =>
  isPlainObject(lesson.scope) &&
  Array.isArray(lesson.scope.workflows) &&
  Array.isArray(lesson.scope.path_prefixes) &&
  lesson.scope.path_prefixes.every(isSafeRelativePath) &&
  Array.isArray(lesson.scope.tags);

export function rankLessons(activeLessons, context = {}) {
  if (!Array.isArray(activeLessons)) {
    return [];
  }
  const {
    projectId,
    workflow,
    paths = [],
    tags = [],
    now,
    limit = 3,
    minConfidence = 0.7,
  } = context;
  if (!isDateTime(now)) {
    return [];
  }
  const safePaths = Array.isArray(paths)
    ? paths.filter(isSafeRelativePath).map((path) => path.replaceAll("\\", "/"))
    : [];
  const safeTags = Array.isArray(tags) ? tags.filter((tag) => typeof tag === "string") : [];
  const nowTimestamp = dateTimeToMilliseconds(now);
  const maximum = Number.isInteger(limit) && limit > 0 ? Math.min(limit, 3) : 0;
  const confidenceFloor = Number.isFinite(minConfidence)
    ? Math.max(minConfidence, 0.7)
    : 0.7;

  return activeLessons
    .filter((lesson) => isPlainObject(lesson))
    .filter((lesson) => !projectId || lesson.project_id === projectId)
    .filter((lesson) => lesson.active !== false)
    .filter(
      (lesson) =>
        typeof lesson.confidence === "number" && lesson.confidence >= confidenceFloor,
    )
    .filter(
      (lesson) =>
        lesson.expires_at === null ||
        lesson.expires_at === undefined ||
        (dateTimeToMilliseconds(lesson.expires_at) ?? Number.NEGATIVE_INFINITY) >
          nowTimestamp,
    )
    .filter(hasSafeScope)
    .filter((lesson) => !containsForbiddenContent(lesson))
    .map((lesson) => ({
      lesson,
      tier: relevanceTier(lesson, workflow, safePaths, safeTags),
    }))
    .filter(({ tier }) => tier > 0)
    .sort((left, right) => {
      if (left.tier !== right.tier) return right.tier - left.tier;
      if (left.lesson.confidence !== right.lesson.confidence) {
        return right.lesson.confidence - left.lesson.confidence;
      }
      const supportDifference =
        (dateTimeToMilliseconds(right.lesson.last_supported_at) ?? Number.NEGATIVE_INFINITY) -
        (dateTimeToMilliseconds(left.lesson.last_supported_at) ?? Number.NEGATIVE_INFINITY);
      if (supportDifference !== 0) return supportDifference;
      if (left.lesson.lesson_id < right.lesson.lesson_id) return -1;
      if (left.lesson.lesson_id > right.lesson.lesson_id) return 1;
      return 0;
    })
    .slice(0, maximum)
    .map(({ lesson }) => ({
      ...lesson,
      advisory: true,
      may_override: "leanpowers_defaults_only",
    }));
}

export function normalizeOriginUrl(value) {
  if (typeof value !== "string") {
    return null;
  }
  const origin = value.trim();
  let host;
  let repositoryPath;

  const scpMatch = origin.match(/^[^@\s]+@([^:\s]+):(.+)$/);
  if (scpMatch) {
    [, host, repositoryPath] = scpMatch;
  } else {
    let parsed;
    try {
      parsed = new URL(origin);
    } catch {
      return null;
    }
    if (!["https:", "http:", "ssh:", "git+ssh:"].includes(parsed.protocol)) {
      return null;
    }
    host = parsed.hostname;
    repositoryPath = parsed.pathname;
  }

  const normalizedPath = repositoryPath
    .replace(/^\/+|\/+$/g, "")
    .replace(/\.git$/i, "");
  if (!host || normalizedPath.split("/").filter(Boolean).length < 2) {
    return null;
  }
  return `${host.toLowerCase()}/${normalizedPath}`;
}

export function computeProjectId({ gitOrigin, realRoot, git } = {}) {
  const origin = git ? normalizeOriginUrl(gitOrigin) : null;
  const identity = origin
    ? `git\0${origin}`
    : `${git ? "git-path" : "workspace"}\0${String(realRoot ?? "")}`;
  return `sha256:${createHash("sha256").update(identity).digest("hex")}`;
}

const FORBIDDEN_PATTERNS = [
  /[\r\n]/,
  /\bauthorization\s*:\s*(?:basic|bearer)\s+\S+/i,
  /\b(?:api[_-]?key|access[_-]?token|refresh[_-]?token|password|passwd|secret|cookie)\s*[:=]\s*\S+/i,
  /\b[A-Z][A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|PASSWD|API_KEY|ACCESS_KEY)\s*=\s*\S+/,
  /\b(?:gh[pousr]_[A-Za-z0-9_]+|github_pat_[A-Za-z0-9_]+|sk-[A-Za-z0-9_-]{8,}|xox[baprs]-[A-Za-z0-9-]+|AKIA[0-9A-Z]{16})\b/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\b[a-z][a-z0-9+.-]*:\/\/[^/\s:@]+:[^/\s@]+@/i,
  /\bfile:\/\/\/?\S+/i,
  /(?:^|[\s"'`(])\/[A-Za-z0-9._~-][^\s"'`)]*/,
  /(?:^|[\s"'`(])(?:\/(?:Users|home|private|var|tmp|etc|opt|srv|mnt|Volumes)\/[^\s"'`)]*|[A-Za-z]:\\[^\s"'`)]*)/,
  /(?:^|\n)\s*at\s+\S+(?:\s+\([^\n]+:\d+:\d+\)|\s+[^\n]+:\d+:\d+)/,
  /(?:^|\n)(?:\d{4}-\d{2}-\d{2}[T ][^\s]+\s+)?(?:TRACE|DEBUG|INFO|WARN|ERROR|FATAL)\b/,
  /\b(?:raw|full|complete)\s+(?:user\s+)?prompt\s*[:=]/i,
];

export function containsForbiddenContent(value) {
  const seen = new WeakSet();
  const visit = (candidate) => {
    if (typeof candidate === "string") {
      return FORBIDDEN_PATTERNS.some((pattern) => pattern.test(candidate));
    }
    if (candidate === null || typeof candidate !== "object") {
      return false;
    }
    if (seen.has(candidate)) {
      return false;
    }
    seen.add(candidate);
    if (Array.isArray(candidate)) {
      return candidate.some(visit);
    }
    return Object.values(candidate).some(visit);
  };
  return visit(value);
}
