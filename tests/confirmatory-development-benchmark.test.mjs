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
  "../evals/development-effects/confirmatory-suite.json",
  import.meta.url,
);

const frozen = {
  suite: "bed220c33b40871ce4550085f0f3f763a56da0d8af3bd71ae33b2299ec1fbf8c",
  cases: {
    "integer-range-labels": {
      mutants_sha256: "6df4b9d8b747037fd129b6c3c4ceca5e63f3a162692c0d97c50dee03032e2f87",
      verifier_sha256: "3635f87a75e15b605b4bbedb737f4d12ef8615ff31e532bb302ab746084fee03",
      workspace_sha256: "1db0e45fb08791c590bfa0e007c90004ad9d2f7f6490d3c456a3df15ecd9bcff",
    },
    "layered-build-options": {
      mutants_sha256: "a3ef7d1c138108667abcb5e0416b37b998bca5639bcb17b542dd3a4a4dd39f07",
      verifier_sha256: "f21ae4ded8eabd940fd31d90098ee3cae8fa44b7fc92c9c95eb862f36b1a07ae",
      workspace_sha256: "73e38bf7c1bb94d6aafbd75579243ee602331f018a54d30841d61191c67f3503",
    },
    "chunked-ndjson-decoder": {
      mutants_sha256: "2f78054f5c1c3f04cd6f84ecfbb1bfcbd54fbb6c2a87a7a30b72df29e850984c",
      verifier_sha256: "4070b2e4e540c19cb6c24c3f0d10308652ee2b55ba4f25da7447f6dff6374f70",
      workspace_sha256: "cd1e071d38c98fc0f8861c4c8446f33ef09ccab2bb2e5ff04acf49d68df351b2",
    },
  },
};

const cases = {
  "integer-range-labels": {
    target: "src/integer-ranges.mjs",
    reference: `export function formatIntegerRanges(values) {
  const valid = Array.isArray(values) && Array.from(values).every(
    (value) => Number.isSafeInteger(value) && value >= 0,
  );
  if (!valid) {
    throw new TypeError("values must be an array of non-negative safe integers");
  }
  const sorted = [...new Set(values)].sort((left, right) => left - right);
  if (sorted.length === 0) return "";
  const labels = [];
  let start = sorted[0];
  let end = start;
  const append = () => labels.push(start === end ? \`${"${start}"}\` : \`${"${start}-${end}"}\`);
  for (const value of sorted.slice(1)) {
    if (value === end + 1) {
      end = value;
      continue;
    }
    append();
    start = value;
    end = value;
  }
  append();
  return labels.join(",");
}
`,
    regression: `import assert from "node:assert/strict";
import test from "node:test";
import { formatIntegerRanges } from "../src/integer-ranges.mjs";

test("normalizes unsorted input without mutation", () => {
  const values = [9, 2, 3];
  const before = [...values];
  assert.equal(formatIntegerRanges(values), "2-3,9");
  assert.deepEqual(values, before);
});
test("removes duplicates", () => assert.equal(formatIntegerRanges([2, 2, 3]), "2-3"));
test("compacts exactly two values", () => assert.equal(formatIntegerRanges([4, 5]), "4-5"));
test("does not bridge a missing integer", () => assert.equal(formatIntegerRanges([1, 3]), "1,3"));
`,
  },
  "layered-build-options": {
    target: "src/build-options.mjs",
    reference: `export function resolveBuildOptions(defaults, projectOptions = {}, cliOptions = {}) {
  const allowed = new Set(Object.keys(defaults));
  const resolved = { ...defaults };
  for (const layer of [projectOptions, cliOptions]) {
    for (const [key, value] of Object.entries(layer)) {
      if (!allowed.has(key)) throw new TypeError(\`unknown build option: ${"${key}"}\`);
      if (value !== undefined) resolved[key] = value;
    }
  }
  return resolved;
}
`,
    regression: `import assert from "node:assert/strict";
import test from "node:test";
import { resolveBuildOptions } from "../src/build-options.mjs";

test("preserves two-argument calls and applies CLI last", () => {
  assert.deepEqual(resolveBuildOptions({ target: "a" }, { target: "b" }), { target: "b" });
  assert.deepEqual(resolveBuildOptions({ target: "a" }, { target: "b" }, { target: "c" }), { target: "c" });
});
test("preserves explicit falsy values and skips undefined", () => {
  assert.deepEqual(
    resolveBuildOptions(
      { watch: true, retries: 2, banner: "x", metadata: {} },
      { watch: false, retries: 0, banner: "", metadata: null },
      { watch: undefined },
    ),
    { watch: false, retries: 0, banner: "", metadata: null },
  );
});
test("rejects own unknown keys and ignores inherited keys", () => {
  assert.throws(() => resolveBuildOptions({ target: "a" }, { typo: undefined }), TypeError);
  const project = Object.create({ target: "inherited", typo: true });
  project.minify = false;
  assert.deepEqual(resolveBuildOptions({ target: "a", minify: true }, project), { target: "a", minify: false });
});
test("returns fresh data without mutating frozen inputs", () => {
  const defaults = Object.freeze({ target: "a", minify: true });
  const project = Object.freeze({ target: "b" });
  const cli = Object.freeze({ minify: false });
  const result = resolveBuildOptions(defaults, project, cli);
  assert.deepEqual(result, { target: "b", minify: false });
  assert.notEqual(result, defaults);
});
`,
  },
  "chunked-ndjson-decoder": {
    target: "src/ndjson-decoder.mjs",
    reference: `export function createNdjsonDecoder(onRecord) {
  let pending = "";
  const emit = (line) => {
    const record = line.endsWith("\\r") ? line.slice(0, -1) : line;
    if (record.trim() !== "") onRecord(JSON.parse(record));
  };
  return {
    write(chunk) {
      const lines = \`${"${pending}${String(chunk)}"}\`.split("\\n");
      pending = lines.pop();
      for (const line of lines) emit(line);
    },
    end() {
      emit(pending);
      pending = "";
    },
  };
}
`,
    regression: `import assert from "node:assert/strict";
import test from "node:test";
import { createNdjsonDecoder } from "../src/ndjson-decoder.mjs";

test("buffers split records", () => {
  const records = [];
  const decoder = createNdjsonDecoder((record) => records.push(record));
  decoder.write('{"id":');
  assert.deepEqual(records, []);
  decoder.write('1}\\n');
  assert.deepEqual(records, [{ id: 1 }]);
});
test("emits complete records synchronously in order", () => {
  const events = [];
  const decoder = createNdjsonDecoder((record) => events.push(record.id));
  decoder.write('{"id":1}\\n{"id":2}\\n{"id":3}\\n');
  events.push("after");
  assert.deepEqual(events, [1, 2, 3, "after"]);
});
test("supports blank CRLF lines and flushes final input", () => {
  const records = [];
  const decoder = createNdjsonDecoder((record) => records.push(record));
  decoder.write('\\r\\n{"id":4}\\r\\n');
  decoder.write('{"id":5}');
  decoder.end();
  assert.deepEqual(records, [{ id: 4 }, { id: 5 }]);
});
test("throws malformed complete records synchronously", () => {
  const decoder = createNdjsonDecoder(() => assert.fail("unexpected record"));
  assert.throws(() => decoder.write('{"id":}\\n'), SyntaxError);
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

test("confirmatory suite is a complete aggregate-token frozen contract", async () => {
  const suite = await loadDevelopmentSuite(suitePath);
  assert.equal(suite.suite_sha256, frozen.suite);
  assert.equal(suite.suite_id, "development-effects-confirmatory-2026-07-15");
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
      ["integer-range-labels", "standard", "build"],
      ["layered-build-options", "standard", "build"],
      ["chunked-ndjson-decoder", "standard", "debug"],
    ],
  );
  for (const benchmarkCase of suite.cases) {
    assert.deepEqual(caseSnapshotContract(benchmarkCase), frozen.cases[benchmarkCase.id]);
  }
});

test("confirmatory fixtures fail hidden acceptance before repair", async () => {
  const suite = await loadDevelopmentSuite(suitePath);
  const root = await mkdtemp(path.join(os.tmpdir(), "lp-confirmatory-pristine-"));
  try {
    for (const benchmarkCase of suite.cases) {
      const workspace = path.join(root, benchmarkCase.id);
      await materializeWorkspaceSnapshot(benchmarkCase.workspace_snapshot, workspace);
      if (benchmarkCase.reproduction_contract) {
        const output = execFileSync(
          process.execPath,
          ["repro/chunked-ndjson.mjs"],
          { cwd: workspace, encoding: "utf8" },
        );
        assert.deepEqual(
          JSON.parse(output),
          benchmarkCase.reproduction_contract.expected_output,
        );
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

test("reference repairs pass acceptance and candidate regressions kill every mutant", async () => {
  const suite = await loadDevelopmentSuite(suitePath);
  const root = await mkdtemp(path.join(os.tmpdir(), "lp-confirmatory-reference-"));
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

test("confirmatory inputs contain only repository-relative public fixture data", async () => {
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
