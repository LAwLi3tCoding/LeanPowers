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
  "../evals/development-effects/performance-confirmatory-suite.json",
  import.meta.url,
);

const frozen = {
  suite: "b038bf60cec48038818362c0a717fe7d5b98412590c228217bb534ec686546d7",
  cases: {
    "utf8-byte-chunks": {
      mutants_sha256: "b6db71d5ee278796f44e2aca01c59d81550c166be448ca1a85ba37d003c015b0",
      verifier_sha256: "714be9a2dbdf51dc5865af435313852cf830ab8bbaadacfd7ffb4ee52f126a5e",
      workspace_sha256: "4516fac38ca74fe8e4be13d1dc14f20dffcaf4bbe7eadfb26b9b211243f307cd",
    },
    "simultaneous-text-edits": {
      mutants_sha256: "f547fdad209a11fe27fe24dc1b910dff10bd675b126f2d8e380c523038391896",
      verifier_sha256: "ea3fe47022dd379b2df90db37271cb43313a83c184f688f4f4b735c95f69f185",
      workspace_sha256: "50358b23561e72690434e36fa2077c40cee211191cb0ce90581953f0d42cd3d2",
    },
    "snapshot-signal-dispatch": {
      mutants_sha256: "76e77c8e25139fdb581a42fe63282b649305949cd6a8814d8d5a8bcf89e42d42",
      verifier_sha256: "2602475e58fe13c0e007039cae3b2d4f76ee89c3eb71397b90a87ee1396d6525",
      workspace_sha256: "e58ce66bdc9d43481c43cb271fd9b15cffa61ec198753b4be60012ba1a70b99d",
    },
  },
};

const fixtures = {
  "utf8-byte-chunks": {
    target: "src/utf8-chunks.mjs",
    reference: `export function splitUtf8Chunks(text, maxBytes) {
  if (
    typeof text !== "string" ||
    !Number.isSafeInteger(maxBytes) ||
    maxBytes <= 0
  ) {
    throw new TypeError("invalid arguments");
  }
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = text.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) {
        throw new TypeError("unpaired surrogate");
      }
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      throw new TypeError("unpaired surrogate");
    }
  }

  const chunks = [];
  let current = "";
  let currentBytes = 0;
  for (const codePoint of text) {
    const codePointBytes = Buffer.byteLength(codePoint, "utf8");
    if (codePointBytes > maxBytes) {
      throw new RangeError("code point exceeds maxBytes");
    }
    if (currentBytes + codePointBytes > maxBytes) {
      chunks.push(current);
      current = codePoint;
      currentBytes = codePointBytes;
    } else {
      current += codePoint;
      currentBytes += codePointBytes;
    }
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}
`,
    regression: `import assert from "node:assert/strict";
import test from "node:test";
import { splitUtf8Chunks } from "../src/index.mjs";

test("packs by UTF-8 bytes without splitting code points", () => {
  assert.deepEqual(splitUtf8Chunks("Aé🍵B", 4), ["Aé", "🍵", "B"]);
  assert.deepEqual(splitUtf8Chunks("ééa", 4), ["éé", "a"]);
});
test("packs greedily through exact byte boundaries", () => {
  assert.deepEqual(splitUtf8Chunks("abcdef", 3), ["abc", "def"]);
  assert.deepEqual(splitUtf8Chunks("abcd", 4), ["abcd"]);
});
test("rejects an oversized code point", () => {
  assert.throws(() => splitUtf8Chunks("🍵", 3), RangeError);
});
test("rejects unpaired UTF-16 surrogates", () => {
  assert.throws(() => splitUtf8Chunks("\\uD800", 4), TypeError);
  assert.throws(() => splitUtf8Chunks("\\uDC00", 4), TypeError);
});
`,
  },
  "simultaneous-text-edits": {
    target: "src/text-edits.mjs",
    reference: `export function applyTextEdits(source, edits) {
  if (typeof source !== "string" || !Array.isArray(edits)) {
    throw new TypeError("invalid arguments");
  }
  const starts = new Set();
  const ordered = Array.from(edits, (edit) => {
    if (
      !Array.isArray(edit) ||
      edit.length !== 3 ||
      !Number.isSafeInteger(edit[0]) ||
      !Number.isSafeInteger(edit[1]) ||
      edit[0] < 0 ||
      edit[0] > edit[1] ||
      edit[1] > source.length ||
      typeof edit[2] !== "string" ||
      starts.has(edit[0])
    ) {
      throw new TypeError("invalid edit");
    }
    starts.add(edit[0]);
    return [...edit];
  }).sort((left, right) => left[0] - right[0]);

  let output = "";
  let cursor = 0;
  for (const [start, end, replacement] of ordered) {
    if (start < cursor) throw new TypeError("overlapping edits");
    output += source.slice(cursor, start) + replacement;
    cursor = end;
  }
  return output + source.slice(cursor);
}
`,
    regression: `import assert from "node:assert/strict";
import test from "node:test";
import { applyTextEdits } from "../src/index.mjs";

test("orders edits while using original coordinates", () => {
  assert.equal(
    applyTextEdits("0123456789", [[7, 9, "X"], [1, 3, "AB"], [5, 6, ""]]),
    "0AB346X9",
  );
  assert.equal(applyTextEdits("abcdef", [[1, 2, "LONG"], [4, 5, "Z"]]), "aLONGcdZf");
});
test("uses half-open ranges and permits adjacency", () => {
  assert.equal(applyTextEdits("abcdef", [[1, 3, "X"]]), "aXdef");
  assert.equal(applyTextEdits("abcdef", [[0, 2, "A"], [2, 4, "B"], [4, 6, "C"]]), "ABC");
});
test("rejects overlap and duplicate starts", () => {
  assert.throws(() => applyTextEdits("abcdef", [[1, 4, "x"], [3, 5, "y"]]), TypeError);
  assert.throws(() => applyTextEdits("abcdef", [[1, 1, "x"], [1, 2, "y"]]), TypeError);
  assert.throws(() => applyTextEdits("abcd", [[1, 3, "X"], [2, 2, "Y"]]), TypeError);
});
test("uses UTF-16 code-unit offsets", () => {
  assert.equal(applyTextEdits("A🍵B", [[1, 3, "tea"]]), "AteaB");
  assert.equal(applyTextEdits("A🍵B", [[3, 4, "!"]]), "A🍵!");
});
test("does not mutate caller-owned edits", () => {
  const edits = Object.freeze([
    Object.freeze([4, 6, "C"]),
    Object.freeze([0, 2, "A"]),
    Object.freeze([2, 4, "B"]),
  ]);
  assert.equal(applyTextEdits("abcdef", edits), "ABC");
});
`,
  },
  "snapshot-signal-dispatch": {
    target: "src/signal.mjs",
    reference: `export function createSignal() {
  const listeners = [];

  return {
    subscribe(listener) {
      if (typeof listener !== "function") {
        throw new TypeError("listener must be a function");
      }
      const record = { listener };
      listeners.push(record);
      let active = true;
      return () => {
        if (!active) return;
        active = false;
        const index = listeners.indexOf(record);
        if (index !== -1) listeners.splice(index, 1);
      };
    },
    emit(value) {
      for (const record of [...listeners]) {
        record.listener(value);
      }
    },
  };
}
`,
    regression: `import assert from "node:assert/strict";
import test from "node:test";
import { createSignal } from "../src/index.mjs";

test("current dispatch uses a snapshot for removals", () => {
  const signal = createSignal();
  const events = [];
  let unsubscribeLater;
  signal.subscribe((value) => {
    events.push("first:" + value);
    unsubscribeLater();
  });
  unsubscribeLater = signal.subscribe((value) => events.push("later:" + value));
  signal.emit("one");
  signal.emit("two");
  assert.deepEqual(events, ["first:one", "later:one", "first:two"]);
});
test("current dispatch excludes listeners added after its snapshot", () => {
  const signal = createSignal();
  const events = [];
  let added = false;
  signal.subscribe((value) => {
    events.push("first:" + value);
    if (!added) {
      added = true;
      signal.subscribe((next) => events.push("added:" + next));
    }
  });
  signal.emit("one");
  signal.emit("two");
  assert.deepEqual(events, ["first:one", "first:two", "added:two"]);
});
test("duplicate subscriptions have independent handles", () => {
  const signal = createSignal();
  const events = [];
  const listener = (value) => events.push(value);
  const unsubscribeFirst = signal.subscribe(listener);
  const unsubscribeSecond = signal.subscribe(listener);
  signal.emit("both");
  unsubscribeFirst();
  unsubscribeFirst();
  signal.emit("second-only");
  unsubscribeSecond();
  assert.deepEqual(events, ["both", "both", "second-only"]);
});
test("dispatch is synchronous and keeps subscription order", () => {
  const signal = createSignal();
  const events = [];
  signal.subscribe(() => events.push("first"));
  signal.subscribe(() => events.push("second"));
  signal.emit("value");
  events.push("after");
  assert.deepEqual(events, ["first", "second", "after"]);
});
test("nested emit snapshots independently", () => {
  const signal = createSignal();
  const events = [];
  let unsubscribeSecond;
  signal.subscribe((value) => {
    events.push("first:" + value);
    if (value === "outer") {
      unsubscribeSecond();
      signal.subscribe((next) => events.push("added:" + next));
      signal.emit("inner");
    }
  });
  unsubscribeSecond = signal.subscribe((value) => events.push("second:" + value));
  signal.emit("outer");
  assert.deepEqual(events, ["first:outer", "first:inner", "added:inner", "second:outer"]);
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

test("performance suite is a complete quality-first frozen contract", async () => {
  const suite = await loadDevelopmentSuite(suitePath);
  assert.equal(suite.suite_sha256, frozen.suite);
  assert.equal(suite.suite_id, "development-effects-performance-confirmatory-2026-07-15");
  assert.equal(suite.freeze_contract_verified, true);
  assert.equal(suite.freeze_contract.agent_read_isolation, HELDOUT_AGENT_READ_ISOLATION);
  assert.equal(suite.cases.length, 3);
  assert.deepEqual(suite.token_target, {
    metric: "aggregate-model-token-share",
    population: "all-matched-pairs",
    max_share_pct: 60,
  });
  assert.deepEqual(
    suite.cases.map(({ id, risk_level, expected_workflow }) => [id, risk_level, expected_workflow]),
    [
      ["utf8-byte-chunks", "standard", "build"],
      ["simultaneous-text-edits", "standard", "build"],
      ["snapshot-signal-dispatch", "standard", "debug"],
    ],
  );
  for (const benchmarkCase of suite.cases) {
    assert.deepEqual(caseSnapshotContract(benchmarkCase), frozen.cases[benchmarkCase.id]);
  }
});

test("performance fixtures pass visible checks and fail hidden acceptance before repair", async () => {
  const suite = await loadDevelopmentSuite(suitePath);
  const root = await mkdtemp(path.join(os.tmpdir(), "lp-performance-pristine-"));
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

test("performance references pass acceptance and candidate regressions kill every mutant", async () => {
  const suite = await loadDevelopmentSuite(suitePath);
  const root = await mkdtemp(path.join(os.tmpdir(), "lp-performance-reference-"));
  try {
    for (const benchmarkCase of suite.cases) {
      const workspace = path.join(root, benchmarkCase.id);
      const fixture = fixtures[benchmarkCase.id];
      await materializeWorkspaceSnapshot(benchmarkCase.workspace_snapshot, workspace);
      const baselineHead = initializeGit(workspace);
      await writeFile(path.join(workspace, fixture.target), fixture.reference);
      const regressionPath = "test/performance-regressions.test.mjs";
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
      assert.equal(await fingerprintBenchmarkWorkspace({ baselineHead, workspace }), fingerprint);
    }
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("performance inputs contain only repository-relative public fixture data", async () => {
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
