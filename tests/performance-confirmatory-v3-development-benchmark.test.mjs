import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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
  "../evals/development-effects/performance-confirmatory-v3-suite.json",
  import.meta.url,
);

const frozen = {
  revision: "94c491a14e61c931dfa1261fb75c92d42ac66a49",
  suite: "cbace9b1542ad9e6f2d65d1b63a25e1f3e2f9f26621db64fb7c00caf02b08b40",
  cases: {
    "atomic-config-migrations": {
      mutants_sha256: "0e025be841e27f1b3ea06ba8fec22aadd03cf891439a023e80e9e42e6a301290",
      verifier_sha256: "e8692c047e76a2e18d96dd35a83515114ad489bb1b9feda733ba8440384ae3c4",
      workspace_sha256: "5ab5b8cc16323b52147caaca0fecfc909b4f1aa39b4b85d50023a00eebe90ef6",
    },
    "generation-guarded-refresh-cache": {
      mutants_sha256: "e45f1d2409e385f9154fceafb637716ede1d5dbce063976a69de70a29183c097",
      verifier_sha256: "89b585b23ac5161c576ced949a968fbe6a316f35bf38a51a6aa3d712c7680791",
      workspace_sha256: "b99490d67bd3b496da034bbb8821fd4951923cb94b4e163081dc05ff5b3b0fb4",
    },
    "stable-priority-merge": {
      mutants_sha256: "749a43751d9647f56d24bb7f180c67bb1009ff1ac090ac3471b4e65975767305",
      verifier_sha256: "5441beb649c0f228c120aa5beb502bbb734a51bc36397f0ca9da673d54a91560",
      workspace_sha256: "eb1de002fe723014e929aae1c3bcb03472cba7da573b025dc8b23f13dde7e35d",
    },
  },
};

const fixtures = {
  "atomic-config-migrations": {
    mutantCount: 7,
    target: "src/config-migrations.mjs",
    reference: `function isExactRecord(value, keys) {
  if (
    value === null
    || typeof value !== "object"
    || Object.getPrototypeOf(value) !== Object.prototype
  ) return false;
  const ownKeys = Reflect.ownKeys(value);
  return ownKeys.length === keys.length && keys.every((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor?.enumerable === true && Object.hasOwn(descriptor, "value");
  });
}

function isFlatValues(value) {
  if (
    value === null
    || typeof value !== "object"
    || Object.getPrototypeOf(value) !== Object.prototype
  ) return false;
  return Reflect.ownKeys(value).every((key) => {
    if (typeof key !== "string") return false;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor?.enumerable !== true || !Object.hasOwn(descriptor, "value")) return false;
    const field = descriptor.value;
    return field === null || (typeof field !== "object" && typeof field !== "function");
  });
}

function validate(initial, migrations) {
  if (
    !isExactRecord(initial, ["version", "values"])
    || !Number.isSafeInteger(initial.version)
    || initial.version < 0
    || !isFlatValues(initial.values)
  ) throw new TypeError("invalid initial config");
  if (
    !Array.isArray(migrations)
    || Reflect.ownKeys(migrations).length !== migrations.length + 1
  ) throw new TypeError("invalid migrations");
  const seen = new Set();
  for (let index = 0; index < migrations.length; index += 1) {
    const migration = migrations[index];
    if (
      !Object.hasOwn(migrations, index)
      || !isExactRecord(migration, ["from", "to", "apply"])
      || !Number.isSafeInteger(migration.from)
      || migration.from < 0
      || !Number.isSafeInteger(migration.to)
      || migration.to !== migration.from + 1
      || typeof migration.apply !== "function"
      || seen.has(migration.from)
    ) throw new TypeError("invalid migration");
    seen.add(migration.from);
  }
}

export function createMigratingConfig(initial, migrations) {
  validate(initial, migrations);
  const steps = new Map(
    migrations.map(({ from, to, apply }) => [from, { from, to, apply }]),
  );
  let state = { version: initial.version, values: { ...initial.values } };
  const snapshot = () => ({ version: state.version, values: { ...state.values } });
  return {
    snapshot,
    migrateTo(target) {
      if (!Number.isSafeInteger(target) || target < 0) {
        throw new TypeError("invalid target");
      }
      if (target < state.version) throw new RangeError("downgrade");
      let version = state.version;
      let values = { ...state.values };
      while (version < target) {
        const migration = steps.get(version);
        if (migration === undefined) throw new TypeError("missing migration");
        const output = migration.apply({ ...values });
        if (!isFlatValues(output)) throw new TypeError("invalid migration output");
        values = { ...output };
        version = migration.to;
      }
      state = { version, values };
      return snapshot();
    },
  };
}
`,
  },
  "stable-priority-merge": {
    mutantCount: 7,
    target: "src/stable-priority-merge.mjs",
    reference: `function validItem(item) {
  if (
    item === null
    || typeof item !== "object"
    || Array.isArray(item)
    || Object.getPrototypeOf(item) !== Object.prototype
  ) return false;
  const keys = Reflect.ownKeys(item);
  return keys.length === 3
    && ["id", "priority", "value"].every((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(item, key);
      return keys.includes(key)
        && descriptor?.enumerable === true
        && Object.hasOwn(descriptor, "value");
    })
    && typeof item.id === "string"
    && item.id.length > 0
    && Number.isSafeInteger(item.priority);
}

function validate(lanes) {
  if (!Array.isArray(lanes)) throw new TypeError("invalid lanes");
  for (let laneIndex = 0; laneIndex < lanes.length; laneIndex += 1) {
    const lane = lanes[laneIndex];
    if (!Object.hasOwn(lanes, laneIndex) || !Array.isArray(lane)) {
      throw new TypeError("invalid lane");
    }
    for (let itemIndex = 0; itemIndex < lane.length; itemIndex += 1) {
      if (!Object.hasOwn(lane, itemIndex) || !validItem(lane[itemIndex])) {
        throw new TypeError("invalid item");
      }
    }
  }
}

export function mergeStablePriorityItems(lanes) {
  validate(lanes);
  const winners = new Map();
  let encounter = 0;
  for (const lane of lanes) {
    for (const item of lane) {
      const current = winners.get(item.id);
      if (current === undefined || item.priority > current.item.priority) {
        winners.set(item.id, { encounter, item });
      }
      encounter += 1;
    }
  }
  return [...winners.values()]
    .sort((left, right) => left.item.priority === right.item.priority
      ? left.encounter - right.encounter
      : left.item.priority > right.item.priority ? -1 : 1)
    .map(({ item }) => ({ id: item.id, priority: item.priority, value: item.value }));
}
`,
  },
  "generation-guarded-refresh-cache": {
    mutantCount: 5,
    target: "src/refresh-cache.mjs",
    reference: `export function createRefreshCache(loadValue) {
  if (typeof loadValue !== "function") {
    throw new TypeError("loadValue must be a function");
  }

  const entries = new Map();
  const generations = new Map();
  const validateKey = (key) => {
    if (typeof key !== "string" || key.length === 0) {
      throw new TypeError("key must be a non-empty string");
    }
  };
  const nextGeneration = (key) => {
    const generation = (generations.get(key) ?? 0) + 1;
    generations.set(key, generation);
    return generation;
  };
  const start = (key, generation) => {
    let promise;
    promise = Promise.resolve()
      .then(() => loadValue(key))
      .catch((error) => {
        const current = entries.get(key);
        if (
          generations.get(key) === generation
          && current?.generation === generation
          && current.promise === promise
        ) entries.delete(key);
        throw error;
      });
    entries.set(key, { generation, promise });
    return promise;
  };

  return {
    get(key) {
      validateKey(key);
      return entries.get(key)?.promise ?? start(key, nextGeneration(key));
    },
    refresh(key) {
      validateKey(key);
      return start(key, nextGeneration(key));
    },
    invalidate(key) {
      validateKey(key);
      nextGeneration(key);
      return entries.delete(key);
    },
  };
}
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

function runReproduction(workspace, reproductionContract) {
  const [command, ...args] = reproductionContract.command.split(" ");
  assert.equal(command, "node");
  const output = execFileSync(process.execPath, args, {
    cwd: workspace,
    encoding: "utf8",
  });
  return JSON.parse(output.trim());
}

test("performance v3 suite is an exact quality-first frozen contract", async () => {
  const suite = await loadDevelopmentSuite(suitePath);
  assert.equal(suite.suite_sha256, frozen.suite);
  assert.equal(suite.suite_id, "development-effects-performance-confirmatory-v3-2026-07-15");
  assert.equal(suite.evidence_level, "paired-development-heldout");
  assert.equal(suite.freeze_contract_verified, true);
  assert.equal(suite.report_contract, "categorized-exact-render-v1");
  assert.equal(suite.freeze_contract.agent_read_isolation, HELDOUT_AGENT_READ_ISOLATION);
  assert.equal(
    suite.freeze_contract.superpowers_revision,
    "d884ae04edebef577e82ff7c4e143debd0bbec99",
  );
  assert.equal(suite.freeze_contract.leanpowers_revision, frozen.revision);
  assert.equal(suite.freeze_contract.evaluator_revision, frozen.revision);
  assert.equal(suite.freeze_contract.runner_revision, frozen.revision);
  assert.equal(suite.model_default, "gpt-5.3-codex-spark");
  assert.equal(suite.effort, "low");
  assert.equal(suite.repetitions, 2);
  assert.deepEqual(suite.workflow_order, [
    ["superpowers-6.1.1", "leanpowers-0.2.0"],
    ["leanpowers-0.2.0", "superpowers-6.1.1"],
  ]);
  assert.deepEqual(suite.token_target, {
    metric: "aggregate-model-token-share",
    population: "all-matched-pairs",
    max_share_pct: 60,
  });
  assert.deepEqual(
    suite.cases.map(({
      id,
      risk_level: riskLevel,
      expected_workflow: owner,
      reporting_category: category,
    }) => [id, riskLevel, owner, category]),
    [
      ["atomic-config-migrations", "strict", "build", "atomic migration build"],
      ["stable-priority-merge", "lean", "build", "stable priority build"],
      [
        "generation-guarded-refresh-cache",
        "strict",
        "debug",
        "generation-guarded cache debug",
      ],
    ],
  );

  let totalMutants = 0;
  for (const benchmarkCase of suite.cases) {
    assert.deepEqual(caseSnapshotContract(benchmarkCase), frozen.cases[benchmarkCase.id]);
    const mutantCount = benchmarkCase.artifact_regression_gates.reduce(
      (sum, gate) => sum + gate.mutations.length,
      0,
    );
    assert.equal(mutantCount, fixtures[benchmarkCase.id].mutantCount, benchmarkCase.id);
    totalMutants += mutantCount;
  }
  assert.equal(totalMutants, 19);
});

test("performance v3 pristine fixtures pass visible checks and fail hidden acceptance", async () => {
  const suite = await loadDevelopmentSuite(suitePath);
  const root = await mkdtemp(path.join(os.tmpdir(), "lp-performance-v3-pristine-"));
  try {
    for (const benchmarkCase of suite.cases) {
      const workspace = path.join(root, benchmarkCase.id);
      await materializeWorkspaceSnapshot(benchmarkCase.workspace_snapshot, workspace);
      if (benchmarkCase.reproduction_contract) {
        assert.deepEqual(
          runReproduction(workspace, benchmarkCase.reproduction_contract),
          benchmarkCase.reproduction_contract.expected_output,
        );
      }
      const verifier = await runVerifier({
        workspace,
        verifierSnapshots: benchmarkCase.verifier_snapshots,
      });
      assert.equal(verifier.visible.exit_code, 0, `${benchmarkCase.id}: ${verifier.visible.output}`);
      assert.notEqual(verifier.hidden.exit_code, 0, benchmarkCase.id);
    }
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("performance v3 references pass acceptance and ideal deltas kill every mutant", async () => {
  const suite = await loadDevelopmentSuite(suitePath);
  const root = await mkdtemp(path.join(os.tmpdir(), "lp-performance-v3-reference-"));
  try {
    for (const benchmarkCase of suite.cases) {
      const workspace = path.join(root, benchmarkCase.id);
      const fixture = fixtures[benchmarkCase.id];
      await materializeWorkspaceSnapshot(benchmarkCase.workspace_snapshot, workspace);
      const baselineHead = initializeGit(workspace);
      await writeFile(path.join(workspace, fixture.target), fixture.reference);
      const regressionPath = "test/performance-v3-regressions.test.mjs";
      await writeFile(
        path.join(workspace, regressionPath),
        benchmarkCase.verifier_snapshots.map(({ source }) => source).join("\n"),
      );

      if (benchmarkCase.reproduction_contract) {
        assert.deepEqual(
          runReproduction(workspace, benchmarkCase.reproduction_contract),
          benchmarkCase.reproduction_contract.resolved_output,
        );
      }
      const beforeVerifier = await fingerprintBenchmarkWorkspace({ baselineHead, workspace });
      const verifier = await runVerifier({
        workspace,
        verifierSnapshots: benchmarkCase.verifier_snapshots,
      });
      assert.equal(verifier.visible.exit_code, 0, `${benchmarkCase.id}: ${verifier.visible.output}`);
      assert.equal(verifier.hidden.exit_code, 0, `${benchmarkCase.id}: ${verifier.hidden.output}`);
      assert.equal(
        await fingerprintBenchmarkWorkspace({ baselineHead, workspace }),
        beforeVerifier,
      );

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
          member.baseline_tests_mutant_visible.exit_code === 0
          && member.candidate_tests_mutant_visible.exit_code !== 0
          && member.killed === true
        )
      ));
      assert.equal(
        await fingerprintBenchmarkWorkspace({ baselineHead, workspace }),
        beforeVerifier,
      );
    }
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("performance v3 inputs contain only repository-relative public fixture data", async () => {
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
