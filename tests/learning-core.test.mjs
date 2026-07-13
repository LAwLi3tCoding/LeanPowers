import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  computeProjectId,
  containsForbiddenContent,
  normalizeOriginUrl,
  rankLessons,
  reduceLessonEvents,
  validateConfig,
  validateEvent,
} from "../skills/adapt/scripts/learning-core.mjs";

const PROJECT_ID = `sha256:${"a".repeat(64)}`;
const OTHER_PROJECT_ID = `sha256:${"b".repeat(64)}`;
const LESSON_OLD = "11111111-1111-4111-8111-111111111111";
const LESSON_NEW = "22222222-2222-4222-8222-222222222222";
const LESSON_FORGOTTEN = "33333333-3333-4333-8333-333333333333";
const LESSON_MIDDLE = "44444444-4444-4444-8444-444444444444";
const VALID_V4_UUID = "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA";
const INVALID_UUIDS = [
  "00000000-0000-0000-0000-000000000000",
  "55555555-5555-1555-8555-555555555555",
  "66666666-6666-6666-8666-666666666666",
  "ffffffff-ffff-ffff-afff-ffffffffffff",
  "not-a-uuid",
];
const GENERIC_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const readJson = (relativePath) =>
  JSON.parse(readFileSync(new URL(relativePath, import.meta.url), "utf8"));

const eventId = (sequence) =>
  `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`;

const evidence = (summary = "Explicit feedback confirmed the reusable rule.") => ({
  source: "explicit_user_feedback",
  summary,
  revision: "git:abc123:clean",
});

const activateEvent = (overrides = {}) => ({
  schema_version: 1,
  event_id: eventId(1),
  project_id: PROJECT_ID,
  recorded_at: "2026-07-13T09:00:00.000Z",
  action: "activate",
  lesson_id: LESSON_OLD,
  kind: "correction",
  scope: {
    workflows: ["debug"],
    path_prefixes: ["src/pricing/"],
    tags: ["coupon", "tenant-filter"],
  },
  rule: "Verify tenant scope before changing coupon query logic.",
  evidence: evidence(),
  confidence: 0.9,
  supersedes: [],
  expires_at: null,
  ...overrides,
});

const reinforceEvent = (lessonId, sequence, confidence = 1) => ({
  schema_version: 1,
  event_id: eventId(sequence),
  project_id: PROJECT_ID,
  recorded_at: `2026-07-13T${String(sequence).padStart(2, "0")}:00:00.000Z`,
  action: "reinforce",
  lesson_id: lessonId,
  evidence: evidence("A later verified outcome independently supported the rule."),
  confidence,
});

const targetEvent = (action, lessonId, sequence) => ({
  schema_version: 1,
  event_id: eventId(sequence),
  project_id: PROJECT_ID,
  recorded_at: `2026-07-13T${String(sequence).padStart(2, "0")}:30:00.000Z`,
  action,
  lesson_id: lessonId,
});

test("schemas define closed config and five closed event branches", () => {
  const configSchema = readJson("../schemas/learning-config.schema.json");
  const eventSchema = readJson("../schemas/lesson-event.schema.json");

  assert.equal(configSchema.additionalProperties, false);
  assert.deepEqual(configSchema.required, [
    "schema_version",
    "enabled",
    "project_id",
    "enabled_at",
  ]);
  assert.equal(configSchema.properties.schema_version.const, 1);

  assert.equal(eventSchema.oneOf.length, 5);
  assert.deepEqual(
    eventSchema.oneOf.map((branch) => branch.properties.action.const),
    ["activate", "reinforce", "supersede", "forget", "clear"],
  );
  assert.ok(eventSchema.oneOf.every((branch) => branch.additionalProperties === false));

  const activate = eventSchema.oneOf[0];
  assert.equal(activate.properties.rule.maxLength, 500);
  assert.equal(activate.properties.evidence.properties.summary.maxLength, 500);
  assert.equal(activate.properties.scope.properties.tags.items.maxLength, 20);
  assert.equal(activate.properties.scope.properties.tags.maxItems, 32);
  assert.equal(activate.properties.confidence.minimum, 0);
  assert.equal(activate.properties.confidence.maximum, 1);
});

test("every schema identifier contract accepts only RFC-variant UUID v4", () => {
  const eventSchema = readJson("../schemas/lesson-event.schema.json");
  const contracts = [];
  const schemaAllowsUuid = (schema, value) =>
    GENERIC_UUID_PATTERN.test(value) &&
    (schema.pattern === undefined || new RegExp(schema.pattern).test(value));

  for (const branch of eventSchema.oneOf) {
    const action = branch.properties.action.const;
    contracts.push([`${action}.event_id`, branch.properties.event_id]);
    if (branch.properties.lesson_id) {
      contracts.push([`${action}.lesson_id`, branch.properties.lesson_id]);
    }
    if (branch.properties.supersedes) {
      contracts.push([`${action}.supersedes[]`, branch.properties.supersedes.items]);
    }
  }

  assert.equal(contracts.length, 11);
  for (const [path, schema] of contracts) {
    assert.equal(schemaAllowsUuid(schema, VALID_V4_UUID), true, `${path} accepts v4`);
    for (const invalid of INVALID_UUIDS) {
      assert.equal(
        schemaAllowsUuid(schema, invalid),
        false,
        `${path} rejects ${invalid}`,
      );
    }
  }
});

test("runtime identifier validation accepts v4 and rejects every other UUID shape", () => {
  assert.deepEqual(
    validateEvent(
      activateEvent({ event_id: VALID_V4_UUID, lesson_id: LESSON_OLD }),
    ),
    [],
  );

  for (const invalid of INVALID_UUIDS) {
    assert.deepEqual(
      validateEvent(activateEvent({ event_id: invalid })),
      ["$.event_id: must be a UUID v4"],
    );
    assert.deepEqual(
      validateEvent(activateEvent({ lesson_id: invalid })),
      ["$.lesson_id: must be a UUID v4"],
    );
    assert.deepEqual(
      validateEvent(
        activateEvent({
          action: "supersede",
          lesson_id: LESSON_NEW,
          supersedes: [invalid],
        }),
      ),
      ["$.supersedes[0]: must be a UUID v4"],
    );
  }
});

test("validateConfig returns stable field-path errors", () => {
  assert.deepEqual(
    validateConfig({
      schema_version: 1,
      enabled: true,
      project_id: PROJECT_ID,
      enabled_at: "2026-07-13T00:00:00.000Z",
    }),
    [],
  );

  assert.deepEqual(
    validateConfig({
      schema_version: 1,
      enabled: "yes",
      project_id: "raw-project-path",
      enabled_at: "yesterday",
      extra: true,
    }),
    [
      "$.extra: is not allowed",
      "$.enabled: must be a boolean",
      "$.project_id: must match sha256:<64 lowercase hex>",
      "$.enabled_at: must be an RFC 3339 date-time",
    ],
  );
});

test("runtime validation requires string values for regex-backed fields", () => {
  assert.deepEqual(
    validateConfig({
      schema_version: 1,
      enabled: true,
      project_id: 42,
      enabled_at: "2026-07-13T00:00:00.000Z",
    }),
    ["$.project_id: must be a string"],
  );

  assert.deepEqual(
    validateEvent({ ...activateEvent(), event_id: 42, project_id: null }),
    ["$.event_id: must be a string", "$.project_id: must be a string"],
  );
});

test("date-time validation enforces RFC 3339 calendar dates and case variants", () => {
  assert.deepEqual(
    validateConfig({
      schema_version: 1,
      enabled: true,
      project_id: PROJECT_ID,
      enabled_at: "2024-02-29t23:59:59z",
    }),
    [],
  );
  assert.deepEqual(
    validateConfig({
      schema_version: 1,
      enabled: true,
      project_id: PROJECT_ID,
      enabled_at: "2023-02-29T23:59:59Z",
    }),
    ["$.enabled_at: must be an RFC 3339 date-time"],
  );
  assert.deepEqual(
    validateConfig({
      schema_version: 1,
      enabled: true,
      project_id: PROJECT_ID,
      enabled_at: "2026-07-13T12:00:60Z",
    }),
    ["$.enabled_at: must be an RFC 3339 date-time"],
  );

  assert.deepEqual(
    validateEvent(
      activateEvent({
        recorded_at: "2024-02-29t23:59:59z",
        expires_at: "2024-03-01t00:00:00z",
      }),
    ),
    [],
  );
  assert.deepEqual(
    validateEvent(activateEvent({ recorded_at: "2026-04-31T12:00:00Z" })),
    ["$.recorded_at: must be an RFC 3339 date-time"],
  );
  assert.deepEqual(
    validateEvent(activateEvent({ recorded_at: "1990-12-31T15:59:60-08:00" })),
    [],
  );

  assert.deepEqual(
    rankLessons([rankedLesson("lowercase-now")], {
      workflow: "debug",
      paths: [],
      tags: [],
      now: "2026-07-13t12:00:00z",
      limit: 3,
      minConfidence: 0.7,
    }).map((lesson) => lesson.lesson_id),
    ["lowercase-now"],
  );
});

test("validateEvent accepts every closed event action", () => {
  const activate = activateEvent();
  const reinforce = reinforceEvent(LESSON_OLD, 2);
  const supersede = activateEvent({
    event_id: eventId(3),
    recorded_at: "2026-07-13T11:00:00.000Z",
    action: "supersede",
    lesson_id: LESSON_NEW,
    supersedes: [LESSON_OLD],
  });
  const forget = targetEvent("forget", LESSON_OLD, 4);
  const clear = {
    schema_version: 1,
    event_id: eventId(5),
    project_id: PROJECT_ID,
    recorded_at: "2026-07-13T12:00:00.000Z",
    action: "clear",
  };

  for (const event of [activate, reinforce, supersede, forget, clear]) {
    assert.deepEqual(validateEvent(event), []);
  }
  assert.deepEqual(validateEvent({ ...clear, lesson_id: "unexpected" }), [
    "$.lesson_id: is not allowed",
  ]);
});

test("every schema branch and runtime validator share required and closed fields", () => {
  const eventSchema = readJson("../schemas/lesson-event.schema.json");
  const fixtures = {
    activate: activateEvent(),
    reinforce: reinforceEvent(LESSON_OLD, 2),
    supersede: activateEvent({
      event_id: eventId(3),
      action: "supersede",
      lesson_id: LESSON_NEW,
      supersedes: [LESSON_OLD],
    }),
    forget: targetEvent("forget", LESSON_OLD, 4),
    clear: {
      schema_version: 1,
      event_id: eventId(5),
      project_id: PROJECT_ID,
      recorded_at: "2026-07-13T12:00:00.000Z",
      action: "clear",
    },
  };

  for (const branch of eventSchema.oneOf) {
    const action = branch.properties.action.const;
    const fixture = fixtures[action];
    assert.deepEqual(Object.keys(fixture).sort(), [...branch.required].sort());
    assert.deepEqual(validateEvent(fixture), []);
    assert.ok(
      validateEvent({ ...fixture, unexpected: true }).includes(
        "$.unexpected: is not allowed",
      ),
    );

    for (const field of branch.required) {
      const missing = { ...fixture };
      delete missing[field];
      assert.ok(
        validateEvent(missing).includes(`$.${field}: is required`),
        `${action} runtime validation must require ${field}`,
      );
    }
  }
});

test("validateEvent rejects unsafe paths and forbidden lesson content", () => {
  assert.deepEqual(
    validateEvent(
      activateEvent({
        scope: {
          workflows: ["debug"],
          path_prefixes: ["src/../secrets"],
          tags: ["coupon"],
        },
      }),
    ),
    ["$.scope.path_prefixes[0]: must be relative and contain no '..' segments"],
  );
  assert.deepEqual(
    validateEvent(
      activateEvent({
        rule: "Use Authorization: Bearer ghp_secret to reproduce the request.",
      }),
    ),
    ["$.rule: contains forbidden sensitive or raw content"],
  );
});

for (const [label, supersedes] of [
  ["null", null],
  ["object", { lesson: LESSON_OLD }],
  ["string", ""],
]) {
  test(`validateEvent returns stable errors for ${label} supersedes`, () => {
    const errors = validateEvent(
      activateEvent({
        action: "supersede",
        lesson_id: LESSON_NEW,
        supersedes,
      }),
    );

    assert.deepEqual(errors, ["$.supersedes: must be an array"]);
  });
}

test("reduceLessonEvents applies activate, reinforce, supersede, forget, and clear in order", () => {
  const lifecycle = [
    activateEvent(),
    reinforceEvent(LESSON_OLD, 2, 1),
    activateEvent({
      event_id: eventId(3),
      recorded_at: "2026-07-13T10:10:00.000Z",
      lesson_id: LESSON_FORGOTTEN,
    }),
    targetEvent("forget", LESSON_FORGOTTEN, 4),
    {
      schema_version: 1,
      event_id: eventId(5),
      project_id: PROJECT_ID,
      recorded_at: "2026-07-13T10:30:00.000Z",
      action: "clear",
    },
    activateEvent({
      event_id: eventId(6),
      recorded_at: "2026-07-13T11:00:00.000Z",
      lesson_id: LESSON_MIDDLE,
    }),
    activateEvent({
      event_id: eventId(7),
      recorded_at: "2026-07-13T11:30:00.000Z",
      action: "supersede",
      lesson_id: LESSON_NEW,
      supersedes: [LESSON_MIDDLE],
    }),
    reinforceEvent(LESSON_NEW, 8, 1),
  ];
  const original = structuredClone(lifecycle);

  const state = reduceLessonEvents(lifecycle, {
    projectId: PROJECT_ID,
    now: "2026-07-13T12:00:00.000Z",
  });

  assert.deepEqual(state.active.map((lesson) => lesson.lesson_id), [LESSON_NEW]);
  assert.equal(state.active[0].confidence, 0.95);
  assert.equal(state.active[0].last_supported_at, "2026-07-13T08:00:00.000Z");
  assert.deepEqual(
    state.inactive.map((lesson) => lesson.lesson_id).sort(),
    [LESSON_FORGOTTEN, LESSON_MIDDLE, LESSON_OLD].sort(),
  );
  const forgotten = state.inactive.find(
    (lesson) => lesson.lesson_id === LESSON_FORGOTTEN,
  );
  assert.equal(forgotten.deactivated_by, "forget");
  assert.equal(forgotten.deactivated_at, "2026-07-13T04:30:00.000Z");
  assert.deepEqual(state.errors, []);
  assert.deepEqual(lifecycle, original);
});

test("reduceLessonEvents rejects malformed and cross-project events", () => {
  const malformed = activateEvent({ event_id: "not-a-uuid" });
  const wrongProject = activateEvent({
    event_id: eventId(9),
    project_id: OTHER_PROJECT_ID,
  });

  const state = reduceLessonEvents([malformed, wrongProject], {
    projectId: PROJECT_ID,
    now: "2026-07-13T12:00:00.000Z",
  });

  assert.deepEqual(state.active, []);
  assert.deepEqual(state.inactive, []);
  assert.ok(state.errors.includes("$[0].event_id: must be a UUID v4"));
  assert.ok(state.errors.includes("$[1].project_id: does not match the current project"));
});

const rankedLesson = (lessonId, overrides = {}) => ({
  lesson_id: lessonId,
  project_id: PROJECT_ID,
  kind: "correction",
  scope: { workflows: ["debug"], path_prefixes: [], tags: [] },
  rule: `Rule for ${lessonId}.`,
  evidence: evidence(),
  confidence: 0.9,
  expires_at: null,
  active: true,
  last_supported_at: "2026-07-13T10:00:00.000Z",
  ...overrides,
});

test("rankLessons caps output and never loads unrelated scope", () => {
  const activeLessons = [
    rankedLesson("tag", { scope: { workflows: ["review"], path_prefixes: [], tags: ["coupon"] } }),
    rankedLesson("workflow", { scope: { workflows: ["debug"], path_prefixes: [], tags: [] } }),
    rankedLesson("workflow-tag", {
      scope: { workflows: ["debug"], path_prefixes: ["src/other/"], tags: ["coupon"] },
    }),
    rankedLesson("path-workflow", {
      scope: { workflows: ["debug"], path_prefixes: ["src/pricing/"], tags: [] },
    }),
    rankedLesson("exact", {
      scope: {
        workflows: ["debug"],
        path_prefixes: ["src/pricing/coupon.ts"],
        tags: ["coupon"],
      },
    }),
    rankedLesson("unrelated", {
      confidence: 1,
      scope: { workflows: ["ship"], path_prefixes: ["docs/"], tags: ["release"] },
    }),
  ];

  const ranked = rankLessons(activeLessons, {
    projectId: PROJECT_ID,
    workflow: "debug",
    paths: ["src/pricing/coupon.ts"],
    tags: ["coupon", "tenant-filter"],
    now: "2026-07-13T12:00:00.000Z",
    limit: 3,
    minConfidence: 0.7,
  });

  assert.deepEqual(ranked.map((lesson) => lesson.lesson_id), [
    "exact",
    "path-workflow",
    "workflow-tag",
  ]);
  assert.ok(ranked.every((lesson) => lesson.advisory === true));
  assert.ok(
    ranked.every((lesson) => lesson.may_override === "leanpowers_defaults_only"),
  );
});

test("rankLessons filters project mismatch, inactive, expired, and weak lessons", () => {
  const candidates = [
    rankedLesson("valid"),
    rankedLesson("wrong-project", { project_id: OTHER_PROJECT_ID }),
    rankedLesson("inactive", { active: false }),
    rankedLesson("expired", { expires_at: "2026-07-13T11:59:59.999Z" }),
    rankedLesson("weak", { confidence: 0.69 }),
  ];

  const ranked = rankLessons(candidates, {
    projectId: PROJECT_ID,
    workflow: "debug",
    paths: [],
    tags: [],
    now: "2026-07-13T12:00:00.000Z",
    limit: 10,
    minConfidence: 0.7,
  });

  assert.deepEqual(ranked.map((lesson) => lesson.lesson_id), ["valid"]);
});

test("rankLessons caps caller limits at three", () => {
  const ranked = rankLessons(
    [
      rankedLesson("lesson-a"),
      rankedLesson("lesson-b"),
      rankedLesson("lesson-c"),
      rankedLesson("lesson-d"),
    ],
    {
      workflow: "debug",
      paths: [],
      tags: [],
      now: "2026-07-13T12:00:00.000Z",
      limit: 99,
      minConfidence: 0.7,
    },
  );

  assert.deepEqual(ranked.map((lesson) => lesson.lesson_id), [
    "lesson-a",
    "lesson-b",
    "lesson-c",
  ]);
});

test("rankLessons enforces a minimum confidence threshold of 0.70", () => {
  const ranked = rankLessons(
    [
      rankedLesson("below-floor", { confidence: 0.69 }),
      rankedLesson("at-floor", { confidence: 0.7 }),
    ],
    {
      workflow: "debug",
      paths: [],
      tags: [],
      now: "2026-07-13T12:00:00.000Z",
      limit: 3,
      minConfidence: 0.1,
    },
  );

  assert.deepEqual(ranked.map((lesson) => lesson.lesson_id), ["at-floor"]);
});

test("rankLessons fails closed when now is missing or invalid", () => {
  const candidates = [rankedLesson("candidate")];
  const context = {
    workflow: "debug",
    paths: [],
    tags: [],
    limit: 3,
    minConfidence: 0.7,
  };

  assert.deepEqual(rankLessons(candidates, context), []);
  assert.deepEqual(rankLessons(candidates, { ...context, now: "not-a-date" }), []);
});

test("rankLessons breaks equal relevance by confidence, support time, then lesson ID", () => {
  const ranked = rankLessons(
    [
      rankedLesson("z-latest", {
        confidence: 0.9,
        last_supported_at: "2026-07-13T11:00:00.000Z",
      }),
      rankedLesson("b-same", { confidence: 0.9 }),
      rankedLesson("a-same", { confidence: 0.9 }),
      rankedLesson("highest", { confidence: 0.95 }),
    ],
    {
      workflow: "debug",
      paths: [],
      tags: [],
      now: "2026-07-13T12:00:00.000Z",
      limit: 10,
      minConfidence: 0.7,
    },
  );

  assert.deepEqual(ranked.map((lesson) => lesson.lesson_id), [
    "highest",
    "z-latest",
    "a-same",
  ]);

  const lexical = rankLessons(
    [rankedLesson("b-same"), rankedLesson("a-same")],
    {
      workflow: "debug",
      paths: [],
      tags: [],
      now: "2026-07-13T12:00:00.000Z",
      limit: 3,
      minConfidence: 0.7,
    },
  );
  assert.deepEqual(lexical.map((lesson) => lesson.lesson_id), ["a-same", "b-same"]);
});

test("rankLessons does not treat a partial path segment as a prefix match", () => {
  const ranked = rankLessons(
    [
      rankedLesson("z-partial-segment", {
        scope: { workflows: ["debug"], path_prefixes: ["src/pric"], tags: [] },
      }),
      rankedLesson("a-workflow-only"),
    ],
    {
      workflow: "debug",
      paths: ["src/pricing/coupon.ts"],
      tags: [],
      now: "2026-07-13T12:00:00.000Z",
      limit: 2,
      minConfidence: 0.7,
    },
  );

  assert.deepEqual(ranked.map((lesson) => lesson.lesson_id), [
    "a-workflow-only",
    "z-partial-segment",
  ]);
});

test("normalizeOriginUrl unifies SSH and HTTPS without credentials", () => {
  const expected = "github.com/Owner/LeanPowers";

  assert.equal(normalizeOriginUrl("git@github.com:Owner/LeanPowers.git"), expected);
  assert.equal(
    normalizeOriginUrl("https://user:token@github.com/Owner/LeanPowers.git"),
    expected,
  );
  assert.equal(
    normalizeOriginUrl("ssh://git@github.com/Owner/LeanPowers.git"),
    expected,
  );
  assert.equal(normalizeOriginUrl("/Users/example/repository"), null);
  assert.equal(normalizeOriginUrl("not an origin"), null);
});

test("computeProjectId hashes normalized identity without exposing raw paths", () => {
  const originIdentity = "github.com/Owner/LeanPowers";
  const expectedOrigin = `sha256:${createHash("sha256")
    .update(`git\0${originIdentity}`)
    .digest("hex")}`;
  const fromSsh = computeProjectId({
    gitOrigin: "git@github.com:Owner/LeanPowers.git",
    realRoot: "/Users/alice/private/repository",
    git: true,
  });
  const fromHttps = computeProjectId({
    gitOrigin: "https://github.com/Owner/LeanPowers.git",
    realRoot: "/different/checkout",
    git: true,
  });
  const fromWorkspace = computeProjectId({
    gitOrigin: null,
    realRoot: "/Users/alice/private/workspace",
    git: false,
  });

  assert.equal(fromSsh, expectedOrigin);
  assert.equal(fromHttps, expectedOrigin);
  assert.match(fromWorkspace, /^sha256:[a-f0-9]{64}$/);
  assert.equal(fromWorkspace.includes("/Users/alice"), false);
});

test("privacy guard rejects credential-shaped and raw-log content", () => {
  assert.equal(containsForbiddenContent("Authorization: Bearer ghp_secret"), true);
  assert.equal(containsForbiddenContent("api_key=sk-live-secret"), true);
  assert.equal(containsForbiddenContent("CI_JOB_TOKEN=internal-secret-value"), true);
  assert.equal(
    containsForbiddenContent("The checkout is /Users/alice/private/LeanPowers."),
    true,
  );
  assert.equal(
    containsForbiddenContent("Error: request failed\n    at submit (src/order.mjs:20:4)"),
    true,
  );
  assert.equal(
    containsForbiddenContent({
      rule: "When coupon results are empty, verify tenant scope first.",
      tags: ["coupon", "tenant-filter"],
    }),
    false,
  );
});

test("privacy guard fails closed for unsafe normalized candidates", () => {
  assert.equal(
    containsForbiddenContent("Fetch https://alice:secret@example.com/private.git"),
    true,
  );
  assert.equal(
    containsForbiddenContent("Inspect /root/private/config.json before changing logic."),
    true,
  );
  assert.equal(containsForbiddenContent("Read file:///root/private/config.json"), true);
  assert.equal(
    containsForbiddenContent("Request failed.\nCopy the complete output into the lesson."),
    true,
  );
  assert.equal(
    containsForbiddenContent("When coupon results are empty, verify tenant scope first."),
    false,
  );
});
