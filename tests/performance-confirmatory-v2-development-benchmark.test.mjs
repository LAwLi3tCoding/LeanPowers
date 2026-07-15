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
  "../evals/development-effects/performance-confirmatory-v2-suite.json",
  import.meta.url,
);

const frozen = {
  suite: "b0f721408de7bfbe04521d5df68c4d1bf2f5ff57ca5233aae61729a234b6f540",
  cases: {
    "coalesced-half-open-intervals": {
      mutants_sha256: "b6d730105248f9c4dd621c8e90c395e8b7e3cf375a0f41414fc3614adb669937",
      verifier_sha256: "d6601ae710dbcaa7d603b1f432a255cbef1f072b422105c84f70245ea54b5cc8",
      workspace_sha256: "c3656fd00128b0247a2d644262d12e431515fb96ab649cfedd1d171f9d1bf469",
    },
    "escaped-field-parser": {
      mutants_sha256: "b03979d6bc93ece6c3a9cf0e4214116068c58c9bf4f66e77110c98868993d87a",
      verifier_sha256: "2463ff4b071df34a75afba6ffb02988db95bd764d74a1ac08d5f1c478f9de700",
      workspace_sha256: "8e2991981e823e4006dfc76dc74a4dcb81083b8ae77841313967ad6a32dee7f5",
    },
    "transactional-batch-flush": {
      mutants_sha256: "95e25ae14050943ef57e3b7086c1a4c98964f99e6396c1cd172655fef31670b0",
      verifier_sha256: "b79a524e7aae87e6396cbdaaa7a90497c9a59b96ca3a24a768821c45af618f97",
      workspace_sha256: "8ee9a973abfa9274e1988f9d6a694f8a42ab3b7fc9a1d4e7c3794c44f67e9ee3",
    },
  },
};

const fixtures = {
  "coalesced-half-open-intervals": {
    target: "src/half-open-intervals.mjs",
    reference: `export function coalesceHalfOpenIntervals(intervals) {
  if (!Array.isArray(intervals)) {
    throw new TypeError("intervals must be a dense array of [start, end] tuples");
  }
  const sorted = [];
  for (let index = 0; index < intervals.length; index += 1) {
    const interval = intervals[index];
    if (
      !Object.hasOwn(intervals, index) ||
      !Array.isArray(interval) ||
      interval.length !== 2 ||
      !Object.hasOwn(interval, 0) ||
      !Object.hasOwn(interval, 1) ||
      !Number.isSafeInteger(interval[0]) ||
      !Number.isSafeInteger(interval[1]) ||
      interval[0] < 0 ||
      interval[0] > interval[1]
    ) {
      throw new TypeError("intervals must be a dense array of [start, end] tuples");
    }
    sorted.push([interval[0], interval[1]]);
  }
  sorted.sort((left, right) => left[0] - right[0] || left[1] - right[1]);

  const nonEmpty = [];
  const points = [];
  const seenPoints = new Set();
  for (const [start, end] of sorted) {
    if (start === end) {
      if (!seenPoints.has(start)) {
        seenPoints.add(start);
        points.push([start, end]);
      }
      continue;
    }
    const previous = nonEmpty.at(-1);
    if (previous && start <= previous[1]) {
      previous[1] = Math.max(previous[1], end);
    } else {
      nonEmpty.push([start, end]);
    }
  }
  return [...nonEmpty, ...points].sort(
    (left, right) => left[0] - right[0] || left[1] - right[1],
  );
}
`,
  },
  "escaped-field-parser": {
    target: "src/escaped-fields.mjs",
    reference: `export function splitEscapedFields(input, separator) {
  if (
    typeof input !== "string" ||
    typeof separator !== "string" ||
    [...separator].length !== 1 ||
    separator === "\\\\"
  ) {
    throw new TypeError("invalid arguments");
  }

  const fields = [];
  let current = "";
  let escaped = false;
  for (const codePoint of input) {
    if (escaped) {
      current += codePoint;
      escaped = false;
    } else if (codePoint === "\\\\") {
      escaped = true;
    } else if (codePoint === separator) {
      fields.push(current);
      current = "";
    } else {
      current += codePoint;
    }
  }
  if (escaped) throw new TypeError("trailing escape");
  fields.push(current);
  return fields;
}
`,
  },
  "transactional-batch-flush": {
    target: "src/batcher.mjs",
    reference: `export function createBatcher(deliver) {
  if (typeof deliver !== "function") {
    throw new TypeError("deliver must be a function");
  }
  const pending = [];
  return {
    add(value) {
      pending.push(value);
    },
    flush() {
      if (pending.length === 0) return false;
      const snapshot = pending.splice(0);
      try {
        deliver([...snapshot]);
      } catch (error) {
        pending.unshift(...snapshot);
        throw error;
      }
      return true;
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

test("performance v2 suite is an exact quality-first frozen contract", async () => {
  const suite = await loadDevelopmentSuite(suitePath);
  assert.equal(suite.suite_sha256, frozen.suite);
  assert.equal(suite.suite_id, "development-effects-performance-confirmatory-v2-2026-07-15");
  assert.equal(suite.evidence_level, "paired-development-heldout");
  assert.equal(suite.freeze_contract_verified, true);
  assert.equal(suite.freeze_contract.agent_read_isolation, HELDOUT_AGENT_READ_ISOLATION);
  assert.deepEqual(suite.token_target, {
    metric: "aggregate-model-token-share",
    population: "all-matched-pairs",
    max_share_pct: 60,
  });
  assert.deepEqual(
    suite.cases.map(({ id, risk_level, expected_workflow, scenario_class }) => [
      id,
      risk_level,
      expected_workflow,
      scenario_class,
    ]),
    [
      ["coalesced-half-open-intervals", "standard", "build", "small-explicit-feature"],
      ["escaped-field-parser", "standard", "build", "small-explicit-feature"],
      ["transactional-batch-flush", "standard", "debug", "unknown-cause-defect"],
    ],
  );
  assert.equal(
    suite.cases.reduce(
      (count, benchmarkCase) => count + benchmarkCase.artifact_regression_gates.length,
      0,
    ),
    20,
  );
  assert.equal(
    suite.cases.reduce(
      (count, benchmarkCase) => count + benchmarkCase.artifact_regression_gates
        .reduce((sum, gate) => sum + gate.mutations.length, 0),
      0,
    ),
    24,
  );
  for (const benchmarkCase of suite.cases) {
    assert.deepEqual(caseSnapshotContract(benchmarkCase), frozen.cases[benchmarkCase.id]);
  }
});

test("performance v2 pristine fixtures pass visible checks and fail hidden acceptance", async () => {
  const suite = await loadDevelopmentSuite(suitePath);
  const root = await mkdtemp(path.join(os.tmpdir(), "lp-performance-v2-pristine-"));
  try {
    for (const benchmarkCase of suite.cases) {
      const workspace = path.join(root, benchmarkCase.id);
      await materializeWorkspaceSnapshot(benchmarkCase.workspace_snapshot, workspace);
      if (benchmarkCase.reproduction_contract) {
        const [command, ...args] = benchmarkCase.reproduction_contract.command.split(" ");
        assert.equal(command, "node");
        const output = execFileSync(process.execPath, args, {
          cwd: workspace,
          encoding: "utf8",
        });
        assert.deepEqual(JSON.parse(output), benchmarkCase.reproduction_contract.expected_output);
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

test("performance v2 references reach acceptance and ideal deltas kill every mutant", async () => {
  const suite = await loadDevelopmentSuite(suitePath);
  const root = await mkdtemp(path.join(os.tmpdir(), "lp-performance-v2-reference-"));
  try {
    for (const benchmarkCase of suite.cases) {
      const workspace = path.join(root, benchmarkCase.id);
      const fixture = fixtures[benchmarkCase.id];
      await materializeWorkspaceSnapshot(benchmarkCase.workspace_snapshot, workspace);
      const baselineHead = initializeGit(workspace);
      await writeFile(path.join(workspace, fixture.target), fixture.reference);
      const regressionPath = "test/performance-v2-regressions.test.mjs";
      await writeFile(
        path.join(workspace, regressionPath),
        benchmarkCase.verifier_snapshots.map(({ source }) => source).join("\n"),
      );

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
          member.baseline_tests_mutant_visible.exit_code === 0 &&
          member.candidate_tests_mutant_visible.exit_code !== 0 &&
          member.killed === true
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

test("performance v2 inputs contain only repository-relative public fixture data", async () => {
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
