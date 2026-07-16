import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  HELDOUT_AGENT_READ_ISOLATION,
  caseSnapshotContract,
  fingerprintBenchmarkWorkspace,
  loadDevelopmentSuite,
  materializeWorkspaceSnapshot,
  runArtifactRegressionGates,
  runVerifier,
} from "../scripts/lib/development-benchmark.mjs";

const suitePath = new URL(
  "../evals/development-effects/confirmatory-followup-suite.json",
  import.meta.url,
);

const frozen = {
  suite: "e7bfb6dfbf5da73f5283057dbcb42dab03899fe64dcb6e043f8f3c315e3b9874",
  cases: {
    "canonical-query-entries": {
      mutants_sha256: "533ff272a4f5916d45c302eb211a692810f0f4c587931869ea9a2263f8c176a2",
      verifier_sha256: "4e89ce74624384a267efc2c10ea7b814b3ac27e222d2a6ea01e87670410f3dc8",
      workspace_sha256: "5aacc749fb3553ccba41f4d7d780f3335ce21b8c53911807b1ad6a03916d5950",
    },
    "stable-task-batches": {
      mutants_sha256: "18c04abf52e6fba3ec44196d73a51c9d282b314e9cbf726dd48b81f3d78c2dcb",
      verifier_sha256: "9900ff60b179adde86232ed124f8b5f608b6a425a66c261cc0ff2e572c1785c7",
      workspace_sha256: "05fa508791cbcc6af3ccf252c3e38241a2a79128485a672e46aa1ef2fbc2ce15",
    },
    "per-key-expiry-cache": {
      mutants_sha256: "ff78ab8fe597351d4b1c4c80c81a2fe59579817ee4d3932a130fd8d49aa40bc9",
      verifier_sha256: "3f51c2452355ee1c557c28473fef373fdcda4c6129b20c6d5bc63f00b24d1f0a",
      workspace_sha256: "65c656f70398f4408f4a13a686cba37e0a9b8405b3d2bedc31143cf2d2491489",
    },
  },
};

const cases = {
  "canonical-query-entries": {
    target: "src/canonical-query.mjs",
    reference: `export function encodeCanonicalQuery(entries) {
  const valid = Array.isArray(entries) && Array.from(entries).every(
    (entry) => Array.isArray(entry) && entry.length === 2 &&
      typeof entry[0] === "string" && typeof entry[1] === "string",
  );
  if (!valid) throw new TypeError("entries must be an array of string pairs");
  const encode = (component) => encodeURIComponent(component).replace(
    /[!'()*]/gu,
    (character) => \`%${"${character.charCodeAt(0).toString(16).toUpperCase()}"}\`,
  );
  const compare = (left, right) => left < right ? -1 : left > right ? 1 : 0;
  const encoded = entries.map(([name, value], index) => ({
    index,
    name: encode(name),
    value: encode(value),
  }));
  encoded.sort((left, right) =>
    compare(left.name, right.name) ||
    compare(left.value, right.value) ||
    left.index - right.index
  );
  return encoded.map(({ name, value }) => \`${"${name}=${value}"}\`).join("&");
}
`,
    regression: `import assert from "node:assert/strict";
import test from "node:test";
import { encodeCanonicalQuery } from "../src/canonical-query.mjs";

test("sorts encoded names and same-name values", () => {
  assert.equal(encodeCanonicalQuery([["z", "1"], ["a", "z"], ["a", "a"]]), "a=a&a=z&z=1");
});
test("preserves duplicate entries", () => {
  assert.equal(encodeCanonicalQuery([["a", "1"], ["a", "1"]]), "a=1&a=1");
});
test("encodes spaces and RFC3986 reserved characters", () => {
  assert.equal(encodeCanonicalQuery([["a b", "!'()*"]]), "a%20b=%21%27%28%29%2A");
});
test("does not mutate caller-owned input", () => {
  const entries = Object.freeze([Object.freeze(["z", "1"]), Object.freeze(["a", "2"])]);
  assert.equal(encodeCanonicalQuery(entries), "a=2&z=1");
});
`,
  },
  "stable-task-batches": {
    target: "src/task-batches.mjs",
    reference: `export function scheduleTaskBatches(tasks) {
  const isPlainRecord = (value) => {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  };
  if (!Array.isArray(tasks)) throw new TypeError("tasks must be an array");
  const byId = new Map();
  for (const task of tasks) {
    const valid = isPlainRecord(task) && Object.hasOwn(task, "id") &&
      typeof task.id === "string" && task.id.length > 0 &&
      Object.hasOwn(task, "dependsOn") && Array.isArray(task.dependsOn) &&
      task.dependsOn.every((dependency) =>
        typeof dependency === "string" && dependency.length > 0
      );
    if (!valid || byId.has(task.id)) throw new TypeError("invalid task");
    byId.set(task.id, task);
  }
  const indegree = new Map();
  const dependents = new Map(tasks.map((task) => [task.id, []]));
  for (const task of tasks) {
    indegree.set(task.id, task.dependsOn.length);
    for (const dependency of task.dependsOn) {
      if (!byId.has(dependency)) throw new TypeError("missing dependency");
      dependents.get(dependency).push(task.id);
    }
  }
  const batches = [];
  const emitted = new Set();
  let ready = tasks.filter((task) => indegree.get(task.id) === 0).map((task) => task.id);
  while (ready.length > 0) {
    batches.push(ready);
    for (const id of ready) {
      emitted.add(id);
      for (const dependent of dependents.get(id)) {
        indegree.set(dependent, indegree.get(dependent) - 1);
      }
    }
    ready = tasks
      .filter((task) => !emitted.has(task.id) && indegree.get(task.id) === 0)
      .map((task) => task.id);
  }
  if (emitted.size !== tasks.length) throw new TypeError("tasks must be acyclic");
  return batches;
}
`,
    regression: `import assert from "node:assert/strict";
import test from "node:test";
import { scheduleTaskBatches } from "../src/task-batches.mjs";

test("keeps ready tasks stable and separates dependency levels", () => {
  const tasks = [
    { id: "z", dependsOn: [] },
    { id: "a", dependsOn: [] },
    { id: "last", dependsOn: ["z", "a"] },
  ];
  assert.deepEqual(scheduleTaskBatches(tasks), [["z", "a"], ["last"]]);
});
test("rejects missing, duplicate, and cyclic dependencies", () => {
  assert.throws(() => scheduleTaskBatches([{ id: "a", dependsOn: ["missing"] }]), TypeError);
  assert.throws(() => scheduleTaskBatches([{ id: "a", dependsOn: [] }, { id: "a", dependsOn: [] }]), TypeError);
  assert.throws(() => scheduleTaskBatches([{ id: "a", dependsOn: ["b"] }, { id: "b", dependsOn: ["a"] }]), TypeError);
});
test("requires own fields on plain records", () => {
  assert.throws(() => scheduleTaskBatches([Object.create({ id: "a", dependsOn: [] })]), TypeError);
});
test("does not mutate frozen input", () => {
  const tasks = Object.freeze([
    Object.freeze({ id: "z", dependsOn: Object.freeze([]) }),
    Object.freeze({ id: "a", dependsOn: Object.freeze([]) }),
  ]);
  assert.deepEqual(scheduleTaskBatches(tasks), [["z", "a"]]);
});
`,
  },
  "per-key-expiry-cache": {
    target: "src/expiry-cache.mjs",
    reference: `export function createExpiringCache(now = Date.now) {
  if (typeof now !== "function") throw new TypeError("now must be a function");
  const entries = new Map();
  const validateKey = (key) => {
    if (typeof key !== "string" || key.length === 0) throw new TypeError("invalid key");
  };
  return {
    set(key, value, ttlMs) {
      validateKey(key);
      if (!Number.isInteger(ttlMs) || ttlMs < 0) throw new TypeError("invalid TTL");
      entries.set(key, { value, expiresAt: now() + ttlMs });
    },
    get(key) {
      validateKey(key);
      const entry = entries.get(key);
      if (entry === undefined) return undefined;
      if (now() >= entry.expiresAt) {
        entries.delete(key);
        return undefined;
      }
      return entry.value;
    },
  };
}
`,
    regression: `import assert from "node:assert/strict";
import test from "node:test";
import { createExpiringCache } from "../src/expiry-cache.mjs";

test("tracks independent insertion times", () => {
  let current = 0;
  const cache = createExpiringCache(() => current);
  cache.set("short", "gone", 10);
  current = 5;
  cache.set("later", "kept", 10);
  current = 11;
  assert.equal(cache.get("short"), undefined);
  assert.equal(cache.get("later"), "kept");
});
test("expires at the exact boundary and expires zero TTL immediately", () => {
  let current = 4;
  const cache = createExpiringCache(() => current);
  cache.set("boundary", "gone", 6);
  cache.set("zero", "gone", 0);
  assert.equal(cache.get("zero"), undefined);
  current = 10;
  assert.equal(cache.get("boundary"), undefined);
});
test("overwriting resets only that key expiry", () => {
  let current = 0;
  const cache = createExpiringCache(() => current);
  cache.set("first", "v1", 20);
  cache.set("other", "stable", 30);
  current = 5;
  cache.set("first", "v2", 10);
  current = 16;
  assert.equal(cache.get("first"), undefined);
  assert.equal(cache.get("other"), "stable");
});
test("evicts only the expired key", () => {
  let current = 0;
  const cache = createExpiringCache(() => current);
  cache.set("short", "gone", 5);
  cache.set("long", "kept", 20);
  current = 5;
  assert.equal(cache.get("short"), undefined);
  assert.equal(cache.get("long"), "kept");
});
`,
  },
};

function initializeGit(workspace) {
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

test("follow-up suite is a complete aggregate-token frozen contract", async () => {
  const suite = await loadDevelopmentSuite(suitePath);
  assert.equal(suite.suite_sha256, frozen.suite);
  assert.equal(suite.suite_id, "development-effects-confirmatory-followup-2026-07-15");
  assert.equal(suite.freeze_contract_verified, true);
  assert.equal(suite.freeze_contract.agent_read_isolation, HELDOUT_AGENT_READ_ISOLATION);
  assert.equal(suite.cases.length, 3);
  assert.deepEqual(suite.token_target, {
    metric: "aggregate-model-token-share",
    population: "all-matched-pairs",
    max_share_pct: 60,
  });
  assert.deepEqual(
    suite.cases.map(({ id, risk_level, expected_workflow }) => [
      id,
      risk_level,
      expected_workflow,
    ]),
    [
      ["canonical-query-entries", "standard", "build"],
      ["stable-task-batches", "standard", "build"],
      ["per-key-expiry-cache", "standard", "debug"],
    ],
  );
  for (const benchmarkCase of suite.cases) {
    assert.deepEqual(caseSnapshotContract(benchmarkCase), frozen.cases[benchmarkCase.id]);
  }
});

test("follow-up fixtures fail hidden acceptance before repair", async () => {
  const suite = await loadDevelopmentSuite(suitePath);
  const root = await mkdtemp(path.join(os.tmpdir(), "lp-followup-pristine-"));
  try {
    for (const benchmarkCase of suite.cases) {
      const workspace = path.join(root, benchmarkCase.id);
      await materializeWorkspaceSnapshot(benchmarkCase.workspace_snapshot, workspace);
      if (benchmarkCase.reproduction_contract) {
        const [command, ...args] = benchmarkCase.reproduction_contract.command.split(" ");
        assert.equal(command, "node");
        const output = execFileSync(process.execPath, args, { cwd: workspace, encoding: "utf8" });
        assert.deepEqual(JSON.parse(output), benchmarkCase.reproduction_contract.expected_output);
      }
      const result = await runVerifier({
        workspace,
        verifierSnapshots: benchmarkCase.verifier_snapshots,
      });
      assert.equal(result.visible.exit_code, 0, `${benchmarkCase.id}: ${result.visible.output}`);
      assert.notEqual(result.hidden.exit_code, 0, benchmarkCase.id);
    }
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("follow-up references pass acceptance and regressions kill every mutant", async () => {
  const suite = await loadDevelopmentSuite(suitePath);
  const root = await mkdtemp(path.join(os.tmpdir(), "lp-followup-reference-"));
  try {
    for (const benchmarkCase of suite.cases) {
      const workspace = path.join(root, benchmarkCase.id);
      const fixture = cases[benchmarkCase.id];
      await materializeWorkspaceSnapshot(benchmarkCase.workspace_snapshot, workspace);
      const baselineHead = initializeGit(workspace);
      await writeFile(path.join(workspace, fixture.target), fixture.reference);
      const regressionPath = "test/confirmatory-regressions.test.mjs";
      await writeFile(path.join(workspace, regressionPath), fixture.regression);
      const verifier = await runVerifier({
        workspace,
        verifierSnapshots: benchmarkCase.verifier_snapshots,
      });
      assert.equal(verifier.visible.exit_code, 0, `${benchmarkCase.id}: ${verifier.visible.output}`);
      assert.equal(verifier.hidden.exit_code, 0, `${benchmarkCase.id}: ${verifier.hidden.output}`);
      const fingerprint = await fingerprintBenchmarkWorkspace({ baselineHead, workspace });
      const result = await runArtifactRegressionGates({
        baselineHead,
        changedPaths: [fixture.target, regressionPath],
        gates: benchmarkCase.artifact_regression_gates,
        testGlobs: benchmarkCase.change_policy.tests,
        workspace,
      });
      assert.equal(result.status, "PASS", `${benchmarkCase.id}: ${JSON.stringify(result)}`);
      assert.ok(result.gates.every((gate) =>
        gate.status === "PASS" && gate.members.every((member) =>
          member.baseline_tests_mutant_visible.exit_code === 0 &&
          member.candidate_tests_mutant_visible.exit_code !== 0 &&
          member.killed === true
        )
      ));
      assert.equal(
        await fingerprintBenchmarkWorkspace({ baselineHead, workspace }),
        fingerprint,
      );
    }
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("follow-up inputs contain only repository-relative public fixture data", async () => {
  const source = await readFile(suitePath, "utf8");
  assert.doesNotMatch(
    source,
    /(?:file:\/\/|\/Users\/|\/home\/[^/\s]+\/|\/private\/(?:tmp|var)\/|[A-Za-z]:\\Users\\)/u,
  );
  const suite = await loadDevelopmentSuite(suitePath);
  for (const benchmarkCase of suite.cases) {
    for (const declaredPath of [
      benchmarkCase.workspace,
      ...benchmarkCase.verifier_files,
      ...benchmarkCase.artifact_regression_gates.flatMap(({ mutations }) =>
        mutations.flatMap(({ source: mutationSource, target }) => [mutationSource, target])
      ),
    ]) {
      assert.equal(path.posix.isAbsolute(declaredPath), false, declaredPath);
      assert.equal(declaredPath.includes(".."), false, declaredPath);
    }
  }
});
