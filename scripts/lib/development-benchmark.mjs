import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { constants as fsConstants, realpathSync } from "node:fs";
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
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";

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
const VERIFIER_OUTPUT_LIMIT_BYTES = 2_000_000;
const VERIFIER_SANDBOX_MODES = new Set([
  "linux-bubblewrap-hermetic-v2",
  "macos-seatbelt-hermetic-v2",
]);
const ARTIFACT_GATE_POLICIES = new Set(["all-kill"]);
const DEVELOPMENT_EVIDENCE_LEVELS = new Set([
  "paired-development-heldout",
  "paired-development-pilot",
]);
const CODEX_CAPACITY_ERROR_MESSAGE =
  "Selected model is at capacity. Please try a different model.";
const LOWER_KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const SAFE_ARTIFACT_DIRECTORY_NAME = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/u;
export const HELDOUT_PERMISSION_PROFILE = "benchmark";
export const HELDOUT_AGENT_READ_ISOLATION =
  "codex-minimal-workspace-plugin-toolchain-read-v1";
const VERIFIER_SOURCE_PATHS = new WeakMap();
const REGEX_PREFIX_KEYWORDS = new Set([
  "await",
  "case",
  "delete",
  "do",
  "else",
  "in",
  "instanceof",
  "of",
  "return",
  "throw",
  "typeof",
  "void",
  "yield",
]);
const MACOS_VERIFIER_SANDBOX_PROFILE = [
  "(version 1)",
  "(deny default)",
  "(import \"system.sb\")",
  "(allow process*)",
  "(allow signal)",
  "(deny network*)",
  "(allow file-read-metadata)",
  "(allow file-read*",
  "  (subpath (param \"WORKSPACE\"))",
  "  (subpath (param \"SANDBOX_HOME\"))",
  "  (subpath \"/opt/homebrew\")",
  "  (subpath \"/usr/local\"))",
  "(deny file-read* (require-all",
  "  (subpath \"/Users\")",
  "  (require-not (subpath (param \"WORKSPACE\")))",
  "  (require-not (subpath (param \"SANDBOX_HOME\")))))",
  "(deny file-read* (subpath \"/Volumes\"))",
  "(deny file-read* (subpath \"/Network\"))",
  "(deny file-read* (require-all",
  "  (subpath \"/private/tmp\")",
  "  (require-not (subpath (param \"SANDBOX_ROOT\")))))",
  "(deny file-read* (require-all",
  "  (subpath (param \"HOST_TMP\"))",
  "  (require-not (subpath (param \"SANDBOX_ROOT\")))))",
  "(deny file-read*",
  "  (literal \"/private/etc/passwd\")",
  "  (literal \"/private/etc/master.passwd\")",
  "  (literal \"/private/etc/group\")",
  "  (literal \"/private/etc/hosts\"))",
  "(allow file-write*",
  "  (subpath (param \"SANDBOX_HOME\"))",
  "  (literal \"/dev/null\"))",
].join("\n");

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
  const suiteSource = await readFile(suiteUrl, "utf8");
  const suite = JSON.parse(suiteSource);
  suite.suite_sha256 = createHash("sha256").update(suiteSource).digest("hex");
  const errors = [];
  const suiteRoot = await realpath(fileURLToPath(new URL(".", suiteUrl)));

  if (suite.schema_version !== 2) errors.push("schema_version must equal 2");
  if (!DEVELOPMENT_EVIDENCE_LEVELS.has(suite.evidence_level)) {
    errors.push(
      "evidence_level must equal paired-development-pilot or paired-development-heldout",
    );
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
  if (
    suite.report_contract !== undefined &&
    suite.report_contract !== "categorized-exact-render-v1"
  ) {
    errors.push("report_contract must equal categorized-exact-render-v1 when provided");
  }
  if (suite.token_target !== undefined) {
    const target = suite.token_target;
    if (
      target === null ||
      typeof target !== "object" ||
      Array.isArray(target) ||
      Object.keys(target).sort().join(",") !==
        "max_share_pct,metric,population" ||
      target.metric !== "aggregate-model-token-share" ||
      target.population !== "all-matched-pairs" ||
      !Number.isFinite(target.max_share_pct) ||
      target.max_share_pct <= 0 ||
      target.max_share_pct > 100
    ) {
      errors.push(
        "token_target must be a closed aggregate-model-token-share target for all-matched-pairs with max_share_pct in (0, 100]",
      );
    }
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
      if (
        typeof benchmarkCase?.id !== "string" ||
        !LOWER_KEBAB_CASE.test(benchmarkCase.id) ||
        ids.has(benchmarkCase.id)
      ) {
        errors.push(`cases[${index}].id must be unique lower-kebab-case`);
      }
      ids.add(benchmarkCase?.id);
      if (!benchmarkCase?.scenario_class || !benchmarkCase?.task) {
        errors.push(`cases[${index}] must declare scenario_class and task`);
      }
      if (
        benchmarkCase?.reporting_category !== undefined &&
        (
          typeof benchmarkCase.reporting_category !== "string" ||
          benchmarkCase.reporting_category.trim() !== benchmarkCase.reporting_category ||
          benchmarkCase.reporting_category.length < 1 ||
          benchmarkCase.reporting_category.length > 80
        )
      ) {
        errors.push(`cases[${index}].reporting_category must be 1-80 trimmed characters`);
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
      let workspacePath = null;
      try {
        const workspaceUrl = new URL(benchmarkCase.workspace, suiteUrl);
        const workspaceStat = await lstat(workspaceUrl);
        workspacePath = await realpath(fileURLToPath(workspaceUrl));
        if (
          !workspaceStat.isDirectory() ||
          !isSameOrAncestor(suiteRoot, workspacePath)
        ) {
          errors.push(`cases[${index}].workspace must be a direct directory inside the suite root`);
          workspacePath = null;
        } else {
          benchmarkCase.workspace_snapshot = await snapshotWorkspaceDirectory(
            workspacePath,
          );
        }
      } catch {
        errors.push(`cases[${index}].workspace must be a readable direct directory`);
      }
      if (Array.isArray(benchmarkCase?.verifier_files)) {
        benchmarkCase.verifier_snapshots = [];
        for (const [verifierIndex, verifierFile] of benchmarkCase.verifier_files.entries()) {
          try {
            const verifierUrl = new URL(verifierFile, suiteUrl);
            const verifierStat = await lstat(verifierUrl);
            const verifierPath = await realpath(fileURLToPath(verifierUrl));
            if (
              !verifierStat.isFile() ||
              !isSameOrAncestor(suiteRoot, verifierPath) ||
              (workspacePath !== null && isSameOrAncestor(workspacePath, verifierPath))
            ) {
              errors.push(
                `cases[${index}].verifier_files[${verifierIndex}] must be a direct file inside the suite root and outside the candidate workspace`,
              );
            } else {
              const source = await readFile(verifierPath, "utf8");
              const verifierSnapshot = {
                sha256: createHash("sha256").update(source).digest("hex"),
                source,
              };
              VERIFIER_SOURCE_PATHS.set(verifierSnapshot, verifierPath);
              benchmarkCase.verifier_snapshots.push(verifierSnapshot);
            }
          } catch {
            errors.push(
              `cases[${index}].verifier_files[${verifierIndex}] must be a readable direct file`,
            );
          }
        }
      }
      if (
        !Array.isArray(benchmarkCase?.change_policy?.product) ||
        benchmarkCase.change_policy.product.length === 0 ||
        !Array.isArray(benchmarkCase?.change_policy?.tests) ||
        benchmarkCase.change_policy.tests.length === 0 ||
        !Array.isArray(benchmarkCase?.change_policy?.workflow) ||
        benchmarkCase.change_policy.workflow.length === 0
      ) {
        errors.push(`cases[${index}].change_policy must declare product, tests, and workflow globs`);
      }
      if (benchmarkCase?.expected_workflow === "debug") {
        const contract = benchmarkCase?.reproduction_contract;
        if (
          typeof contract?.command !== "string" ||
          canonicalReproductionCommand(contract.command) !== contract.command
        ) {
          errors.push(`cases[${index}].reproduction_contract.command must be one canonical executable command`);
        }
        if (
          contract?.expected_output === null ||
          typeof contract?.expected_output !== "object" ||
          Array.isArray(contract?.expected_output)
        ) {
          errors.push(`cases[${index}].reproduction_contract.expected_output must be an object`);
        }
        if (
          contract?.resolved_output !== undefined &&
          (contract.resolved_output === null ||
            typeof contract.resolved_output !== "object" ||
            Array.isArray(contract.resolved_output))
        ) {
          errors.push(`cases[${index}].reproduction_contract.resolved_output must be an object when provided`);
        }
      }
      const artifactGates = benchmarkCase?.artifact_regression_gates;
      if (artifactGates !== undefined) {
        if (!Array.isArray(artifactGates) || artifactGates.length === 0) {
          errors.push(`cases[${index}].artifact_regression_gates must be a non-empty array`);
        } else {
          const gateIds = new Set();
          for (const [gateIndex, gate] of artifactGates.entries()) {
            const label = `cases[${index}].artifact_regression_gates[${gateIndex}]`;
            if (
              typeof gate?.id !== "string" ||
              !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(gate.id) ||
              gateIds.has(gate.id)
            ) {
              errors.push(`${label}.id must be unique lower-kebab-case`);
            }
            gateIds.add(gate?.id);
            if (!ARTIFACT_GATE_POLICIES.has(gate?.policy)) {
              errors.push(`${label}.policy must be all-kill`);
            }
            const mutations = gate?.mutations;
            if (
              !Array.isArray(mutations) ||
              mutations.length === 0
            ) {
              errors.push(`${label}.mutations must be a non-empty policy-valid array`);
              continue;
            }
            const productPatterns = benchmarkCase?.change_policy?.product ?? [];
            const testPatterns = benchmarkCase?.change_policy?.tests ?? [];
            const workflowPatterns = benchmarkCase?.change_policy?.workflow ?? [];
            const mutationSources = new Set();
            const mutationTargets = new Set();
            const mutationExportNames = new Set();
            const replacementHashes = new Set();
            for (const [mutationIndex, mutation] of mutations.entries()) {
              const mutationLabel = `${label}.mutations[${mutationIndex}]`;
              if (
                mutation?.kind !== "replace-callable-export" ||
                typeof mutation?.export_name !== "string" ||
                mutation.export_name === "default" ||
                !/^[A-Za-z_$][A-Za-z0-9_$]*$/u.test(mutation.export_name) ||
                !isSafeRelativePath(mutation?.target) ||
                !isSafeRelativePath(mutation?.source)
              ) {
                errors.push(`${mutationLabel} must declare a safe replace-callable-export target, source, and export name`);
                continue;
              }
              if (mutationSources.has(mutation.source)) {
                errors.push(`${label}.mutations must use unique source files`);
              }
              mutationSources.add(mutation.source);
              mutationTargets.add(mutation.target);
              mutationExportNames.add(mutation.export_name);
              if (
                !productPatterns.some((pattern) => matchGlob(mutation.target, pattern)) ||
                testPatterns.some((pattern) => matchGlob(mutation.target, pattern)) ||
                workflowPatterns.some((pattern) => matchGlob(mutation.target, pattern))
              ) {
                errors.push(`${mutationLabel}.target must address product code, not tests or workflow files`);
              }
              try {
                const sourceUrl = new URL(mutation.source, suiteUrl);
                const sourceStat = await lstat(sourceUrl);
                if (!sourceStat.isFile()) {
                  errors.push(`${mutationLabel}.source must be a regular file`);
                  continue;
                }
                const sourcePath = await realpath(fileURLToPath(sourceUrl));
                if (!isSameOrAncestor(suiteRoot, sourcePath)) {
                  errors.push(`${mutationLabel}.source must resolve inside the suite root`);
                  continue;
                }
                if (workspacePath !== null && isSameOrAncestor(workspacePath, sourcePath)) {
                  errors.push(`${mutationLabel}.source must stay outside the candidate workspace`);
                  continue;
                }
                const replacement = await readFile(sourcePath, "utf8");
                try {
                  await assertJavaScriptSourceSyntax({
                    environment: benchmarkEnvironment(os.tmpdir(), {
                      TMPDIR: os.tmpdir(),
                    }),
                    source: replacement,
                    workspace: suiteRoot,
                  });
                } catch {
                  errors.push(`${mutationLabel}.source must be syntactically valid`);
                  continue;
                }
                let replacementFragment;
                try {
                  replacementFragment = directNamedFunctionExportFragment(
                    replacement,
                    mutation.export_name,
                  );
                } catch {
                  errors.push(
                    `${mutationLabel}.source must contain only one direct named function export`,
                  );
                  continue;
                }
                const replacementSha256 =
                  createHash("sha256").update(replacementFragment).digest("hex");
                if (replacementHashes.has(replacementSha256)) {
                  errors.push(`${label}.mutations must have unique replacement content`);
                }
                replacementHashes.add(replacementSha256);
                mutation.replacement = replacementFragment;
                mutation.replacement_sha256 = replacementSha256;
              } catch {
                errors.push(`${mutationLabel}.source must be a readable regular file`);
              }
            }
            if (mutationTargets.size !== 1) {
              errors.push(`${label}.mutations must replace one shared product target`);
            }
            if (mutationExportNames.size !== 1) {
              errors.push(`${label}.mutations must replace one shared named export`);
            }
            if (
              ARTIFACT_GATE_POLICIES.has(gate?.policy) &&
              mutations.every((mutation) =>
                typeof mutation?.replacement === "string" &&
                /^[a-f0-9]{64}$/u.test(String(mutation?.replacement_sha256 ?? ""))
              ) &&
              mutationTargets.size === 1 &&
              mutationExportNames.size === 1
            ) {
              gate.target = mutations[0].target;
              gate.export_name = mutations[0].export_name;
              gate.mutation_manifest_sha256 = artifactGateMutationManifestSha256(gate);
            }
          }
        }
      }
    }
  }

  if (suite.case_order !== undefined) {
    const caseIds = Array.isArray(suite.cases)
      ? suite.cases.map(({ id }) => id)
      : [];
    if (
      !Array.isArray(suite.case_order) ||
      suite.case_order.length !== suite.repetitions ||
      suite.case_order.some((order) =>
        !Array.isArray(order) ||
        order.length !== caseIds.length ||
        new Set(order).size !== order.length ||
        !isDeepStrictEqual([...order].sort(), [...caseIds].sort())
      )
    ) {
      errors.push(
        "case_order must define one exact permutation of all case ids per repetition",
      );
    }
  }

  if (suite.evidence_level === "paired-development-heldout") {
    let freezeContractVerified = false;
    try {
      const caseSnapshots = Object.fromEntries(suite.cases.map((benchmarkCase) => [
        benchmarkCase.id,
        caseSnapshotContract(benchmarkCase),
      ]));
      const expectedFreezeContract = {
        status: "frozen-before-live-run",
        model_default: suite.model_default,
        effort: suite.effort,
        repetitions: suite.repetitions,
        workflow_order: suite.workflow_order,
        ...(suite.case_order === undefined
          ? {}
          : { case_order: suite.case_order }),
        agent_read_isolation: HELDOUT_AGENT_READ_ISOLATION,
        superpowers_revision: suite.freeze_contract?.superpowers_revision,
        ...(suite.freeze_contract?.leanpowers_revision === undefined
          ? {}
          : { leanpowers_revision: suite.freeze_contract.leanpowers_revision }),
        ...(suite.freeze_contract?.evaluator_revision === undefined
          ? {}
          : { evaluator_revision: suite.freeze_contract.evaluator_revision }),
        ...(suite.freeze_contract?.runner_revision === undefined
          ? {}
          : { runner_revision: suite.freeze_contract.runner_revision }),
        case_snapshots: caseSnapshots,
        ...(suite.token_target === undefined
          ? {}
          : { token_target: suite.token_target }),
      };
      const pinnedRevisions = [
        suite.freeze_contract?.leanpowers_revision,
        suite.freeze_contract?.evaluator_revision,
        suite.freeze_contract?.runner_revision,
      ];
      const pinnedRevisionContractValid =
        pinnedRevisions.every((value) => value === undefined) ||
        pinnedRevisions.every((value) => /^[a-f0-9]{40}$/u.test(String(value)));
      freezeContractVerified =
        /^[a-f0-9]{40}$/u.test(String(
          suite.freeze_contract?.superpowers_revision ?? "",
        )) &&
        pinnedRevisionContractValid &&
        isDeepStrictEqual(suite.freeze_contract, expectedFreezeContract);
    } catch {
      freezeContractVerified = false;
    }
    suite.freeze_contract_verified = freezeContractVerified;
    if (!freezeContractVerified) {
      errors.push(
        "paired-development-heldout requires an exact frozen model, matrix, read-isolation policy, baseline revision, and case snapshot contract",
      );
    }
  }

  if (errors.length > 0) {
    throw new Error(`Invalid development benchmark suite:\n${errors.join("\n")}`);
  }
  return suite;
}

export function assertFrozenHeldoutSelection(
  suite,
  { caseIds, model, repetitions } = {},
) {
  if (suite?.evidence_level !== "paired-development-heldout") return;
  if (suite.freeze_contract_verified !== true) {
    throw new Error("Held-out runs require a verified freeze contract");
  }
  if (model !== undefined && model !== suite.model_default) {
    throw new Error("Held-out runs must use the frozen default model");
  }
  if (repetitions !== undefined && repetitions !== suite.repetitions) {
    throw new Error("Held-out runs must execute every frozen repetition");
  }
  if (caseIds?.length) {
    const requested = [...new Set(caseIds)].sort();
    const frozen = suite.cases.map(({ id }) => id).sort();
    if (
      requested.length !== caseIds.length ||
      !isDeepStrictEqual(requested, frozen)
    ) {
      throw new Error("Held-out runs must execute every frozen case exactly once");
    }
  }
}

export function assertFrozenHeldoutRevisions(
  suite,
  { evaluatorRevision, runnerRevision, workflowRevisions } = {},
) {
  if (suite?.evidence_level !== "paired-development-heldout") return;
  const freeze = suite.freeze_contract ?? {};
  const legacyRevisionContract = freeze.leanpowers_revision === undefined &&
    freeze.evaluator_revision === undefined &&
    freeze.runner_revision === undefined;
  if (
    !/^[a-f0-9]{40}$/u.test(String(evaluatorRevision ?? "")) ||
    (!legacyRevisionContract &&
      !/^[a-f0-9]{40}$/u.test(String(runnerRevision ?? ""))) ||
    workflowRevisions?.["superpowers-6.1.1"] !==
      freeze.superpowers_revision ||
    (legacyRevisionContract
      ? evaluatorRevision !== workflowRevisions?.["leanpowers-0.2.0"]
      : workflowRevisions?.["leanpowers-0.2.0"] !== freeze.leanpowers_revision ||
        evaluatorRevision !== freeze.evaluator_revision ||
        runnerRevision !== freeze.runner_revision)
  ) {
    throw new Error(
      "Held-out evaluator, LeanPowers plugin, or Superpowers baseline revision did not match the freeze contract",
    );
  }
}

async function snapshotWorkspaceDirectory(workspace) {
  const entries = [];
  const visit = async (directory, relativeDirectory = "") => {
    const children = await readdir(directory, { withFileTypes: true });
    children.sort((left, right) =>
      left.name < right.name ? -1 : left.name > right.name ? 1 : 0
    );
    for (const child of children) {
      const relativePath = relativeDirectory
        ? `${relativeDirectory}/${child.name}`
        : child.name;
      if (!isSafeWorkspaceSnapshotPath(relativePath)) {
        throw new Error("workspace snapshot contained a reserved or unsafe path");
      }
      const target = path.join(directory, child.name);
      const stat = await lstat(target);
      if (stat.isSymbolicLink()) {
        throw new Error("workspace snapshots do not support symlinks");
      }
      if (stat.isDirectory()) {
        entries.push({ kind: "directory", path: relativePath });
        await visit(target, relativePath);
      } else if (stat.isFile()) {
        entries.push({
          contents_base64: (await readFile(target)).toString("base64"),
          executable: (stat.mode & 0o111) !== 0,
          kind: "file",
          path: relativePath,
        });
      } else {
        throw new Error("workspace snapshot contained an unsupported entry");
      }
    }
  };
  await visit(workspace);
  entries.sort((left, right) =>
    left.path < right.path ? -1 : left.path > right.path ? 1 : 0
  );
  return {
    entries,
    sha256: workspaceSnapshotSha256(entries),
  };
}

function workspaceSnapshotSha256(entries) {
  if (!Array.isArray(entries)) {
    throw new Error("workspace snapshot entries were malformed");
  }
  const hash = createHash("sha256");
  const paths = new Set();
  const directories = new Set();
  let previousPath = null;
  for (const entry of entries) {
    if (
      entry === null ||
      typeof entry !== "object" ||
      !isSafeWorkspaceSnapshotPath(entry.path) ||
      paths.has(entry.path) ||
      (previousPath !== null && entry.path <= previousPath) ||
      !["directory", "file"].includes(entry.kind)
    ) {
      throw new Error("workspace snapshot entry was malformed or duplicated");
    }
    const parent = path.posix.dirname(entry.path);
    if (parent !== "." && !directories.has(parent)) {
      throw new Error("workspace snapshot entry was missing its parent directory");
    }
    previousPath = entry.path;
    paths.add(entry.path);
    if (entry.kind === "directory") {
      if (Object.keys(entry).sort().join(",") !== "kind,path") {
        throw new Error("workspace snapshot directory entry was not closed");
      }
      directories.add(entry.path);
      updateFingerprint(hash, `directory:${entry.path}`, "");
      continue;
    }
    if (
      Object.keys(entry).sort().join(",") !==
        "contents_base64,executable,kind,path" ||
      typeof entry.executable !== "boolean" ||
      typeof entry.contents_base64 !== "string"
    ) {
      throw new Error("workspace snapshot file entry was not closed");
    }
    const contents = Buffer.from(entry.contents_base64, "base64");
    if (contents.toString("base64") !== entry.contents_base64) {
      throw new Error("workspace snapshot file content was not canonical base64");
    }
    updateFingerprint(
      hash,
      `file:${entry.path}:${entry.executable ? "executable" : "regular"}`,
      contents,
    );
  }
  return hash.digest("hex");
}

function isSafeWorkspaceSnapshotPath(value) {
  return isSafeRelativePath(value) &&
    !value.includes("\\") &&
    path.posix.normalize(value) === value &&
    value.split("/")[0] !== ".git";
}

export async function materializeWorkspaceSnapshot(snapshot, workspace) {
  if (
    snapshot === null ||
    typeof snapshot !== "object" ||
    !/^[a-f0-9]{64}$/u.test(String(snapshot.sha256 ?? "")) ||
    workspaceSnapshotSha256(snapshot.entries) !== snapshot.sha256
  ) {
    throw new Error("workspace snapshot manifest did not match its entries");
  }
  await mkdir(workspace, { recursive: true });
  for (const entry of snapshot.entries) {
    const target = path.join(workspace, entry.path);
    if (entry.kind === "directory") {
      await mkdir(target, { recursive: true });
      continue;
    }
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, Buffer.from(entry.contents_base64, "base64"));
    await chmod(target, entry.executable ? 0o755 : 0o644);
  }
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

export function renderHeldoutCodexProfile({
  authFile,
  pluginRoot,
  runtimeReadRoots = [],
}) {
  const requiredPaths = [authFile, pluginRoot, ...runtimeReadRoots];
  if (requiredPaths.some((entry) =>
    typeof entry !== "string" || !path.isAbsolute(entry)
  )) {
    throw new Error("Held-out permission paths must be absolute");
  }
  const readRoots = [...new Set(runtimeReadRoots.map((entry) => path.resolve(entry)))]
    .sort();
  if (readRoots.some((entry) =>
    entry === path.parse(entry).root ||
    isSameOrAncestor(entry, PROJECT_ROOT) ||
    isSameOrAncestor(entry, path.resolve(authFile))
  )) {
    throw new Error("Held-out toolchain read root is too broad");
  }
  return [
    `default_permissions = ${JSON.stringify(HELDOUT_PERMISSION_PROFILE)}`,
    "",
    `[permissions.${HELDOUT_PERMISSION_PROFILE}.filesystem]`,
    '":minimal" = "read"',
    '":workspace_roots" = "write"',
    '":tmpdir" = "write"',
    `${JSON.stringify(path.resolve(pluginRoot))} = "read"`,
    ...readRoots.map((entry) => `${JSON.stringify(entry)} = "read"`),
    `${JSON.stringify(path.resolve(authFile))} = "none"`,
    "",
    `[permissions.${HELDOUT_PERMISSION_PROFILE}.network]`,
    "enabled = false",
    "",
  ].join("\n");
}

export function buildCodexArgs({
  model,
  prompt,
  workspace,
  effort = "low",
  permissionProfile,
}) {
  const args = [
    "exec",
    "--json",
  ];
  if (permissionProfile === undefined) {
    args.push("--sandbox", "workspace-write");
  } else {
    if (!/^[a-z][a-z0-9-]*$/u.test(permissionProfile)) {
      throw new Error("Codex permission profile name is invalid");
    }
    args.push("--strict-config", "--profile", permissionProfile);
  }
  args.push(
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
  );
  return args;
}

export function buildCodexPermissionSelectionArgs() {
  return [
    "--profile",
    HELDOUT_PERMISSION_PROFILE,
    "debug",
    "prompt-input",
    "permission-profile-selection-probe",
  ];
}

function heldoutAgentEnvironment(home, overrides = {}) {
  return benchmarkEnvironment(home, {
    HOME: path.join(home, "tmp", "home"),
    OPENSSL_CONF: "/dev/null",
    ...overrides,
  });
}

async function configureHeldoutCodexHome(home, toolchain) {
  const scratchHome = path.join(home, "tmp", "home");
  await mkdir(scratchHome, { recursive: true });
  await writeFile(
    path.join(home, `${HELDOUT_PERMISSION_PROFILE}.config.toml`),
    renderHeldoutCodexProfile({
      authFile: path.join(home, "auth.json"),
      pluginRoot: path.join(home, "plugins"),
      runtimeReadRoots: toolchain.runtimeReadRoots,
    }),
  );
}

async function findFirstSkillFile(root) {
  const entries = await readdir(root, { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name));
  for (const entry of entries) {
    const target = path.join(root, entry.name);
    if (entry.isFile() && entry.name === "SKILL.md") return target;
    if (entry.isDirectory()) {
      const nested = await findFirstSkillFile(target);
      if (nested !== null) return nested;
    }
  }
  return null;
}

export async function preflightHeldoutAgentReadIsolation({
  benchmarkCase,
  codexExecutable,
  codexHome,
  toolchain,
}) {
  const runRoot = await mkdtemp(path.join(os.tmpdir(), "leanpowers-isolation-preflight-"));
  const workspace = path.join(runRoot, "workspace");
  const runHome = path.join(runRoot, "home");
  try {
    await materializeWorkspaceSnapshot(
      benchmarkCase.workspace_snapshot,
      workspace,
    );
    await cp(codexHome, runHome, { recursive: true });
    await configureHeldoutCodexHome(runHome, toolchain);
    await initializeGit(workspace, toolchain);
    const skillFile = await findFirstSkillFile(path.join(runHome, "plugins"));
    if (skillFile === null) {
      throw new Error("Held-out read-isolation preflight could not locate an installed skill");
    }
    const evaluatorSentinel = path.join(PROJECT_ROOT, "package.json");
    const hiddenVerifier = VERIFIER_SOURCE_PATHS.get(
      benchmarkCase.verifier_snapshots?.[0],
    );
    if (typeof hiddenVerifier !== "string") {
      throw new Error(
        "Held-out read-isolation preflight could not resolve the loaded verifier source",
      );
    }
    await access(hiddenVerifier, fsConstants.R_OK);
    const probeTarget = path.join(workspace, ".leanpowers-permission-probe");
    const probeScript = [
      'const fs = require("node:fs");',
      "const [workspaceFile, writeTarget, pluginFile, ...blockedFiles] = process.argv.slice(1);",
      "fs.readFileSync(workspaceFile);",
      "fs.readFileSync(pluginFile);",
      'fs.writeFileSync(writeTarget, "probe\\n");',
      "fs.unlinkSync(writeTarget);",
      "for (const blockedFile of blockedFiles) {",
      "  try {",
      "    fs.readFileSync(blockedFile);",
      "    process.exit(42);",
      "  } catch (error) {",
      "    if (error?.code === undefined) throw error;",
      "  }",
      "}",
    ].join("\n");
    const env = heldoutAgentEnvironment(runHome, toolchain.environment);
    const selectionProbe = await runProcess(
      codexExecutable,
      buildCodexPermissionSelectionArgs(),
      { cwd: workspace, env, maxOutputBytes: 2_000_000, timeoutMs: 60_000 },
    );
    let selectionText = "";
    try {
      const promptInput = JSON.parse(selectionProbe.stdout);
      selectionText = promptInput.flatMap((message) => message.content ?? [])
        .filter(({ type, text: inputText }) =>
          type === "input_text" && typeof inputText === "string"
        )
        .map(({ text: inputText }) => inputText)
        .join("\n");
    } catch {
      selectionText = "";
    }
    const canonicalWorkspace = await realpath(workspace);
    const canonicalScratch = await realpath(path.join(runHome, "tmp"));
    const canonicalAuthFile = await realpath(path.join(runHome, "auth.json"));
    if (
      selectionProbe.exitCode !== 0 ||
      selectionProbe.timedOut ||
      selectionProbe.signal !== null ||
      selectionProbe.outputLimitExceeded ||
      !selectionText.includes("Network access is restricted.") ||
      !selectionText.includes("Denied filesystem reads") ||
      !selectionText.includes(canonicalWorkspace) ||
      !selectionText.includes(canonicalScratch) ||
      !selectionText.includes(canonicalAuthFile)
    ) {
      throw new Error("Held-out default-permissions selection probe failed");
    }
    const runSandboxed = (command, args) => runProcess(
      codexExecutable,
      [
        "sandbox",
        "--permissions-profile",
        HELDOUT_PERMISSION_PROFILE,
        "--profile",
        HELDOUT_PERMISSION_PROFILE,
        "-C",
        workspace,
        command,
        ...args,
      ],
      { cwd: workspace, env, timeoutMs: 60_000 },
    );
    const nodeProbe = await runSandboxed(toolchain.node, [
      "--eval",
      probeScript,
      path.join(workspace, "package.json"),
      probeTarget,
      skillFile,
      evaluatorSentinel,
      path.join(runHome, "auth.json"),
      hiddenVerifier,
    ]);
    if (
      nodeProbe.exitCode !== 0 ||
      nodeProbe.timedOut ||
      nodeProbe.signal !== null
    ) {
      throw new Error("Held-out read-isolation filesystem probe failed");
    }
    const npmProbe = await runSandboxed(toolchain.npm, ["test"]);
    if (
      npmProbe.exitCode !== 0 ||
      npmProbe.timedOut ||
      npmProbe.signal !== null
    ) {
      throw new Error("Held-out read-isolation validation-command probe failed");
    }
    const gitProbe = await runSandboxed(toolchain.git, ["status", "--short"]);
    if (
      gitProbe.exitCode !== 0 ||
      gitProbe.timedOut ||
      gitProbe.signal !== null ||
      gitProbe.stdout.trim() !== ""
    ) {
      throw new Error("Held-out read-isolation Git probe failed");
    }
    return {
      agent_read_isolation: HELDOUT_AGENT_READ_ISOLATION,
      permission_profile: HELDOUT_PERMISSION_PROFILE,
      status: "PASS",
    };
  } finally {
    await rm(runRoot, { force: true, recursive: true });
  }
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
  const rawTokenFields = {
    input: usage?.input_tokens,
    output: usage?.output_tokens,
    cache_creation_input: usage?.cache_creation_input_tokens,
    cache_read_input: usage?.cache_read_input_tokens,
  };
  const hasTokenTelemetry = Object.values(rawTokenFields).some(
    (value) => value !== undefined,
  );
  const tokenFields = Object.fromEntries(Object.entries(rawTokenFields).map(
    ([key, value]) => [key, nonNegativeSafeInteger(value)],
  ));
  const tokenTelemetryValid = Object.values(rawTokenFields).every(
    (value) => value === undefined || nonNegativeSafeInteger(value) !== null,
  );
  const tokens = hasTokenTelemetry && tokenTelemetryValid
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
    changePolicy = null,
    expectedReviewContract = null,
    expectedWorkflow = null,
    reproductionContract = null,
    reviewerWorkspaceMutations = new Map(),
    workspace = null,
  } = {},
) {
  const events = parseCodexEvents(raw);
  const parseCurrentValidationCommand = (command) =>
    parsePostChangeValidationCommand(
      command,
      expectedWorkflow,
      reproductionContract,
      workspace,
    )?.command ?? null;
  const usageEvent = [...events].reverse().find((event) => event?.type === "turn.completed");
  const usage = usageEvent?.usage;
  const hasUsage = Boolean(usage) && [
    usage.input_tokens,
    usage.cached_input_tokens,
    usage.output_tokens,
    usage.reasoning_output_tokens,
  ].some((value) => value !== undefined);
  const input = nonNegativeSafeInteger(usage?.input_tokens);
  const cachedInput = nonNegativeSafeInteger(usage?.cached_input_tokens);
  const output = nonNegativeSafeInteger(usage?.output_tokens);
  const cacheValid = input !== null && cachedInput !== null && cachedInput >= 0 && cachedInput <= input;
  const total = input !== null && output !== null && input + output > 0
    ? input + output
    : null;
  const telemetryComplete = cacheValid && output !== null && total !== null;
  const completedItems = events.filter((event) => event?.type === "item.completed");
  const agentMessageItems = completedItems.filter(
    (event) => event?.item?.type === "agent_message",
  );
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
    (event) => isCompletedFileChange(event),
  );
  const firstFileChangeIndex = events.findIndex(
    (event) => isCompletedFileChange(event),
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
      const lastFileChangeBeforeSpawnIndex = events.findLastIndex(
        (candidate, candidateIndex) =>
          candidateIndex < index && isCompletedFileChange(candidate),
      );
      const reviewValidationCommands = events.flatMap((candidate, candidateIndex) =>
        candidateIndex > lastFileChangeBeforeSpawnIndex &&
          candidateIndex < index &&
          candidate?.type === "item.completed" &&
          candidate?.item?.type === "command_execution" &&
          candidate.item.status === "completed"
          ? [{ event: candidate, index: candidateIndex }]
          : []
      );
      const reviewValidation = parseSupportedPostChangeValidation(
        reviewValidationCommands,
        expectedWorkflow,
        reproductionContract,
        events.map((candidate, candidateIndex) => ({
          event: candidate,
          index: candidateIndex,
        })),
        workspace,
      );
      const currentSpawnId = item.id;
      const validationFreshAtSpawn = reviewValidation !== null &&
        postBoundaryActivityIsReadOnly(
          events.flatMap((candidate, candidateIndex) =>
            candidateIndex < index &&
              !(
                typeof currentSpawnId === "string" &&
                candidate?.item?.type === "collab_tool_call" &&
                candidate.item.tool === "spawn_agent" &&
                candidate.item.id === currentSpawnId
              )
              ? [{ event: candidate, index: candidateIndex }]
              : []
          ),
          reviewValidation?.final_index ?? -1,
          workspace,
        );
      for (const agentId of item.receiver_thread_ids ?? []) {
        reviewAgentSpawns.set(agentId, {
          contract_verbatim: hasExactCodexReviewContract(
            item.prompt,
            expectedReviewContract,
          ),
          quality_context_complete: reviewPromptContainsContract(
            item.prompt,
            expectedReviewContract,
          ),
          quality_current_validation_observed: validationFreshAtSpawn,
          packet: parseCompleteCodexReviewPacket(
            item.prompt,
            expectedReviewContract,
            observedChangedPaths,
            parseCurrentValidationCommand,
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
      const currentWaitId = item.id;
      const reviewWindowEvents = events.flatMap((candidate, candidateIndex) =>
        candidateIndex < index &&
          !(
            typeof currentWaitId === "string" &&
            candidate?.item?.type === "collab_tool_call" &&
            candidate.item.tool === "wait" &&
            candidate.item.id === currentWaitId
          )
          ? [{ event: candidate, index: candidateIndex }]
          : []
      );
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
            quality_verdict:
              state?.status === "completed"
                ? classifyQualityReviewVerdict(state?.message)
                : null,
            quality_context_complete: spawn.quality_context_complete,
            quality_current_validation_observed:
              spawn.quality_current_validation_observed,
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
        latestIndependentReview = {
          contract_verbatim: completedReviews.every(
            (review) => review.contract_verbatim,
          ),
          pass: completedReviews.every((review) => review.verdict === "pass"),
          quality_context_complete: completedReviews.every(
            (review) => review.quality_context_complete,
          ),
          quality_current_validation_observed: completedReviews.every(
            (review) =>
              review.quality_current_validation_observed &&
              postBoundaryActivityIsReadOnly(
                reviewWindowEvents,
                review.spawn_index,
                workspace,
              ),
          ),
          quality_pass: completedReviews.every(
            (review) => review.quality_verdict === "pass",
          ),
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
          wait_index: index,
        };
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
        const command = parseCurrentValidationCommand(event.item.command);
        return command !== null && command === review.test_command;
      });
      if (!currentValidationObserved) return false;
      const isFinalCycle = cycleIndex === reviewCycles.length - 1;
      if (isFinalCycle) {
        return review.spawn_index > finalFileChangeIndex && review.verdict === "pass";
      }
      return review.verdict === "changes_required";
    });
  const finalStrictReviewWaitIndex = latestIndependentReview?.wait_index ?? -1;
  const strictFinalStopObserved =
    latestIndependentReview?.quality_pass === true &&
    finalStrictReviewWaitIndex >= 0 &&
    postBoundaryActivityIsReadOnly(
      events.map((event, index) => ({ event, index })),
      finalStrictReviewWaitIndex,
      workspace,
    );
  const finalMessage = [...events].reverse().find(
    (event) => event?.type === "item.completed" && event?.item?.type === "agent_message",
  );
  const firstProgressMessage = events.find(
    (event) => event?.type === "item.completed" && event?.item?.type === "agent_message",
  );
  const capsuleStage = traceCapsuleStage(
    events,
    expectedWorkflow,
    changePolicy,
    reproductionContract,
    expectedReviewContract,
    workspace,
  );
  return {
    completed:
      Boolean(usageEvent) &&
      !events.some((event) => event?.type === "turn.failed" || event?.type === "error"),
    final_message: typeof finalMessage?.item?.text === "string" ? finalMessage.item.text : "",
    first_progress_message:
      typeof firstProgressMessage?.item?.text === "string" ? firstProgressMessage.item.text : "",
    turns: events.filter((event) => event?.type === "turn.started").length,
    agent_message_items: agentMessageItems.length,
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
      quality_independent_review_pass_observed:
        latestIndependentReview?.quality_pass === true,
      quality_independent_review_context_observed:
        latestIndependentReview?.quality_context_complete === true,
      quality_independent_review_current_validation_observed:
        latestIndependentReview?.quality_current_validation_observed === true,
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
      strict_final_stop_observed: strictFinalStopObserved,
      strict_review_cycle_count: reviewCycles.length,
      duplicate_strict_collab_call_id_observed:
        duplicateStrictCollabCallIdObserved,
      unexpected_strict_collab_tool_observed:
        unexpectedStrictCollabToolObserved,
      post_change_spawn_calls: postChangeSpawnAttempts.size,
      post_change_wait_calls: postChangeWaitAttempts.size,
      ...(capsuleStage === null ? {} : { capsule_stage: capsuleStage }),
    },
    tokens: hasUsage
      ? {
          input,
          cached_input: cachedInput,
          output,
          reasoning_output: nonNegativeSafeInteger(usage?.reasoning_output_tokens),
          total,
          uncached_plus_output: telemetryComplete ? input - cachedInput + output : null,
          telemetry_complete: telemetryComplete,
        }
      : null,
  };
}

export function isRetryableCodexCapacityFailure({ raw, telemetry }) {
  if (telemetry?.completed !== false || telemetry?.tokens?.telemetry_complete === true) {
    return false;
  }
  const terminalEvents = parseCodexEvents(raw).slice(-2);
  return terminalEvents.length === 2 &&
    terminalEvents[0]?.type === "error" &&
    terminalEvents[0]?.message === CODEX_CAPACITY_ERROR_MESSAGE &&
    terminalEvents[1]?.type === "turn.failed" &&
    terminalEvents[1]?.error?.message === CODEX_CAPACITY_ERROR_MESSAGE;
}

function parseCodexEvents(raw) {
  return String(raw ?? "")
    .split(/\r?\n/u)
    .filter((line) => line.trim().startsWith("{"))
    .flatMap((line) => {
      try {
        return [JSON.parse(line)];
      } catch {
        return [];
      }
    });
}

function traceCapsuleStage(
  events,
  expectedWorkflow,
  changePolicy,
  reproductionContract,
  expectedReviewContract,
  workspace,
) {
  if (!["build", "debug"].includes(expectedWorkflow)) return null;

  const indexed = events.map((event, index) => ({ event, index }));
  const parseCapsuleValidationCommand = (command) =>
    parsePostChangeValidationCommand(
      command,
      expectedWorkflow,
      reproductionContract,
      workspace,
    )?.command ?? null;
  const firstToolIndex = indexed.find(({ event }) =>
    ["item.started", "item.completed"].includes(event?.type) &&
    !["agent_message", "reasoning"].includes(event?.item?.type)
  )?.index ?? events.length;
  const routeTimeline = analyzeLeanRouteTimeline(indexed, firstToolIndex);
  const routeLedgerOccurrences = routeTimeline.route_ledger_occurrences;
  const initialRouteLedger = routeTimeline.initial_route_ledger;
  const routeDeclarationsConsistent =
    routeTimeline.route_declarations_consistent;
  const riskMonotonicObserved = routeTimeline.risk_monotonic_observed;
  const ledgerBeforeToolsObserved =
    initialRouteLedger !== undefined &&
    initialRouteLedger.ledger !== null;
  const canonicalRouteDeclarationObserved =
    initialRouteLedger !== undefined &&
    isCanonicalLeanRouteDeclaration(initialRouteLedger.presentation);
  const declaredRisk = routeTimeline.highest_presented_risk;
  const ledgerKeysAfterInitialObserved =
    routeTimeline.ledger_keys_after_initial_observed;
  const firstChangeIndex = indexed.find(
    ({ event }) => isCompletedFileChange(event),
  )?.index ?? -1;
  const firstReviewSpawnIndex = declaredRisk === "strict"
    ? indexed.find(
        ({ event, index }) =>
          index > firstChangeIndex &&
          event?.item?.type === "collab_tool_call" &&
          event.item.tool === "spawn_agent" &&
          hasExactCodexReviewContract(event.item.prompt, expectedReviewContract) &&
          parseCompleteCodexReviewPacket(
            event.item.prompt,
            expectedReviewContract,
            new Set(),
            parseCapsuleValidationCommand,
          ) !== null &&
          ["item.started", "item.completed"].includes(event.type),
      )?.index ?? events.length
    : events.length;
  const taskChanges = indexed.filter(
    ({ event, index }) => index < firstReviewSpawnIndex && isCompletedFileChange(event),
  );
  const patchBatches = groupContiguousFileChanges(events, taskChanges);
  const taskFirstChangeIndex = taskChanges[0]?.index ?? -1;
  const taskFirstPatchIndex = indexed.find(({ event, index }) =>
    index < firstReviewSpawnIndex &&
    ["item.started", "item.completed"].includes(event?.type) &&
    event?.item?.type === "file_change"
  )?.index ?? -1;
  const taskLastChangeIndex = taskChanges.at(-1)?.index ?? -1;
  const workflowReads = indexed.filter(
    ({ event, index }) =>
      index < firstReviewSpawnIndex &&
      event?.type === "item.completed" &&
      event?.item?.type === "command_execution" &&
      isWorkflowReadCommand(event.item.command),
  );
  const taskCommands = indexed.filter(
    ({ event, index }) =>
      index < firstReviewSpawnIndex &&
      event?.type === "item.completed" &&
      event?.item?.type === "command_execution" &&
      !isWorkflowReadCommand(event.item.command),
  );
  const preChangeCommands = taskCommands.filter(
    ({ index }) => taskFirstChangeIndex < 0 || index < taskFirstChangeIndex,
  );
  const postChangeCommands = taskCommands.filter(
    ({ index }) => taskLastChangeIndex >= 0 && index > taskLastChangeIndex,
  );
  const patchPaths = [...new Set(taskChanges.flatMap(({ event }) =>
    (event.item.changes ?? [])
      .map((change) => benchmarkObservedPath(change?.path))
      .filter(Boolean)
  ))].sort();
  const readRequiredPatchPaths = [...new Set(taskChanges.flatMap(({ event }) =>
    (event.item.changes ?? [])
      .filter((change) => change?.kind !== "add")
      .map((change) => benchmarkObservedPath(change?.path))
      .filter(Boolean)
  ))].sort();
  const firstChangeIndexByPath = new Map();
  for (const { event, index } of taskChanges) {
    for (const change of event.item.changes ?? []) {
      const changedPath = benchmarkObservedPath(change?.path);
      if (
        changedPath !== null &&
        !firstChangeIndexByPath.has(changedPath)
      ) {
        firstChangeIndexByPath.set(changedPath, index);
      }
    }
  }
  const qualityReadEvidence = taskCommands.flatMap(({ event, index }) =>
    successfulReadEvidencePaths(
      event.item,
      workspace,
      reproductionContract,
    ).map((readPath) => ({ index, readPath }))
  );
  const qualityReadObserved = qualityReadEvidence.length > 0;
  const qualityPatchTargetsReadObserved = readRequiredPatchPaths.every(
    (requiredPath) => qualityReadEvidence.some(({ index, readPath }) =>
      readPath === requiredPath && index < firstChangeIndexByPath.get(requiredPath)
    ),
  );
  const preChangeStage = tracePreChangeStages(
    preChangeCommands,
    expectedWorkflow,
    reproductionContract,
    readRequiredPatchPaths,
    changePolicy,
    workspace,
  );
  const lastPreChangeCommandIndex = preChangeCommands.at(-1)?.index ?? -1;
  const prePatchClauseTestLedgerPresentations =
    lastPreChangeCommandIndex >= 0 &&
    taskFirstPatchIndex > lastPreChangeCommandIndex
      ? indexed.flatMap(({ event, index }) => {
          if (
            index <= lastPreChangeCommandIndex ||
            index >= taskFirstPatchIndex ||
            event?.type !== "item.completed" ||
            event?.item?.type !== "agent_message"
          ) {
            return [];
          }
          const headerCount = countClauseTestLedgerHeaders(event.item.text);
          if (headerCount === 0) return [];
          const packet = headerCount === 1
            ? parseClauseTestLedgerPacket(event.item.text)
            : null;
          return [{ header_count: headerCount, packet }];
        })
      : [];
  const prePatchClauseTestLedgerPacketCount =
    prePatchClauseTestLedgerPresentations.reduce(
      (total, presentation) => total + presentation.header_count,
      0,
    );
  const prePatchClauseTestLedger =
    prePatchClauseTestLedgerPacketCount === 1 &&
    prePatchClauseTestLedgerPresentations.length === 1
      ? prePatchClauseTestLedgerPresentations[0].packet
      : null;
  const prePatchClauseTestLedgerStructureObserved =
    prePatchClauseTestLedgerPacketCount === 1 &&
    prePatchClauseTestLedger !== null;
  const groundedClauseTestMappings = prePatchClauseTestLedger === null
    ? []
    : groundedLedgerMappings(
        expectedReviewContract,
        prePatchClauseTestLedger.mappings,
      );
  const prePatchClauseTestLedgerObserved = groundedClauseTestMappings.length > 0;
  const taskBoundaries = taskBoundaryClauses(expectedReviewContract);
  const taskBoundaryCount = taskBoundaries.length;
  const distinctBoundaryCoverageObserved = taskBoundariesHaveDistinctCoverage(
    taskBoundaries,
    groundedClauseTestMappings,
  );
  const clauseCoverageObserved =
    groundedClauseTestMappings.length >= Math.max(
      expectedWorkflow === "debug" ? 2 : 1,
      taskBoundaryCount,
    ) && distinctBoundaryCoverageObserved;
  const prePatchCounterexampleStructureObserved =
    prePatchClauseTestLedger?.counterexample !== null &&
    prePatchClauseTestLedger?.counterexample !== undefined;
  const prePatchCounterexampleTransitionObserved =
    prePatchCounterexampleStructureObserved &&
    counterexampleSingleChangeObserved(prePatchClauseTestLedger.counterexample);
  const prePatchCounterexampleObserved =
    prePatchCounterexampleTransitionObserved &&
    groundedCounterexample(
      expectedReviewContract,
      prePatchClauseTestLedger.counterexample,
    );
  const postPatchClauseTestLedgerObserved =
    taskFirstPatchIndex >= 0 &&
    indexed.some(({ event, index }) =>
      index > taskFirstPatchIndex &&
      event?.type === "item.completed" &&
      event?.item?.type === "agent_message" &&
      hasClauseTestLedgerHeader(event.item.text)
    );
  const discoverObserved = preChangeStage.discover_observed;
  const readObserved = preChangeStage.read_observed;
  const reproduceObserved = preChangeStage.reproduce_observed;
  const testPatterns = changePolicy?.tests ?? [];
  const productPatterns = changePolicy?.product ?? [];
  const isTestPath = (changedPath) =>
    testPatterns.some((pattern) => matchGlob(changedPath, pattern));
  const isImplementationPath = (changedPath) =>
    productPatterns.some((pattern) => matchGlob(changedPath, pattern)) &&
    !isTestPath(changedPath);
  const changePaths = ({ event }) => (event.item.changes ?? [])
    .map((change) => benchmarkObservedPath(change?.path))
    .filter(Boolean);
  const completedChangeStartIndex = ({ event, index }) => {
    const changeId = event?.item?.id;
    if (typeof changeId !== "string") return index;
    return indexed.findLast(({ event: candidate, index: candidateIndex }) =>
      candidateIndex <= index &&
      candidate?.type === "item.started" &&
      candidate?.item?.type === "file_change" &&
      candidate.item.id === changeId
    )?.index ?? index;
  };
  const firstProductChange = expectedWorkflow === "build"
    ? taskChanges.find((change) => changePaths(change).some(isImplementationPath)) ?? null
    : null;
  const firstProductChangeIndex = firstProductChange?.index ?? -1;
  const firstProductPatchStartIndex = firstProductChange === null
    ? -1
    : completedChangeStartIndex(firstProductChange);
  const preProductChanges = expectedWorkflow === "build"
    ? taskChanges.filter(({ index }) => index < firstProductChangeIndex)
    : [];
  const productChanges = expectedWorkflow === "build" && firstProductChangeIndex >= 0
    ? taskChanges.filter(({ index }) => index >= firstProductChangeIndex)
    : [];
  const preProductPatchBatches = expectedWorkflow === "build"
    ? groupContiguousFileChanges(events, preProductChanges)
    : [];
  const buildTestPatchPaths = preProductChanges.flatMap(changePaths);
  const buildCodePatchPaths = productChanges.flatMap(changePaths);
  const buildTestPatchObserved = expectedWorkflow === "build" &&
    buildTestPatchPaths.length > 0 &&
    buildTestPatchPaths.every(isTestPath);
  const buildCodePatchObserved = expectedWorkflow === "build" &&
    buildCodePatchPaths.length > 0 &&
    buildCodePatchPaths.every(isImplementationPath);
  const buildCodePatchPathSet = new Set(buildCodePatchPaths);
  const redTestPathsPreservedObserved = expectedWorkflow === "build"
    ? buildTestPatchPaths.length > 0 &&
      buildTestPatchPaths.every((changedPath) =>
        !buildCodePatchPathSet.has(changedPath)
      )
    : null;
  const buildTestPatchEndIndex = preProductChanges.at(-1)?.index ?? -1;
  const buildRedCommands = expectedWorkflow === "build" &&
    buildTestPatchEndIndex >= 0 &&
    firstProductPatchStartIndex > buildTestPatchEndIndex
    ? taskCommands.filter(({ index }) =>
        index > buildTestPatchEndIndex && index < firstProductPatchStartIndex
      )
    : [];
  const finalBuildTestAttempt = buildRedCommands.findLast(({ event }) =>
    isBuildRedRetryAttempt(event.item, workspace)
  ) ?? null;
  const finalBuildRedWindowSafe = buildTestPatchEndIndex >= 0 &&
    postBuildEvidenceActivityIsSafe(
      indexed.filter(({ index }) => index < firstProductPatchStartIndex),
      buildTestPatchEndIndex,
      workspace,
    );
  const buildRedObserved = expectedWorkflow === "build"
    ? finalBuildTestAttempt !== null &&
      isExpectedBuildRed(finalBuildTestAttempt.event.item, workspace) &&
      finalBuildRedWindowSafe
    : null;
  const buildRedCycleRestarts = expectedWorkflow === "build"
    ? Math.max(0, preProductPatchBatches.length - 1)
    : 0;
  const buildRedRetryWindows = expectedWorkflow === "build"
    ? preProductPatchBatches.slice(0, -1).map((batch, index) => {
        const afterIndex = batch.at(-1)?.index ?? -1;
        const beforeIndex = completedChangeStartIndex(
          preProductPatchBatches[index + 1][0],
        );
        const commands = taskCommands.filter(({ index: commandIndex }) =>
          commandIndex > afterIndex && commandIndex < beforeIndex
        );
        const relevantAttempts = commands.filter(({ event }) =>
          isBuildRedRetryAttempt(event.item, workspace)
        );
        return {
          commands,
          evidence_preserved:
            postBuildEvidenceActivityIsSafe(
              indexed.filter(({ index: eventIndex }) => eventIndex < beforeIndex),
              afterIndex,
              workspace,
            ),
          relevant_attempts: relevantAttempts,
        };
      })
    : [];
  const buildRedRetryCommands = buildRedRetryWindows.flatMap(
    ({ commands }) => commands,
  );
  const buildRedRetryProtocolObserved = expectedWorkflow === "build"
    ? buildRedRetryWindows.every(({
        evidence_preserved: evidencePreserved,
        relevant_attempts: relevantAttempts,
      }) =>
        relevantAttempts.length >= 1 && evidencePreserved
      )
    : null;
  const validation = parsePostChangeValidationSequence(
    postChangeCommands,
    expectedWorkflow,
    reproductionContract,
    workspace,
  );
  const validationObserved = validation !== null;
  const qualityValidation = parseSupportedPostChangeValidation(
    postChangeCommands,
    expectedWorkflow,
    reproductionContract,
    indexed,
    workspace,
  );
  const qualityValidationObserved = qualityValidation !== null;
  const qualityPreChangeEvidenceObserved =
    qualityReadObserved &&
    qualityPatchTargetsReadObserved &&
    (expectedWorkflow === "debug" ? reproduceObserved : buildRedObserved);
  const testPatchObserved = patchPaths.some((changedPath) =>
    isTestPath(changedPath)
  );
  const implementationPatchObserved = patchPaths.some((changedPath) =>
    isImplementationPath(changedPath)
  );
  const multiFilePatchObserved =
    patchBatches.length === 1 &&
    implementationPatchObserved &&
    testPatchObserved;
  const debugInitialPatchBatch = expectedWorkflow === "debug"
    ? patchBatches[0] ?? []
    : [];
  const debugInitialPatchPaths = debugInitialPatchBatch.flatMap(changePaths);
  const debugInitialPatchObserved = expectedWorkflow === "debug"
    ? debugInitialPatchPaths.some(isImplementationPath) &&
      debugInitialPatchPaths.some(isTestPath) &&
      debugInitialPatchPaths.every((changedPath) =>
        isImplementationPath(changedPath) || isTestPath(changedPath)
      )
    : null;
  const debugRecoveryCount = expectedWorkflow === "debug"
    ? Math.max(0, patchBatches.length - 1)
    : 0;
  const debugRecoveryBatch = expectedWorkflow === "debug"
    ? patchBatches[1] ?? []
    : [];
  const debugRecoveryPaths = debugRecoveryBatch.flatMap(changePaths);
  const debugInitialPatchEndIndex = debugInitialPatchBatch.at(-1)?.index ?? -1;
  const debugRecoveryPatchCompletedIndex = debugRecoveryBatch[0]?.index ?? -1;
  const debugRecoveryPatchId = debugRecoveryBatch[0]?.event?.item?.id;
  const debugRecoveryPatchStartIndex = debugRecoveryPatchCompletedIndex < 0
    ? -1
    : indexed.findLast(({ event, index }) =>
        index <= debugRecoveryPatchCompletedIndex &&
        event?.type === "item.started" &&
        event?.item?.type === "file_change" &&
        (debugRecoveryPatchId === undefined || event.item.id === debugRecoveryPatchId)
      )?.index ?? debugRecoveryPatchCompletedIndex;
  const debugRecoveryCommands = expectedWorkflow === "debug" &&
    debugInitialPatchEndIndex >= 0 &&
    debugRecoveryPatchStartIndex > debugInitialPatchEndIndex
    ? taskCommands.filter(({ index }) =>
        index > debugInitialPatchEndIndex && index < debugRecoveryPatchStartIndex
      )
    : [];
  const debugLauncherErrors = debugRecoveryCommands.filter(({ event }) =>
    isDebugValidationLauncherError(event.item, reproductionContract, workspace)
  );
  const debugLauncherErrorIndexes = new Set(
    debugLauncherErrors.map(({ index }) => index),
  );
  const failedDebugValidations = debugRecoveryCommands.flatMap((command) => {
    if (debugLauncherErrorIndexes.has(command.index)) return [];
    const validation = parseFailedDebugValidation(
      command.event.item,
      reproductionContract,
      workspace,
    );
    return validation === null ? [] : [{ command, validation }];
  });
  const failedDebugValidation = failedDebugValidations.length === 1
    ? failedDebugValidations[0]
    : null;
  const debugRecoveryCommandProtocolObserved =
    failedDebugValidation !== null &&
    debugLauncherErrors.length <= 1 &&
    debugRecoveryCommands.length === debugLauncherErrors.length + 1 &&
    debugLauncherErrors.every(({ index }) =>
      index < failedDebugValidation.command.index
    );
  const debugRecoveryToolCallCount = countToolCallsBetween(indexed, {
    afterIndex: debugInitialPatchEndIndex,
    beforeIndex: debugRecoveryPatchStartIndex,
  });
  const debugRecoveryPathsObserved = debugRecoveryPaths.length > 0 &&
    debugRecoveryPaths.every((changedPath) =>
      (isImplementationPath(changedPath) || isTestPath(changedPath)) &&
      qualityReadEvidence.some(({ readPath }) => readPath === changedPath)
    );
  const debugRecoveryProtocolObserved = expectedWorkflow === "debug"
    ? debugRecoveryCount === 0
      ? patchBatches.length === 1 &&
        debugInitialPatchObserved
      : debugRecoveryCount === 1 &&
        debugInitialPatchObserved &&
        debugRecoveryCommandProtocolObserved &&
        debugRecoveryToolCallCount === debugLauncherErrors.length + 1 &&
        debugRecoveryPathsObserved &&
        failedDebugValidation !== null &&
        failedDebugValidation.validation.validation_command ===
          qualityValidation?.validation_command
    : null;
  const patchProtocolObserved = expectedWorkflow === "build"
    ? buildRedObserved &&
      buildTestPatchObserved &&
      buildCodePatchObserved &&
      buildRedRetryProtocolObserved &&
      redTestPathsPreservedObserved &&
      implementationPatchObserved &&
      testPatchObserved
    : debugInitialPatchObserved;
  const qualityPatchObserved = implementationPatchObserved && testPatchObserved;
  const freshnessAnchorIndex = expectedWorkflow === "build"
    ? firstProductChangeIndex
    : debugInitialPatchEndIndex;
  const freshnessValidation = freshnessAnchorIndex < 0
    ? null
    : parseFirstSupportedPostChangeValidation(
        taskCommands.filter(({ index }) => index > freshnessAnchorIndex),
        expectedWorkflow,
        reproductionContract,
        indexed,
        workspace,
      );
  const postValidationToolCalls = validationObserved
    ? countToolCallsAfter(indexed, validation.final_index)
    : 0;
  const qualityPostValidationToolCalls = qualityValidationObserved
    ? countToolCallsAfter(indexed, freshnessValidation?.final_index ?? -1)
    : 0;
  const readOnlyAfterFreshnessValidation = freshnessValidation !== null &&
    postBoundaryActivityIsReadOnly(
      indexed,
      freshnessValidation.final_index,
      workspace,
    );
  const ordinaryStopObserved = declaredRisk === "strict"
    ? null
    : validationObserved &&
      freshnessValidation !== null &&
      readOnlyAfterFreshnessValidation;
  const qualityOrdinaryStopObserved = declaredRisk === "strict"
    ? null
    : qualityValidationObserved &&
      freshnessValidation !== null &&
      readOnlyAfterFreshnessValidation;
  const finalStopObserved = declaredRisk === "strict"
    ? null
    : qualityOrdinaryStopObserved;
  const protocolObserved =
    routeDeclarationsConsistent &&
    riskMonotonicObserved &&
    ledgerBeforeToolsObserved &&
    workflowReads.length === 0 &&
    preChangeStage.protocol_observed &&
    prePatchClauseTestLedgerObserved &&
    !postPatchClauseTestLedgerObserved &&
    patchProtocolObserved &&
    validationObserved &&
    (declaredRisk === "strict" || ordinaryStopObserved);

  return {
    workflow: expectedWorkflow,
    route_ledger_occurrences: routeLedgerOccurrences,
    route_declarations_consistent: routeDeclarationsConsistent,
    risk_monotonic_observed: riskMonotonicObserved,
    ledger_before_tools_observed: ledgerBeforeToolsObserved,
    canonical_route_declaration_observed: canonicalRouteDeclarationObserved,
    ledger_keys_after_initial_observed: ledgerKeysAfterInitialObserved,
    highest_presented_risk: declaredRisk,
    workflow_read_calls: workflowReads.length,
    pre_change_command_calls: preChangeCommands.length,
    pre_change_stage_protocol_observed: preChangeStage.protocol_observed,
    stage_retry_calls: preChangeStage.retry_calls,
    stage_attempts: preChangeStage.attempts,
    unexpected_pre_change_command_calls: preChangeStage.unexpected_calls,
    out_of_order_stage_calls: preChangeStage.out_of_order_stage_calls,
    extra_read_calls: preChangeStage.extra_read_calls,
    malformed_read_calls: preChangeStage.malformed_read_calls,
    discover_observed: discoverObserved,
    read_observed: readObserved,
    patch_targets_read_observed: preChangeStage.patch_targets_read_observed,
    grounded_candidate_paths: preChangeStage.grounded_candidate_paths,
    grounded_candidates_read_observed:
      preChangeStage.grounded_candidates_read_observed,
    quality_grounded_candidates_read_observed:
      preChangeStage.quality_grounded_candidates_read_observed,
    quality_patch_targets_read_observed: qualityPatchTargetsReadObserved,
    quality_pre_change_evidence_observed: qualityPreChangeEvidenceObserved,
    quality_read_observed: qualityReadObserved,
    build_red_observed: buildRedObserved,
    build_red_command_calls: buildRedCommands.length,
    build_red_cycle_restarts: buildRedCycleRestarts,
    build_red_retry_command_calls: buildRedRetryCommands.length,
    build_red_retry_protocol_observed: buildRedRetryProtocolObserved,
    red_test_paths_preserved_observed: redTestPathsPreservedObserved,
    required_read_paths: preChangeStage.required_read_paths,
    validation_metadata_read_observed:
      preChangeStage.validation_metadata_read_observed,
    reproduce_observed: reproduceObserved,
    ordered_reproduce_observed: preChangeStage.ordered_reproduce_observed,
    pre_patch_clause_test_ledger_structure_observed:
      prePatchClauseTestLedgerStructureObserved,
    pre_patch_clause_test_ledger_packet_count:
      prePatchClauseTestLedgerPacketCount,
    pre_patch_clause_test_ledger_observed: prePatchClauseTestLedgerObserved,
    clause_test_mapping_count: prePatchClauseTestLedger?.mappings.length ?? 0,
    grounded_clause_test_mapping_count: groundedClauseTestMappings.length,
    task_boundary_count: taskBoundaryCount,
    distinct_boundary_coverage_observed: distinctBoundaryCoverageObserved,
    clause_coverage_observed: clauseCoverageObserved,
    counterexample_presentation_count:
      prePatchClauseTestLedger?.counterexample_presentation_count ?? 0,
    pre_patch_counterexample_structure_observed:
      prePatchCounterexampleStructureObserved,
    pre_patch_counterexample_transition_observed:
      prePatchCounterexampleTransitionObserved,
    pre_patch_counterexample_observed: prePatchCounterexampleObserved,
    post_patch_clause_test_ledger_observed: postPatchClauseTestLedgerObserved,
    patch_batches: patchBatches.length,
    patch_file_events: taskChanges.length,
    patch_paths: patchPaths,
    implementation_patch_observed: implementationPatchObserved,
    quality_patch_observed: qualityPatchObserved,
    test_patch_observed: testPatchObserved,
    multi_file_patch_observed: multiFilePatchObserved,
    patch_protocol_observed: patchProtocolObserved,
    post_change_command_calls: postChangeCommands.length,
    validation_observed: validationObserved,
    quality_validation_observed: qualityValidationObserved,
    quality_validation_mode: qualityValidation?.mode ?? null,
    post_change_validation_mode: validation?.mode ?? null,
    debug_recovery_count: debugRecoveryCount,
    debug_launcher_error_count: debugLauncherErrors.length,
    debug_recovery_protocol_observed: debugRecoveryProtocolObserved,
    final_validation_budget_observed:
      validationObserved && postChangeCommands.length === 1,
    capsule_green_path_observed:
      protocolObserved &&
      preChangeStage.retry_calls === 0 &&
      (expectedWorkflow !== "build" || buildRedCycleRestarts === 0) &&
      (expectedWorkflow !== "debug" || debugRecoveryCount === 0) &&
      postChangeCommands.length === 1 &&
      (expectedWorkflow !== "debug" || validation?.mode === "combined"),
    post_change_reproduction_replayed:
      validation?.reproduction_replayed ?? false,
    post_validation_tool_calls: postValidationToolCalls,
    quality_post_validation_tool_calls: qualityPostValidationToolCalls,
    quality_ordinary_stop_observed: qualityOrdinaryStopObserved,
    ordinary_stop_observed: ordinaryStopObserved,
    final_stop_observed: finalStopObserved,
    protocol_observed: protocolObserved,
  };
}

function isClauseTestLedgerHeaderLine(value) {
  return String(value ?? "").trim() === "Clause→test ledger:";
}

function visibleAssertionLines(value) {
  const visible = [];
  let fence = null;
  for (const line of String(value ?? "").split(/\r?\n/u)) {
    if (fence !== null) {
      const closing = line.match(/^ {0,12}(`{3,}|~{3,})[ \t]*$/u)?.[1] ?? null;
      if (
        closing !== null &&
        closing[0] === fence.character &&
        closing.length >= fence.length
      ) {
        fence = null;
      }
      continue;
    }
    const opening = line.match(
      /^ {0,3}(?:(?:[-*+]|\d+[.)])[ \t]+)?(`{3,}|~{3,})/u,
    )?.[1] ?? null;
    if (opening !== null) {
      fence = { character: opening[0], length: opening.length };
      continue;
    }
    if (
      /^(?: {4}|\t)/u.test(line) ||
      /^\s*>/u.test(line)
    ) {
      continue;
    }
    visible.push(line);
  }
  return visible;
}

function hasClauseTestLedgerHeader(value) {
  return countClauseTestLedgerHeaders(value) > 0;
}

function countClauseTestLedgerHeaders(value) {
  return visibleAssertionLines(value).filter(isClauseTestLedgerHeaderLine).length;
}

function parseClauseTestLedgerPacket(value) {
  const lines = visibleAssertionLines(value);
  const headerIndexes = lines.flatMap((line, index) =>
    isClauseTestLedgerHeaderLine(line) ? [index] : []
  );
  if (headerIndexes.length !== 1) return null;
  const headerIndex = headerIndexes[0];
  const packetLines = lines.slice(headerIndex + 1);
  const counterexamplePresentations = packetLines.filter((line) =>
    /^\s*(?:[-*+]\s+|\d+[.)]\s*)?counterexample\s*:/iu.test(line)
  );
  const parsedCounterexamples = counterexamplePresentations.flatMap((line) => {
    const entry = line
      .replace(/^\s*(?:[-*+]\s+|\d+[.)]\s*)/u, "")
      .trim();
    const payload = entry.replace(/^counterexample\s*:\s*/iu, "");
    if ((payload.match(/(?:→|->)/gu) ?? []).length !== 2) return [];
    const match = entry.match(
      /^counterexample\s*:\s*([^=→]+?)\s*=\s*([^→]+?)\s*(?:→|->)\s*([^→]+?)\s*(?:→|->)\s*(.+)$/iu,
    );
    if (match === null) return [];
    const [property, passing, mutation, boundary] = match.slice(1).map((part) => part.trim());
    if (
      [property, passing, mutation, boundary].some((part) => part.length === 0) ||
      passing.toLocaleLowerCase("en-US") === mutation.toLocaleLowerCase("en-US")
    ) {
      return [];
    }
    return [{ property, passing, mutation, boundary }];
  });
  const counterexample =
    counterexamplePresentations.length === 1 && parsedCounterexamples.length === 1
      ? parsedCounterexamples[0]
      : null;
  const mappings = packetLines.flatMap((line) => {
    const entry = line
      .replace(/^\s*(?:[-*+]\s+|\d+[.)]\s*)/u, "")
      .trim();
    if (/^counterexample\s*:/iu.test(entry)) return [];
    if (
      (entry.match(/(?:→|->)/gu) ?? []).length !== 1 ||
      hasEvidenceDisclaimer(entry)
    ) {
      return [];
    }
    const mapping = entry.match(/^(.+?)\s*(?:→|->)\s*(.+)$/u);
    return mapping === null || mapping[1].trim() === "" || mapping[2].trim() === ""
      ? []
      : [{ clause: mapping[1].trim(), test: mapping[2].trim() }];
  });
  if (mappings.length === 0) return null;
  const distinctMappings = [...new Map(mappings.map((mapping) => [
    `${normalizeLedgerMappingPart(mapping.clause)}\u0000${normalizeLedgerMappingPart(mapping.test)}`,
    mapping,
  ])).values()];
  return {
    counterexample,
    counterexample_presentation_count: counterexamplePresentations.length,
    mappings: distinctMappings,
  };
}

function normalizeLedgerMappingPart(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/gu, " ")
    .toLocaleLowerCase("en-US");
}

function hasEvidenceDisclaimer(value) {
  return /\b(?:fake|fictional|hypothetical|illustrative|placeholder|pretend|unrelated)\b|\bexample[-\s]+only\b|\b(?:no|not|unproven|unsupported|unverified)\s+(?:claim|evidence|mapping|test)\b/iu
    .test(String(value ?? ""));
}

const TASK_BOUNDARY_CUE =
  /\b(?:compatib\w*|error|exact\w*|intact|invalid|keep|keeping|keeps|kept|malformed|must|only|preserv\w*|reject\w*|remain\w*|throw\w*)\b/iu;

function taskBoundaryClauses(value) {
  return String(value ?? "")
    .split(/(?:[.!?;]+\s*|\r?\n)+/u)
    .map((clause) => clause.trim())
    .filter((clause) => clause.length > 0 && TASK_BOUNDARY_CUE.test(clause));
}

function taskBoundariesHaveDistinctCoverage(boundaries, mappings) {
  function assign(boundaryIndex, usedMappings) {
    if (boundaryIndex >= boundaries.length) return true;
    const boundaryTokens = ledgerContentTokens(boundaries[boundaryIndex]);
    for (const [mappingIndex, mapping] of mappings.entries()) {
      if (
        usedMappings.has(mappingIndex) ||
        tokenOverlapCount(
          boundaryTokens,
          `${mapping.clause} ${mapping.test}`,
        ) < 2
      ) {
        continue;
      }
      usedMappings.add(mappingIndex);
      if (assign(boundaryIndex + 1, usedMappings)) return true;
      usedMappings.delete(mappingIndex);
    }
    return false;
  }
  return assign(0, new Set());
}

const LEDGER_TOKEN_STOPWORDS = new Set([
  "after", "also", "among", "another", "before", "being", "between",
  "could", "does", "during", "either", "every", "from", "have", "into",
  "itself", "other", "should", "since", "their", "there", "these", "they",
  "those", "through", "under", "until", "using", "when", "where", "which",
  "while", "with", "would",
]);

function groundedLedgerMappings(task, mappings) {
  const taskTokens = ledgerContentTokens(task);
  if (taskTokens.size < 2) return [];
  return mappings.filter(({ clause, test }) => {
    const mappingTokens = ledgerContentTokens(`${clause} ${test}`);
    let overlap = 0;
    for (const token of mappingTokens) {
      if (taskTokens.has(token)) overlap += 1;
      if (overlap >= 2) return true;
    }
    return false;
  });
}

function groundedCounterexample(task, counterexample) {
  if (counterexample === null || counterexample === undefined) return false;
  const transition = parseCounterexampleTransition(counterexample);
  if (transition === null) return false;
  const taskTokens = ledgerContentTokens(task);
  const boundaryClauses = taskBoundaryClauses(task).filter((clause) =>
    tokenOverlapCount(ledgerContentTokens(clause), counterexample.boundary) >= 2
  );
  return tokenOverlapCount(taskTokens, counterexample.property) >= 1 &&
    tokenOverlapCount(taskTokens, transition.context) >= 1 &&
    boundaryClauses.some((clause) =>
      hasExplicitClauseNegation(clause) ===
        hasExplicitClauseNegation(counterexample.boundary)
    );
}

function counterexampleSingleChangeObserved(counterexample) {
  return parseCounterexampleTransition(counterexample) !== null;
}

function parseCounterexampleTransition(counterexample) {
  const passing = parseCounterexampleEndpoint(counterexample.passing);
  const mutation = parseCounterexampleEndpoint(counterexample.mutation);
  if (
    passing === null ||
    mutation === null ||
    passing.context !== mutation.context ||
    passing.value.toLocaleLowerCase("en-US") ===
      mutation.value.toLocaleLowerCase("en-US")
  ) {
    return null;
  }
  return { context: passing.context, passing: passing.value, mutation: mutation.value };
}

function parseCounterexampleEndpoint(value) {
  const match = String(value ?? "").trim().match(
    /^(.+),\s*value\s*=\s*(.+)$/iu,
  );
  if (match === null) return null;
  const context = match[1].trim();
  const endpointValue = match[2].trim();
  if (
    context === "" ||
    endpointValue === "" ||
    /[,=]/u.test(endpointValue) ||
    /(?:→|->)/u.test(context) ||
    /(?:→|->)/u.test(endpointValue)
  ) {
    return null;
  }
  return { context, value: endpointValue };
}

function hasExplicitClauseNegation(value) {
  return /\b(?:cannot|no|not|never|without)\b|\b(?:are|ca|could|did|do|does|has|have|is|must|should|was|were|wo|would)n['’]t\b|\bfail(?:s|ed|ing)?\s+to\b|\b(?:drop|drops|dropped|dropping|lack|lacks|lacked|lacking|omit|omits|omitted|omitting|refuse|refuses|refused|refusing)\b/iu
    .test(String(value ?? ""));
}

function tokenOverlapCount(referenceTokens, value) {
  const candidateTokens = ledgerContentTokens(value);
  let overlap = 0;
  for (const token of candidateTokens) {
    if (referenceTokens.has(token)) overlap += 1;
  }
  return overlap;
}

function ledgerContentTokens(value) {
  const normalized = String(value ?? "")
    .replace(/([\p{Ll}\d])([\p{Lu}])/gu, "$1 $2")
    .toLocaleLowerCase("en-US");
  return new Set(
    (normalized.match(/[\p{L}\p{N}]+/gu) ?? [])
      .filter((token) => token.length >= 4 && !LEDGER_TOKEN_STOPWORDS.has(token)),
  );
}

function countToolCallsAfter(indexed, afterIndex) {
  return countToolCallsBetween(indexed, { afterIndex });
}

function isSafeGitReportingCommand(item, workspace = null) {
  if (
    item?.status === "failed" ||
    item?.timed_out === true ||
    item?.exit_code !== 0
  ) {
    return false;
  }
  const command = observedCommandText(item?.command, workspace);
  if (command === null || /[\\\r\n;&|`<>$#]/u.test(command)) return false;
  const words = parseSimpleShellWords(command);
  if (words === null || words[0] !== "git") return false;
  if (
    words[1] === "status" &&
    words.length === 3 &&
    ["--porcelain", "--short"].includes(words[2])
  ) {
    return true;
  }
  const safeDiffFlags = new Set([
    "--cached",
    "--check",
    "--name-only",
    "--no-ext-diff",
    "--stat",
    "--staged",
  ]);
  return words[1] === "diff" &&
    words.length >= 3 &&
    words.slice(2).every((word) => safeDiffFlags.has(word));
}

function isProvenPostBoundaryRead(item, workspace = null) {
  return successfulReadEvidencePaths(item, workspace).length > 0 ||
    isSafeGitReportingCommand(item, workspace);
}

function postBoundaryActivityIsSafe(indexed, afterIndex, isSafeCommand) {
  if (afterIndex < 0) return false;
  const completedToolIds = new Set(indexed.flatMap(({ event, index }) =>
    index > afterIndex &&
      event?.type === "item.completed" &&
      !["agent_message", "reasoning"].includes(event?.item?.type) &&
      typeof event?.item?.id === "string"
      ? [event.item.id]
      : []
  ));
  return indexed.every(({ event, index }) => {
    if (index <= afterIndex || event?.item === undefined) return true;
    const item = event.item;
    if (["agent_message", "reasoning"].includes(item.type)) return true;
    if (event.type === "item.started") {
      return typeof item.id === "string" && completedToolIds.has(item.id);
    }
    if (event.type !== "item.completed") return false;
    return item.type === "command_execution" && isSafeCommand(item);
  });
}

function postBoundaryActivityIsReadOnly(indexed, afterIndex, workspace = null) {
  return postBoundaryActivityIsSafe(
    indexed,
    afterIndex,
    (item) => isProvenPostBoundaryRead(item, workspace),
  );
}

function postBuildEvidenceActivityIsSafe(indexed, afterIndex, workspace = null) {
  return postBoundaryActivityIsSafe(
    indexed,
    afterIndex,
    (item) =>
      isProvenPostBoundaryRead(item, workspace) ||
      isBuildRedRetryAttempt(item, workspace),
  );
}

function countToolCallsBetween(
  indexed,
  { afterIndex, beforeIndex = Number.POSITIVE_INFINITY },
) {
  const calls = new Set();
  for (const { event, index } of indexed) {
    if (
      index <= afterIndex ||
      index >= beforeIndex ||
      !["item.started", "item.completed"].includes(event?.type) ||
      ["agent_message", "reasoning"].includes(event?.item?.type) ||
      !event?.item?.type
    ) {
      continue;
    }
    calls.add(typeof event.item.id === "string"
      ? `${event.item.type}:${event.item.id}`
      : `${event.type}:${index}`);
  }
  return calls.size;
}

function tracePreChangeStages(
  commands,
  expectedWorkflow,
  reproductionContract,
  patchPaths,
  changePolicy,
  workspace,
) {
  const stages = [
    {
      name: "discover",
      matches: looksLikeDiscoverAttempt,
      passes: isContentAwareDiscover,
    },
    {
      name: "read",
      matches: looksLikeReadAttempt,
      passes: (item) => isBatchRead(
        item,
        workspace,
        reproductionContract,
      ),
    },
  ];
  if (expectedWorkflow === "debug") {
    stages.push({
      name: "reproduce",
      matches: (item) => looksLikeReproductionAttempt(
        item,
        reproductionContract,
        workspace,
      ),
      passes: (item) => isExecutableReproduction(
        item,
        reproductionContract,
        workspace,
      ),
    });
  }

  const attempts = { discover: 0, read: 0, reproduce: 0 };
  const qualityReadPaths = new Set();
  const successfulItems = new Map();
  let extraReadCalls = 0;
  let malformedReadCalls = 0;
  let outOfOrderStageCalls = 0;
  let unexpectedCalls = 0;
  for (const { event } of commands) {
    const item = event?.item;
    const matchingStages = stages.filter(({ matches }) => matches(item));
    const combinedReadReproduction =
      matchingStages.length === 2 &&
      matchingStages[0]?.name === "read" &&
      matchingStages[1]?.name === "reproduce" &&
      matchingStages.every(({ passes }) => passes(item));
    if (matchingStages.length !== 1 && !combinedReadReproduction) {
      unexpectedCalls += 1;
      continue;
    }
    for (const readPath of successfulReadEvidencePaths(
      item,
      workspace,
      reproductionContract,
    )) {
      qualityReadPaths.add(readPath);
    }
    for (const stage of matchingStages) {
      const discoverReady = successfulItems.has("discover");
      if (
        (stage.name !== "discover" && !discoverReady) ||
        successfulItems.has(stage.name)
      ) {
        unexpectedCalls += 1;
        if (stage.name === "read" && successfulItems.has("read")) {
          extraReadCalls += 1;
        } else {
          outOfOrderStageCalls += 1;
        }
        continue;
      }
      attempts[stage.name] += 1;
      if (attempts[stage.name] > 2) {
        unexpectedCalls += 1;
        continue;
      }
      if (stage.passes(item)) {
        successfulItems.set(stage.name, item);
      } else {
        if (stage.name === "read") malformedReadCalls += 1;
        if (!isStageRetryAuthorized(item)) {
          unexpectedCalls += 1;
        }
      }
    }
  }

  const discoverObserved = successfulItems.has("discover");
  const readObserved = successfulItems.has("read");
  const orderedReproduceObserved = expectedWorkflow === "debug"
    ? successfulItems.has("reproduce")
    : null;
  const reproduceObserved = expectedWorkflow === "debug"
      ? commands.some(({ event }) =>
        isExecutableReproduction(event?.item, reproductionContract, workspace)
      )
    : null;
  const validationMetadataReadObserved = discoverObserved && readObserved
      ? readsDiscoveredValidationMetadata(
        successfulItems.get("discover"),
        successfulItems.get("read"),
        workspace,
        reproductionContract,
      )
    : false;
  const readPaths = new Set(batchReadPaths(
    successfulItems.get("read"),
    workspace,
    reproductionContract,
  ));
  const discoveredPaths = new Set(discoveredRepositoryPaths(
    successfulItems.get("discover")?.aggregated_output,
  ));
  const productPatterns = changePolicy?.product ?? [];
  const groundedCandidatePaths = contentHitRepositoryPaths(
    successfulItems.get("discover")?.aggregated_output,
  ).filter((candidate) => productPatterns.some((pattern) =>
    matchGlob(candidate, pattern)
  ));
  const normalizedPatchPaths = patchPaths.map(normalizeReadPath).filter(Boolean);
  const requiredReadPaths = [...new Set([
    ...normalizedPatchPaths,
    ...groundedCandidatePaths,
  ])].sort();
  const patchTargetsReadObserved = normalizedPatchPaths.every((candidate) =>
    discoveredPaths.has(candidate) && readPaths.has(candidate)
  );
  const groundedCandidatesReadObserved = groundedCandidatePaths.every((candidate) =>
    readPaths.has(candidate)
  );
  const qualityPatchTargetsReadObserved = normalizedPatchPaths.every((candidate) =>
    qualityReadPaths.has(candidate)
  );
  const qualityGroundedCandidatesReadObserved = groundedCandidatePaths.every(
    (candidate) => qualityReadPaths.has(candidate),
  );
  const qualityReadObserved = qualityReadPaths.size > 0;
  const qualityPreChangeEvidenceObserved =
    qualityReadObserved &&
    qualityPatchTargetsReadObserved &&
    (expectedWorkflow !== "debug" || reproduceObserved);
  const retryCalls = Object.values(attempts)
    .reduce((total, count) => total + Math.max(0, count - 1), 0);
  const protocolObserved =
    stages.every(({ name }) => successfulItems.has(name)) &&
    unexpectedCalls === 0 &&
    validationMetadataReadObserved &&
    patchTargetsReadObserved &&
    groundedCandidatesReadObserved;

  return {
    attempts,
    discover_observed: discoverObserved,
    extra_read_calls: extraReadCalls,
    grounded_candidate_paths: [...new Set(groundedCandidatePaths)].sort(),
    grounded_candidates_read_observed: groundedCandidatesReadObserved,
    malformed_read_calls: malformedReadCalls,
    out_of_order_stage_calls: outOfOrderStageCalls,
    patch_targets_read_observed: patchTargetsReadObserved,
    protocol_observed: protocolObserved,
    quality_grounded_candidates_read_observed:
      qualityGroundedCandidatesReadObserved,
    quality_patch_targets_read_observed: qualityPatchTargetsReadObserved,
    quality_pre_change_evidence_observed: qualityPreChangeEvidenceObserved,
    quality_read_observed: qualityReadObserved,
    read_observed: readObserved,
    reproduce_observed: reproduceObserved,
    ordered_reproduce_observed: orderedReproduceObserved,
    retry_calls: retryCalls,
    required_read_paths: [...new Set(requiredReadPaths)].sort(),
    unexpected_calls: unexpectedCalls,
    validation_metadata_read_observed: validationMetadataReadObserved,
  };
}

function isStageRetryAuthorized(item) {
  if (item?.status === "failed" || item?.timed_out === true) return true;
  if (!Number.isInteger(item?.exit_code)) return false;
  if (item.exit_code !== 0 || String(item?.aggregated_output ?? "").length === 0) {
    return true;
  }
  const output = String(item?.aggregated_output ?? "");
  const command = unwrapShellInvocation(item?.command) ?? String(item?.command ?? "");
  return hasFatalShellDiagnostic(output, {
    allowInlineShellPrefix: /^\s*printf\b/u.test(command),
  });
}

function isExpectedBuildRed(item, workspace = null) {
  return (
    item?.type === "command_execution" &&
    ["completed", "failed"].includes(item?.status) &&
    item?.timed_out !== true &&
    Number.isInteger(item?.exit_code) &&
    item.exit_code >= 1 &&
    item.exit_code <= 255 &&
    String(item?.aggregated_output ?? "").trim().length > 0 &&
    !hasFatalShellDiagnostic(item?.aggregated_output) &&
    canonicalTestValidationCommand(item?.command, workspace) !== null
  );
}

function isBuildRedRetryAttempt(item, workspace = null) {
  return (
    item?.type === "command_execution" &&
    ["completed", "failed"].includes(item?.status) &&
    item?.timed_out !== true &&
    canonicalTestValidationCommand(item?.command, workspace) !== null &&
    Number.isInteger(item?.exit_code) &&
    item.exit_code >= 0 &&
    item.exit_code <= 255 &&
    String(item?.aggregated_output ?? "").trim().length > 0 &&
    !hasFatalShellDiagnostic(item?.aggregated_output)
  );
}

function groupContiguousFileChanges(events, taskChanges) {
  const batches = [];
  let previousIndex = -1;
  for (const change of taskChanges) {
    const separated = previousIndex >= 0 && events
      .slice(previousIndex + 1, change.index)
      .some((event) => ![
        "agent_message",
        "file_change",
        "reasoning",
      ].includes(event?.item?.type));
    if (batches.length === 0 || separated) batches.push([]);
    batches.at(-1).push(change);
    previousIndex = change.index;
  }
  return batches;
}

function isCompletedFileChange(event) {
  return (
    event?.type === "item.completed" &&
    event?.item?.type === "file_change" &&
    event.item.status !== "failed" &&
    Array.isArray(event.item.changes) &&
    event.item.changes.length > 0
  );
}

function isWorkflowReadCommand(command) {
  return /(?:^|[\/\s"'])(?:skills\/[^/\s"']+\/SKILL\.md|references\/[^/\s"']+\.md)/u
    .test(String(command ?? ""));
}

function isContentAwareDiscover(item) {
  if (
    item?.status === "failed" ||
    item?.timed_out === true ||
    item?.exit_code !== 0 ||
    hasFatalShellDiagnostic(item?.aggregated_output)
  ) {
    return false;
  }
  const command = unwrapShellInvocation(item?.command);
  const commandMatch = String(command ?? "").match(
    /^rg[ \t]+--files[ \t]+\.[ \t]*;[ \t]*rg[ \t]+-n[ \t]+--[ \t]+'([^'\r\n]+)'[ \t]+\.$/u,
  );
  const terms = commandMatch?.[1] ?? null;
  const canonicalCommand =
    terms !== null &&
    !terms.includes("\\") &&
    ![".", ".*", "^", "$"].includes(terms);
  const hasContentOutput = /(?:^|\r?\n)[^:\r\n]+:\d+:[^\r\n]+/u
    .test(String(item?.aggregated_output ?? ""));
  return canonicalCommand && hasContentOutput;
}

function isBatchRead(item, workspace = null, reproductionContract = null) {
  if (
    item?.status === "failed" ||
    item?.timed_out === true ||
    item?.exit_code !== 0 ||
    String(item?.aggregated_output ?? "").length === 0 ||
    hasFatalShellDiagnostic(item?.aggregated_output)
  ) {
    return false;
  }
  return batchReadPaths(item, workspace, reproductionContract).length >= 2;
}

function looksLikeDiscoverAttempt(item) {
  const command = unwrapShellInvocation(item?.command) ?? String(item?.command ?? "");
  return /^\s*rg\s+/u.test(command);
}

function looksLikeReadAttempt(item) {
  const command = unwrapShellInvocation(item?.command) ?? String(item?.command ?? "");
  return /(?:^|[;&|\s])(?:cat|sed|awk|head|tail)(?:\s|$)/u.test(command);
}

function looksLikeReproductionAttempt(item, contract, workspace = null) {
  return canonicalReproductionCommand(item?.command, workspace) === contract?.command ||
    analyzeReadEvidenceCommand(item, workspace, contract)
      ?.reproduction_observed === true;
}

function batchReadPaths(item, workspace = null, reproductionContract = null) {
  const analysis = analyzeReadEvidenceCommand(
    item,
    workspace,
    reproductionContract,
  );
  if (analysis !== null) return analysis.paths;
  const command = observedCommandText(item?.command, workspace);
  if (command === null || /[\\\r\n;&|`<>$#]/u.test(command)) return [];
  const words = parseSimpleShellWords(command);
  if (
    words === null ||
    words[0] !== "tail" ||
    words[1] !== "-n" ||
    words[2] !== "+1" ||
    words[3] !== "--"
  ) {
    return [];
  }
  const paths = words.slice(4).map(normalizeReadPath);
  return paths.length >= 2 && paths.every(Boolean) ? [...new Set(paths)] : [];
}

function successfulReadEvidencePaths(
  item,
  workspace = null,
  reproductionContract = null,
) {
  return analyzeReadEvidenceCommand(item, workspace, reproductionContract)?.paths ?? [];
}

function analyzeReadEvidenceCommand(item, workspace, reproductionContract) {
  if (
    item?.status === "failed" ||
    item?.timed_out === true ||
    item?.exit_code !== 0 ||
    String(item?.aggregated_output ?? "").length === 0 ||
    hasFatalShellDiagnostic(item?.aggregated_output)
  ) {
    return null;
  }
  const segments = observedCommandSegments(item?.command, workspace);
  if (segments === null) return null;
  let reproductionObserved = false;
  if (
    reproductionContract !== null &&
    reproductionContract !== undefined &&
    canonicalReproductionCommand(segments.at(-1)) === reproductionContract.command
  ) {
    if (
      !isReproductionOutputBoundaryCommand(segments.at(-2)) ||
      !resolvedReproductionOutputAfterBoundaryObserved(
        item?.aggregated_output,
        reproductionContract.expected_output,
      )
    ) {
      return null;
    }
    segments.pop();
    segments.pop();
    reproductionObserved = true;
  }
  const paths = [];
  for (const segment of segments) {
    if (isFixedLiteralPrintfSeparator(segment)) continue;
    const segmentPaths = simpleReadEvidencePaths(segment);
    if (segmentPaths.length === 0) return null;
    paths.push(...segmentPaths);
  }
  if (paths.length === 0) return null;
  return {
    paths: [...new Set(paths)],
    reproduction_observed: reproductionObserved,
  };
}

function observedCommandText(command, workspace = null) {
  const text = unwrapShellInvocation(command);
  const segments = splitSafeAndCommandChain(text);
  if (segments === null) return null;
  const firstWords = parseSimpleShellWords(segments[0]);
  if (firstWords?.[0] !== "cd") return text;
  if (!sameWorkspaceCdSegment(firstWords, workspace)) return null;
  const firstStart = text.indexOf(segments[0]);
  if (firstStart < 0) return null;
  const firstEnd = firstStart + segments[0].length;
  const separator = text.slice(firstEnd).match(/^[ \t]*&&[ \t]*/u)?.[0] ?? null;
  if (separator === null) return null;
  const remainder = text.slice(firstEnd + separator.length);
  return remainder.length > 0 ? remainder : null;
}

function observedCommandSegments(command, workspace = null) {
  const text = unwrapShellInvocation(command);
  const segments = splitSafeAndCommandChain(text);
  if (segments === null) return null;
  const firstWords = parseSimpleShellWords(segments[0]);
  if (firstWords?.[0] !== "cd") return segments;
  if (!sameWorkspaceCdSegment(firstWords, workspace)) return null;
  segments.shift();
  if (segments.length === 0) return null;
  return segments.some((segment) => parseSimpleShellWords(segment)?.[0] === "cd")
    ? null
    : segments;
}

function sameWorkspaceCdSegment(words, workspace) {
  if (typeof workspace !== "string" || !path.isAbsolute(workspace)) return false;
  const target = words.length === 2
    ? words[1]
    : words.length === 3 && words[1] === "--"
      ? words[2]
      : null;
  if (target === null || target.length === 0) return false;
  if (target.split("/").includes("..")) return false;
  return path.resolve(workspace, target) === path.resolve(workspace);
}

function splitSafeAndCommandChain(command) {
  if (command === null) return null;
  const text = String(command);
  if (text.length === 0 || /[\r\n]/u.test(text)) return null;

  const segments = [];
  let quote = null;
  let segmentStart = 0;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === "'" && quote !== "double") {
      quote = quote === "single" ? null : "single";
      continue;
    }
    if (character === '"' && quote !== "single") {
      quote = quote === "double" ? null : "double";
      continue;
    }
    if (quote === "double" && /[\\`$!]/u.test(character)) return null;
    if (quote !== null) continue;
    if (/[\\;|`<>$#!()]/u.test(character)) return null;
    if (character !== "&") continue;
    if (text[index + 1] !== "&") return null;
    const segment = text.slice(segmentStart, index).trim();
    if (segment.length === 0) return null;
    segments.push(segment);
    index += 1;
    segmentStart = index + 1;
  }
  if (quote !== null) return null;
  const finalSegment = text.slice(segmentStart).trim();
  if (finalSegment.length === 0) return null;
  segments.push(finalSegment);
  return segments;
}

function isFixedLiteralPrintfSeparator(command) {
  const words = parseSimpleShellWords(command);
  if (words === null || words[0] !== "printf") return false;
  let offset = 1;
  if (words[offset] === "--") offset += 1;
  const format = words[offset];
  if (
    typeof format !== "string" ||
    format.length === 0 ||
    format.startsWith("-") ||
    /[*?\[\]{}~]/u.test(format) ||
    /%(?![%s])/u.test(format)
  ) {
    return false;
  }
  const values = words.slice(offset + 1);
  if (
    values.some((value) => /[*?\[\]{}~]/u.test(value)) ||
    (format.includes("%s") ? values.length === 0 : values.length !== 0)
  ) {
    return false;
  }
  return true;
}

const REPRODUCTION_OUTPUT_BOUNDARY =
  "__LEANPOWERS_REPRODUCTION_OUTPUT_BOUNDARY__";

function isReproductionOutputBoundaryCommand(command) {
  const words = parseSimpleShellWords(command);
  return words?.length === 3 &&
    words[0] === "printf" &&
    words[1] === "%s\\n" &&
    words[2] === REPRODUCTION_OUTPUT_BOUNDARY;
}

function simpleReadEvidencePaths(command) {
  const words = parseSimpleShellWords(command);
  if (words === null) return [];
  let values;
  if (words[0] === "cat") {
    values = words[1] === "--" ? words.slice(2) : words.slice(1);
  } else if (words[0] === "head") {
    let offset = 1;
    if (words[offset] === "-n" && /^\d+$/u.test(words[offset + 1] ?? "")) {
      offset += 2;
    } else if (/^-\d+$/u.test(words[offset] ?? "")) {
      offset += 1;
    }
    if (words[offset] === "--") offset += 1;
    values = words.slice(offset);
  } else if (words[0] === "tail") {
    let offset = 1;
    if (words[offset] === "-n" && /^\+?\d+$/u.test(words[offset + 1] ?? "")) {
      offset += 2;
    } else {
      return [];
    }
    if (words[offset] === "--") offset += 1;
    values = words.slice(offset);
  } else if (
    words[0] === "sed" &&
    words[1] === "-n" &&
    /^(?:\d+|\d+,\d+)p$/u.test(words[2] ?? "")
  ) {
    const offset = words[3] === "--" ? 4 : 3;
    values = words.slice(offset);
  } else {
    return [];
  }
  if (values.length === 0 || values.some((value) => value.startsWith("-"))) {
    return [];
  }
  const paths = values.map(normalizeReadPath);
  return paths.every(Boolean) ? [...new Set(paths)] : [];
}

function parseSimpleShellWords(command) {
  const words = [];
  let current = "";
  let quote = null;
  let escaped = false;
  let hasToken = false;
  for (const character of String(command ?? "")) {
    if (escaped) {
      current += character;
      escaped = false;
      hasToken = true;
      continue;
    }
    if (quote === null && character === "\\") {
      escaped = true;
      hasToken = true;
      continue;
    }
    if (quote === "double" && character === "\\") {
      escaped = true;
      hasToken = true;
      continue;
    }
    if (character === "'" && quote !== "double") {
      quote = quote === "single" ? null : "single";
      hasToken = true;
      continue;
    }
    if (character === '"' && quote !== "single") {
      quote = quote === "double" ? null : "double";
      hasToken = true;
      continue;
    }
    if (quote === null && /\s/u.test(character)) {
      if (hasToken) {
        words.push(current);
        current = "";
        hasToken = false;
      }
      continue;
    }
    current += character;
    hasToken = true;
  }
  if (escaped || quote !== null) return null;
  if (hasToken) words.push(current);
  return words;
}

function normalizeReadPath(value) {
  const normalized = String(value ?? "").replace(/\\/gu, "/").replace(/^\.\//u, "");
  if (
    normalized.length === 0 ||
    normalized.startsWith("/") ||
    normalized.startsWith("~") ||
    normalized.startsWith("=") ||
    normalized.startsWith("-") ||
    /^[A-Za-z]:\//u.test(normalized) ||
    normalized.split("/").includes("..") ||
    /[*?\[\]{}]/u.test(normalized)
  ) {
    return null;
  }
  return normalized;
}

function readsDiscoveredValidationMetadata(
  discoverItem,
  readItem,
  workspace = null,
  reproductionContract = null,
) {
  const manifests = new Set(
    String(discoverItem?.aggregated_output ?? "")
      .split(/\r?\n/u)
      .map((line) => line.replace(/:\d+:.*$/u, ""))
      .map(normalizeReadPath)
      .filter((candidate) => candidate !== null && isValidationManifestPath(candidate)),
  );
  if (manifests.size === 0) return false;
  const readPaths = new Set(batchReadPaths(
    readItem,
    workspace,
    reproductionContract,
  ));
  return [...manifests].some((manifest) => readPaths.has(manifest));
}

function discoveredRepositoryPaths(output) {
  return String(output ?? "")
    .split(/\r?\n/u)
    .map((line) => line.replace(/:\d+:.*$/u, ""))
    .map(normalizeReadPath)
    .filter(Boolean);
}

function contentHitRepositoryPaths(output) {
  return String(output ?? "")
    .split(/\r?\n/u)
    .flatMap((line) => {
      const match = line.match(/^(.+?):\d+:/u);
      if (!match) return [];
      const candidate = normalizeReadPath(match[1]);
      return candidate === null ? [] : [candidate];
    });
}

function isValidationManifestPath(candidate) {
  return /(?:^|\/)(?:Cargo\.toml|Gemfile|Makefile|build\.gradle(?:\.kts)?|composer\.json|deno\.jsonc?|go\.mod|justfile|package\.json|pom\.xml|pyproject\.toml|requirements\.txt|setup\.py|tox\.ini)$/u
    .test(candidate);
}

function hasFatalShellDiagnostic(output, { allowInlineShellPrefix = false } = {}) {
  const inlinePrefix = allowInlineShellPrefix ? "(?:printf )?" : "";
  const shellDiagnostic = new RegExp(
    `^${inlinePrefix}(?:.*[/\\\\])?(?:bash|dash|fish|ksh|powershell|pwsh|sh|zsh)(?::[^:\\r\\n]+){0,3}:\\s*(?:command not found|no matches found|not found|parse error|syntax error)`,
    "iu",
  );
  return String(output ?? "").split(/\r?\n/u).some((line) => {
    const trimmed = line.trim();
    return shellDiagnostic.test(trimmed) ||
      /^(?:cat|rg|sed|awk|head|tail):[^\r\n]*:\s*(?:no such file or directory|not found)/iu
        .test(trimmed) ||
      /^(?:the term ['"][^'"\r\n]+['"] is not recognized as the name of a cmdlet|['"][^'"\r\n]+['"] is not recognized as an internal or external command)/iu
        .test(trimmed);
  });
}

function isExecutableReproduction(item, contract, workspace = null) {
  if (
    item?.type !== "command_execution" ||
    item?.exit_code !== 0
  ) {
    return false;
  }
  if (
    analyzeReadEvidenceCommand(item, workspace, contract)
      ?.reproduction_observed === true
  ) {
    return true;
  }
  if (canonicalReproductionCommand(item.command, workspace) !== contract?.command) {
    return false;
  }
  try {
    const output = JSON.parse(String(item?.aggregated_output ?? "").trim());
    return isDeepStrictEqual(output, contract.expected_output);
  } catch {
    return false;
  }
}

function canonicalReproductionCommand(command, workspace = null) {
  const text = observedCommandText(command, workspace);
  if (text === null) return null;
  if (
    text.length === 0 ||
    text !== text.trim() ||
    /[\r\n;&|`!<>#$]/u.test(text) ||
    !/^(?:bun|cargo|go|gradle|java|mvn|node|npm|pnpm|pytest|python3?|ruby|yarn)\b/iu.test(text)
  ) {
    return null;
  }
  return text;
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

export function tracksReviewerWorkspaceMutations(workflow) {
  return workflow === "leanpowers-0.2.0";
}

function isReviewerPrompt(prompt) {
  return /(?:\breview\b|reviewer|审查|复核)/iu.test(String(prompt ?? ""));
}

function reviewPromptContainsContract(prompt, expectedReviewContract) {
  if (
    typeof prompt !== "string" ||
    typeof expectedReviewContract !== "string" ||
    expectedReviewContract.trim().length === 0
  ) {
    return false;
  }
  const normalize = (value) => String(value)
    .normalize("NFKC")
    .replace(/\s+/gu, " ")
    .trim();
  return normalize(prompt).includes(normalize(expectedReviewContract));
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
  parseValidationCommand = canonicalValidationCommand,
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
  const validationEvidence = parseValidationEvidence(
    testEvidence,
    parseValidationCommand,
  );
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

function parseValidationEvidence(evidence, parseValidationCommand = canonicalValidationCommand) {
  const match = String(evidence ?? "").match(/^exit=0; command=(.+)$/u);
  if (!match) return null;
  const testCommand = parseValidationCommand(match[1]);
  return testCommand === null ? null : { test_command: testCommand };
}

function parsePostChangeValidationCommand(
  command,
  expectedWorkflow,
  reproductionContract,
  workspace = null,
) {
  const direct = expectedWorkflow === "build"
    ? canonicalBuildValidationCommand(command, workspace)
    : canonicalTestValidationCommand(command, workspace);
  if (direct !== null) {
    return {
      command: direct,
      reproduction_replayed: false,
      validation_command: direct,
    };
  }
  if (expectedWorkflow !== "debug") return null;
  const reproductionCommand = reproductionContract?.command;
  if (
    typeof reproductionCommand !== "string" ||
    canonicalReproductionCommand(reproductionCommand) !== reproductionCommand
  ) {
    return null;
  }
  const text = observedCommandText(command, workspace);
  if (text === null) return null;
  const parts = text.split(" && ");
  if (parts.length !== 2 || parts[1] !== reproductionCommand) return null;
  const testText = parts[0];
  const testCommand = canonicalTestValidationCommand(testText);
  if (testCommand === null || testCommand !== testText) return null;
  return {
    command: text,
    reproduction_replayed: true,
    validation_command: testCommand,
  };
}

function parsePostChangeValidation(
  item,
  expectedWorkflow,
  reproductionContract,
  workspace = null,
) {
  const validation = parsePostChangeValidationCommand(
    item?.command,
    expectedWorkflow,
    reproductionContract,
    workspace,
  );
  if (
    validation === null ||
    !validation.reproduction_replayed
  ) {
    return validation;
  }
  return reproductionContract?.resolved_output === undefined
    ? validation
    : null;
}

function resolvedReproductionOutputObserved(output, expected) {
  const lines = String(output ?? "")
    .split(/\r?\n/u)
    .filter((line) => line.trim().length > 0);
  const finalLine = lines.at(-1);
  if (finalLine === undefined) return false;
  try {
    return isDeepStrictEqual(JSON.parse(finalLine), expected);
  } catch {
    return false;
  }
}

function resolvedReproductionOutputAfterBoundaryObserved(output, expected) {
  const lines = String(output ?? "").split(/\r?\n/u);
  const boundaryIndex = lines.findLastIndex(
    (line) => line.trim() === REPRODUCTION_OUTPUT_BOUNDARY,
  );
  if (boundaryIndex < 0) return false;
  return resolvedReproductionOutputObserved(
    lines.slice(boundaryIndex + 1).join("\n"),
    expected,
  );
}

function reproductionOutputObserved(item, reproductionContract) {
  return reproductionContract?.resolved_output === undefined ||
    resolvedReproductionOutputObserved(
      item?.aggregated_output,
      reproductionContract.resolved_output,
    );
}

function parseStandalonePostChangeReproduction(
  item,
  reproductionContract,
  workspace = null,
) {
  const reproductionCommand = reproductionContract?.command;
  if (
    typeof reproductionCommand !== "string" ||
    canonicalReproductionCommand(item?.command, workspace) !== reproductionCommand
  ) {
    return null;
  }
  return {
    command: reproductionCommand,
    output_observed: reproductionOutputObserved(item, reproductionContract),
  };
}

function isSuccessfulStandalonePostChangeReproduction(
  item,
  reproductionContract,
  workspace = null,
) {
  return item?.type === "command_execution" &&
    item?.status === "completed" &&
    item?.timed_out !== true &&
    item?.exit_code === 0 &&
    parseStandalonePostChangeReproduction(item, reproductionContract, workspace)
      ?.output_observed === true;
}

function parseFailedDebugValidation(item, reproductionContract, workspace = null) {
  const validation = parsePostChangeValidationCommand(
    item?.command,
    "debug",
    reproductionContract,
    workspace,
  );
  if (
    validation === null ||
    (
      validation.reproduction_replayed &&
      reproductionContract?.resolved_output !== undefined
    ) ||
    !["completed", "failed"].includes(item?.status) ||
    item?.timed_out === true ||
    !Number.isInteger(item?.exit_code) ||
    item.exit_code < 1 ||
    item.exit_code > 255 ||
    String(item?.aggregated_output ?? "").trim().length === 0 ||
    hasFatalShellDiagnostic(item?.aggregated_output)
  ) {
    return null;
  }
  return validation;
}

function isDebugValidationLauncherError(
  item,
  reproductionContract,
  workspace = null,
) {
  const validation = parsePostChangeValidationCommand(
    item?.command,
    "debug",
    reproductionContract,
    workspace,
  );
  if (
    validation === null ||
    item?.status !== "failed" ||
    item?.timed_out === true ||
    !Number.isInteger(item?.exit_code) ||
    item.exit_code < 1 ||
    item.exit_code > 255
  ) {
    return false;
  }
  const output = String(item?.aggregated_output ?? "").trim();
  if (hasFatalShellDiagnostic(output)) return true;
  return item.exit_code === 255 && (
    output.length === 0 || isNpmTestLauncherPreambleOnly(output)
  );
}

function isNpmTestLauncherPreambleOnly(output) {
  const lines = String(output ?? "")
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
  if (
    lines.length !== 2 ||
    !/^>\s+(?:[^\s]+\s+)?test(?::[A-Za-z0-9_.-]+)?$/iu.test(lines[0]) ||
    !lines[1].startsWith("> ")
  ) {
    return false;
  }
  return canonicalTestValidationCommand(lines[1].slice(2)) !== null;
}

function parsePostChangeValidationSequence(
  commands,
  expectedWorkflow,
  reproductionContract,
  workspace = null,
) {
  if (commands.length === 1 && commands[0].event.item.exit_code === 0) {
    const validation = parsePostChangeValidation(
      commands[0].event.item,
      expectedWorkflow,
      reproductionContract,
      workspace,
    );
    if (
      validation === null ||
      (expectedWorkflow === "debug" && !validation.reproduction_replayed)
    ) {
      return null;
    }
    return {
      ...validation,
      final_index: commands[0].index,
      mode: validation.reproduction_replayed ? "combined" : "canonical",
    };
  }
  if (
    expectedWorkflow !== "debug" ||
    commands.length !== 2 ||
    commands.some(({ event }) => event.item.exit_code !== 0)
  ) {
    return null;
  }
  const testCommand = canonicalTestValidationCommand(
    commands[0].event.item.command,
    workspace,
  );
  const reproduction = parseStandalonePostChangeReproduction(
    commands[1].event.item,
    reproductionContract,
    workspace,
  );
  if (testCommand === null || reproduction?.output_observed !== true) return null;
  return {
    command: testCommand,
    final_index: commands[1].index,
    mode: "separate",
    reproduction_replayed: true,
    validation_command: testCommand,
  };
}

function parseSupportedPostChangeValidation(
  commands,
  expectedWorkflow,
  reproductionContract,
  activities = commands,
  workspace = null,
) {
  const reproductionCommand = reproductionContract?.command;
  const reproductionAttempts = [];
  const validationAttempts = [];
  for (const { event, index } of commands) {
    const parsed = parsePostChangeValidationCommand(
      event.item.command,
      expectedWorkflow,
      reproductionContract,
      workspace,
    );
    if (
      parsed?.reproduction_replayed &&
      reproductionContract?.resolved_output !== undefined
    ) {
      continue;
    }
    if (parsed?.reproduction_replayed) {
      reproductionAttempts.push({
        exit_code: event.item.exit_code,
        index,
        output_observed: reproductionOutputObserved(
          event.item,
          reproductionContract,
        ),
      });
    } else if (
      expectedWorkflow === "debug" &&
      canonicalReproductionCommand(event.item.command, workspace) === reproductionCommand
    ) {
      const reproduction = parseStandalonePostChangeReproduction(
        event.item,
        reproductionContract,
        workspace,
      );
      reproductionAttempts.push({
        exit_code: event.item.exit_code,
        index,
        output_observed: reproduction?.output_observed === true,
      });
    }
    if (parsed !== null) {
      validationAttempts.push({
        ...parsed,
        exit_code: event.item.exit_code,
        final_index: index,
      });
    }
  }
  const latestValidation = validationAttempts.at(-1) ?? null;
  if (latestValidation === null || latestValidation.exit_code !== 0) {
    return null;
  }
  if (expectedWorkflow !== "debug") {
    return {
      ...latestValidation,
      mode: "canonical",
    };
  }
  const latestReproduction = reproductionAttempts.at(-1) ?? null;
  if (
    latestReproduction === null ||
    latestReproduction.exit_code !== 0 ||
    latestReproduction.output_observed !== true ||
    latestValidation.final_index > latestReproduction.index ||
    (
      latestValidation.final_index === latestReproduction.index &&
      latestValidation.reproduction_replayed !== true
    )
  ) {
    return null;
  }
  if (
    latestValidation.final_index < latestReproduction.index &&
    !postBoundaryActivityIsSafe(
      activities.filter(({ index }) => index <= latestReproduction.index),
      latestValidation.final_index,
      (item) =>
        isProvenPostBoundaryRead(item, workspace) ||
        isSuccessfulStandalonePostChangeReproduction(
          item,
          reproductionContract,
          workspace,
        ),
    )
  ) {
    return null;
  }
  return {
    command: latestValidation.command,
    final_index: latestReproduction.index,
    mode: latestValidation.final_index === latestReproduction.index
      ? "combined"
      : "separate",
    reproduction_replayed: true,
    validation_command: latestValidation.validation_command,
    validation_index: latestValidation.final_index,
  };
}

function parseFirstSupportedPostChangeValidation(
  commands,
  expectedWorkflow,
  reproductionContract,
  activities = commands,
  workspace = null,
) {
  for (let length = 1; length <= commands.length; length += 1) {
    const validation = parseSupportedPostChangeValidation(
      commands.slice(0, length),
      expectedWorkflow,
      reproductionContract,
      activities,
      workspace,
    );
    if (validation?.final_index === commands[length - 1].index) {
      return validation;
    }
  }
  return null;
}

function canonicalValidationCommand(command, workspace = null) {
  const text = observedCommandText(command, workspace);
  if (text === null) return null;
  if (
    text.length === 0 ||
    text !== text.trim() ||
    /[\r\n;&|`!<>#$]/u.test(text) ||
    !isSupportedValidationInvocation(text)
  ) {
    return null;
  }
  return text;
}

function canonicalTestValidationCommand(command, workspace = null) {
  const text = canonicalValidationCommand(command, workspace);
  if (text === null) return null;
  return isTestValidationInvocation(text) ? text : null;
}

function canonicalBuildValidationCommand(command, workspace = null) {
  const text = observedCommandText(command, workspace);
  if (text === null || text.length === 0 || text !== text.trim()) return null;
  const commands = text.split(" && ");
  if (
    commands.length === 0 ||
    commands.length > 6 ||
    new Set(commands).size !== commands.length ||
    commands.some((candidate) => canonicalValidationCommand(candidate) !== candidate) ||
    !commands.some((candidate) => isTestValidationInvocation(candidate))
  ) {
    return null;
  }
  return commands.join(" && ");
}

function isTestValidationInvocation(command) {
  const script = "test(?::[A-Za-z0-9_.-]+)?";
  return [
    new RegExp(`^(?:bun|npm|pnpm|yarn)\\s+(?:run\\s+)?${script}(?:\\s|$)`, "iu"),
    /^cargo\s+test(?:\s|$)/iu,
    /^go\s+test(?:\s|$)/iu,
    /^(?:gradle|\.\/gradlew)\s+test(?:\s|$)/iu,
    new RegExp(`^make\\s+${script}(?:\\s|$)`, "iu"),
    /^mvn\s+(?:test|verify)(?:\s|$)/iu,
    /^node\s+--test(?:\s|$)/iu,
    /^(?:python3?\s+-m\s+)?pytest(?:\s|$)/iu,
  ].some((pattern) => pattern.test(command));
}

function unwrapShellInvocation(command) {
  const text = String(command ?? "");
  const shellPrefix = /^(?:(?:\/(?:usr\/)?bin\/)?(?:bash|sh|zsh))\s+-lc\s+/u;
  if (!shellPrefix.test(text)) return text;
  const wrapped = text.match(
    /^(?:(?:\/(?:usr\/)?bin\/)?(?:bash|sh|zsh))\s+-lc\s+(['"])([\s\S]*)\1$/u,
  );
  return wrapped?.[2] ?? null;
}

function isSupportedValidationInvocation(command) {
  if (
    /(?:^|\s)(?:--allow-?no-?tests|--collect-?only|--co|--dry-?run|--help|--if-present|--ignore-scripts|--list-?tests?|--no-run|--pass-?with-?no-?tests|--version)(?:[=\s]|$)/iu
      .test(command) ||
    /(?:^|\s)(?:-V|-h)(?:\s|$)/u.test(command) ||
    /(?:^|\s)-run\s+['"]?\^\$['"]?(?:\s|$)/u.test(command) ||
    /(?:^|\s)--test-name-pattern(?:=|\s+)['"]?\^\$['"]?(?:\s|$)/u.test(command)
  ) {
    return false;
  }
  const script = "(?:build|check|lint|test|typecheck)(?::[A-Za-z0-9_.-]+)?";
  return [
    new RegExp(`^(?:bun|npm|pnpm|yarn)\\s+(?:run\\s+)?${script}(?:\\s|$)`, "iu"),
    /^cargo\s+(?:build|check|clippy|test)(?:\s|$)/iu,
    /^go\s+(?:build|test|vet)(?:\s|$)/iu,
    /^(?:gradle|\.\/gradlew)\s+(?:build|check|lint|test)(?:\s|$)/iu,
    new RegExp(`^make\\s+${script}(?:\\s|$)`, "iu"),
    /^mvn\s+(?:package|test|verify)(?:\s|$)/iu,
    /^node\s+--test(?:\s|$)/iu,
    /^(?:python3?\s+-m\s+)?pytest(?:\s|$)/iu,
  ].some((pattern) => pattern.test(command));
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

export function classifyQualityReviewVerdict(message) {
  const source = String(message ?? "").replace(/\r\n/gu, "\n");
  if (classifyReviewVerdict(source) !== null) {
    return classifyReviewVerdict(source);
  }
  try {
    const parsed = JSON.parse(source);
    if (
      parsed !== null &&
      typeof parsed === "object" &&
      !Array.isArray(parsed) &&
      String(parsed.verdict ?? "").toLowerCase() === "pass" &&
      Array.isArray(parsed.findings) &&
      parsed.findings.length === 0 &&
      Array.isArray(parsed.unverified_areas) &&
      parsed.unverified_areas.length === 0
    ) {
      return "pass";
    }
  } catch {
    // Continue with a surface-tolerant closed-field parse.
  }
  const normalized = source
    .replace(/^\s*```[^\r\n]*\r?\n/gu, "")
    .replace(/\r?\n```\s*$/gu, "")
    .trim();
  if (/^verdict\s*:\s*(?!pass\s*$).+$/imu.test(normalized)) return null;
  return /^verdict\s*:\s*pass\s*$[\s\S]*^findings\s*:\s*\[\]\s*$[\s\S]*^unverified_areas\s*:\s*\[\]\s*$/imu.test(
    normalized,
  )
    ? "pass"
    : null;
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
  const verifier = run?.verifier ?? {};
  const visible = verifier?.visible ?? {};
  const hidden = verifier?.hidden ?? {};
  if (run.agent_exit_code !== 0) reasons.push("agent exited non-zero");
  if (run.agent_timed_out) reasons.push("agent timed out");
  if (!run.agent_completed) reasons.push("agent did not complete a turn");
  if (!run.head_unchanged) reasons.push("agent moved the benchmark Git HEAD");
  if (!validCaseSnapshotEvidence(run.case_snapshot)) {
    reasons.push("case snapshot evidence was missing or malformed");
  }
  if (run.verifier_workspace_unchanged !== true) {
    reasons.push("verifier changed the original candidate workspace");
  }
  if (!completeVerifierCommandEvidence(visible)) {
    reasons.push("visible regression evidence was incomplete");
  }
  if (!completeVerifierCommandEvidence(hidden)) {
    reasons.push("hidden verifier evidence was incomplete");
  }
  if (visible.timed_out === true) reasons.push("visible regression suite timed out");
  if (hidden.timed_out === true) reasons.push("hidden verifier timed out");
  if (visible.output_limited === true) reasons.push("visible regression suite exceeded its output limit");
  if (hidden.output_limited === true) reasons.push("hidden verifier exceeded its output limit");
  if (!isVerifierSandboxMode(visible.sandbox) || hidden.sandbox !== visible.sandbox) {
    reasons.push("verifier sandbox evidence was missing or inconsistent");
  }
  if (visible.exit_code !== 0) reasons.push("visible regression suite failed");
  if (hidden.exit_code !== 0) reasons.push("hidden verifier failed");
  const rawRequiredArtifactGateIds =
    run.required_artifact_regression_gate_ids;
  const requiredArtifactGateIds = Array.isArray(rawRequiredArtifactGateIds)
    ? rawRequiredArtifactGateIds
    : [];
  if (
    !Array.isArray(rawRequiredArtifactGateIds)
  ) {
    reasons.push("required artifact regression gate ids were malformed");
  }
  const requiredArtifactGates = Array.isArray(
    run.required_artifact_regression_gates,
  )
    ? run.required_artifact_regression_gates
    : [];
  if (
    !Array.isArray(run.required_artifact_regression_gates)
  ) {
    reasons.push("required artifact regression gate contracts were malformed");
  }
  const validRequiredIds = requiredArtifactGateIds.every((id) =>
    typeof id === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(id)
  );
  if (!validRequiredIds) {
    reasons.push("required artifact regression gate ids were malformed");
  }
  if (new Set(requiredArtifactGateIds).size !== requiredArtifactGateIds.length) {
    reasons.push("required artifact regression gate ids were duplicated");
  }
  const contractsMatchIds =
    requiredArtifactGates.length === requiredArtifactGateIds.length &&
    requiredArtifactGates.every((contract, index) =>
      contract !== null &&
      typeof contract === "object" &&
      hasExactObjectKeys(contract, [
        "export_name",
        "id",
        "member_count",
        "mutation_manifest_sha256",
        "policy",
        "target",
      ]) &&
      contract.id === requiredArtifactGateIds[index] &&
      ARTIFACT_GATE_POLICIES.has(contract.policy) &&
      isSafeRelativePath(contract.target) &&
      typeof contract.export_name === "string" &&
      contract.export_name !== "default" &&
      /^[A-Za-z_$][A-Za-z0-9_$]*$/u.test(contract.export_name) &&
      Number.isInteger(contract.member_count) &&
      contract.member_count > 0 &&
      /^[a-f0-9]{64}$/u.test(String(contract.mutation_manifest_sha256 ?? ""))
    );
  if (!contractsMatchIds) {
    reasons.push("required artifact regression gate contracts did not match ids");
  }
  let requiredArtifactManifestSha256 = null;
  if (contractsMatchIds) {
    try {
      requiredArtifactManifestSha256 = artifactGateContractManifestSha256(
        requiredArtifactGates,
      );
    } catch {
      // The contract-shape reason above or the snapshot mismatch below is sufficient.
    }
  }
  if (requiredArtifactManifestSha256 !== run?.case_snapshot?.mutants_sha256) {
    reasons.push("required artifact regression gates did not match the case snapshot");
  }
  if (requiredArtifactGateIds.length > 0) {
    const artifactRegression = verifier.artifact_regression;
    if (
      artifactRegression === null ||
      typeof artifactRegression !== "object" ||
      Array.isArray(artifactRegression)
    ) {
      reasons.push("artifact regression evidence was missing");
    } else {
      if (!hasExactObjectKeys(artifactRegression, [
        "gates",
        "required_gate_ids",
        "status",
      ])) {
        reasons.push("artifact regression evidence contained unexpected fields");
      }
      const expectedIds = new Set(requiredArtifactGateIds);
      if (
        !Array.isArray(artifactRegression.required_gate_ids) ||
        artifactRegression.required_gate_ids.length !== requiredArtifactGateIds.length ||
        new Set(artifactRegression.required_gate_ids).size !==
          artifactRegression.required_gate_ids.length ||
        artifactRegression.required_gate_ids.some(
          (id) => typeof id !== "string" || !expectedIds.has(id),
        ) ||
        requiredArtifactGateIds.some(
          (id) => !artifactRegression.required_gate_ids.includes(id),
        )
      ) {
        reasons.push("artifact regression required-gate manifest did not match the case");
      }
      if (artifactRegression.status !== "PASS") {
        reasons.push("artifact regression evidence did not pass");
      }
      const observedGates = Array.isArray(artifactRegression.gates)
        ? artifactRegression.gates
        : [];
      if (!Array.isArray(artifactRegression.gates)) {
        reasons.push("artifact regression gate evidence was malformed");
      }
      for (const gateId of expectedIds) {
        const matching = observedGates.filter((gate) => gate?.id === gateId);
        if (matching.length !== 1) {
          reasons.push(`artifact regression gate ${gateId} was missing or duplicated`);
        } else if (matching[0].status !== "PASS") {
          const gateReasons = matching[0].reasons?.length > 0
            ? matching[0].reasons
            : ["failed"];
          for (const reason of gateReasons) {
            reasons.push(`artifact regression gate ${gateId}: ${reason}`);
          }
        } else {
          const expectedGate = requiredArtifactGates.find(
            (gate) => gate?.id === gateId,
          );
          for (const reason of artifactGateEvidenceProblems(
            matching[0],
            expectedGate,
          )) {
            reasons.push(`artifact regression gate ${gateId}: ${reason}`);
          }
        }
      }
      if (observedGates.some((gate) => !expectedIds.has(gate?.id))) {
        reasons.push("artifact regression evidence contained an unexpected gate");
      }
    }
  } else if (verifier.artifact_regression !== null &&
    verifier.artifact_regression !== undefined) {
    reasons.push("unexpected artifact regression evidence was present");
  }
  if (!Array.isArray(run?.changes?.violations) || run.changes.violations.length > 0) {
    reasons.push("changed paths violated scope policy");
  }
  return {
    status: reasons.length === 0 ? "PASS" : "FAIL",
    reasons,
  };
}

function validCaseSnapshotEvidence(snapshot) {
  return snapshot !== null &&
    typeof snapshot === "object" &&
    !Array.isArray(snapshot) &&
    Object.keys(snapshot).sort().join(",") ===
      "mutants_sha256,verifier_sha256,workspace_sha256" &&
    [
      snapshot.mutants_sha256,
      snapshot.verifier_sha256,
      snapshot.workspace_sha256,
    ].every((value) => /^[a-f0-9]{64}$/u.test(String(value ?? "")));
}

function hasExactObjectKeys(value, keys) {
  return value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).sort().join(",") === [...keys].sort().join(",");
}

function completeVerifierCommandEvidence(evidence) {
  return hasExactObjectKeys(evidence, [
    "exit_code",
    "output",
    "output_limited",
    "sandbox",
    "signal",
    "timed_out",
  ]) &&
    Number.isInteger(evidence.exit_code) &&
    evidence.exit_code >= 0 &&
    evidence.exit_code <= 255 &&
    evidence.output_limited === false &&
    isVerifierSandboxMode(evidence.sandbox) &&
    evidence.timed_out === false &&
    evidence.signal === null &&
    typeof evidence.output === "string";
}

function isVerifierSandboxMode(value) {
  return typeof value === "string" && VERIFIER_SANDBOX_MODES.has(value);
}

function artifactGateEvidenceProblems(gate, expectedGate) {
  const reasons = [];
  const hasLiveEvidence = hasExactObjectKeys(gate, [
    "candidate_visible_test_paths",
    "changed_visible_test_paths",
    "export_name",
    "id",
    "member_count",
    "members",
    "mutation_manifest_sha256",
    "policy",
    "reasons",
    "status",
    "target",
  ]);
  const hasPublishedSummary = hasExactObjectKeys(gate, [
    "baseline_pass_count",
    "candidate_complete_count",
    "candidate_visible_test_paths",
    "changed_visible_test_paths",
    "evidence_sha256",
    "export_name",
    "id",
    "killed_member_count",
    "member_count",
    "mutation_manifest_sha256",
    "policy",
    "reasons",
    "status",
    "target",
  ]);
  if (!hasLiveEvidence && !hasPublishedSummary) {
    reasons.push("mutation family evidence contained unexpected fields");
  }
  if (
    expectedGate === undefined ||
    gate.policy !== expectedGate?.policy ||
    !ARTIFACT_GATE_POLICIES.has(gate.policy)
  ) {
    reasons.push("mutation policy evidence was missing or inconsistent");
  }
  if (
    expectedGate === undefined ||
    !isSafeRelativePath(gate.target) ||
    gate.target !== expectedGate?.target
  ) {
    reasons.push("mutation target evidence was missing or inconsistent");
  }
  if (
    typeof gate.export_name !== "string" ||
    gate.export_name !== expectedGate?.export_name
  ) {
    reasons.push("mutation export evidence was missing or inconsistent");
  }
  if (
    !/^[a-f0-9]{64}$/u.test(String(gate.mutation_manifest_sha256 ?? "")) ||
    gate.mutation_manifest_sha256 !== expectedGate?.mutation_manifest_sha256
  ) {
    reasons.push("mutation family snapshot evidence was missing or inconsistent");
  }
  if (
    Object.hasOwn(gate, "replacement") ||
    Object.hasOwn(gate, "mutation") ||
    Object.hasOwn(gate, "mutations")
  ) {
    reasons.push("mutation replacement content leaked into result evidence");
  }
  const changedTestPaths = gate.changed_visible_test_paths;
  const candidateTestPaths = gate.candidate_visible_test_paths;
  if (
    !Array.isArray(changedTestPaths) ||
    !Array.isArray(candidateTestPaths) ||
    candidateTestPaths.length === 0 ||
    new Set(changedTestPaths).size !== changedTestPaths.length ||
    new Set(candidateTestPaths).size !== candidateTestPaths.length ||
    [...changedTestPaths, ...candidateTestPaths].some(
      (candidate) => !isSafeRelativePath(candidate),
    ) ||
    candidateTestPaths.some((candidate) => !changedTestPaths.includes(candidate))
  ) {
    reasons.push("candidate visible test delta evidence was missing or inconsistent");
  }
  if (!Array.isArray(gate.reasons) || gate.reasons.length !== 0) {
    reasons.push("passing artifact gate retained failure reasons");
  }
  if (hasPublishedSummary) {
    const counts = [
      gate.baseline_pass_count,
      gate.candidate_complete_count,
      gate.killed_member_count,
    ];
    if (
      gate.member_count !== expectedGate?.member_count ||
      !Number.isInteger(gate.member_count) ||
      gate.member_count <= 0 ||
      counts.some((count) =>
        !Number.isInteger(count) || count < 0 || count > gate.member_count
      )
    ) {
      reasons.push("mutation family summary counts were missing or inconsistent");
    } else if (
      gate.status === "PASS" &&
      counts.some((count) => count !== gate.member_count)
    ) {
      reasons.push("passing mutation family summary was incomplete");
    }
    if (!/^[a-f0-9]{64}$/u.test(String(gate.evidence_sha256 ?? ""))) {
      reasons.push("mutation family summary hash was missing or malformed");
    }
    return reasons;
  }
  const members = Array.isArray(gate.members) ? gate.members : [];
  if (
    gate.member_count !== expectedGate?.member_count ||
    !Array.isArray(gate.members) ||
    members.length !== expectedGate?.member_count ||
    members.some((member, index) =>
      member === null ||
      typeof member !== "object" ||
      !hasExactObjectKeys(member, [
        "baseline_tests_mutant_visible",
        "candidate_tests_mutant_visible",
        "index",
        "killed",
        "replacement_sha256",
      ]) ||
      member.index !== index + 1 ||
      !/^[a-f0-9]{64}$/u.test(String(member.replacement_sha256 ?? "")) ||
      Object.hasOwn(member, "replacement") ||
      Object.hasOwn(member, "source")
    )
  ) {
    reasons.push("mutation family member evidence was missing or inconsistent");
  } else {
    let observedManifest = null;
    try {
      observedManifest = artifactFamilyManifestSha256({
        id: gate.id,
        policy: gate.policy,
        target: gate.target,
        exportName: gate.export_name,
        replacementSha256s: members.map(({ replacement_sha256 }) =>
          replacement_sha256
        ),
      });
    } catch {
      // The structural reason above or the manifest mismatch below is sufficient.
    }
    if (observedManifest !== gate.mutation_manifest_sha256) {
      reasons.push("mutation family members did not match the declared snapshot");
    }
    for (const member of members) {
      if (!passingBaselineMutantEvidence(member.baseline_tests_mutant_visible)) {
        reasons.push("baseline-test counterfactual evidence was incomplete or non-passing");
        break;
      }
    }
    for (const member of members) {
      if (!completeArtifactMutantEvidence(member.candidate_tests_mutant_visible)) {
        reasons.push("candidate-test mutant evidence was incomplete");
        break;
      }
      if (
        member.killed !==
          (member.candidate_tests_mutant_visible.exit_code !== 0)
      ) {
        reasons.push("candidate-test mutant kill evidence was inconsistent");
        break;
      }
    }
    const killed = members.map(({ killed }) => killed === true);
    if (
      gate.policy === "all-kill" &&
      (killed.length === 0 || killed.some((value) => !value))
    ) {
      reasons.push("candidate tests did not kill every semantic fault member");
    }
  }
  return reasons;
}

function passingBaselineMutantEvidence(evidence) {
  return completeArtifactMutantEvidence(evidence) &&
    evidence.exit_code === 0 &&
    evidence.signal === null;
}

function completeArtifactMutantEvidence(evidence) {
  return hasExactObjectKeys(evidence, [
    "exit_code",
    "output",
    "output_limited",
    "sandbox",
    "signal",
    "timed_out",
  ]) &&
    Number.isInteger(evidence.exit_code) &&
    evidence.exit_code >= 0 &&
    evidence.exit_code <= 255 &&
    evidence.output_limited === false &&
    isVerifierSandboxMode(evidence.sandbox) &&
    evidence.timed_out === false &&
    evidence.signal === null &&
    typeof evidence.output === "string";
}

export function evaluateWorkflowConformance(run) {
  const reasons = [];
  if (!run.activation_reported) reasons.push("top-level workflow declaration was not reported");
  if (run.workflow === "leanpowers-0.2.0") {
    if (!run.route_ledger_reported) {
      reasons.push("structured LeanPowers route declaration was not reported");
    }
    if (
      run.expected_workflow &&
      run.declared_workflow !== run.expected_workflow
    ) {
      reasons.push(
        `declared ${run.declared_workflow ?? "no"} workflow instead of ${run.expected_workflow}`,
      );
    }
    const expectedRiskRank = riskRank(run.risk_level);
    const declaredRiskRank = riskRank(run.declared_risk);
    if (!run.declared_risk) {
      reasons.push("risk declaration was not reported");
    } else if (
      expectedRiskRank === null ||
      declaredRiskRank === null ||
      declaredRiskRank < expectedRiskRank
    ) {
      reasons.push(`declared ${run.declared_risk} risk instead of ${run.risk_level}`);
    }
    if (["build", "debug"].includes(run.expected_workflow)) {
      const capsule = run.telemetry?.workflow_trace?.capsule_stage;
      if (!capsule) {
        reasons.push("capsule stage trace was unavailable");
      } else {
        if (!capsule.route_declarations_consistent) {
          reasons.push("route declarations were missing or conflicting");
        }
        if (!capsule.risk_monotonic_observed) {
          reasons.push("route risk was downgraded after an upgrade");
        }
        if (!capsule.ledger_before_tools_observed) {
          reasons.push("route ledger was not emitted before task tools");
        }
        if (!capsule.quality_pre_change_evidence_observed) {
          reasons.push(run.expected_workflow === "build"
            ? "ordered pre-product source and failing RED evidence was not observed"
            : "ordered pre-change source and reproduction evidence was not observed");
        }
        if (!capsule.quality_read_observed) {
          reasons.push("pre-change source READ evidence was not observed");
        }
        if (!capsule.quality_patch_targets_read_observed) {
          reasons.push("READ omitted discovered files that were later changed");
        }
        if (run.expected_workflow === "debug" && !capsule.reproduce_observed) {
          reasons.push("pre-edit executable REPRODUCE was not observed");
        }
        if (!capsule.patch_protocol_observed) {
          reasons.push(run.expected_workflow === "build"
            ? "ordered TEST-PATCH, RED, and CODE-PATCH protocol was not observed"
            : "uninterrupted code-and-test mutation window was not observed");
        }
        if (
          run.expected_workflow === "debug" &&
          capsule.patch_protocol_observed === true &&
          (
            !Number.isInteger(capsule.debug_recovery_count) ||
            capsule.debug_recovery_count < 0 ||
            capsule.debug_recovery_count > 1 ||
            (
              capsule.debug_recovery_count > 0 &&
              capsule.debug_recovery_protocol_observed !== true
            )
          )
        ) {
          reasons.push("bounded DEBUG recovery protocol was not observed");
        }
        if (!capsule.quality_validation_observed) {
          reasons.push("supported successful post-edit validation was not observed");
        }
        if (
          run.risk_level !== "strict" &&
          run.declared_risk !== "strict" &&
          capsule.highest_presented_risk !== "strict" &&
          capsule.quality_validation_observed === true &&
          capsule.final_stop_observed !== true
        ) {
          reasons.push("unsafe activity occurred after first successful validation");
        }
      }
    }
    const strictRequired =
      run.risk_level === "strict" ||
      run.declared_risk === "strict" ||
      run.telemetry?.workflow_trace?.capsule_stage?.highest_presented_risk === "strict";
    const passingStrictReviewObserved =
      run.telemetry?.workflow_trace?.quality_independent_review_pass_observed === true;
    if (
      strictRequired &&
      !passingStrictReviewObserved
    ) {
      reasons.push("current passing independent review was not observed");
    } else if (
      strictRequired &&
      !run.telemetry?.workflow_trace?.quality_independent_review_context_observed
    ) {
      reasons.push("passing independent review did not receive the complete task contract");
    }
    if (
      strictRequired &&
      passingStrictReviewObserved &&
      !run.telemetry?.workflow_trace
        ?.quality_independent_review_current_validation_observed
    ) {
      reasons.push("passing independent review lacked current validation context");
    }
    if (
      strictRequired &&
      passingStrictReviewObserved &&
      !run.telemetry?.workflow_trace?.reviewer_workspace_mutation_check_observed
    ) {
      reasons.push("reviewer workspace mutation check was not observed");
    } else if (
      strictRequired &&
      passingStrictReviewObserved &&
      run.telemetry?.workflow_trace?.reviewer_workspace_mutation_observed
    ) {
      reasons.push("designated reviewer mutated the workspace");
    }
    if (
      strictRequired &&
      passingStrictReviewObserved &&
      run.telemetry?.workflow_trace?.strict_final_stop_observed !== true
    ) {
      reasons.push("unsafe activity occurred after the final passing independent review");
    }
  }
  return { status: reasons.length === 0 ? "PASS" : "FAIL", reasons };
}

function riskRank(risk) {
  const rank = { lean: 0, standard: 1, strict: 2 }[risk];
  return Number.isInteger(rank) ? rank : null;
}

export function resolveDevelopmentOutputDirectory(outputDirectory) {
  const resolved = path.resolve(outputDirectory);
  assertDevelopmentOutputBoundary(resolved);
  return resolved;
}

function assertDevelopmentOutputBoundary(resolved) {
  if (
    isSameOrAncestor(PROJECT_ROOT, resolved) &&
    !isSameOrAncestor(SAFE_LOCAL_RESULTS_ROOT, resolved)
  ) {
    throw new Error("Repository-local benchmark output must stay under ignored evals/results/");
  }
}

export async function runVerifier({
  environment = {},
  workspace,
  verifierFiles,
  verifierSnapshots,
}) {
  const verifierRoot = await mkdtemp(path.join(os.tmpdir(), "lp-eval-"));
  const sandboxHome = path.join(verifierRoot, "home");
  const sandboxWorkspace = path.join(verifierRoot, "workspace");
  try {
    if (await workspaceContainsSymlink(workspace)) {
      const rejected = failedPublicCommandResult(
        "workspace symlinks are unsupported by the verifier",
      );
      return { visible: rejected, hidden: rejected };
    }
    const snapshots = verifierSnapshots ?? await snapshotVerifierFiles(verifierFiles);
    validateVerifierSnapshots(snapshots);
    await prepareVerifierSandboxCopy({
      sandboxHome,
      sandboxWorkspace,
      workspace,
    });
    const visible = await runSandboxedNpmTest({
      cwd: sandboxWorkspace,
      env: verifierEnvironment(sandboxHome, environment),
      timeoutMs: 120_000,
    });
    await prepareVerifierSandboxCopy({
      sandboxHome,
      sandboxWorkspace,
      workspace,
    });
    const hidden = await runSandboxedNpmTest({
      cwd: sandboxWorkspace,
      env: verifierEnvironment(sandboxHome, environment),
      verifierSnapshots: snapshots,
      timeoutMs: 120_000,
    });
    const redactPaths = [
      verifierRoot,
      sandboxHome,
      sandboxWorkspace,
      workspace,
    ];
    return {
      visible: publicCommandResult(visible, { redactPaths }),
      hidden: publicCommandResult(hidden, { redactPaths }),
    };
  } finally {
    await rm(verifierRoot, { force: true, recursive: true });
  }
}

async function prepareVerifierSandboxCopy({ sandboxHome, sandboxWorkspace, workspace }) {
  await Promise.all([
    rm(sandboxHome, { force: true, recursive: true }),
    rm(sandboxWorkspace, { force: true, recursive: true }),
  ]);
  await Promise.all([
    cp(workspace, sandboxWorkspace, {
      recursive: true,
      verbatimSymlinks: true,
    }),
    mkdir(path.join(sandboxHome, "tmp"), { recursive: true }),
  ]);
  if (await workspaceContainsSymlink(sandboxWorkspace)) {
    throw new Error("workspace changed to contain a symlink while the verifier copied it");
  }
}

async function snapshotVerifierFiles(verifierFiles) {
  if (!Array.isArray(verifierFiles) || verifierFiles.length === 0) {
    throw new Error("verifier files must be a non-empty array");
  }
  const snapshots = [];
  for (const verifierFile of verifierFiles) {
    const stat = await lstat(verifierFile);
    if (!stat.isFile()) throw new Error("verifier input was not a direct regular file");
    const source = await readFile(verifierFile, "utf8");
    snapshots.push({
      sha256: createHash("sha256").update(source).digest("hex"),
      source,
    });
  }
  return snapshots;
}

function validateVerifierSnapshots(snapshots) {
  if (!Array.isArray(snapshots) || snapshots.length === 0) {
    throw new Error("verifier snapshots must be a non-empty array");
  }
  for (const snapshot of snapshots) {
    const digest = typeof snapshot?.source === "string"
      ? createHash("sha256").update(snapshot.source).digest("hex")
      : null;
    if (digest === null || digest !== snapshot?.sha256) {
      throw new Error("verifier snapshot hash did not match its source");
    }
  }
}

function verifierSnapshotManifestSha256(snapshots) {
  validateVerifierSnapshots(snapshots);
  const hash = createHash("sha256");
  for (const [index, snapshot] of snapshots.entries()) {
    updateFingerprint(hash, `verifier:${index + 1}`, snapshot.sha256);
  }
  return hash.digest("hex");
}

export function caseSnapshotContract(benchmarkCase) {
  const workspaceSha256 = benchmarkCase?.workspace_snapshot?.sha256;
  const verifierSha256 = verifierSnapshotManifestSha256(
    benchmarkCase?.verifier_snapshots,
  );
  if (!/^[a-f0-9]{64}$/u.test(String(workspaceSha256 ?? ""))) {
    throw new Error("benchmark case workspace snapshot hash was missing");
  }
  return {
    mutants_sha256: artifactMutationManifestSha256(
      benchmarkCase?.artifact_regression_gates ?? [],
    ),
    verifier_sha256: verifierSha256,
    workspace_sha256: workspaceSha256,
  };
}

function artifactMutationManifestSha256(gates) {
  if (!Array.isArray(gates)) {
    throw new Error("artifact mutation gates were malformed");
  }
  return artifactGateContractManifestSha256(gates.map((gate) => {
    const mutationManifestSha256 = artifactGateMutationManifestSha256(gate);
    if (
      typeof gate?.id !== "string" ||
      !ARTIFACT_GATE_POLICIES.has(gate?.policy) ||
      !isSafeRelativePath(gate?.target) ||
      typeof gate?.export_name !== "string" ||
      mutationManifestSha256 !== gate?.mutation_manifest_sha256
    ) {
      throw new Error("artifact mutation manifest was incomplete");
    }
    return {
      id: gate.id,
      policy: gate.policy,
      target: gate.target,
      export_name: gate.export_name,
      member_count: gate.mutations.length,
      mutation_manifest_sha256: mutationManifestSha256,
    };
  }));
}

function artifactGateMutationManifestSha256(gate) {
  if (!Array.isArray(gate?.mutations) || gate.mutations.length === 0) {
    throw new Error("artifact mutation family was malformed");
  }
  return artifactFamilyManifestSha256({
    id: gate.id,
    policy: gate.policy,
    target: gate.target ?? gate.mutations[0]?.target,
    exportName: gate.export_name ?? gate.mutations[0]?.export_name,
    replacementSha256s: gate.mutations.map(
      ({ replacement_sha256 }) => replacement_sha256,
    ),
  });
}

function artifactFamilyManifestSha256({
  id,
  policy,
  target,
  exportName,
  replacementSha256s,
}) {
  if (
    typeof id !== "string" ||
    !ARTIFACT_GATE_POLICIES.has(policy) ||
    !isSafeRelativePath(target) ||
    typeof exportName !== "string" ||
    exportName === "default" ||
    !/^[A-Za-z_$][A-Za-z0-9_$]*$/u.test(exportName) ||
    !Array.isArray(replacementSha256s) ||
    replacementSha256s.length === 0 ||
    replacementSha256s.some(
      (digest) => !/^[a-f0-9]{64}$/u.test(String(digest ?? "")),
    )
  ) {
    throw new Error("artifact mutation family manifest was incomplete");
  }
  const hash = createHash("sha256");
  updateFingerprint(hash, `fault-family:${id}:policy`, policy);
  updateFingerprint(hash, `fault-family:${id}:target`, target);
  updateFingerprint(hash, `fault-family:${id}:export`, exportName);
  for (const [index, digest] of replacementSha256s.entries()) {
    updateFingerprint(hash, `fault-family:${id}:member:${index + 1}`, digest);
  }
  return hash.digest("hex");
}

function artifactGateContractManifestSha256(contracts) {
  if (!Array.isArray(contracts)) {
    throw new Error("artifact gate contracts were malformed");
  }
  const hash = createHash("sha256");
  for (const [index, contract] of contracts.entries()) {
    if (
      typeof contract?.id !== "string" ||
      !ARTIFACT_GATE_POLICIES.has(contract?.policy) ||
      !isSafeRelativePath(contract?.target) ||
      typeof contract?.export_name !== "string" ||
      contract.export_name === "default" ||
      !/^[A-Za-z_$][A-Za-z0-9_$]*$/u.test(contract.export_name) ||
      !Number.isInteger(contract?.member_count) ||
      contract.member_count < 1 ||
      !/^[a-f0-9]{64}$/u.test(String(contract?.mutation_manifest_sha256 ?? ""))
    ) {
      throw new Error("artifact gate contract manifest was incomplete");
    }
    updateFingerprint(
      hash,
      `fault-family:${index + 1}:${contract.id}:${contract.policy}:${contract.target}:${contract.export_name}:${contract.member_count}`,
      contract.mutation_manifest_sha256,
    );
  }
  return hash.digest("hex");
}

function verifierEnvironment(home, environment) {
  return benchmarkEnvironment(home, {
    HOSTNAME: "leanpowers-sandbox",
    LOGNAME: "sandbox",
    PATH: typeof environment?.PATH === "string"
      ? environment.PATH
      : FALLBACK_BENCHMARK_PATH,
    SHELL: typeof environment?.SHELL === "string"
      ? environment.SHELL
      : process.platform === "win32" ? "cmd.exe" : "/bin/sh",
    USER: "sandbox",
  });
}

async function runSandboxedNpmTest({ cwd, env, timeoutMs, verifierSnapshots }) {
  const workspace = await realpath(cwd);
  const sandboxHome = await realpath(env.HOME);
  let command;
  let args;
  let input;
  let sandboxMode;
  if (process.platform === "darwin") {
    command = "/usr/bin/sandbox-exec";
    try {
      await access(command, fsConstants.X_OK);
    } catch {
      return unavailableVerifierSandboxResult("macOS sandbox-exec is unavailable");
    }
    sandboxMode = "macos-seatbelt-hermetic-v2";
    const nestedCommand = verifierSnapshots
      ? hiddenVerifierCommand(verifierSnapshots, workspace)
      : { args: ["test"], command: "npm", input: undefined };
    args = [
      "-p",
      MACOS_VERIFIER_SANDBOX_PROFILE,
      `-DWORKSPACE=${workspace}`,
      `-DSANDBOX_HOME=${sandboxHome}`,
      `-DSANDBOX_ROOT=${path.dirname(workspace)}`,
      `-DHOST_TMP=${realpathSync(os.tmpdir())}`,
      "--",
      nestedCommand.command,
      ...nestedCommand.args,
    ];
    input = nestedCommand.input;
  } else if (process.platform === "linux") {
    command = "/usr/bin/bwrap";
    try {
      await access(command, fsConstants.X_OK);
    } catch {
      return unavailableVerifierSandboxResult("Linux bubblewrap is unavailable");
    }
    sandboxMode = "linux-bubblewrap-hermetic-v2";
    const sandboxWorkspace = "/workspace";
    const sandboxHomePath = path.posix.join("/", "home", "sandbox");
    const linuxRuntime = await resolveLinuxVerifierRuntime(env);
    const nestedCommand = verifierSnapshots
      ? {
          ...hiddenVerifierCommand(verifierSnapshots, sandboxWorkspace),
          command: linuxRuntime.node,
        }
      : { args: ["test"], command: linuxRuntime.npm, input: undefined };
    env = {
      ...env,
      CODEX_HOME: sandboxHomePath,
      HOME: sandboxHomePath,
      HOSTNAME: "leanpowers-sandbox",
      LOGNAME: "sandbox",
      PATH: linuxRuntime.path,
      TMPDIR: `${sandboxHomePath}/tmp`,
      USER: "sandbox",
    };
    args = [
      "--die-with-parent",
      "--new-session",
      "--unshare-net",
      "--unshare-pid",
      "--unshare-ipc",
      "--unshare-uts",
      "--hostname", "leanpowers-sandbox",
      "--unshare-cgroup-try",
      "--ro-bind", "/usr", "/usr",
      "--dir", "/etc",
      "--tmpfs", "/home",
      "--dir",
      sandboxHomePath,
      "--tmpfs", sandboxWorkspace,
      "--dev", "/dev",
      "--proc", "/proc",
      ...linuxRuntime.mountArgs,
      "--ro-bind", workspace, sandboxWorkspace,
      "--bind", sandboxHome, sandboxHomePath,
      "--tmpfs", "/tmp",
      "--tmpfs", "/var/tmp",
      "--chdir", sandboxWorkspace,
      "--",
      nestedCommand.command,
      ...nestedCommand.args,
    ];
    input = nestedCommand.input;
  } else {
    return unavailableVerifierSandboxResult(
      `verifier sandbox is unsupported on ${process.platform}`,
    );
  }
  const result = await runProcess(command, args, {
    cwd: workspace,
    env,
    input,
    maxOutputBytes: VERIFIER_OUTPUT_LIMIT_BYTES,
    timeoutMs,
  });
  return { ...result, sandboxMode };
}

function hiddenVerifierCommand(verifierSnapshots, sandboxWorkspace) {
  validateVerifierSnapshots(verifierSnapshots);
  const moduleUrls = verifierSnapshots.map(({ source }) => {
    const compiled = rewriteVerifierModuleSource(source, sandboxWorkspace);
    return `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`;
  });
  return {
    args: ["--input-type=module"],
    command: "node",
    input: [
      `process.chdir(${JSON.stringify(sandboxWorkspace)});`,
      ...moduleUrls.map((url) => `await import(${JSON.stringify(url)});`),
      "",
    ].join("\n"),
  };
}

function rewriteVerifierModuleSource(source, sandboxWorkspace) {
  const virtualDirectory = path.join(sandboxWorkspace, "test");
  const resolveSpecifier = (specifier) => {
    const resolved = path.resolve(virtualDirectory, specifier);
    if (!isSameOrAncestor(sandboxWorkspace, resolved)) {
      throw new Error("verifier module import escaped the sandbox workspace");
    }
    return pathToFileURL(resolved).href;
  };
  let compiled = String(source).replace(
    /new\s+URL\(\s*(["'])(\.\.?\/[^"']+)\1\s*,\s*import\.meta\.url\s*\)/gu,
    (_match, _quote, specifier) => `new URL(${JSON.stringify(resolveSpecifier(specifier))})`,
  );
  compiled = compiled.replace(
    /(\bfrom\s*|\bimport\s*)(["'])(\.\.?\/[^"']+)\2/gu,
    (_match, prefix, _quote, specifier) =>
      `${prefix}${JSON.stringify(resolveSpecifier(specifier))}`,
  );
  compiled = compiled.replace(
    /(\bimport\s*\(\s*)(["'])(\.\.?\/[^"']+)\2(\s*\))/gu,
    (_match, prefix, _quote, specifier, suffix) =>
      `${prefix}${JSON.stringify(resolveSpecifier(specifier))}${suffix}`,
  );
  return compiled;
}

async function resolveLinuxVerifierRuntime(environment) {
  const args = [];
  for (const systemPath of ["/bin", "/sbin", "/lib", "/lib64"]) {
    try {
      const stat = await lstat(systemPath);
      if (stat.isSymbolicLink()) {
        args.push("--symlink", await readlink(systemPath), systemPath);
      } else {
        args.push("--ro-bind", systemPath, systemPath);
      }
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
  for (const systemFile of ["/etc/ld.so.cache", "/etc/localtime"]) {
    try {
      const stat = await lstat(systemFile);
      if (stat.isFile()) args.push("--ro-bind", systemFile, systemFile);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
  const executables = {};
  const runtimeRoots = new Set();
  for (const executable of ["node", "npm"]) {
    const resolved = await resolveExecutableFromPath(executable, environment.PATH);
    const real = await realpath(resolved);
    executables[executable] = real;
    if (isSameOrAncestor("/usr", real)) continue;
    runtimeRoots.add(approvedLinuxRuntimeRoot(real));
  }
  const minimalRuntimeRoots = [...runtimeRoots].filter((root) =>
    ![...runtimeRoots].some((other) =>
      other !== root && isSameOrAncestor(other, root)
    )
  ).sort();
  for (const root of minimalRuntimeRoots) {
    args.push("--ro-bind", root, root);
  }
  return {
    mountArgs: args,
    node: executables.node,
    npm: executables.npm,
    path: [...new Set([
      path.dirname(executables.node),
      path.dirname(executables.npm),
      "/usr/local/bin",
      "/usr/bin",
      "/bin",
    ])].join(path.delimiter),
  };
}

export function approvedLinuxRuntimeRoot(executable) {
  const marker = `${path.sep}bin${path.sep}`;
  const markerIndex = executable.lastIndexOf(marker);
  if (markerIndex <= 0) {
    throw new Error("verifier runtime executable was outside a bounded bin directory");
  }
  const root = executable.slice(0, markerIndex);
  const broadRoots = new Set([
    "/",
    "/home",
    "/media",
    "/mnt",
    "/root",
    "/run",
    "/tmp",
    "/var",
    "/var/tmp",
  ]);
  if (
    broadRoots.has(root) ||
    /^\/(?:home|Users)\/[^/]+$/u.test(root) ||
    isSameOrAncestor(root, os.homedir()) ||
    isSameOrAncestor(root, realpathSync(os.tmpdir())) ||
    !isSameOrAncestor(root, executable)
  ) {
    throw new Error("verifier runtime root was too broad to mount safely");
  }
  return root;
}

async function resolveExecutableFromPath(command, searchPath) {
  for (const directory of String(searchPath ?? "").split(path.delimiter)) {
    if (!path.isAbsolute(directory)) continue;
    const candidate = path.join(directory, command);
    try {
      await access(candidate, fsConstants.X_OK);
      return candidate;
    } catch {
      // Continue to the next fixed PATH entry.
    }
  }
  throw new Error(`Required verifier executable is unavailable: ${command}`);
}

function unavailableVerifierSandboxResult(message) {
  return {
    exitCode: 1,
    outputLimitExceeded: false,
    sandboxMode: null,
    signal: null,
    stderr: String(message),
    stdout: "",
    timedOut: false,
  };
}

export async function runArtifactRegressionGates({
  baselineHead,
  changedPaths,
  environment = {},
  gates,
  gitExecutable = "git",
  testGlobs,
  workspace,
}) {
  if (!Array.isArray(gates) || gates.length === 0) return null;
  const changedTestPaths = [...new Set(changedPaths.filter((changedPath) =>
    testGlobs.some((pattern) => matchGlob(changedPath, pattern))
  ))].sort();
  const candidateTestPaths = [];
  const invalidTestPaths = [];
  for (const changedPath of changedTestPaths) {
    try {
      const stat = await lstat(path.join(workspace, changedPath));
      if (stat.isFile()) candidateTestPaths.push(changedPath);
      else invalidTestPaths.push(changedPath);
    } catch (error) {
      if (error?.code !== "ENOENT") invalidTestPaths.push(changedPath);
    }
  }
  candidateTestPaths.sort();
  invalidTestPaths.sort();
  const workspaceSymlinkObserved = await workspaceContainsSymlink(workspace);

  const results = [];
  for (const gate of gates) {
    results.push(await runArtifactRegressionGate({
      baselineHead,
      candidateTestPaths,
      changedTestPaths,
      environment,
      gate,
      gitExecutable,
      invalidTestPaths,
      workspace,
      workspaceSymlinkObserved,
    }));
  }
  return {
    required_gate_ids: gates.map(({ id }) => id),
    status: results.every(({ status }) => status === "PASS") ? "PASS" : "FAIL",
    gates: results,
  };
}

function maskJavaScriptStringsAndComments(source) {
  const masked = source.split("");
  let state = "code";
  let templateDepth = 0;
  let regexCharacterClass = false;
  const templateExpressionDepths = [];
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];
    if (state === "code") {
      if (character === "'" || character === '"') {
        state = character === "'"
          ? "single"
          : "double";
        masked[index] = " ";
      } else if (character === "`") {
        templateDepth += 1;
        state = "template";
        masked[index] = " ";
      } else if (character === "/" && next === "/") {
        state = "line-comment";
        masked[index] = " ";
        masked[index + 1] = " ";
        index += 1;
      } else if (character === "/" && next === "*") {
        state = "block-comment";
        masked[index] = " ";
        masked[index + 1] = " ";
        index += 1;
      } else if (character === "/" && isLikelyRegexLiteralStart(source, index)) {
        state = "regex";
        regexCharacterClass = false;
        masked[index] = " ";
      } else if (templateExpressionDepths.length > 0 && character === "{") {
        templateExpressionDepths[templateExpressionDepths.length - 1] += 1;
      } else if (templateExpressionDepths.length > 0 && character === "}") {
        const expressionIndex = templateExpressionDepths.length - 1;
        templateExpressionDepths[expressionIndex] -= 1;
        if (templateExpressionDepths[expressionIndex] === 0) {
          templateExpressionDepths.pop();
          state = "template";
          masked[index] = " ";
        }
      }
      continue;
    }
    if (state === "regex") {
      if (character === "\n" || character === "\r") {
        throw new Error("JavaScript source contained an unterminated regex literal");
      }
      if (character === "\\") {
        masked[index] = " ";
        if (index + 1 < source.length) {
          masked[index + 1] = " ";
          index += 1;
        }
      } else {
        if (character === "[" && !regexCharacterClass) {
          regexCharacterClass = true;
        } else if (character === "]" && regexCharacterClass) {
          regexCharacterClass = false;
        } else if (character === "/" && !regexCharacterClass) {
          state = "code";
        }
        masked[index] = " ";
      }
      continue;
    }
    if (state === "template") {
      if (character === "\\") {
        masked[index] = " ";
        if (index + 1 < source.length) {
          if (source[index + 1] !== "\n" && source[index + 1] !== "\r") {
            masked[index + 1] = " ";
          }
          index += 1;
        }
      } else if (character === "`") {
        templateDepth -= 1;
        state = "code";
        masked[index] = " ";
      } else if (character === "$" && next === "{") {
        templateExpressionDepths.push(1);
        state = "code";
        masked[index] = " ";
        masked[index + 1] = " ";
        index += 1;
      } else if (character !== "\n" && character !== "\r") {
        masked[index] = " ";
      }
      continue;
    }
    if (state === "line-comment") {
      if (character === "\n" || character === "\r") {
        state = "code";
      } else {
        masked[index] = " ";
      }
      continue;
    }
    if (state === "block-comment") {
      if (character === "*" && next === "/") {
        masked[index] = " ";
        masked[index + 1] = " ";
        index += 1;
        state = "code";
      } else if (character !== "\n" && character !== "\r") {
        masked[index] = " ";
      }
      continue;
    }
    if (character === "\\") {
      masked[index] = " ";
      if (index + 1 < source.length) {
        if (source[index + 1] !== "\n" && source[index + 1] !== "\r") {
          masked[index + 1] = " ";
        }
        index += 1;
      }
      continue;
    }
    const closingQuote = state === "single" ? "'" : '"';
    if (character === closingQuote) state = "code";
    if (character !== "\n" && character !== "\r") masked[index] = " ";
  }
  if (
    !["code", "line-comment"].includes(state) ||
    templateDepth !== 0 ||
    templateExpressionDepths.length !== 0
  ) {
    throw new Error("JavaScript source contained unterminated lexical content");
  }
  return masked.join("");
}

function isLikelyRegexLiteralStart(source, slashIndex) {
  const prefix = source.slice(0, slashIndex).trimEnd();
  if (prefix.length === 0) return true;
  const lastCharacter = prefix.at(-1);
  if (/[[({:;,=!?&|+\-*%^~<>]/u.test(lastCharacter)) return true;
  const previousWord = prefix.match(/([A-Za-z_$][A-Za-z0-9_$]*)$/u)?.[1];
  return REGEX_PREFIX_KEYWORDS.has(previousWord);
}

function matchingDelimiterIndex(source, start, opening, closing) {
  let depth = 0;
  for (let index = start; index < source.length; index += 1) {
    if (source[index] === opening) depth += 1;
    if (source[index] === closing) {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function directExportedFunction(source, exportName) {
  const masked = maskJavaScriptStringsAndComments(source);
  const escapedName = exportName.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const pattern = new RegExp(
    `\\bexport\\s+(?:async\\s+)?function\\s+${escapedName}\\s*\\(`,
    "gu",
  );
  const matches = [...masked.matchAll(pattern)];
  if (matches.length !== 1) {
    throw new Error("fault target must contain exactly one direct named function export");
  }
  const start = matches[0].index;
  const openingParenthesis = masked.indexOf("(", start);
  const closingParenthesis = matchingDelimiterIndex(
    masked,
    openingParenthesis,
    "(",
    ")",
  );
  if (closingParenthesis < 0) {
    throw new Error("fault target export parameters were malformed");
  }
  let openingBrace = closingParenthesis + 1;
  while (/\s/u.test(masked[openingBrace] ?? "")) openingBrace += 1;
  if (masked[openingBrace] !== "{") {
    throw new Error("fault target export was not a function declaration");
  }
  const closingBrace = matchingDelimiterIndex(masked, openingBrace, "{", "}");
  if (closingBrace < 0) {
    throw new Error("fault target export body was malformed");
  }
  return { end: closingBrace + 1, start };
}

function directNamedCallableExport(source, exportName) {
  const masked = maskJavaScriptStringsAndComments(source);
  const escapedName = exportName.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const functionPattern = new RegExp(
    `\\bexport\\s+(?:async\\s+)?function\\s+${escapedName}\\s*\\(`,
    "gu",
  );
  const variablePattern = new RegExp(
    `\\bexport\\s+(?:const|let|var)\\s+${escapedName}\\s*=`,
    "gu",
  );
  const functionMatches = [...masked.matchAll(functionPattern)];
  const variableMatches = [...masked.matchAll(variablePattern)];
  if (functionMatches.length + variableMatches.length !== 1) {
    throw new Error("fault target must contain exactly one supported direct named export");
  }
  if (functionMatches.length === 1) {
    return directExportedFunction(source, exportName);
  }

  const match = variableMatches[0];
  const start = match.index;
  const initializerStart = start + match[0].length;
  const depth = { "(": 0, "[": 0, "{": 0 };
  const openingFor = { ")": "(", "]": "[", "}": "{" };
  for (let index = initializerStart; index < masked.length; index += 1) {
    const character = masked[index];
    if (Object.hasOwn(depth, character)) {
      depth[character] += 1;
      continue;
    }
    if (Object.hasOwn(openingFor, character)) {
      const opening = openingFor[character];
      depth[opening] -= 1;
      if (depth[opening] < 0) {
        throw new Error("fault target variable export was malformed");
      }
      continue;
    }
    const atTopLevel = Object.values(depth).every((value) => value === 0);
    if (atTopLevel && character === ",") {
      throw new Error("fault target variable export must bind only one name");
    }
    if (atTopLevel && character === ";") {
      return { end: index + 1, start };
    }
  }
  throw new Error("fault target variable export must end with a semicolon");
}

function replaceDirectNamedFunctionExport(source, replacement, exportName) {
  const target = directNamedCallableExport(source, exportName);
  const replacementFragment = directNamedFunctionExportFragment(
    replacement,
    exportName,
  );
  return `${source.slice(0, target.start)}${replacementFragment}${source.slice(
    target.end,
  )}`;
}

function directNamedFunctionExportFragment(source, exportName) {
  const fault = directExportedFunction(source, exportName);
  const remainingFaultSource = maskJavaScriptStringsAndComments(
    `${source.slice(0, fault.start)}${source.slice(fault.end)}`,
  ).replace(/[;\s]/gu, "");
  if (remainingFaultSource.length > 0) {
    throw new Error("fault replacement must contain only the named function export");
  }
  return source.slice(fault.start, fault.end);
}

async function assertJavaScriptSourceSyntax({ environment, source, workspace }) {
  const syntax = await runProcess(
    process.execPath,
    ["--input-type=module", "--check", "-"],
    {
      cwd: workspace,
      env: environment,
      input: source,
      maxOutputBytes: 100_000,
      timeoutMs: 30_000,
    },
  );
  if (
    syntax.exitCode !== 0 ||
    syntax.timedOut ||
    syntax.outputLimitExceeded ||
    syntax.signal !== null
  ) {
    throw new Error("fault source syntax validation failed");
  }
}

async function runArtifactRegressionGate({
  baselineHead,
  candidateTestPaths,
  changedTestPaths,
  environment,
  gate,
  gitExecutable,
  invalidTestPaths,
  workspace,
  workspaceSymlinkObserved,
}) {
  const mutations = Array.isArray(gate?.mutations) ? gate.mutations : [];
  const target = gate?.target ?? mutations[0]?.target ?? null;
  const exportName = gate?.export_name ?? mutations[0]?.export_name ?? null;
  const memberDigests = mutations.map(({ replacement }) =>
    typeof replacement === "string"
      ? createHash("sha256").update(replacement).digest("hex")
      : null
  );
  let mutationManifestSha256 = null;
  try {
    mutationManifestSha256 = artifactFamilyManifestSha256({
      id: gate?.id,
      policy: gate?.policy,
      target,
      exportName,
      replacementSha256s: memberDigests,
    });
  } catch {
    // The fail-closed result below reports the malformed family.
  }
  const result = {
    id: gate.id,
    policy: gate.policy,
    status: "FAIL",
    target,
    export_name: exportName,
    member_count: mutations.length,
    mutation_manifest_sha256: mutationManifestSha256,
    changed_visible_test_paths: changedTestPaths,
    candidate_visible_test_paths: candidateTestPaths,
    members: mutations.map((mutation, index) => ({
      index: index + 1,
      replacement_sha256: memberDigests[index],
      baseline_tests_mutant_visible: null,
      candidate_tests_mutant_visible: null,
      killed: false,
    })),
    reasons: [],
  };
  const addReason = (reason) => {
    if (!result.reasons.includes(reason)) result.reasons.push(reason);
  };
  if (candidateTestPaths.length === 0) {
    addReason("no candidate visible test delta");
  }
  if (invalidTestPaths.length > 0) {
    addReason("a changed visible test path was not a regular file");
  }
  if (workspaceSymlinkObserved) {
    addReason("workspace symlinks are unsupported by artifact regression gates");
  }
  if (
    !ARTIFACT_GATE_POLICIES.has(gate?.policy) ||
    mutations.length === 0 ||
    !isSafeRelativePath(target) ||
    typeof exportName !== "string" ||
    !/^[A-Za-z_$][A-Za-z0-9_$]*$/u.test(exportName) ||
    mutations.some(
      (mutation, index) =>
        mutation?.kind !== "replace-callable-export" ||
        mutation?.target !== target ||
        mutation?.export_name !== exportName ||
        memberDigests[index] === null ||
        memberDigests[index] !== mutation?.replacement_sha256,
    ) ||
    new Set(memberDigests).size !== memberDigests.length ||
    mutationManifestSha256 === null ||
    mutationManifestSha256 !== gate?.mutation_manifest_sha256
  ) {
    addReason("mutation family snapshot did not match replacement content");
  }
  if (result.reasons.length > 0) return result;

  const evaluationRoot = await mkdtemp(path.join(os.tmpdir(), "lp-eval-"));
  const sandboxHome = path.join(evaluationRoot, "home");
  const sandboxWorkspace = path.join(evaluationRoot, "workspace");
  try {
    let transformedSources;
    try {
      await mkdir(path.join(sandboxHome, "tmp"), { recursive: true });
      const syntaxEnvironment = benchmarkEnvironment(sandboxHome, environment);
      const originalMutationTarget = path.join(workspace, target);
      const originalTargetStat = await lstat(originalMutationTarget);
      if (!originalTargetStat.isFile()) {
        throw new Error("mutation target was not a regular file");
      }
      const candidateSource = await readFile(originalMutationTarget, "utf8");
      await assertJavaScriptSourceSyntax({
        environment: syntaxEnvironment,
        source: candidateSource,
        workspace,
      });
      transformedSources = [];
      for (const mutation of mutations) {
        await assertJavaScriptSourceSyntax({
          environment: syntaxEnvironment,
          source: mutation.replacement,
          workspace,
        });
        const transformedSource = replaceDirectNamedFunctionExport(
          candidateSource,
          mutation.replacement,
          mutation.export_name,
        );
        await assertJavaScriptSourceSyntax({
          environment: syntaxEnvironment,
          source: transformedSource,
          workspace,
        });
        transformedSources.push(transformedSource);
      }
    } catch {
      addReason("mutation source transformation was unsupported or invalid");
      return result;
    }

    const prepareMutationWorkspace = async ({
      baselineTests,
      mutation,
      transformedSource,
    }) => {
      await Promise.all([
        rm(sandboxHome, { force: true, recursive: true }),
        rm(sandboxWorkspace, { force: true, recursive: true }),
      ]);
      await Promise.all([
        cp(workspace, sandboxWorkspace, {
          recursive: true,
          verbatimSymlinks: true,
        }),
        mkdir(path.join(sandboxHome, "tmp"), { recursive: true }),
      ]);
      if (await workspaceContainsSymlink(sandboxWorkspace)) {
        throw new Error("workspace changed to contain a symlink while the artifact gate copied it");
      }
      if (baselineTests) {
        await restoreBaselineTests({
          baselineHead,
          environment: benchmarkEnvironment(sandboxHome, environment),
          gitExecutable,
          testPaths: changedTestPaths,
          workspace: sandboxWorkspace,
        });
      }
      const mutationTarget = path.join(sandboxWorkspace, mutation.target);
      const targetStat = await lstat(mutationTarget);
      if (!targetStat.isFile()) {
        throw new Error("mutation target was not a regular file");
      }
      await writeFile(mutationTarget, transformedSource);
    };

    let candidateRunsComplete = true;
    for (const [index, mutation] of mutations.entries()) {
      const member = result.members[index];
      await prepareMutationWorkspace({
        baselineTests: true,
        mutation,
        transformedSource: transformedSources[index],
      });
      const baselineTestsMutant = await runSandboxedNpmTest({
        cwd: sandboxWorkspace,
        env: verifierEnvironment(sandboxHome, environment),
        timeoutMs: 120_000,
      });
      member.baseline_tests_mutant_visible = publicArtifactCommandResult(
        baselineTestsMutant,
        {
          redactPaths: [evaluationRoot, sandboxHome, sandboxWorkspace, workspace],
        },
      );

      await prepareMutationWorkspace({
        baselineTests: false,
        mutation,
        transformedSource: transformedSources[index],
      });
      const candidateTestsMutant = await runSandboxedNpmTest({
        cwd: sandboxWorkspace,
        env: verifierEnvironment(sandboxHome, environment),
        timeoutMs: 120_000,
      });
      member.candidate_tests_mutant_visible = publicArtifactCommandResult(
        candidateTestsMutant,
        {
          redactPaths: [evaluationRoot, sandboxHome, sandboxWorkspace, workspace],
        },
      );
      member.killed = completeArtifactMutantEvidence(
        member.candidate_tests_mutant_visible,
      ) && candidateTestsMutant.exitCode !== 0;

      if (!completeArtifactMutantEvidence(member.baseline_tests_mutant_visible)) {
        if (baselineTestsMutant.timedOut) {
          addReason("baseline-test counterfactual timed out");
        } else if (baselineTestsMutant.outputLimitExceeded) {
          addReason("baseline-test counterfactual exceeded its output limit");
        } else if (baselineTestsMutant.signal !== null) {
          addReason("baseline-test counterfactual was terminated by a signal");
        } else {
          addReason("baseline-test counterfactual evidence was incomplete");
        }
      } else if (baselineTestsMutant.exitCode !== 0) {
        addReason("baseline-test counterfactual already killed a semantic fault");
      }
      const candidateComplete = completeArtifactMutantEvidence(
        member.candidate_tests_mutant_visible,
      );
      if (!candidateComplete) {
        candidateRunsComplete = false;
      }
      if (candidateTestsMutant.timedOut) {
        addReason("candidate-test semantic fault run timed out");
      } else if (candidateTestsMutant.outputLimitExceeded) {
        addReason("candidate-test semantic fault run exceeded its output limit");
      } else if (candidateTestsMutant.signal !== null) {
        addReason("candidate-test semantic fault run was terminated by a signal");
      } else if (!candidateComplete) {
        addReason("candidate-test semantic fault run was incomplete");
      }
    }
    if (candidateRunsComplete) {
      const killed = result.members.map((member) => member.killed);
      if (gate.policy === "all-kill" && killed.some((value) => !value)) {
        addReason("candidate visible tests did not kill every semantic fault member");
      }
    }
    if (result.reasons.length === 0) result.status = "PASS";
    return result;
  } catch {
    addReason("artifact regression gate execution failed");
    return result;
  } finally {
    await rm(evaluationRoot, { force: true, recursive: true });
  }
}

async function restoreBaselineTests({
  baselineHead,
  environment,
  gitExecutable,
  testPaths,
  workspace,
}) {
  for (const testPath of testPaths) {
    const tree = await runProcess(
      gitExecutable,
      ["ls-tree", "--name-only", "-z", baselineHead, "--", testPath],
      { cwd: workspace, env: environment, timeoutMs: 30_000 },
    );
    if (tree.exitCode !== 0 || tree.timedOut || tree.signal !== null) {
      throw new Error("cannot inspect baseline test path");
    }
    const target = path.join(workspace, testPath);
    if (tree.stdout.length === 0) {
      await rm(target, { force: true, recursive: true });
      continue;
    }
    const baseline = await runProcess(
      gitExecutable,
      ["show", `${baselineHead}:${testPath}`],
      { cwd: workspace, env: environment, timeoutMs: 30_000 },
    );
    if (baseline.exitCode !== 0 || baseline.timedOut || baseline.signal !== null) {
      throw new Error("cannot restore baseline test path");
    }
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, baseline.stdout);
  }
}

function publicArtifactCommandResult(result, options) {
  return {
    ...publicCommandResult(result, options),
    signal: result.signal ?? null,
  };
}

export function summarizeArtifactRegressionEvidence(artifactRegression) {
  if (artifactRegression === null || artifactRegression === undefined) {
    return null;
  }
  return {
    required_gate_ids: [...artifactRegression.required_gate_ids],
    status: artifactRegression.status,
    gates: artifactRegression.gates.map((gate) => ({
      id: gate.id,
      policy: gate.policy,
      status: gate.status,
      target: gate.target,
      export_name: gate.export_name,
      member_count: gate.member_count,
      mutation_manifest_sha256: gate.mutation_manifest_sha256,
      changed_visible_test_paths: [...gate.changed_visible_test_paths],
      candidate_visible_test_paths: [...gate.candidate_visible_test_paths],
      baseline_pass_count: gate.members.filter((member) =>
        passingBaselineMutantEvidence(member.baseline_tests_mutant_visible)
      ).length,
      candidate_complete_count: gate.members.filter((member) =>
        completeArtifactMutantEvidence(member.candidate_tests_mutant_visible)
      ).length,
      killed_member_count: gate.members.filter(({ killed }) => killed === true).length,
      evidence_sha256: createHash("sha256")
        .update(JSON.stringify(gate.members))
        .digest("hex"),
      reasons: [...gate.reasons],
    })),
  };
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
  const heldout = suite.evidence_level === "paired-development-heldout";
  assertFrozenHeldoutSelection(suite, { caseIds, model, repetitions });
  let selectedCases = caseIds?.length
    ? suite.cases.filter((benchmarkCase) => caseIds.includes(benchmarkCase.id))
    : suite.cases;
  if (selectedCases.length === 0) {
    throw new Error("No benchmark cases matched --case");
  }
  const runRepetitions = repetitions ?? suite.repetitions;
  if (!Number.isInteger(runRepetitions) || runRepetitions < 1 || runRepetitions > suite.repetitions) {
    throw new Error(`repetitions must be between 1 and ${suite.repetitions}`);
  }
  selectedCases = selectedCases.map((benchmarkCase) => ({
    ...benchmarkCase,
    artifact_regression_gates: benchmarkCase.artifact_regression_gates ?? [],
  }));
  outputDirectory = await preflightDevelopmentOutputDirectory(outputDirectory);

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
    const runnerRevision = heldout
      ? await cleanGitRevision(PROJECT_ROOT)
      : null;
    const evaluatorRevision = runnerRevision;
    assertFrozenHeldoutRevisions(suite, {
      evaluatorRevision,
      runnerRevision,
      workflowRevisions,
    });
    const homes = await prepareCodexHomes({
      authFile,
      codexExecutable,
      homeRoot,
      leanpowersMarketplace,
      superpowersMarketplace,
      toolchain,
    });
    let agentReadIsolationPreflight = null;
    if (heldout) {
      for (const benchmarkCase of selectedCases) {
        for (const workflow of WORKFLOWS) {
          await preflightHeldoutAgentReadIsolation({
            benchmarkCase,
            codexExecutable,
            codexHome: homes[workflow],
            toolchain,
          });
        }
      }
      agentReadIsolationPreflight = "PASS";
    }
    const runtime = {
      codex_version: (
        await runProcess(codexExecutable, ["--version"], { timeoutMs: 30_000 })
      ).stdout.trim(),
      model: model ?? suite.model_default,
      effort: suite.effort,
      sandbox: heldout ? "permissions-profile" : "workspace-write",
      permission_profile: heldout ? HELDOUT_PERMISSION_PROFILE : null,
      agent_read_isolation: heldout ? HELDOUT_AGENT_READ_ISOLATION : null,
      agent_read_isolation_preflight: agentReadIsolationPreflight,
      approval: "never",
      user_plugins: "isolated",
      evaluator_revision: evaluatorRevision,
      runner_revision: runnerRevision,
      freeze_contract_verified: suite.freeze_contract_verified === true,
      workflow_revisions: workflowRevisions,
    };
    const runs = [];
    const pendingArtifacts = [];
    for (let repetition = 0; repetition < runRepetitions; repetition += 1) {
      const order = suite.workflow_order[repetition];
      const repetitionCases = orderedDevelopmentCases(
        suite,
        selectedCases,
        repetition,
      );
      for (const benchmarkCase of repetitionCases) {
        for (const workflow of order) {
          const runId = `r${repetition + 1}-${benchmarkCase.id}-${workflow}`;
          onProgress({ type: "start", runId, workflow, caseId: benchmarkCase.id });
          const execution = await runDevelopmentCaseWithCapacityRetry(({
            allowCapacityRetry,
          }) => runSingleCase({
            allowCapacityRetry,
            benchmarkCase,
            codexExecutable,
            codexHome: homes[workflow],
            entrypoint: suite.workflow_entrypoints[workflow],
            effort: suite.effort,
            model: runtime.model,
            repetition: repetition + 1,
            runId,
            toolchain,
            workflow,
            permissionProfile:
              heldout ? HELDOUT_PERMISSION_PROFILE : undefined,
          }));
          const { result, artifacts, priorAttempts } = execution;
          runs.push(result);
          pendingArtifacts.push({ runId, artifacts, priorAttempts });
          onProgress({ type: "end", ...result });
        }
      }
    }

    const result = makePilotResult(suite, runtime, runs, runRepetitions, selectedCases);
    const adjudication = adjudicateDevelopmentResult(result);
    const {
      adjudicateDevelopmentResultGate,
      evaluateDevelopmentResultGate,
    } = await import(
      "./development-result-gate.mjs"
    );
    const preliminaryGateVerdict = adjudicateDevelopmentResultGate(result, { suite });
    const reportMarkdown = renderDevelopmentReport(result, {
      adjudication,
      gateVerdict: preliminaryGateVerdict,
    });
    const gateVerdict = evaluateDevelopmentResultGate(result, {
      report: reportMarkdown,
      suite,
    });
    if (gateVerdict.reasons.includes("report-artifact")) {
      throw new Error("Canonical development report did not match its gate decision");
    }
    await materializeRunArtifacts(outputDirectory, pendingArtifacts);
    await materializeDevelopmentSummaryArtifacts(outputDirectory, {
      gateJson: `${JSON.stringify(gateVerdict, null, 2)}\n`,
      reportMarkdown,
      resultJson: `${JSON.stringify(result, null, 2)}\n`,
    });
    return result;
  } finally {
    await rm(homeRoot, { force: true, recursive: true });
  }
}

export async function runDevelopmentCaseWithCapacityRetry(runAttempt) {
  const attempts = [];
  const first = await runAttempt({
    allowCapacityRetry: true,
    attemptNumber: 1,
  });
  attempts.push(first);
  if (first.capacity_retry_eligible === true) {
    attempts.push(await runAttempt({
      allowCapacityRetry: false,
      attemptNumber: 2,
    }));
  }

  const finalAttempt = attempts.at(-1);
  const capacityRetryExhausted =
    attempts.length === 2 && finalAttempt?.capacity_retry_eligible === true;
  if (
    !capacityRetryExhausted &&
    (finalAttempt?.result === null || finalAttempt?.result === undefined)
  ) {
    throw new Error("Final development benchmark attempt did not produce a result");
  }
  const attemptWallSeconds = attempts.map((attempt) => {
    if (!Number.isFinite(attempt.wall_seconds) || attempt.wall_seconds < 0) {
      throw new Error("Development benchmark attempt has invalid wall time");
    }
    return attempt.wall_seconds;
  });
  const finalAttemptWallSeconds = attemptWallSeconds.at(-1);
  const infrastructureRetryWallSeconds = (
    capacityRetryExhausted ? attemptWallSeconds : attemptWallSeconds.slice(0, -1)
  )
    .reduce((total, value) => total + value, 0);
  const finalResult = capacityRetryExhausted
    ? {
        ...(finalAttempt.result ?? {}),
        infrastructure_failure: {
          kind: "model-capacity",
          retry_exhausted: true,
        },
        outcome: {
          status: "INCOMPLETE",
          reasons: ["model capacity retry exhausted"],
        },
        telemetry: {
          ...(finalAttempt.result?.telemetry ?? {}),
          tokens: null,
        },
      }
    : finalAttempt.result;
  return {
    artifacts: finalAttempt.artifacts,
    priorAttempts: attempts.slice(0, -1).map((attempt, index) => ({
      artifacts: attempt.artifacts,
      attemptNumber: index + 1,
    })),
    result: {
      ...finalResult,
      attempt_count: attempts.length,
      capacity_retry_count: attempts.length - 1,
      final_attempt_wall_seconds: capacityRetryExhausted
        ? null
        : finalAttemptWallSeconds,
      infrastructure_retry_wall_seconds: infrastructureRetryWallSeconds,
      wall_seconds: capacityRetryExhausted ? null : finalAttemptWallSeconds,
    },
  };
}

export function adjudicateDevelopmentResult(result) {
  const sourceRuns = Array.isArray(result?.runs) ? result.runs : [];
  const runs = sourceRuns.map((run) => {
    if (run === null || typeof run !== "object" || Array.isArray(run)) {
      return {
        _malformed_run: true,
        case_id: null,
        changes: { product: [], violations: [], workflow: [] },
        outcome: { status: "FAIL", reasons: ["run evidence was malformed"] },
        repetition: null,
        telemetry: { tokens: {}, workflow_trace: {} },
        workflow: null,
        workflow_conformance: {
          status: "FAIL",
          reasons: ["workflow conformance evidence was malformed"],
        },
      };
    }
    const changes = run.changes !== null && typeof run.changes === "object" &&
        !Array.isArray(run.changes)
      ? run.changes
      : {};
    const telemetry = run.telemetry !== null && typeof run.telemetry === "object" &&
        !Array.isArray(run.telemetry)
      ? run.telemetry
      : {};
    const tokens = telemetry.tokens !== null &&
        typeof telemetry.tokens === "object" &&
        !Array.isArray(telemetry.tokens)
      ? telemetry.tokens
      : {};
    const workflowTrace = telemetry.workflow_trace !== null &&
        typeof telemetry.workflow_trace === "object" &&
        !Array.isArray(telemetry.workflow_trace)
      ? telemetry.workflow_trace
      : {};
    const verifier = run.verifier !== null && typeof run.verifier === "object" &&
        !Array.isArray(run.verifier)
      ? run.verifier
      : {};
    let malformedEvidence = !(
      run.changes !== null &&
      typeof run.changes === "object" &&
      !Array.isArray(run.changes) &&
      Array.isArray(run.changes.product) &&
      Array.isArray(run.changes.violations) &&
      Array.isArray(run.changes.workflow) &&
      run.telemetry !== null &&
      typeof run.telemetry === "object" &&
      !Array.isArray(run.telemetry) &&
      Object.hasOwn(run.telemetry, "tokens") &&
      run.telemetry.workflow_trace !== null &&
      typeof run.telemetry.workflow_trace === "object" &&
      !Array.isArray(run.telemetry.workflow_trace) &&
      run.verifier !== null &&
      typeof run.verifier === "object" &&
      !Array.isArray(run.verifier)
    );
    let outcome;
    let workflowConformance;
    try {
      outcome = evaluateRunOutcome(run);
    } catch {
      malformedEvidence = true;
      outcome = {
        status: "FAIL",
        reasons: ["run evidence was malformed"],
      };
    }
    try {
      workflowConformance = evaluateWorkflowConformance(run);
    } catch {
      malformedEvidence = true;
      workflowConformance = {
        status: "FAIL",
        reasons: ["workflow conformance evidence was malformed"],
      };
    }
    return {
      ...run,
      _malformed_run: malformedEvidence,
      changes: {
        ...changes,
        product: Array.isArray(changes.product) ? changes.product : [],
        violations: Array.isArray(changes.violations) ? changes.violations : [],
        workflow: Array.isArray(changes.workflow) ? changes.workflow : [],
      },
      outcome,
      telemetry: {
        ...telemetry,
        tokens,
        workflow_trace: workflowTrace,
      },
      verifier,
      workflow_conformance: workflowConformance,
    };
  });
  const matrixComplete = result?.completion === "complete";
  const pairValidity = classifyDevelopmentPairValidity(result, runs);
  const validPairKeys = new Set(pairValidity.entries
    .filter(({ status }) => status === "VALID")
    .map(({ case_id: caseId, repetition }) =>
      developmentPairKey(caseId, repetition)
    ));
  const paired = aggregatePairedRuns(runs, {
    matrixComplete,
    validPairKeys,
    expectedPairCount: pairValidity.total_pair_count,
  });
  const tokenTarget = result?.token_target ?? defaultDevelopmentTokenTarget();
  return {
    aggregate: aggregateRuns(runs),
    paired,
    pair_token_diagnostics: pairTokenDiagnostics(runs),
    pair_validity: pairValidity,
    runs,
    token_target_result: assessDevelopmentTokenTarget(
      tokenTarget,
      paired,
      matrixComplete,
    ),
  };
}

export function validDevelopmentTokenTelemetry(tokens) {
  return tokens !== null &&
    typeof tokens === "object" &&
    !Array.isArray(tokens) &&
    tokens.telemetry_complete === true &&
    Number.isSafeInteger(tokens.input) &&
    tokens.input >= 0 &&
    Number.isSafeInteger(tokens.cached_input) &&
    tokens.cached_input >= 0 &&
    tokens.cached_input <= tokens.input &&
    Number.isSafeInteger(tokens.output) &&
    tokens.output >= 0 &&
    Number.isSafeInteger(tokens.total) &&
    tokens.total > 0 &&
    tokens.total === tokens.input + tokens.output &&
    Number.isSafeInteger(tokens.uncached_plus_output) &&
    tokens.uncached_plus_output ===
      tokens.input - tokens.cached_input + tokens.output &&
    (tokens.reasoning_output === null || tokens.reasoning_output === undefined ||
      (Number.isSafeInteger(tokens.reasoning_output) && tokens.reasoning_output >= 0));
}

export function validDevelopmentWallTelemetry(run) {
  return Number.isFinite(run?.wall_seconds) &&
    run.wall_seconds > 0 &&
    Number.isFinite(run?.final_attempt_wall_seconds) &&
    run.final_attempt_wall_seconds === run.wall_seconds &&
    Number.isSafeInteger(run?.attempt_count) &&
    run.attempt_count >= 1 &&
    run.attempt_count <= 2 &&
    Number.isSafeInteger(run?.capacity_retry_count) &&
    run.capacity_retry_count === run.attempt_count - 1 &&
    Number.isFinite(run?.infrastructure_retry_wall_seconds) &&
    run.infrastructure_retry_wall_seconds >= 0 &&
    (run.attempt_count !== 1 || run.infrastructure_retry_wall_seconds === 0);
}

export function hasDevelopmentInfrastructureFailure(run) {
  const markedFailure = (value) =>
    value !== undefined && value !== null && value !== false;
  return run?.capacity_retry_exhausted === true ||
    markedFailure(run?.capacity_failure) ||
    markedFailure(run?.infrastructure_failure) ||
    ["capacity", "capacity-failure", "infrastructure-failure"].includes(
      run?.final_attempt_failure_kind,
    ) ||
    ["capacity-failure", "infrastructure-failure", "failed"].includes(
      run?.final_attempt_status,
    ) ||
    ["capacity-failure", "infrastructure-failure", "failed"].includes(
      run?.infrastructure_status,
    );
}

function developmentPairKey(caseId, repetition) {
  return `${caseId}\u0000${repetition}`;
}

function classifyDevelopmentPairValidity(result, runs) {
  const cases = Array.isArray(result?.cases) ? result.cases : [];
  const repetitions = Number.isSafeInteger(result?.repetitions)
    ? result.repetitions
    : 0;
  const entries = [];
  for (let repetition = 1; repetition <= repetitions; repetition += 1) {
    for (const benchmarkCase of cases) {
      const selected = runs.filter((run) =>
        run?.case_id === benchmarkCase.id && run?.repetition === repetition
      );
      const reasons = [];
      const byWorkflow = Object.fromEntries([...WORKFLOWS].map((workflow) => [
        workflow,
        selected.filter((run) => run?.workflow === workflow),
      ]));
      if ([...WORKFLOWS].some((workflow) => byWorkflow[workflow].length !== 1)) {
        reasons.push("matrix-shape");
      } else {
        const pairRuns = [...WORKFLOWS].map((workflow) => byWorkflow[workflow][0]);
        if (pairRuns.some(hasDevelopmentInfrastructureFailure)) {
          reasons.push("infrastructure-failure");
        }
        if (pairRuns.some((run) =>
          !validDevelopmentTokenTelemetry(run?.telemetry?.tokens)
        )) {
          reasons.push("token-telemetry");
        }
        if (pairRuns.some((run) => !validDevelopmentWallTelemetry(run))) {
          reasons.push("wall-telemetry");
        }
      }
      entries.push({
        case_id: benchmarkCase.id,
        repetition,
        status: reasons.length === 0 ? "VALID" : "INVALID",
        reasons,
      });
    }
  }
  return {
    entries,
    invalid_pair_count: entries.filter(({ status }) => status === "INVALID").length,
    total_pair_count: entries.length,
    valid_pair_count: entries.filter(({ status }) => status === "VALID").length,
  };
}

function pairTokenDiagnostics(runs) {
  const groups = new Map();
  for (const run of runs) {
    const key = developmentPairKey(run?.case_id, run?.repetition);
    const group = groups.get(key) ?? Object.fromEntries(
      [...WORKFLOWS].map((workflow) => [workflow, []]),
    );
    if (WORKFLOWS.has(run?.workflow)) group[run.workflow].push(run);
    groups.set(key, group);
  }
  return [...groups.values()].flatMap((group) => {
    if ([...WORKFLOWS].some((workflow) => group[workflow].length !== 1)) {
      return [];
    }
    const baseline = group["superpowers-6.1.1"][0];
    const candidate = group["leanpowers-0.2.0"][0];
    if (
      !baseline ||
      !candidate ||
      !validDevelopmentTokenTelemetry(baseline.telemetry?.tokens) ||
      !validDevelopmentTokenTelemetry(candidate.telemetry?.tokens)
    ) {
      return [];
    }
    const baselineTokens = baseline.telemetry.tokens;
    const candidateTokens = candidate.telemetry.tokens;
    return [{
      case_id: candidate.case_id,
      repetition: candidate.repetition,
      baseline_total: baselineTokens.total,
      candidate_total: candidateTokens.total,
      token_share_pct: candidateTokens.total / baselineTokens.total * 100,
      total_excess: candidateTokens.total - baselineTokens.total,
      baseline_cached: baselineTokens.cached_input,
      candidate_cached: candidateTokens.cached_input,
      cached_excess: candidateTokens.cached_input - baselineTokens.cached_input,
      baseline_fresh: baselineTokens.uncached_plus_output,
      candidate_fresh: candidateTokens.uncached_plus_output,
      fresh_excess:
        candidateTokens.uncached_plus_output - baselineTokens.uncached_plus_output,
      baseline_tool_calls: finiteNumber(baseline.telemetry?.tool_calls),
      candidate_tool_calls: finiteNumber(candidate.telemetry?.tool_calls),
      baseline_tool_types: baseline.telemetry?.tool_calls_by_type ?? null,
      candidate_tool_types: candidate.telemetry?.tool_calls_by_type ?? null,
      baseline_agent_messages: finiteNumber(baseline.telemetry?.agent_message_items),
      candidate_agent_messages: finiteNumber(candidate.telemetry?.agent_message_items),
    }];
  }).sort((left, right) =>
    left.repetition - right.repetition ||
    left.case_id.localeCompare(right.case_id)
  );
}

function observedDevelopmentDecision(result, adjudication) {
  const reasons = [];
  const advisories = [];
  if (adjudication.runs.some((run) => run?.outcome?.status !== "PASS")) {
    reasons.push("task-outcome");
  }
  if (adjudication.runs.some((run) =>
    run?.workflow === "leanpowers-0.2.0" &&
    run?.workflow_conformance?.status !== "PASS"
  )) {
    reasons.push("lean-conformance");
  }
  if (adjudication.runs.some((run) =>
    run?.workflow === "superpowers-6.1.1" && run?.activation_reported !== true
  )) {
    reasons.push("superpowers-activation");
  }
  const invalidReasons = new Set(adjudication.pair_validity.entries.flatMap(
    ({ reasons: pairReasons }) => pairReasons,
  ));
  for (const reason of ["infrastructure-failure", "token-telemetry", "wall-telemetry"]) {
    if (invalidReasons.has(reason)) reasons.push(reason);
  }
  const tokenResult = adjudication.token_target_result;
  let tokenAssessment = "miss";
  if (tokenResult.eligible === true && tokenResult.observed_share_pct <= 60) {
    tokenAssessment = "met";
  } else if (
    tokenResult.eligible === true && tokenResult.observed_share_pct <= 65
  ) {
    tokenAssessment = "near-target";
    advisories.push("token-near-target");
  } else {
    reasons.push("token-target");
  }
  const wallReduction = adjudication.paired.all_pairs.median_wall_reduction_pct;
  if (Number.isFinite(wallReduction) && wallReduction < -20) {
    reasons.push("wall-regression");
  } else if (Number.isFinite(wallReduction) && wallReduction <= 0) {
    advisories.push("wall-not-improved");
  }
  return {
    status: reasons.length > 0
      ? "FAIL"
      : tokenAssessment === "near-target" ? "REVIEW" : "PASS",
    reasons: [...new Set(reasons)],
    advisories: [...new Set(advisories)],
    evidence: {
      case_count: Array.isArray(result?.cases) ? result.cases.length : 0,
      repetition_count: Number.isSafeInteger(result?.repetitions)
        ? result.repetitions
        : null,
      run_count: adjudication.runs.length,
      pair_count: adjudication.paired.all_pairs.count,
      aggregate_model_token_share_pct:
        adjudication.paired.all_pairs.aggregate_model_token_share_pct,
      token_target_assessment: tokenAssessment,
      median_wall_reduction_pct: wallReduction,
    },
  };
}

export function renderDevelopmentReport(
  result,
  { adjudication = adjudicateDevelopmentResult(result), gateVerdict = null } = {},
) {
  const runs = adjudication.runs;
  const aggregate = adjudication.aggregate;
  const paired = adjudication.paired;
  gateVerdict ??= observedDevelopmentDecision(result, adjudication);
  const tokenTarget = result.token_target ?? defaultDevelopmentTokenTarget();
  const tokenTargetResult = adjudication.token_target_result;
  const pairValidity = adjudication.pair_validity;
  const pairTokenSources = adjudication.pair_token_diagnostics;
  const performanceGoalAssessment =
    tokenTarget.metric === "aggregate-model-token-share" &&
    tokenTarget.population === "all-matched-pairs" &&
    tokenTarget.max_share_pct === 60 &&
    tokenTargetResult.eligible === true &&
    Number.isFinite(tokenTargetResult.observed_share_pct)
      ? tokenTargetResult.observed_share_pct <= 60
        ? "PASS — target met"
        : tokenTargetResult.observed_share_pct <= 65
          ? "REVIEW — near-target evidence requires categorized assessment"
          : "FAIL — target missed"
      : null;
  const rows = runs.map((run) =>
    [
      run.case_id,
      run.risk_level,
      String(run.repetition),
      run.workflow,
      run.outcome.status,
      run.workflow_conformance.status,
      run.activation_reported ? "yes" : "no",
      run.verifier.artifact_regression === null ||
        run.verifier.artifact_regression === undefined
        ? "n/a"
        : run.verifier.artifact_regression.status,
      displayMetric(run.telemetry.tokens?.total),
      displayMetric(run.telemetry.tokens?.uncached_plus_output),
      displayMetric(round(run.wall_seconds, 1)),
      String(run.attempt_count ?? 1),
      displayMetric(round(run.infrastructure_retry_wall_seconds ?? 0, 1)),
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
  const qualityDiagnostics = paired.quality_diagnostics;
  const qualityQuadrantRows = Object.entries(
    qualityDiagnostics.outcome_quadrants,
  ).map(([quadrant, count]) => `${quadrant} | ${count}`);
  const qualityWorkflowRows = [...WORKFLOWS].map((workflow) => {
    const metrics = qualityDiagnostics.workflow_task_pass[workflow];
    return [
      workflow,
      `${metrics.passed}/${metrics.total}`,
      displayPercent(round(metrics.rate_pct, 1)),
    ].join(" | ");
  });
  const qualityInterpretation = (value) => {
    if (!qualityDiagnostics.eligible) return "ineligible";
    return value ? "yes" : "no";
  };
  const failures = runs
    .filter((run) => run.outcome.status === "FAIL")
    .map((run) => `- ${run.run_id}: ${run.outcome.reasons.join("; ")}`);
  const conformanceFailures = runs
    .filter((run) =>
      run.workflow === "leanpowers-0.2.0" &&
      run.workflow_conformance?.status === "FAIL"
    )
    .map((run) =>
      `- ${run.run_id}: ${run.workflow_conformance.reasons.join("; ")}`
    );
  const infrastructureFailures = runs.filter(hasDevelopmentInfrastructureFailure);
  const telemetryGaps = runs.filter((run) =>
    !validDevelopmentTokenTelemetry(run.telemetry?.tokens) ||
    !validDevelopmentWallTelemetry(run)
  );
  const manifestRows = (Array.isArray(result.case_snapshots)
    ? result.case_snapshots
    : []
  ).map((snapshot) => [
    snapshot.id,
    snapshot.workspace_sha256,
    snapshot.verifier_sha256,
    snapshot.mutants_sha256,
  ].join(" | "));
  const heldout = result.evidence_level === "paired-development-heldout";
  const confirmatory = heldout &&
    result.confirmatory_eligible === true &&
    result.completion === "complete";
  const reportTitle = confirmatory
    ? "# Frozen held-out development-effects comparison"
    : heldout
      ? "# Incomplete held-out development-effects diagnostic"
      : "# Paired development-effects pilot";
  const evidenceDescription = confirmatory
    ? "This is frozen confirmatory coding evidence for the listed cases and revisions, but it is not the full 11-scenario release benchmark."
    : heldout
      ? "This held-out result is incomplete or did not match the freeze contract, so it is diagnostic only and cannot support a confirmatory claim."
      : "This is real coding and independent executable verification, but it is not the full 11-scenario release benchmark.";
  const reportedCases = Array.isArray(result.cases) ? result.cases : [];
  const invalidOrExcludedPairCount = pairValidity.invalid_pair_count;
  const validPairKeys = new Set(pairValidity.entries
    .filter(({ status }) => status === "VALID")
    .map(({ case_id: caseId, repetition }) =>
      developmentPairKey(caseId, repetition)
    ));
  const categoryResult = (label, selectedRuns) => {
    const metricRuns = selectedRuns.filter((run) =>
      validPairKeys.has(developmentPairKey(run.case_id, run.repetition))
    );
    const workflowMetrics = categoryWorkflowMetrics(selectedRuns, { metricRuns });
    const categoryPaired = aggregatePairedRuns(selectedRuns, {
      matrixComplete: result.completion === "complete",
      validPairKeys,
    }).all_pairs;
    return {
      label,
      paired: categoryPaired,
      workflowMetrics,
    };
  };
  const categoryResults = reportedCases.map((benchmarkCase) => categoryResult(
    benchmarkCase.reporting_category ?? developmentReportCategory(benchmarkCase.id),
    runs.filter((run) => run.case_id === benchmarkCase.id),
  ));
  const ownerResults = [...new Set(reportedCases.map(
    ({ expected_workflow: owner }) => owner,
  ))].map((owner) => {
    const caseIds = new Set(reportedCases
      .filter(({ expected_workflow: expectedWorkflow }) => expectedWorkflow === owner)
      .map(({ id }) => id));
    return categoryResult(
      `${owner} owner aggregate`,
      runs.filter((run) => caseIds.has(run.case_id)),
    );
  });
  const reportedCategoryResults = [...categoryResults, ...ownerResults];
  const categoryRows = reportedCategoryResults.map(({ label, paired: metrics, workflowMetrics }) => {
    const baseline = workflowMetrics["superpowers-6.1.1"];
    const candidate = workflowMetrics["leanpowers-0.2.0"];
    return [
      label,
      String(metrics.count),
      `${baseline.passed}/${baseline.total}`,
      `${candidate.passed}/${candidate.total}`,
      displayMetric(baseline.total_tokens),
      displayMetric(candidate.total_tokens),
      displayPercent(metrics.aggregate_model_token_share_pct),
      displayMetric(baseline.median_tokens),
      displayMetric(candidate.median_tokens),
      displayMetric(baseline.median_wall_seconds),
      displayMetric(candidate.median_wall_seconds),
      displayPercent(metrics.median_wall_reduction_pct),
    ].join(" | ");
  });
  const categoryDiagnosticRows = reportedCategoryResults.flatMap(
    ({ label, workflowMetrics }) => [...WORKFLOWS].map((workflow) => {
      const metrics = workflowMetrics[workflow];
      return [
        label,
        workflow,
        displayMetric(metrics.median_fresh_tokens),
        displayMetric(metrics.median_output_tokens),
        displayMetric(metrics.median_tool_calls),
        displayMetric(metrics.median_workflow_reads),
        String(metrics.capacity_retries),
        displayMetric(metrics.infrastructure_retry_wall_seconds),
      ].join(" | ");
    }),
  );
  const categoryTokenSourceRows = reportedCategoryResults.map(
    ({ label, paired: metrics, workflowMetrics }) => {
      const baseline = workflowMetrics["superpowers-6.1.1"];
      const candidate = workflowMetrics["leanpowers-0.2.0"];
      return [
        label,
        displayMetric(baseline.total_tokens),
        displayMetric(candidate.total_tokens),
        displayMetric(metricDelta(candidate.total_tokens, baseline.total_tokens)),
        displayPercent(metricDelta(
          metrics.aggregate_model_token_share_pct,
          tokenTarget.max_share_pct,
        )),
        displayMetric(baseline.total_cached_tokens),
        displayMetric(candidate.total_cached_tokens),
        displayMetric(metricDelta(
          candidate.total_cached_tokens,
          baseline.total_cached_tokens,
        )),
        displayMetric(baseline.total_fresh_tokens),
        displayMetric(candidate.total_fresh_tokens),
        displayMetric(metricDelta(
          candidate.total_fresh_tokens,
          baseline.total_fresh_tokens,
        )),
        displayMetric(baseline.total_tool_calls),
        displayMetric(candidate.total_tool_calls),
        displayToolCallTypes(baseline.tool_calls_by_type),
        displayToolCallTypes(candidate.tool_calls_by_type),
        displayMetric(baseline.total_agent_messages),
        displayMetric(candidate.total_agent_messages),
      ].join(" | ");
    },
  );
  const pairTokenSourceRows = pairTokenSources.map((source) => [
    source.case_id,
    String(source.repetition),
    displayMetric(source.baseline_total),
    displayMetric(source.candidate_total),
    displayPercent(round(source.token_share_pct, 1)),
    displayPercent(round(source.token_share_pct - tokenTarget.max_share_pct, 1)),
    displayMetric(source.total_excess),
    displayMetric(source.baseline_cached),
    displayMetric(source.candidate_cached),
    displayMetric(source.cached_excess),
    displayMetric(source.baseline_fresh),
    displayMetric(source.candidate_fresh),
    displayMetric(source.fresh_excess),
    displayMetric(source.baseline_tool_calls),
    displayMetric(source.candidate_tool_calls),
    displayToolCallTypes(source.baseline_tool_types),
    displayToolCallTypes(source.candidate_tool_types),
    displayMetric(source.baseline_agent_messages),
    displayMetric(source.candidate_agent_messages),
  ].join(" | "));
  const invalidPairRows = pairValidity.entries
    .filter(({ status }) => status === "INVALID")
    .map(({ case_id: caseId, repetition, reasons }) =>
      `- ${caseId} r${repetition}: ${reasons.join(", ")}`
    );
  const decisionReasons = Array.isArray(gateVerdict?.reasons) &&
      gateVerdict.reasons.length > 0
    ? gateVerdict.reasons.join(", ")
    : "none";
  const decisionAdvisories = Array.isArray(gateVerdict?.advisories) &&
      gateVerdict.advisories.length > 0
    ? gateVerdict.advisories.join(", ")
    : "none";
  const caseScope = reportedCases.length === 1
    ? "the one reported fixture"
    : `the ${reportedCases.length} reported fixtures`;
  const scenarioScope = [...new Set(reportedCases.map(
    ({ scenario_class: scenarioClass }) => scenarioClass,
  ))].join(", ");
  const caseSpecificBoundaries = [];
  if (reportedCases.some(({ id }) => id === "localized-template-cache")) {
    caseSpecificBoundaries.push(
      "- The localized-cache hidden verifier samples representative single-, control-, repeated-, and multi-character separators. Passing those samples is not mathematical proof of collision freedom for every possible string; the task contract still requires an unambiguous structural identity.",
    );
  }
  if (reportedCases.some(({ id }) => id === "transient-profile-load")) {
    caseSpecificBoundaries.push(
      "- The transient-profile-load verifier exercises the declared retry, same-ID overlap, fulfilled reuse, and cross-ID isolation sequences. It does not prove every possible cache lifecycle or concurrency interleaving.",
    );
  }
  return [
    reportTitle,
    "",
    `Evidence level: **${result.evidence_level}**. ${evidenceDescription}`,
    ...(heldout
      ? [
          "",
          `Frozen run contract: **${result.frozen_run_contract_verified === true ? "verified" : "unverified"}**. Confirmatory eligibility: **${confirmatory ? "yes" : "no"}**.`,
        ]
      : []),
    "",
    `Run matrix: **${result.completion}**. Token-target conclusions are unavailable unless the declared matrix and target population are complete.`,
    "",
    `Runtime: ${result.runtime.codex_version}; model: ${result.runtime.model}; effort: ${result.runtime.effort}.`,
    ...(heldout
      ? [
          "",
          `Agent read isolation: ${result.runtime.agent_read_isolation}; permission profile: ${result.runtime.permission_profile}; preflight: ${result.runtime.agent_read_isolation_preflight}.`,
        ]
      : []),
    "",
    `Revisions: Superpowers ${result.runtime.workflow_revisions["superpowers-6.1.1"]}; LeanPowers ${result.runtime.workflow_revisions["leanpowers-0.2.0"]}; evaluator ${result.runtime.evaluator_revision ?? "n/a"}; runner ${result.runtime.runner_revision ?? "n/a"}.`,
    "",
    `Suite manifest: ${result.suite_sha256}.`,
    "",
    "Case | Workspace snapshot | Hidden verifier snapshot | Fault-family snapshot",
    "--- | --- | --- | ---",
    ...manifestRows,
    "",
    `Activation: ${result.activation_mode}. Each run explicitly invokes its installed top-level workflow entrypoint and must name it in the first agent progress message before the identical engineering task.`,
    "",
    "Superpowers 6.1.1 is the upstream baseline and inspiration for LeanPowers. This report measures a bounded tradeoff under the listed conditions; it is not a winner ranking.",
    "",
    "## Machine decision",
    "",
    `Status: **${gateVerdict.status}**`,
    "",
    `Reasons: ${decisionReasons}.`,
    "",
    `Advisories: ${decisionAdvisories}.`,
    "",
    "## Aggregate",
    "",
    "Workflow | Task PASS | Median model tokens | Median fresh tokens | Median wall seconds | Median tool calls | Median workflow reads | Declaration failures | Conformance failures | Scope violations",
    "--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---:",
    ...summaryRows,
    "",
    "## Layered quality diagnostics",
    "",
    `Population: **complete valid matched pairs**; interpretation eligibility: **${qualityDiagnostics.eligible ? "yes" : "no"}** (${qualityDiagnostics.valid_matched_pair_count}/${qualityDiagnostics.required_pair_count}).`,
    "",
    "Paired outcome quadrant | Count",
    "--- | ---:",
    ...qualityQuadrantRows,
    "",
    "Workflow | Task PASS | Task PASS rate",
    "--- | ---: | ---:",
    ...qualityWorkflowRows,
    "",
    `Shared floor (both Task PASS rates <20%): **${qualityInterpretation(qualityDiagnostics.shared_floor)}**.`,
    "",
    `Shared ceiling (both Task PASS rates >80%): **${qualityInterpretation(qualityDiagnostics.shared_ceiling)}**.`,
    "",
    `Directional asymmetry: **${qualityDiagnostics.directional_asymmetry.present ? "yes" : "no"}**; Superpowers PASS / LeanPowers FAIL: **${qualityDiagnostics.directional_asymmetry.superpowers_pass_lean_fail}**; LeanPowers PASS / Superpowers FAIL: **${qualityDiagnostics.directional_asymmetry.lean_pass_superpowers_fail}**.`,
    "",
    "## Results by task category",
    "",
    "Category | Pairs | Superpowers quality | LeanPowers quality | Superpowers total tokens | LeanPowers total tokens | Lean token share | Superpowers median tokens | LeanPowers median tokens | Superpowers median wall | LeanPowers median wall | Lean wall reduction",
    "--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---:",
    ...categoryRows,
    "",
    "## Category source diagnostics",
    "",
    "Category | Workflow | Median fresh tokens | Median output tokens | Median tool calls | Median workflow reads | Capacity retries | Infrastructure retry wall",
    "--- | --- | ---: | ---: | ---: | ---: | ---: | ---:",
    ...categoryDiagnosticRows,
    "",
    "## Category token sources",
    "",
    "Category | Superpowers total | LeanPowers total | Total excess | Target excess | Superpowers cached | LeanPowers cached | Cached excess | Superpowers fresh | LeanPowers fresh | Fresh excess | Superpowers tool calls | LeanPowers tool calls | Superpowers tool types | LeanPowers tool types | Superpowers agent messages | LeanPowers agent messages",
    "--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | ---: | ---:",
    ...categoryTokenSourceRows,
    "",
    "## Pair token excess",
    "",
    "Case | Rep | Superpowers total | LeanPowers total | Lean token share | Target excess | Total excess | Superpowers cached | LeanPowers cached | Cached excess | Superpowers fresh | LeanPowers fresh | Fresh excess | Superpowers tool calls | LeanPowers tool calls | Superpowers tool types | LeanPowers tool types | Superpowers agent messages | LeanPowers agent messages",
    "--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | ---: | ---:",
    ...(pairTokenSourceRows.length > 0 ? pairTokenSourceRows : [
      "No pairs have complete token telemetry.",
    ]),
    "",
    "## Token target",
    "",
    `Metric: **${tokenTarget.metric}** across **${tokenTarget.population}**; LeanPowers target: at most **${tokenTarget.max_share_pct}%** of Superpowers model tokens.`,
    "",
    `Status: **${tokenTargetResult.status}**; eligible pairs: ${tokenTargetResult.eligible_pair_count}/${tokenTargetResult.required_pair_count}; observed share: ${Number.isFinite(tokenTargetResult.observed_share_pct) ? `${round(tokenTargetResult.observed_share_pct, 1)}%` : "n/a"}.`,
    ...(performanceGoalAssessment === null
      ? []
      : [
          "",
          `Performance-goal assessment: **${performanceGoalAssessment}**. The 60–65% band never bypasses quality gates and is not an automatic PASS.`,
          "",
          "Wall time is secondary: complete pair telemetry is mandatory; 0% through -20% is an advisory non-improvement, while a slowdown greater than 20% is a material regression.",
        ]),
    ...(gateVerdict.status === "REVIEW"
      ? [
          "",
          "## REVIEW explanation",
          "",
          `The aggregate LeanPowers token share is ${displayPercent(round(tokenTargetResult.observed_share_pct, 1))}, above the ${tokenTarget.max_share_pct}% target but within the preregistered 60–65% review band. Quality gates still pass; this is not an automatic PASS. The category and pair token-source tables identify whether the remaining distance comes from cached context, fresh tokens, tool-call mix, or a long-tail pair.`,
        ]
      : []),
    "",
    "## Paired reductions",
    "",
    "Population | Eligible/required pairs | Aggregate Lean token share | Median model-token reduction | Median Lean token share | Max Lean token share | Lean ≤60% pairs | Median fresh-token reduction | Median wall reduction | Median tool-call reduction | Median workflow-read reduction",
    "--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---:",
    pairedRow(
      "Both Task PASS + Lean quality-bearing conformance + Superpowers activation (primary)",
      paired.conformant_pass_pairs,
    ),
    pairedRow("Primary: lean", paired.by_risk.lean.conformant_pass_pairs),
    pairedRow("Primary: standard", paired.by_risk.standard.conformant_pass_pairs),
    pairedRow("Primary: strict", paired.by_risk.strict.conformant_pass_pairs),
    pairedRow("Both workflows PASS", paired.both_pass_pairs),
    pairedRow("All matched runs", paired.all_pairs),
    "",
    "## Paired runs",
    "",
    "Case | Risk | Rep | Workflow | Task | Conformance | Declared | Artifact regression | Model tokens | Fresh tokens | Wall seconds | Attempts | Capacity retry wall | Tool calls | Workflow reads | Product files | Workflow artifacts | Scope violations",
    "--- | --- | ---: | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---:",
    ...rows,
    "",
    "## Failed-run reasons",
    "",
    failures.length > 0 ? failures.join("\n") : "None.",
    "",
    "## Workflow conformance reasons",
    "",
    conformanceFailures.length > 0 ? conformanceFailures.join("\n") : "None.",
    "",
    "## Validity exclusions",
    "",
    `Infrastructure failures: **${infrastructureFailures.length}**; telemetry-gap runs: **${telemetryGaps.length}**; Invalid or excluded pairs: **${invalidOrExcludedPairCount}**. Invalid pairs are excluded from token and wall-time conclusions.`,
    ...(invalidPairRows.length === 0 ? [] : ["", ...invalidPairRows]),
    ...(infrastructureFailures.length === 0
      ? []
      : [
          "",
          ...infrastructureFailures.map((run) =>
            `- ${run.run_id}: ${run.infrastructure_failure?.kind ?? run.final_attempt_failure_kind ?? "infrastructure"}`
          ),
        ]),
    "",
    "## Interpretation boundary",
    "",
    "- Task PASS requires successful agent completion, no timeout, both visible and hidden test success, every case-owned semantic fault family policy to pass, and no changed-path scope violation. Workflow declaration and risk-routing conformance are reported separately.",
    `- LeanPowers quality-bearing conformance requires an unambiguous semantic route declaration before any task tool, rejects conflicting declarations, and forbids risk downgrade after an upgrade. Build/debug traces must show each later-edited existing file was successfully read before its own first edit and supported successful validation after the final edit. Build additionally requires test-only edits before the first product edit, one or more meaningful focused RED results after the final test correction, preservation of those RED test paths, and product-only edits thereafter. Every pre-product evidence window may contain only proven reads, narrow Git reporting, and completed nonfatal canonical test attempts; the final window's last test attempt must be a meaningful RED. Evidence-driven invalid test-design corrections and repeated RED confirmation are allowed, while exact counts remain diagnostics rather than fixed gates. Debug requires fixture-owned structured pre-edit reproduction and an initial uninterrupted code-and-test mutation window. One failed supported validation may open exactly one bounded recovery patch only when no other tool intervenes, every recovery path was already read and remains in scope, and the final rerun uses the identical validation command; the resolved reproduction then runs separately. A second failure or recovery is incomplete. Canonical DEBUG completion runs validation before reproduction. When the fixture declares resolved output, only a standalone reproduction can supply quality-bearing evidence and its final nonblank output line must be that exact JSON; combined validation and reproduction remains eligible only for contracts without structured resolved output. Lean and standard runs preserve the first successful validation after the first product edit or initial DEBUG mutation; only proven relative-file reads and the narrow Git reporting allowlist may follow. Strict runs require the same freshness from validation through reviewer spawn and wait, preserve the final passing review under the same read-only boundary, and separately prove the designated reviewer did not mutate the workspace. Discovery syntax, extra grounded-file reads, split versus batched reads, validation-manifest reads, Skill/reference reloads, exact pre-validation command/call budgets, clause-ledger shape, repeated route or ledger presentation, and one-call versus two-call validation remain efficiency or ceremony diagnostics rather than quality gates. Representation-boundary adequacy is measured workflow-neutrally in Task PASS: every pre-registered fault-family member must preserve baseline tests, every candidate counterfactual must complete, and every member must be killed by the candidate test delta. Reproduction telemetry proves the exact command and, when declared, resolved structured output; it is not universal semantic proof. These observable checks are scoped to ${caseScope}, not universal semantic proof. Strict quality additionally requires a current independent PASS review with the complete task and current validation context; exact Skill invocation, prompt/verdict surface, reviewer count, wait targeting, and cycle choreography remain diagnostics.`,
    "- Async/blocking review adapter mechanics are runtime-specific diagnostics. The quality gate is one fresh read-only independent review effect; Codex JSONL does not expose every raw adapter argument.",
    "- Model tokens sum Codex input and output tokens. Fresh tokens are uncached input plus output. Reasoning output is already included in output and is never double-counted. Missing or impossible telemetry is shown as n/a, never zero.",
    "- Workflow reads are exact observed Skill/reference file reads from command traces. They are an attribution proxy, not workflow-only token telemetry.",
    `- Paired reductions and Lean token shares are computed within each identical case and repetition. The declared token target uses ${tokenTarget.metric === "aggregate-model-token-share" ? "the ratio of summed LeanPowers tokens to summed Superpowers tokens" : "the maximum paired LeanPowers share"} across ${tokenTarget.population}; every-pair and median shares remain distribution diagnostics rather than substitute quality gates. Complete telemetry and the full target population are required. Failing faster or skipping workflow gates never counts as an improvement.`,
    "- Codex CLI does not expose a deterministic seed, so paired repetitions reduce noise but do not eliminate it.",
    "- Exact terminal model-capacity failures without complete token telemetry may retry once from a fresh disposable workspace. Capacity retries are isolated from workflow wall-time comparisons, remain visible as separate attempt time, and never apply to agent, test, verifier, or conformance failures.",
    `- The reported cases cover only these scenario classes: ${scenarioScope || "none"}. They do not establish universal non-inferiority.`,
    ...caseSpecificBoundaries,
    "- Raw transcripts remain local and are written only after every run finishes. Disposable workspaces are destroyed after each run and are not publication artifacts.",
    "",
  ].join("\n");
}

function categoryWorkflowMetrics(runs, { metricRuns = runs } = {}) {
  return Object.fromEntries([...WORKFLOWS].map((workflow) => {
    const selected = runs.filter((run) => run.workflow === workflow);
    const metricSelected = metricRuns.filter((run) => run.workflow === workflow);
    const tokenTotals = metricSelected.map((run) => run.telemetry.tokens?.total);
    return [workflow, {
      total: selected.length,
      passed: selected.filter((run) => run.outcome.status === "PASS").length,
      total_tokens: completeMetricSum(tokenTotals, { positive: true }),
      total_cached_tokens: completeMetricSum(
        metricSelected.map((run) => run.telemetry.tokens?.cached_input),
      ),
      total_fresh_tokens: completeMetricSum(
        metricSelected.map((run) => run.telemetry.tokens?.uncached_plus_output),
      ),
      total_tool_calls: completeMetricSum(
        metricSelected.map((run) => run.telemetry.tool_calls),
      ),
      tool_calls_by_type: aggregateToolCallTypes(metricSelected),
      total_agent_messages: completeMetricSum(
        metricSelected.map((run) => run.telemetry.agent_message_items),
      ),
      median_tokens: median(tokenTotals),
      median_fresh_tokens: median(
        metricSelected.map((run) => run.telemetry.tokens?.uncached_plus_output),
      ),
      median_output_tokens: median(
        metricSelected.map((run) => run.telemetry.tokens?.output),
      ),
      median_wall_seconds: round(
        median(metricSelected.map((run) => run.wall_seconds)),
        1,
      ),
      median_tool_calls: median(
        metricSelected.map((run) => run.telemetry.tool_calls),
      ),
      median_workflow_reads: median(
        metricSelected.map((run) => run.telemetry.workflow_trace?.read_calls),
      ),
      capacity_retries: selected.reduce(
        (total, run) => total + (run.capacity_retry_count ?? 0),
        0,
      ),
      infrastructure_retry_wall_seconds: round(selected.reduce(
        (total, run) => total + (run.infrastructure_retry_wall_seconds ?? 0),
        0,
      ), 1),
    }];
  }));
}

function completeMetricSum(values, { positive = false } = {}) {
  if (
    values.length === 0 ||
    values.some((value) =>
      !Number.isFinite(value) || value < 0 || (positive && value === 0)
    )
  ) {
    return null;
  }
  const total = values.reduce((sum, value) => sum + value, 0);
  return Number.isSafeInteger(total) ? total : null;
}

function aggregateToolCallTypes(runs) {
  const totals = {};
  for (const run of runs) {
    const entries = run.telemetry?.tool_calls_by_type;
    if (
      entries === null ||
      typeof entries !== "object" ||
      Array.isArray(entries)
    ) {
      return null;
    }
    for (const [type, count] of Object.entries(entries)) {
      if (!Number.isSafeInteger(count) || count < 0) return null;
      totals[type] = (totals[type] ?? 0) + count;
      if (!Number.isSafeInteger(totals[type])) return null;
    }
  }
  return runs.length > 0
    ? Object.fromEntries(Object.entries(totals).sort(([left], [right]) =>
        left.localeCompare(right)
      ))
    : null;
}

function displayToolCallTypes(value) {
  return value === null || typeof value !== "object" || Array.isArray(value)
    ? "n/a"
    : Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([type, count]) => `${type}:${count}`)
      .join(", ") || "none";
}

function metricDelta(candidate, baseline) {
  return Number.isFinite(candidate) && Number.isFinite(baseline)
    ? round(candidate - baseline, 1)
    : null;
}

function developmentReportCategory(caseId) {
  return ({
    "coalesced-half-open-intervals": "collection-transform build",
    "escaped-field-parser": "Unicode parser build",
    "transactional-batch-flush": "transactional-state debug",
  })[caseId] ?? caseId;
}

function pairedRow(label, metrics) {
  return [
    label,
    `${metrics.count}/${metrics.required_pair_count}`,
    displayPairedMetric(metrics.aggregate_model_token_share_pct, metrics.token_pairs),
    displayPairedMetric(metrics.median_token_reduction_pct, metrics.token_pairs),
    displayPairedMetric(metrics.median_token_share_pct, metrics.token_pairs),
    displayPairedMetric(metrics.max_token_share_pct, metrics.token_pairs),
    `${metrics.token_share_at_or_below_60_count}/${metrics.required_pair_count}`,
    displayPairedMetric(metrics.median_fresh_token_reduction_pct, metrics.fresh_token_pairs),
    displayPairedMetric(metrics.median_wall_reduction_pct, metrics.wall_pairs),
    displayPairedMetric(metrics.median_tool_call_reduction_pct, metrics.tool_call_pairs),
    displayPairedMetric(metrics.median_workflow_read_reduction_pct, metrics.workflow_read_pairs),
  ].join(" | ");
}

async function runSingleCase({
  allowCapacityRetry = false,
  benchmarkCase,
  codexExecutable,
  codexHome,
  entrypoint,
  effort,
  model,
  repetition,
  runId,
  toolchain,
  workflow,
  permissionProfile,
}) {
  const runRoot = await mkdtemp(path.join(os.tmpdir(), "leanpowers-development-run-"));
  const workspace = path.join(runRoot, "workspace");
  const runHome = path.join(runRoot, "home");
  try {
    await materializeWorkspaceSnapshot(
      benchmarkCase.workspace_snapshot,
      workspace,
    );
    await cp(codexHome, runHome, { recursive: true });
    const baselineHead = await initializeGit(workspace, toolchain);
    await mkdir(path.join(runHome, "tmp"), { recursive: true });
    if (permissionProfile !== undefined) {
      if (permissionProfile !== HELDOUT_PERMISSION_PROFILE) {
        throw new Error("Unsupported development benchmark permission profile");
      }
      await configureHeldoutCodexHome(runHome, toolchain);
    }

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
      permissionProfile,
    });
    const reviewerMutationTracker =
      tracksReviewerWorkspaceMutations(workflow)
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
      env: permissionProfile === undefined
        ? benchmarkEnvironment(runHome, toolchain.environment)
        : heldoutAgentEnvironment(runHome, toolchain.environment),
      onStdoutLine: reviewerMutationTracker?.onStdoutLine,
      timeoutMs: 600_000,
    });
    const wallSeconds = (Date.now() - startedAt) / 1000;
    const telemetry = parseCodexResult(agent.stdout, {
      changePolicy: benchmarkCase.change_policy,
      expectedReviewContract: benchmarkCase.task,
      expectedWorkflow: benchmarkCase.expected_workflow,
      reproductionContract: benchmarkCase.reproduction_contract,
      reviewerWorkspaceMutations: reviewerMutationTracker?.mutations(),
      workspace,
    });
    const capacityRetryEligible = isRetryableCodexCapacityFailure({
      raw: agent.stdout,
      telemetry,
    });
    if (capacityRetryEligible) {
      const gitState = await inspectBenchmarkGitState({
        baselineHead,
        environment: toolchain.environment,
        gitExecutable: toolchain.git,
        workspace,
      });
      const changes = evaluateChangedPaths(
        gitState.changed_paths,
        benchmarkCase.change_policy,
      );
      return {
        artifacts: {
          agent_stderr: agent.stderr,
          agent_stdout: agent.stdout,
          final_message: telemetry.final_message,
          verifier: null,
          workspace_patch: gitState.workspace_patch,
        },
        capacity_retry_eligible: true,
        result: allowCapacityRetry
          ? null
          : {
              run_id: runId,
              workflow,
              case_id: benchmarkCase.id,
              scenario_class: benchmarkCase.scenario_class,
              risk_level: benchmarkCase.risk_level,
              expected_workflow: benchmarkCase.expected_workflow,
              declared_risk: null,
              declared_workflow: null,
              route_ledger_reported:
                workflow === "leanpowers-0.2.0" ? false : null,
              repetition,
              agent_exit_code: agent.exitCode,
              agent_timed_out: agent.timedOut,
              agent_completed: false,
              activation_reported: false,
              case_snapshot: caseSnapshotContract(benchmarkCase),
              head_unchanged: gitState.final_head === baselineHead,
              telemetry: {
                turns: telemetry.turns,
                tool_calls: telemetry.tool_calls,
                tool_calls_by_type: telemetry.tool_calls_by_type,
                workflow_trace: telemetry.workflow_trace,
                tokens: null,
              },
              changes,
              required_artifact_regression_gate_ids:
                benchmarkCase.artifact_regression_gates.map(({ id }) => id),
              required_artifact_regression_gates: [],
              verifier: { artifact_regression: null },
              verifier_workspace_unchanged: null,
              workflow_conformance: {
                status: "INCOMPLETE",
                reasons: ["agent run unavailable due model capacity"],
              },
            },
        wall_seconds: wallSeconds,
      };
    }
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
    const verifierFingerprintBefore = await fingerprintBenchmarkWorkspace({
      baselineHead,
      environment: toolchain.environment,
      gitExecutable: toolchain.git,
      workspace,
    });
    const verifier = await runVerifier({
      environment: toolchain.environment,
      workspace,
      verifierSnapshots: benchmarkCase.verifier_snapshots,
    });
    const artifactRegression = await runArtifactRegressionGates({
      baselineHead,
      changedPaths,
      environment: toolchain.environment,
      gates: benchmarkCase.artifact_regression_gates,
      gitExecutable: toolchain.git,
      testGlobs: benchmarkCase.change_policy.tests,
      workspace,
    });
    const verifierEvidence = {
      ...verifier,
      artifact_regression: artifactRegression,
    };
    const verifierWorkspaceUnchanged = verifierFingerprintBefore ===
      await fingerprintBenchmarkWorkspace({
        baselineHead,
        environment: toolchain.environment,
        gitExecutable: toolchain.git,
        workspace,
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
      case_snapshot: caseSnapshotContract(benchmarkCase),
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
      required_artifact_regression_gate_ids:
        benchmarkCase.artifact_regression_gates.map(({ id }) => id),
      required_artifact_regression_gates:
        benchmarkCase.artifact_regression_gates.map(({
          id,
          policy,
          target,
          export_name,
          mutations,
          mutation_manifest_sha256,
        }) => ({
          id,
          policy,
          target,
          export_name,
          member_count: mutations.length,
          mutation_manifest_sha256,
        })),
      verifier: verifierEvidence,
      verifier_workspace_unchanged: verifierWorkspaceUnchanged,
    };
    result.outcome = evaluateRunOutcome(result);
    result.workflow_conformance = evaluateWorkflowConformance(result);
    result.verifier = {
      ...verifierEvidence,
      artifact_regression: summarizeArtifactRegressionEvidence(
        artifactRegression,
      ),
    };
    return {
      capacity_retry_eligible: capacityRetryEligible,
      result,
      artifacts: {
        agent_stderr: agent.stderr,
        agent_stdout: agent.stdout,
        final_message: telemetry.final_message,
        verifier: verifierEvidence,
        workspace_patch: workspacePatch,
      },
      wall_seconds: wallSeconds,
    };
  } finally {
    await rm(runRoot, { force: true, recursive: true });
  }
}

export function orderedDevelopmentCases(suite, selectedCases, repetitionIndex) {
  const declaredOrder = suite?.case_order?.[repetitionIndex];
  if (!Array.isArray(declaredOrder)) return [...selectedCases];
  const selectedById = new Map(selectedCases.map((benchmarkCase) => [
    benchmarkCase.id,
    benchmarkCase,
  ]));
  return declaredOrder.flatMap((caseId) => {
    const benchmarkCase = selectedById.get(caseId);
    return benchmarkCase === undefined ? [] : [benchmarkCase];
  });
}

export function makePilotResult(suite, runtime, runs, repetitions, selectedCases) {
  const caseSnapshots = selectedCases.map((benchmarkCase) => ({
    id: benchmarkCase.id,
    ...caseSnapshotContract(benchmarkCase),
  }));
  const reportedCases = selectedCases.map(({
    id,
    scenario_class,
    risk_level,
    expected_workflow,
    reporting_category,
  }) => ({
    id,
    scenario_class,
    risk_level,
    expected_workflow,
    ...(reporting_category === undefined ? {} : { reporting_category }),
  }));
  const heldout = suite.evidence_level === "paired-development-heldout";
  const frozenCaseIds = Array.isArray(suite.cases)
    ? suite.cases.map(({ id }) => id).sort()
    : [];
  const selectedCaseIds = selectedCases.map(({ id }) => id).sort();
  const freeze = suite.freeze_contract ?? {};
  const legacyRevisionContract = freeze.leanpowers_revision === undefined &&
    freeze.evaluator_revision === undefined &&
    freeze.runner_revision === undefined;
  const heldoutRevisionsVerified =
    /^[a-f0-9]{40}$/u.test(String(runtime?.evaluator_revision ?? "")) &&
    (legacyRevisionContract ||
      /^[a-f0-9]{40}$/u.test(String(runtime?.runner_revision ?? ""))) &&
    runtime?.workflow_revisions?.["superpowers-6.1.1"] ===
      freeze.superpowers_revision &&
    (legacyRevisionContract
      ? runtime.evaluator_revision ===
        runtime?.workflow_revisions?.["leanpowers-0.2.0"]
      : runtime?.workflow_revisions?.["leanpowers-0.2.0"] ===
          freeze.leanpowers_revision &&
        runtime.evaluator_revision === freeze.evaluator_revision &&
        runtime.runner_revision === freeze.runner_revision);
  const heldoutContractVerified = !heldout || (
    suite.freeze_contract_verified === true &&
    runtime?.freeze_contract_verified === true &&
    repetitions === suite.repetitions &&
    isDeepStrictEqual(selectedCaseIds, frozenCaseIds) &&
    runtime?.model === suite.model_default &&
    runtime?.effort === suite.effort &&
    runtime?.sandbox === "permissions-profile" &&
    runtime?.permission_profile === HELDOUT_PERMISSION_PROFILE &&
    runtime?.agent_read_isolation ===
      suite.freeze_contract?.agent_read_isolation &&
    runtime?.agent_read_isolation_preflight === "PASS" &&
    heldoutRevisionsVerified
  );
  const matrixComplete = /^[a-f0-9]{64}$/u.test(String(suite.suite_sha256 ?? "")) &&
    hasCompleteRunMatrix(runs, selectedCases, repetitions) &&
    heldoutContractVerified;
  const pairValidity = classifyDevelopmentPairValidity({
    cases: reportedCases,
    repetitions,
  }, runs);
  const validPairKeys = new Set(pairValidity.entries
    .filter(({ status }) => status === "VALID")
    .map(({ case_id: caseId, repetition }) =>
      developmentPairKey(caseId, repetition)
    ));
  const paired = aggregatePairedRuns(runs, {
    matrixComplete,
    validPairKeys,
    expectedPairCount: pairValidity.total_pair_count,
  });
  const tokenTarget = suite.token_target ?? defaultDevelopmentTokenTarget();
  return {
    schema_version: 2,
    suite_id: suite.suite_id,
    suite_sha256: suite.suite_sha256,
    evidence_level: suite.evidence_level,
    activation_mode: suite.activation_mode,
    completion: matrixComplete ? "complete" : "incomplete",
    frozen_run_contract_verified: heldout ? heldoutContractVerified : null,
    confirmatory_eligible: heldout ? matrixComplete : null,
    runtime,
    repetitions,
    cases: reportedCases,
    case_snapshots: caseSnapshots,
    runs,
    aggregate: aggregateRuns(runs),
    paired,
    token_target: tokenTarget,
    token_target_result: assessDevelopmentTokenTarget(
      tokenTarget,
      paired,
      matrixComplete,
    ),
  };
}

function defaultDevelopmentTokenTarget() {
  return {
    metric: "every-pair-model-token-share",
    population: "both-pass-pairs",
    max_share_pct: 60,
  };
}

function assessDevelopmentTokenTarget(target, paired, matrixComplete) {
  const metrics = target.population === "all-matched-pairs"
    ? paired.all_pairs
    : paired.both_pass_pairs;
  const completePopulation = matrixComplete &&
    metrics.required_pair_count > 0 &&
    metrics.count === metrics.required_pair_count &&
    metrics.token_pairs === metrics.required_pair_count;
  const observedShare = target.metric === "aggregate-model-token-share"
    ? metrics.aggregate_model_token_share_pct
    : metrics.max_token_share_pct;
  const eligible = completePopulation && Number.isFinite(observedShare);
  return {
    eligible,
    eligible_pair_count: metrics.count,
    metric: target.metric,
    observed_share_pct: eligible ? observedShare : null,
    population: target.population,
    required_pair_count: metrics.required_pair_count,
    status: !eligible
      ? "INELIGIBLE"
      : observedShare <= target.max_share_pct ? "PASS" : "FAIL",
    threshold_pct: target.max_share_pct,
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

function aggregatePairedRuns(
  runs,
  { expectedPairCount, matrixComplete, validPairKeys } = {},
) {
  const groups = new Map();
  for (const run of runs) {
    const key = developmentPairKey(run.case_id, run.repetition);
    const group = groups.get(key) ?? Object.fromEntries(
      [...WORKFLOWS].map((workflow) => [workflow, []]),
    );
    if (WORKFLOWS.has(run.workflow)) group[run.workflow].push(run);
    groups.set(key, group);
  }
  const matchedPairEntries = [...groups.entries()]
    .filter(([, group]) =>
      [...WORKFLOWS].every((workflow) => group[workflow].length === 1)
    )
    .map(([key, group]) => ({
      key,
      pair: Object.fromEntries(
        [...WORKFLOWS].map((workflow) => [workflow, group[workflow][0]]),
      ),
    }));
  const matchedPairs = matchedPairEntries.map(({ pair }) => pair);
  const pairs = matchedPairEntries
    .filter(({ key, pair }) =>
      (validPairKeys === undefined || validPairKeys.has(key)) &&
      [...WORKFLOWS].every((workflow) =>
        !hasDevelopmentInfrastructureFailure(pair[workflow])
      )
    )
    .map(({ pair }) => pair);
  const bothPass = pairs.filter((group) =>
    [...WORKFLOWS].every((workflow) => group[workflow].outcome.status === "PASS")
  );
  const conformantPass = bothPass.filter((group) =>
    [...WORKFLOWS].every(
      (workflow) => group[workflow].workflow_conformance?.status === "PASS",
    )
  );
  const byRisk = Object.fromEntries(["lean", "standard", "strict"].map((risk) => {
    const required = matchedPairs.filter(
      (pair) => pair["leanpowers-0.2.0"].risk_level === risk,
    ).length;
    const selected = pairs.filter((pair) => pair["leanpowers-0.2.0"].risk_level === risk);
    return [risk, {
      all_pairs: summarizePairs(selected, {
        matrixComplete,
        requiredPairCount: required,
      }),
      both_pass_pairs: summarizePairs(selected.filter((pair) =>
        [...WORKFLOWS].every((workflow) => pair[workflow].outcome.status === "PASS")
      ), { matrixComplete, requiredPairCount: required }),
      conformant_pass_pairs: summarizePairs(selected.filter((pair) =>
        [...WORKFLOWS].every((workflow) =>
          pair[workflow].outcome.status === "PASS" &&
          pair[workflow].workflow_conformance?.status === "PASS"
        )
      ), { matrixComplete, requiredPairCount: required }),
    }];
  }));
  const requiredPairCount = matchedPairs.length;
  return {
    all_pairs: summarizePairs(pairs, {
      matrixComplete,
      requiredPairCount,
    }),
    both_pass_pairs: summarizePairs(bothPass, {
      matrixComplete,
      requiredPairCount,
    }),
    conformant_pass_pairs: summarizePairs(conformantPass, {
      matrixComplete,
      requiredPairCount,
    }),
    quality_diagnostics: summarizeLayeredQualityDiagnostics(pairs, {
      matrixComplete,
      requiredPairCount: Number.isSafeInteger(expectedPairCount) &&
          expectedPairCount >= 0
        ? expectedPairCount
        : requiredPairCount,
    }),
    by_risk: byRisk,
  };
}

function summarizeLayeredQualityDiagnostics(
  pairs,
  { matrixComplete, requiredPairCount },
) {
  const outcomeQuadrants = {
    both_pass: 0,
    superpowers_pass_lean_fail: 0,
    lean_pass_superpowers_fail: 0,
    both_fail: 0,
  };
  for (const pair of pairs) {
    const superpowersPass =
      pair["superpowers-6.1.1"]?.outcome?.status === "PASS";
    const leanpowersPass =
      pair["leanpowers-0.2.0"]?.outcome?.status === "PASS";
    const quadrant = superpowersPass
      ? leanpowersPass ? "both_pass" : "superpowers_pass_lean_fail"
      : leanpowersPass ? "lean_pass_superpowers_fail" : "both_fail";
    outcomeQuadrants[quadrant] += 1;
  }
  const workflowTaskPass = Object.fromEntries([...WORKFLOWS].map((workflow) => {
    const passed = pairs.filter((pair) =>
      pair[workflow]?.outcome?.status === "PASS"
    ).length;
    return [workflow, {
      passed,
      total: pairs.length,
      rate_pct: pairs.length === 0 ? null : passed / pairs.length * 100,
    }];
  }));
  const eligible = matrixComplete === true &&
    requiredPairCount > 0 &&
    pairs.length === requiredPairCount;
  const rates = [...WORKFLOWS].map((workflow) =>
    workflowTaskPass[workflow].rate_pct
  );
  return {
    population: "complete-valid-matched-pairs",
    eligible,
    valid_matched_pair_count: pairs.length,
    required_pair_count: requiredPairCount,
    outcome_quadrants: outcomeQuadrants,
    workflow_task_pass: workflowTaskPass,
    shared_floor: eligible && rates.every((rate) => rate < 20),
    shared_ceiling: eligible && rates.every((rate) => rate > 80),
    directional_asymmetry: {
      present: outcomeQuadrants.superpowers_pass_lean_fail > 0 ||
        outcomeQuadrants.lean_pass_superpowers_fail > 0,
      superpowers_pass_lean_fail:
        outcomeQuadrants.superpowers_pass_lean_fail,
      lean_pass_superpowers_fail:
        outcomeQuadrants.lean_pass_superpowers_fail,
    },
  };
}

function hasCompleteRunMatrix(runs, selectedCases, repetitions) {
  const expected = new Map();
  const caseSnapshots = new Map(selectedCases.map((benchmarkCase) => [
    benchmarkCase.id,
    caseSnapshotContract(benchmarkCase),
  ]));
  for (let repetition = 1; repetition <= repetitions; repetition += 1) {
    for (const benchmarkCase of selectedCases) {
      for (const workflow of WORKFLOWS) {
        expected.set(`${benchmarkCase.id}\u0000${repetition}\u0000${workflow}`, 0);
      }
    }
  }
  for (const run of runs) {
    const key = `${run.case_id}\u0000${run.repetition}\u0000${run.workflow}`;
    if (
      !expected.has(key) ||
      hasDevelopmentInfrastructureFailure(run) ||
      !isDeepStrictEqual(run.case_snapshot, caseSnapshots.get(run.case_id))
    ) {
      return false;
    }
    expected.set(key, expected.get(key) + 1);
  }
  return [...expected.values()].every((count) => count === 1);
}

function summarizePairs(
  pairs,
  { matrixComplete, requiredPairCount },
) {
  const reduction = (selector) => pairs.flatMap((pair) => {
    const baseline = selector(pair["superpowers-6.1.1"]);
    const candidate = selector(pair["leanpowers-0.2.0"]);
    if (
      !Number.isFinite(baseline) ||
      !Number.isFinite(candidate) ||
      baseline <= 0 ||
      candidate <= 0
    ) {
      return [];
    }
    return [(1 - candidate / baseline) * 100];
  });
  const token = reduction((run) => run.telemetry.tokens?.total);
  const modelTokenShares = pairs.flatMap((pair) => {
    const baseline = pair["superpowers-6.1.1"].telemetry.tokens?.total;
    const candidate = pair["leanpowers-0.2.0"].telemetry.tokens?.total;
    if (
      !Number.isFinite(baseline) ||
      !Number.isFinite(candidate) ||
      baseline <= 0 ||
      candidate <= 0
    ) {
      return [];
    }
    const sharePct = candidate / baseline * 100;
    return [{
      at_or_below_60: sharePct <= 60,
      case_id: pair["leanpowers-0.2.0"].case_id,
      repetition: pair["leanpowers-0.2.0"].repetition,
      share_pct: sharePct,
    }];
  });
  const modelTokenTotals = pairs.reduce((totals, pair) => {
    const baseline = pair["superpowers-6.1.1"].telemetry.tokens?.total;
    const candidate = pair["leanpowers-0.2.0"].telemetry.tokens?.total;
    if (
      !Number.isFinite(baseline) ||
      !Number.isFinite(candidate) ||
      baseline <= 0 ||
      candidate <= 0
    ) {
      return totals;
    }
    totals.baseline += baseline;
    totals.candidate += candidate;
    totals.count += 1;
    return totals;
  }, { baseline: 0, candidate: 0, count: 0 });
  const aggregateModelTokenShare = modelTokenTotals.count === 0
    ? null
    : modelTokenTotals.candidate / modelTokenTotals.baseline * 100;
  const fresh = reduction((run) => run.telemetry.tokens?.uncached_plus_output);
  const wall = reduction((run) => run.wall_seconds);
  const tools = reduction((run) => run.telemetry.tool_calls);
  const workflowReads = reduction((run) => run.telemetry.workflow_trace?.read_calls);
  return {
    count: pairs.length,
    required_pair_count: requiredPairCount,
    token_pairs: token.length,
    aggregate_model_tokens: {
      baseline: modelTokenTotals.count === 0 ? null : modelTokenTotals.baseline,
      candidate: modelTokenTotals.count === 0 ? null : modelTokenTotals.candidate,
    },
    aggregate_model_token_share_pct: aggregateModelTokenShare,
    aggregate_model_token_reduction_pct: aggregateModelTokenShare === null
      ? null
      : 100 - aggregateModelTokenShare,
    model_token_shares: modelTokenShares,
    median_token_share_pct: median(
      modelTokenShares.map(({ share_pct }) => share_pct),
    ),
    max_token_share_pct: modelTokenShares.length === 0
      ? null
      : Math.max(...modelTokenShares.map(({ share_pct }) => share_pct)),
    token_share_at_or_below_60_count: modelTokenShares.filter(
      ({ at_or_below_60 }) => at_or_below_60,
    ).length,
    stable_token_share_at_or_below_60:
      !matrixComplete || requiredPairCount === 0
      ? null
      : pairs.length === requiredPairCount &&
        modelTokenShares.length === requiredPairCount &&
        modelTokenShares.every(({ at_or_below_60 }) => at_or_below_60),
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
    ["diff", "--no-renames", "--name-only", "--relative", baselineHead, "--", "."],
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

export async function materializeRunArtifacts(outputDirectory, pendingArtifacts) {
  const rawDirectory = path.resolve(outputDirectory, "raw");
  await mkdir(rawDirectory, { recursive: true });
  const rawStat = await lstat(rawDirectory);
  if (rawStat.isSymbolicLink() || !rawStat.isDirectory()) {
    throw new Error("Development benchmark raw artifact root must be a real directory");
  }
  const rawRoot = await realpath(rawDirectory);

  for (const { runId, artifacts, priorAttempts = [] } of pendingArtifacts) {
    if (
      typeof runId !== "string" ||
      !SAFE_ARTIFACT_DIRECTORY_NAME.test(runId)
    ) {
      throw new Error(
        "Development benchmark run id must use safe lowercase segments",
      );
    }
    const runDirectory = await ensureArtifactChildDirectory(rawRoot, runId);
    await writeRunArtifactSet(runDirectory, artifacts);
    const attemptsDirectory = priorAttempts.length === 0
      ? null
      : await ensureArtifactChildDirectory(runDirectory, "attempts");
    for (const { attemptNumber, artifacts: attemptArtifacts } of priorAttempts) {
      if (!Number.isSafeInteger(attemptNumber) || attemptNumber < 1) {
        throw new Error("Development benchmark attempt number must be a positive safe integer");
      }
      const attemptDirectory = await ensureArtifactChildDirectory(
        attemptsDirectory,
        `attempt-${attemptNumber}`,
      );
      await writeRunArtifactSet(attemptDirectory, attemptArtifacts);
    }
  }
}

export async function preflightDevelopmentOutputDirectory(outputDirectory) {
  const resolved = resolveDevelopmentOutputDirectory(outputDirectory);
  assertDevelopmentOutputBoundary(await prospectiveCanonicalPath(resolved));
  await mkdir(resolved, { recursive: true });
  const stat = await lstat(resolved);
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    throw new Error("Development benchmark output must be a real directory");
  }
  if ((await readdir(resolved)).length > 0) {
    throw new Error("Development benchmark output directory must be empty");
  }
  const canonical = await realpath(resolved);
  assertDevelopmentOutputBoundary(canonical);
  return canonical;
}

async function prospectiveCanonicalPath(target) {
  let existing = target;
  const suffix = [];
  while (true) {
    try {
      await lstat(existing);
      break;
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      const parent = path.dirname(existing);
      if (parent === existing) throw error;
      suffix.unshift(path.basename(existing));
      existing = parent;
    }
  }
  return path.resolve(await realpath(existing), ...suffix);
}

export async function materializeDevelopmentSummaryArtifacts(
  outputDirectory,
  { gateJson, reportMarkdown, resultJson },
) {
  const writes = [
    writeFile(
      path.join(outputDirectory, "pilot-result.json"),
      resultJson,
      { flag: "wx" },
    ),
    writeFile(
      path.join(outputDirectory, "pilot-report.md"),
      reportMarkdown,
      { flag: "wx" },
    ),
  ];
  if (gateJson !== undefined) {
    writes.push(writeFile(
      path.join(outputDirectory, "gate-result.json"),
      gateJson,
      { flag: "wx" },
    ));
  }
  await Promise.all(writes);
}

async function ensureArtifactChildDirectory(parentDirectory, name) {
  if (!SAFE_ARTIFACT_DIRECTORY_NAME.test(name)) {
    throw new Error("Development benchmark artifact directory name is unsafe");
  }
  const candidate = path.resolve(parentDirectory, name);
  if (!isStrictDescendant(parentDirectory, candidate)) {
    throw new Error("Development benchmark artifact directory escaped its parent");
  }
  try {
    await mkdir(candidate);
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
    const existing = await lstat(candidate);
    if (existing.isSymbolicLink()) {
      throw new Error("Development benchmark artifact directory must not be a symbolic link");
    }
    throw new Error("Development benchmark artifact directory must be newly created");
  }
  const stat = await lstat(candidate);
  if (stat.isSymbolicLink()) {
    throw new Error("Development benchmark artifact directory must not be a symbolic link");
  }
  if (!stat.isDirectory()) {
    throw new Error("Development benchmark artifact path must be a directory");
  }
  const resolved = await realpath(candidate);
  if (!isStrictDescendant(parentDirectory, resolved)) {
    throw new Error("Development benchmark artifact directory escaped its parent");
  }
  return resolved;
}

async function writeRunArtifactSet(runDirectory, artifacts) {
  await Promise.all([
    writeFile(
      path.join(runDirectory, "codex.stdout.jsonl"),
      artifacts.agent_stdout,
      { flag: "wx" },
    ),
    writeFile(
      path.join(runDirectory, "codex.stderr.log"),
      artifacts.agent_stderr,
      { flag: "wx" },
    ),
    writeFile(
      path.join(runDirectory, "final-message.md"),
      artifacts.final_message,
      { flag: "wx" },
    ),
    writeFile(
      path.join(runDirectory, "verifier.json"),
      `${JSON.stringify(artifacts.verifier, null, 2)}\n`,
      { flag: "wx" },
    ),
    writeFile(
      path.join(runDirectory, "workspace.patch"),
      artifacts.workspace_patch,
      { flag: "wx" },
    ),
  ]);
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
    node,
    npm,
    runtimeReadRoots: benchmarkToolchainRuntimeReadRoots([node, npm]),
    environment: {
      PATH: [...new Set([...executableDirectories, ...systemDirectories])].join(path.delimiter),
      SHELL: shell,
    },
  };
}

function benchmarkToolchainRuntimeReadRoots(executables) {
  const roots = new Set();
  for (const executable of executables) {
    const resolved = realpathSync(executable);
    const normalized = resolved.split(path.sep).join("/");
    const cellarMarker = "/Cellar/";
    const cellarIndex = normalized.indexOf(cellarMarker);
    if (cellarIndex > 0) {
      const prefix = normalized.slice(0, cellarIndex);
      roots.add(path.join(prefix, "bin"));
      roots.add(path.join(prefix, "Cellar"));
      roots.add(path.join(prefix, "opt"));
    }
    const nodeModulesMarker = "/node_modules/";
    const nodeModulesIndex = normalized.indexOf(nodeModulesMarker);
    if (nodeModulesIndex > 0) {
      const packageEnd = normalized.indexOf("/", nodeModulesIndex + nodeModulesMarker.length);
      roots.add(
        packageEnd === -1 ? normalized : normalized.slice(0, packageEnd),
      );
    }
  }
  return [...roots].sort();
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
    input,
    maxOutputBytes = Number.POSITIVE_INFINITY,
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
      stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stdoutLineBuffer = "";
    let stderr = "";
    let timedOut = false;
    let forceKillTimer;
    let outputLimitExceeded = false;
    let outputLimitTerminationStarted = false;
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
    const terminateForOutputLimit = () => {
      outputLimitExceeded = true;
      if (outputLimitTerminationStarted) return;
      outputLimitTerminationStarted = true;
      killProcessTree(child, "SIGTERM");
      forceKillTimer = setTimeout(() => killProcessTree(child, "SIGKILL"), 5_000);
    };
    const appendOutput = (current, chunk) => {
      if (!Number.isFinite(maxOutputBytes)) return `${current}${chunk}`;
      const remaining = maxOutputBytes - Buffer.byteLength(current);
      if (remaining <= 0) {
        terminateForOutputLimit();
        return current;
      }
      const bytes = Buffer.from(chunk);
      if (bytes.length <= remaining) return `${current}${chunk}`;
      terminateForOutputLimit();
      return `${current}${bytes.subarray(0, remaining).toString("utf8")}`;
    };
    child.stdout.on("data", (chunk) => {
      stdout = appendOutput(stdout, chunk);
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
      stderr = appendOutput(stderr, chunk);
    });
    if (input !== undefined) {
      child.stdin.on("error", (error) => {
        if (error?.code !== "EPIPE" && !settled) callbackError ??= error;
      });
      child.stdin.end(String(input));
    }
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
        outputLimitExceeded,
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

function publicCommandResult(result, { redactPaths = [] } = {}) {
  const output = sanitizeBenchmarkOutput(
    `${result.stdout}${result.stderr}`,
    redactPaths,
  );
  return {
    exit_code: result.exitCode,
    output_limited: result.outputLimitExceeded === true,
    sandbox: result.sandboxMode ?? null,
    signal: result.signal ?? null,
    timed_out: result.timedOut,
    output: output.slice(-20_000),
  };
}

function failedPublicCommandResult(message) {
  return {
    exit_code: 1,
    output_limited: false,
    sandbox: null,
    signal: null,
    timed_out: false,
    output: String(message),
  };
}

function sanitizeBenchmarkOutput(value, redactPaths) {
  let output = String(value ?? "");
  const roots = [
    PROJECT_ROOT,
    os.homedir(),
    os.tmpdir(),
    ...redactPaths,
  ].filter((candidate) => typeof candidate === "string" && path.isAbsolute(candidate));
  const paths = [...new Set(roots.flatMap((candidate) => {
    try {
      return [candidate, realpathSync(candidate)];
    } catch {
      return [candidate];
    }
  }))]
    .sort((left, right) => right.length - left.length);
  for (const sensitivePath of paths) {
    for (const presentation of [
      pathToFileURL(sensitivePath).href.replace(/\/$/u, ""),
      sensitivePath,
    ]) {
      output = output.replaceAll(presentation, "<redacted-path>");
    }
  }
  const hostUser = os.userInfo().username;
  if (typeof hostUser === "string" && hostUser.length >= 3) {
    output = output.replaceAll(hostUser, "<redacted-user>");
  }
  return output
    .replace(/data:text\/javascript;base64,[a-z0-9+/=]+/giu, "<hidden-verifier>")
    .replace(/file:\/\/\/[^\s)\]}]+/gu, "<redacted-path>");
}

async function workspaceContainsSymlink(workspace, directory = workspace) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    const stat = await lstat(target);
    if (stat.isSymbolicLink()) return true;
    if (stat.isDirectory() && await workspaceContainsSymlink(workspace, target)) {
      return true;
    }
  }
  return false;
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

function nonNegativeSafeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

export function extractDeclaredRisk(message) {
  const routeDeclaration = parseLeanRouteLedger(message);
  if (routeDeclaration !== null) return routeDeclaration.risk;
  const text = visibleAssertionLines(message).join("\n");
  const afterRisk = text.match(
    /\brisk(?:\s+(?:profile|level))?\s*(?:[:=]|\bis\b)?\s*`?(lean|standard|strict)`?/iu,
  );
  if (afterRisk) return afterRisk[1].toLowerCase();
  const beforeRisk = text.match(/`?(lean|standard|strict)`?\s+risk\b/iu);
  if (beforeRisk) return beforeRisk[1].toLowerCase();
  const ownerOrMode = text.match(/\b(lean|standard|strict)\s+(?:owner|mode)\b/iu);
  return ownerOrMode ? ownerOrMode[1].toLowerCase() : null;
}

export function parseLeanRouteLedger(message) {
  const text = visibleAssertionLines(message).join("\n");
  const firstLine = text.split(/\r?\n/u)[0];
  if (leanRouteMessageDeniesActivation(text)) return null;
  const exact = parseExactLeanRouteLedger(text);
  if (exact !== null) {
    return leanRouteFieldsConsistent(text, exact) ? exact : null;
  }

  const routeMatch = /\bleanpowers:route\b/iu.exec(firstLine);
  if (routeMatch === null) return null;
  const throughRoute = firstLine.slice(
    0,
    routeMatch.index + routeMatch[0].length,
  );
  if (!isAssertiveLeanRoutePrefix(throughRoute)) return null;
  const afterRoute = firstLine.slice(routeMatch.index + routeMatch[0].length);
  if (
    /^\s*running in\b/iu.test(throughRoute) &&
    !/^[*_`]*\s+workflow\s+with\b/iu.test(afterRoute)
  ) {
    return null;
  }
  if (/^[*_`]*\s*\?/u.test(afterRoute)) return null;
  if (
    /\b(?:if|maybe|perhaps|possibly|tentatively|provisionally|assuming)\b[^.;]{0,80}\bleanpowers:route\b/iu.test(throughRoute) ||
    /\b(?:do\s+not|don't|never|cannot|can't|won't|unable\s+to)\s+(?:use|select|activate|invoke)\b[^.;]{0,32}\bleanpowers:route\b/iu.test(throughRoute) ||
    /\b(?:not|without|skip(?:ping)?|declin(?:e|ing))\s+(?:(?:use|using|select|selecting|activate|activating|invoke|invoking)\s+)?\bleanpowers:route\b/iu.test(throughRoute) ||
    /\bwithout\s+(?:using|selecting|activating|invoking)\b[^.;]{0,32}\bleanpowers:route\b/iu.test(throughRoute) ||
    /\bleanpowers:route\b[^.]{0,48}\b(?:unavailable|disabled|not available|cannot be used)\b/iu.test(firstLine) ||
    /\b(?:not|never)\s+activat(?:e|ed|ing)\b|\bactivation\s+(?:failed|did\s+not\s+succeed|was\s+unsuccessful)\b/iu.test(firstLine)
  ) {
    return null;
  }
  const rawRouteFieldText = firstLine.slice(
    routeMatch.index + routeMatch[0].length,
  );
  const routeFieldText = rawRouteFieldText.replace(
    /^[*_`]*\s+workflow\s*:\s*(?=owner\s*[:=])/iu,
    " ",
  );
  const routeAndFields = `${routeMatch[0]}${routeFieldText}`;
  const structuredFields = [...routeFieldText.matchAll(
    /(?:^|[^\p{L}\p{N}_-])([\p{L}_][\p{L}\p{N}_-]*)\s*[:=]/gu,
  )].map((match) => match[1].toLocaleLowerCase("en-US"));
  const allowedStructuredFields = new Set([
    "gate",
    "gates",
    "owner",
    "required_gate",
    "required_gates",
    "risk",
    "workflow",
  ]);
  if (structuredFields.some((field) => !allowedStructuredFields.has(field))) {
    return null;
  }
  const workflowMatches = [...routeAndFields.matchAll(
    /\b(?:workflow|owner)\s*(?:[:=]|\bis\b)\s*`?(shape|build|debug|review|verify|ship|adapt)`?(?=\s*(?:[|;,.]|\b(?:and|based|per)\b|\bwas\s+used\b|$))/giu,
  )];
  const riskMatches = [...routeAndFields.matchAll(
    /\brisk\s*(?:[:=]|\bis\b)\s*`?(lean|standard|strict)`?(?=\s*(?:[|;,.]|\b(?:and|based|per)\b|\bwas\s+used\b|$))/giu,
  )];
  const workflowPresentations = [...routeAndFields.matchAll(
    /\b(?:workflow|owner)\s*(?:[:=]|\bis\b)\s*`?(?!not\b|never\b)([\p{L}][\p{L}\p{N}_-]*)`?(?=\s*(?:[|;,.]|\b(?:and|based|per)\b|\bwas\s+used\b|$))/giu,
  )];
  const riskPresentations = [...routeAndFields.matchAll(
    /\brisk\s*(?:[:=]|\bis\b)\s*`?(?!not\b|never\b)([\p{L}][\p{L}\p{N}_-]*)`?(?=\s*(?:[|;,.]|\b(?:and|based|per)\b|\bwas\s+used\b|$))/giu,
  )];
  const workflows = new Set(workflowMatches.map(
    (match) => match[1].toLocaleLowerCase("en-US"),
  ));
  const risks = new Set(riskMatches.map(
    (match) => match[1].toLocaleLowerCase("en-US"),
  ));
  const structuredWorkflowMatches = [...routeFieldText.matchAll(
    /\b(?:workflow|owner)\s*[:=]\s*`?(?:shape|build|debug|review|verify|ship|adapt)`?(?=\s*(?:[|;,.]|\b(?:and|based|per)\b|\bwas\s+used\b|$))/giu,
  )];
  const structuredRiskMatches = [...routeFieldText.matchAll(
    /\brisk\s*[:=]\s*`?(?:lean|standard|strict)`?(?=\s*(?:[|;,.]|\b(?:and|based|per)\b|\bwas\s+used\b|$))/giu,
  )];
  const structuredWorkflowFields = structuredFields.filter((field) =>
    field === "workflow" || field === "owner"
  ).length;
  const structuredRiskFields = structuredFields.filter((field) => field === "risk").length;
  if (
    workflows.size !== 1 ||
    risks.size !== 1 ||
    workflowMatches.length !== 1 ||
    riskMatches.length !== 1 ||
    workflowPresentations.length !== workflowMatches.length ||
    riskPresentations.length !== riskMatches.length ||
    structuredWorkflowFields !== structuredWorkflowMatches.length ||
    structuredRiskFields !== structuredRiskMatches.length
  ) {
    return null;
  }
  const workflow = [...workflows][0];
  const risk = [...risks][0];
  const expectedGates = expectedLeanRouteGates(risk);
  const gateMatches = [...routeAndFields.matchAll(
    /\b(?:required[_\s]+gates?|gates?)\s*(?:[:=]|\b(?:is|are)\b)\s*`?(\[[^\]\r\n]*\])`?(?=\s*(?:[|;,.]|\band\b|$))/giu,
  )];
  const gatePresentations = [...routeAndFields.matchAll(
    /\b(?:required[_\s]+gates?|gates?)\s*(?:[:=]|\b(?:is|are)\b)\s*`?(?!not\b|never\b)(\[[^\]\r\n]*\]|[\p{L}_][\p{L}\p{N}_-]*)`?(?=\s*(?:[|;,.]|\band\b|$))/giu,
  )];
  const explicitGatePresentations = [...routeAndFields.matchAll(
    /\b(?:required[_\s]+gates?|gates?)\s*(?:[:=]|\b(?:is|are)\b)\s*`?(?:\[|current_evidence\b|independent_review\b)/giu,
  )];
  const structuredGateMatches = [...routeFieldText.matchAll(
    /\b(?:required[_\s]+gates?|gates?)\s*[:=]\s*`?\[[^\]\r\n]*\]`?(?=\s*(?:[|;,.]|\band\b|$))/giu,
  )];
  const structuredGateFields = structuredFields.filter((field) =>
    ["gate", "gates", "required_gate", "required_gates"].includes(field)
  ).length;
  if (
    gateMatches.length > 1 ||
    gatePresentations.length !== gateMatches.length ||
    explicitGatePresentations.length !== gateMatches.length ||
    structuredGateFields !== structuredGateMatches.length
  ) {
    return null;
  }
  const declarationEnd = Math.max(
    ...[...workflowMatches, ...riskMatches, ...gateMatches].map(
      (match) => match.index + match[0].length,
    ),
  );
  const declaration = routeAndFields.slice(0, declarationEnd);
  if (
    /\b(?:if|maybe|perhaps|possibly|tentatively|provisionally|assuming)\b/iu.test(declaration) ||
    /\b(?:not|never|without|skip(?:ping)?|declin(?:e|ing)|unavailable|unable(?:\s+to)?|cannot|can't|won't|do\s+not|don't)\b/iu.test(declaration)
  ) {
    return null;
  }
  const presentedGates = gateMatches.map(
    (match) => normalizeLeanRouteGates(match[1]),
  );
  if (
    presentedGates.some((gates) => gates === null || gates !== expectedGates) ||
    new Set(presentedGates).size > 1
  ) {
    return null;
  }
  if (negatesLeanRouteDeclaration(text, { workflow, risk, expectedGates })) {
    return null;
  }
  const parsedDeclaration = { workflow, risk, required_gates: expectedGates };
  return leanRouteFieldsConsistent(text, parsedDeclaration)
    ? parsedDeclaration
    : null;
}

function leanRouteFieldsConsistent(message, { workflow, risk, required_gates: expectedGates }) {
  const text = String(message ?? "");
  const structuredText = text
    .split(/\r?\n/u)
    .map(normalizeLeanRouteLedgerPresentation)
    .filter((line) =>
      /^(?:workflow|owner|risk|required[_\s]+gates?|gates?)(?:[*_`]+)?\s*[:=]/iu
        .test(line)
    )
    .join("\n");
  const structuredWorkflowFields = [...structuredText.matchAll(
    /\b(?:workflow|owner)(?:[*_`]+)?\s*[:=]/giu,
  )];
  const structuredWorkflowPresentations = [...structuredText.matchAll(
    /\b(?:workflow|owner)(?:[*_`]+)?\s*[:=][*_`]*\s*`?(shape|build|debug|review|verify|ship|adapt)`?(?=\s*(?:[|;,.]|\band\b|$))/gimu,
  )];
  const structuredRiskFields = [...structuredText.matchAll(
    /\brisk(?:[*_`]+)?\s*[:=]/giu,
  )];
  const structuredRiskPresentations = [...structuredText.matchAll(
    /\brisk(?:[*_`]+)?\s*[:=][*_`]*\s*`?(lean|standard|strict)`?(?=\s*(?:[|;,.]|\band\b|$))/gimu,
  )];
  const structuredGateFields = [...structuredText.matchAll(
    /\b(?:required[_\s]+gates?|gates?)(?:[*_`]+)?\s*[:=]/giu,
  )];
  const structuredGatePresentations = [...structuredText.matchAll(
    /\b(?:required[_\s]+gates?|gates?)(?:[*_`]+)?\s*[:=][*_`]*\s*`?(\[[^\]\r\n]*\])`?(?=\s*(?:[|;,.]|\band\b|$))/gimu,
  )];
  const workflowPresentations = [
    ...structuredWorkflowPresentations,
    ...text.matchAll(
      /\b(?:workflow|owner)\s+is\s+`?(shape|build|debug|review|verify|ship|adapt)\b/giu,
    ),
  ].map((match) => match[1].toLocaleLowerCase("en-US"));
  const riskPresentations = [
    ...structuredRiskPresentations,
    ...text.matchAll(
      /\brisk\s+is\s+`?(lean|standard|strict)\b/giu,
    ),
  ].map((match) => match[1].toLocaleLowerCase("en-US"));
  const gatePresentations = [
    ...structuredGatePresentations,
    ...text.matchAll(
      /\b(?:required[_\s]+gates?|gates?)\s+(?:is|are)\s+`?(\[[^\]\r\n]*\])`?/giu,
    ),
  ].map((match) => normalizeLeanRouteGates(match[1]));
  return !negatesLeanRouteDeclaration(text, { workflow, risk, expectedGates }) &&
    structuredWorkflowFields.length === structuredWorkflowPresentations.length &&
    structuredRiskFields.length === structuredRiskPresentations.length &&
    structuredGateFields.length === structuredGatePresentations.length &&
    workflowPresentations.every((value) => value === workflow) &&
    riskPresentations.every((value) => value === risk) &&
    gatePresentations.every((value) => value === expectedGates);
}

function leanRouteMessageDeniesActivation(message) {
  const text = String(message ?? "");
  return (
    /\bactivation\s+(?:failed|did\s+not\s+succeed|(?:is|was)\s+(?:unsuccessful|not\s+successful|false))\b/iu.test(text) ||
    /\b(?:invok(?:e|ed|ing)|activat(?:e|ed|ing)|select(?:ed|ing)|follow(?:ed|ing)|us(?:e|ed|ing))\s+`?leanpowers:route`?\s*(?:[:—-]\s*)?(?:has\s+)?(?:failed|did\s+not\s+succeed|was\s+unsuccessful)\b/iu.test(text) ||
    /\b(?:not|never|without|skip(?:ping)?|declin(?:e|ing))\s+(?:(?:use|using|select|selecting|activate|activating|invoke|invoking)\s+)?`?leanpowers:route`?\b/iu.test(text) ||
    /\b(?:(?:workflow|owner)\s*(?:[:=]|\bis\b)\s*`?(?:OWNER|WORKFLOW)\b|risk\s*(?:[:=]|\bis\b)\s*`?RISK\b)/u.test(text) ||
    /\bleanpowers:route\b[^\r\n.]{0,48}\b(?:not|never)\s+activat(?:e|ed|ing)\b/iu.test(text) ||
    /\bleanpowers:route\b[^\r\n.]{0,160}\bwas\s+not\s+used\b/iu.test(text) ||
    /\b(?:(?:do|does|did|am|is|are|was|were|will|would|have|has)\s+not|(?:don['’]t|doesn['’]t|didn['’]t|isn['’]t|aren['’]t|wasn['’]t|weren['’]t|won['’]t|wouldn['’]t|haven['’]t|hasn['’]t))\s+(?:(?:intend|mean|plan)\s+to\s+)?(?:use|used|using|activate|activated|activating|select|selected|selecting|invoke|invoked|invoking|follow|followed|following)\s+(?:it|this\s+(?:route|workflow)|that\s+(?:route|workflow)|the\s+(?:route(?:\s+workflow)?|workflow)|leanpowers:route)\b/iu.test(text) ||
    /\b(?:this|that|the)\s+(?:route|workflow)\s+(?:(?:is|was)\s+not|(?:isn['’]t|wasn['’]t))\s+active\b/iu.test(text)
  );
}

function negatesLeanRouteDeclaration(text, { workflow, risk, expectedGates }) {
  const negatedWorkflows = [
    ...String(text ?? "").matchAll(
      /\b(?:workflow|owner)\s*(?:(?:is\s+not)|isn't)\s*`?(shape|build|debug|review|verify|ship|adapt)\b/giu,
    ),
    ...String(text ?? "").matchAll(
      /\bnot\s+(?:the\s+)?(?:workflow|owner)\s*(?:[:=]|\bis\b)?\s*`?(shape|build|debug|review|verify|ship|adapt)\b/giu,
    ),
  ].map((match) => match[1].toLocaleLowerCase("en-US"));
  const negatedRisks = [
    ...String(text ?? "").matchAll(
      /\brisk\s*(?:(?:is\s+not)|isn't)\s*`?(lean|standard|strict)\b/giu,
    ),
    ...String(text ?? "").matchAll(
      /\bnot\s+(?:the\s+)?risk\s*(?:[:=]|\bis\b)?\s*`?(lean|standard|strict)\b/giu,
    ),
  ].map((match) => match[1].toLocaleLowerCase("en-US"));
  const negatedGates = [
    ...String(text ?? "").matchAll(
      /\b(?:required[_\s]+gates?|gates?)\s*(?:(?:(?:is|are)\s+not)|(?:isn't|aren't))\s*`?(\[[^\]\r\n]*\])`?/giu,
    ),
    ...String(text ?? "").matchAll(
      /\bnot\s+(?:the\s+)?(?:required[_\s]+gates?|gates?)\s*(?:[:=]|\b(?:is|are)\b)?\s*`?(\[[^\]\r\n]*\])`?/giu,
    ),
  ].map((match) => normalizeLeanRouteGates(match[1]));
  return negatedWorkflows.includes(workflow) ||
    negatedRisks.includes(risk) ||
    negatedGates.includes(expectedGates);
}

function isAssertiveLeanRoutePrefix(value) {
  const normalized = String(value ?? "")
    .replace(/[*_`]/gu, "")
    .trim()
    .replace(/\s+/gu, " ");
  return /^(?:leanpowers:route|workflow decision\s*:\s*leanpowers:route|(?:(?:routing|route) selected|selected|using|following|invoking|activated|activating|entrypoint)\s*:?\s*leanpowers:route|starting (?:in workflow\s+|with (?:the\s+)?|using (?:the\s+)?)leanpowers:route|running in (?:the\s+)?leanpowers:route|I(?:'m|’m| am)?\s+(?:use|using|follow|following|select|selected|activate|activated|invoke|invoking)\s+leanpowers:route)$/iu
    .test(normalized);
}

function parseExactLeanRouteLedger(message) {
  const lines = String(message ?? "").split(/\r?\n/u);
  if (lines.length < 3 || lines[0] !== "entrypoint: leanpowers:route") {
    return null;
  }
  const workflow = lines[1].match(
    /^workflow: (shape|build|debug|review|verify|ship|adapt)$/u,
  )?.[1];
  const risk = lines[2].match(/^risk: (lean|standard|strict)$/u)?.[1];
  if (!workflow || !risk) return null;
  const expectedGates = expectedLeanRouteGates(risk);
  let suffixStart = 3;
  if (/^required_gates:/u.test(lines[3] ?? "")) {
    const requiredGates = lines[3].match(
      /^required_gates: (\[[^\]]*\])$/u,
    )?.[1];
    if (requiredGates !== expectedGates) return null;
    suffixStart = 4;
  }
  if (!isValidLeanRouteSuffix(lines.slice(suffixStart))) return null;
  return { workflow, risk, required_gates: expectedGates };
}

function isValidLeanRouteSuffix(suffix) {
  return suffix.length === 0 ||
    (suffix.length === 1 && suffix[0] === "") ||
    (suffix.length >= 2 && suffix[0] === "" && suffix[1].trim().length > 0);
}

function expectedLeanRouteGates(risk) {
  return risk === "strict"
    ? "[independent_review, current_evidence]"
    : "[current_evidence]";
}

function normalizeLeanRouteGates(value) {
  const text = String(value ?? "").trim();
  if (!/^\[[^\]]*\]$/u.test(text)) return null;
  const gates = text.slice(1, -1).split(",").map((gate) => gate.trim());
  const allowed = ["independent_review", "current_evidence"];
  if (
    gates.some((gate) => !allowed.includes(gate)) ||
    new Set(gates).size !== gates.length
  ) {
    return null;
  }
  return `[${allowed.filter((gate) => gates.includes(gate)).join(", ")}]`;
}

function isCanonicalLeanRouteDeclaration(message) {
  if (parseExactLeanRouteLedger(message) !== null) return true;
  const firstLine = String(message ?? "").split(/\r?\n/u)[0];
  return /^leanpowers:route \| workflow=(?:shape|build|debug|review|verify|ship|adapt) \| risk=(?:lean|standard|strict)$/u
    .test(firstLine);
}

function parseLeanRouteLedgerCandidate(message) {
  const semantic = parseLeanRouteLedger(message);
  if (semantic !== null) return semantic;
  const lines = String(message ?? "").split(/\r?\n/u);
  if (lines.length < 4) return null;
  return parseLeanRouteLedger(
    [
      ...lines.slice(0, 4).map((line) => line.trimEnd()),
      ...lines.slice(4),
    ].join("\n"),
  );
}

function hasForbiddenLeanRouteLedgerKey(message) {
  return String(message ?? "").split(/\r?\n/u).some((line) =>
    /^(?:entrypoint|workflow|risk|required_gates)(?:[*_`]+)?:(?:[*_`]+)?(?:[ \t]|$)/u
      .test(normalizeLeanRouteLedgerPresentation(line))
  );
}

function analyzeLeanRouteTimeline(indexedEvents, firstToolIndex) {
  const order = ["lean", "standard", "strict"];
  const presentations = [];
  const visibleMessages = [];
  for (const { event, index } of indexedEvents) {
    if (
      event?.type !== "item.completed" ||
      event?.item?.type !== "agent_message"
    ) {
      continue;
    }
    const message = String(event.item.text ?? "");
    const lines = visibleAssertionLines(message);
    visibleMessages.push({ event_index: index, lines });
    const denialObserved = leanRouteMessageDeniesActivation(lines.join("\n"));
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      const line = lines[lineIndex];
      const multilineStructuredPacket =
        /\bleanpowers:route\b/iu.test(line) &&
        !isStructuredLeanRoutePacketShape(line) &&
        isStructuredLeanRoutePacketShape(
          lines.slice(lineIndex, lineIndex + 4).join("\n"),
        );
      if (isLeanRouteDeclarationShape(line) || multilineStructuredPacket) {
        const legacy = /^\s*entrypoint:\s*leanpowers:route\b/iu.test(line);
        const packetLineCount = legacy
          ? structuredLeanRoutePacketLineCount(lines, lineIndex)
          : multilineStructuredPacket ? 4 : 1;
        const lineEnd = Math.min(
          lines.length - 1,
          lineIndex + packetLineCount - 1,
        );
        const packet = lines.slice(lineIndex, lineEnd + 1)
          .map((packetLine) => packetLine.trimEnd())
          .join("\n");
        presentations.push({
          event,
          event_index: index,
          kind: "route",
          legacy_suffix_valid:
            !legacy || isValidLeanRouteSuffix(lines.slice(lineEnd + 1)),
          line_index: lineIndex,
          line_end: lineEnd,
          message_denies_activation: denialObserved,
          presentation: packet,
        });
        if (legacy || multilineStructuredPacket) lineIndex = lineEnd;
        continue;
      }
      const marker = line.trim().match(
        /^leanpowers:risk \| risk=(lean|standard|strict)$/u,
      );
      if (marker !== null) {
        presentations.push({
          event,
          event_index: index,
          kind: "marker",
          line_index: lineIndex,
          line_end: lineIndex,
          risk: marker[1],
        });
      }
    }
  }
  presentations.sort((left, right) =>
    left.event_index - right.event_index ||
    left.line_index - right.line_index ||
    (left.kind === "route" ? -1 : 1)
  );

  let declarationsConsistent = true;
  let highestPresentedRisk = null;
  let highestRank = -1;
  let initialRouteLedger;
  let owner = null;
  let riskMonotonicObserved = true;
  let routeLedgerOccurrences = 0;
  for (const presentation of presentations) {
    if (presentation.kind === "marker") {
      const rank = order.indexOf(presentation.risk);
      if (rank < highestRank) riskMonotonicObserved = false;
      highestRank = Math.max(highestRank, rank);
      highestPresentedRisk = order[highestRank];
      continue;
    }

    routeLedgerOccurrences += 1;
    let ledger = presentation.message_denies_activation ||
        presentation.legacy_suffix_valid === false
      ? null
      : parseLeanRouteLedgerCandidate(presentation.presentation);
    const visibleLines = visibleAssertionLines(
      presentation.event?.item?.text,
    );
    const claimedRouteLines = new Set(
      presentations
        .filter((candidate) =>
          candidate.kind === "route" &&
          candidate.event_index === presentation.event_index
        )
        .flatMap((candidate) =>
          Array.from(
            { length: candidate.line_end - candidate.line_index + 1 },
            (_, offset) => candidate.line_index + offset,
          )
        ),
    );
    const unclaimedFieldLines = visibleLines.filter((line, lineIndex) =>
      !claimedRouteLines.has(lineIndex) &&
      !/^\s*leanpowers:risk\s*\|/iu.test(line)
    );
    const fieldContext = [
      presentation.presentation,
      ...unclaimedFieldLines,
    ].join("\n");
    if (
      ledger !== null &&
      !leanRouteFieldsConsistent(fieldContext, ledger)
    ) {
      ledger = null;
    }
    if (routeLedgerOccurrences === 1 && ledger !== null) {
      if (presentation.event_index < firstToolIndex) {
        initialRouteLedger = { ...presentation, ledger };
      }
    }
    if (ledger === null) {
      declarationsConsistent = false;
      for (const presentedRisk of presentedLeanRouteRiskTokens(
        visibleLines.join("\n"),
      )) {
        const rank = order.indexOf(presentedRisk);
        if (rank < highestRank) riskMonotonicObserved = false;
        highestRank = Math.max(highestRank, rank);
        highestPresentedRisk = order[highestRank];
      }
      continue;
    }
    const rank = order.indexOf(ledger.risk);
    if (rank < highestRank) riskMonotonicObserved = false;
    highestRank = Math.max(highestRank, rank);
    highestPresentedRisk = order[highestRank];
    if (owner === null) owner = ledger.workflow;
    else if (ledger.workflow !== owner) declarationsConsistent = false;
  }

  const recognizedRouteLines = new Map();
  for (const presentation of presentations.filter(({ kind }) => kind === "route")) {
    const lines = recognizedRouteLines.get(presentation.event_index) ?? new Set();
    for (
      let lineIndex = presentation.line_index;
      lineIndex <= presentation.line_end;
      lineIndex += 1
    ) {
      lines.add(lineIndex);
    }
    recognizedRouteLines.set(presentation.event_index, lines);
  }
  const ledgerKeysAfterInitialObserved = initialRouteLedger !== undefined &&
    visibleMessages.some(({ event_index: eventIndex, lines }) => {
      if (eventIndex < initialRouteLedger.event_index) return false;
      const recognized = recognizedRouteLines.get(eventIndex) ?? new Set();
      return lines.some((line, lineIndex) => {
        if (
          eventIndex === initialRouteLedger.event_index &&
          lineIndex <= initialRouteLedger.line_end
        ) {
          return false;
        }
        return !recognized.has(lineIndex) && hasForbiddenLeanRouteLedgerKey(line);
      });
    });

  return {
    highest_presented_risk: highestPresentedRisk,
    initial_route_ledger: initialRouteLedger,
    ledger_keys_after_initial_observed: ledgerKeysAfterInitialObserved,
    risk_monotonic_observed:
      routeLedgerOccurrences > 0 && riskMonotonicObserved,
    route_declarations_consistent:
      routeLedgerOccurrences > 0 && declarationsConsistent,
    route_ledger_occurrences: routeLedgerOccurrences,
  };
}

function structuredLeanRoutePacketLineCount(lines, start) {
  if (
    !/^\s*entrypoint:\s*leanpowers:route\b/iu.test(lines[start] ?? "") ||
    !/^workflow:\s*(?:shape|build|debug|review|verify|ship|adapt)\s*$/iu.test(
      lines[start + 1] ?? "",
    ) ||
    !/^risk:\s*(?:lean|standard|strict)\s*$/iu.test(lines[start + 2] ?? "")
  ) {
    return 1;
  }
  return /^required_gates:/iu.test(lines[start + 3] ?? "") ? 4 : 3;
}

function isLeanRouteDeclarationShape(line) {
  const text = String(line ?? "");
  if (/^\s*entrypoint:\s*leanpowers:route\b/iu.test(text)) return true;
  const routeMatch = /\bleanpowers:route\b/iu.exec(text);
  if (routeMatch === null) return false;
  if (isAssertiveLeanRoutePrefix(
    text.slice(0, routeMatch.index + routeMatch[0].length),
  )) {
    return true;
  }
  const fields = text.slice(routeMatch.index + routeMatch[0].length);
  return isStructuredLeanRoutePacketShape(fields);
}

function isStructuredLeanRoutePacketShape(value) {
  const text = String(value ?? "");
  return /\b(?:workflow|owner)\s*(?:[:=]|\bis\b)/iu.test(text) &&
    /\brisk\s*(?:[:=]|\bis\b)/iu.test(text);
}

function presentedLeanRouteRiskTokens(message) {
  const risks = [];
  const text = visibleAssertionLines(message).join("\n");
  for (const match of text.matchAll(
    /\brisk(?:\s+(?:profile|level))?\s*(?:[:=]|\bis\b)\s*`?(lean|standard|strict)`?/giu,
  )) {
    risks.push(match[1].toLocaleLowerCase("en-US"));
  }
  return risks;
}

function normalizeLeanRouteLedgerPresentation(line) {
  let normalized = String(line ?? "").trimStart();
  while (true) {
    const stripped = normalized.replace(
      /^(?:>[ \t]*|#{1,6}[ \t]+|[-*+][ \t]+|\d+[.)][ \t]+)/u,
      "",
    ).trimStart();
    if (stripped === normalized) break;
    normalized = stripped;
  }
  return normalized.replace(/^[*_`]+/u, "");
}

export function reportsWorkflowActivation({ entrypoint, message, workflow }) {
  const text = visibleAssertionLines(message).join("\n");
  if (workflow === "leanpowers-0.2.0") {
    return parseLeanRouteLedger(text) !== null;
  }
  const aliases = [entrypoint.slice(1)];
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
  const structured = new RegExp(
    `(?:^|\\n)\\s*(?:[-*]\\s*)?(?:entrypoint|workflow|skill)\\s*[:=]\\s*(?:${target})(?:\\s|$)`,
    "iu",
  );
  const applying = new RegExp(
    `(?:^|\\n)\\s*Applying\\s+(?:${target})(?=\\s|[,.;:]|$)`,
    "iu",
  );
  const affirmative = new RegExp(
    `\\b(?:activat(?:e|ed|ing)|invok(?:e|ed|ing)|us(?:e|ed|ing)|follow(?:ed|ing)?|start(?:ed|ing)?(?:\\s+with)?)\\b[^\\n.]{0,64}(?:${target})`,
    "iu",
  );
  return structured.test(text) || applying.test(text) || affirmative.test(text);
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

function isStrictDescendant(parent, child) {
  const relative = path.relative(parent, child);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}
