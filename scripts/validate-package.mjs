import { execFile, spawn } from "node:child_process";
import {
  access,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  readdir,
  rm,
  stat,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { expectedArtifacts, packageFileManifest } from "./generate.mjs";
import { projectRoot, readMetadata } from "./lib/project.mjs";

const ROOT = fileURLToPath(projectRoot);
const execFileAsync = promisify(execFile);
const PACKAGE_ROOTS = [
  path.join(ROOT, "plugins/codex/leanpowers"),
  path.join(ROOT, "plugins/claude/leanpowers"),
];
const SKILLS = ["adapt", "build", "debug", "review", "shape", "ship", "verify"];
const LEARNING_HELPERS = ["learning.mjs", "learning-core.mjs", "learning-store.mjs"];
const LEARNING_SCHEMAS = ["learning-config.schema.json", "lesson-event.schema.json"];
const FORBIDDEN_PACKAGE_ENTRIES = [
  "adapters",
  "evals",
  "metadata",
  "scripts",
  "tests",
  "package.json",
];

export async function collectValidationErrors() {
  const errors = [];
  let metadata;
  try {
    metadata = await readMetadata();
  } catch (error) {
    return [`metadata: ${error.message}`];
  }

  await validateVersionSync(metadata, errors);
  await validateGeneratedArtifacts(errors);
  for (const [runtime, packageRoot] of [
    ["codex", PACKAGE_ROOTS[0]],
    ["claude", PACKAGE_ROOTS[1]],
  ]) {
    errors.push(...(await validatePackage(packageRoot, { runtime })));
  }
  return [...new Set(errors)].sort();
}

export async function validateStandalonePackage(
  packageRoot,
  { timeoutMs = 5000 } = {},
) {
  const resolvedRoot = path.resolve(packageRoot);
  const errors = [];
  const runtime = await inferPackageRuntime(resolvedRoot, errors);
  if (runtime === null) {
    return [...new Set(errors)].sort();
  }
  return validatePackage(resolvedRoot, { runtime, timeoutMs });
}

export async function validatePackage(
  packageRoot,
  { runtime, timeoutMs = 5000 } = {},
) {
  const resolvedRoot = path.resolve(packageRoot);
  const errors = [];
  if (runtime !== "codex" && runtime !== "claude") {
    return [`${relative(resolvedRoot)}: runtime must be codex or claude`];
  }

  await validateExactInventory(resolvedRoot, runtime, errors);
  await validateRuntimeManifest(resolvedRoot, runtime, errors);
  await validateCommonPackage(resolvedRoot, errors);
  if (runtime === "claude") {
    await validateClaudeStatic(resolvedRoot, errors);
  }
  if (errors.length === 0) {
    await validateLearningRuntime(resolvedRoot, errors, timeoutMs);
    if (runtime === "claude") {
      await validateClaudeHookRuntime(resolvedRoot, errors, timeoutMs);
    }
  }
  return [...new Set(errors)].sort();
}

async function inferPackageRuntime(packageRoot, errors) {
  const manifests = [
    ["codex", ".codex-plugin/plugin.json"],
    ["claude", ".claude-plugin/plugin.json"],
  ];
  const present = [];
  for (const [runtime, manifest] of manifests) {
    if (await exists(path.join(packageRoot, manifest))) {
      present.push(runtime);
    }
  }
  if (present.length !== 1) {
    errors.push(`${relative(packageRoot)}: requires exactly one runtime manifest`);
    return null;
  }
  return present[0];
}

async function validateRuntimeManifest(packageRoot, runtime, errors) {
  const manifest = runtime === "codex"
    ? ".codex-plugin/plugin.json"
    : ".claude-plugin/plugin.json";
  const manifestPath = path.join(packageRoot, manifest);
  let value;
  try {
    value = JSON.parse(await readFile(manifestPath, "utf8"));
  } catch (error) {
    errors.push(`${relative(manifestPath)}: invalid runtime manifest (${error.message})`);
    return;
  }
  if (value?.name !== "leanpowers") {
    errors.push(`${relative(manifestPath)}: runtime manifest name must be leanpowers`);
  }
  if (typeof value?.version !== "string" || !/^\d+\.\d+\.\d+$/u.test(value.version)) {
    errors.push(`${relative(manifestPath)}: runtime manifest version must be semver`);
  }
  if (runtime === "codex") {
    if (value.skills !== "./skills/") {
      errors.push(`${relative(manifestPath)}: Codex skills path must be ./skills/`);
    }
    if (Object.hasOwn(value, "hooks") || Object.hasOwn(value, "agents")) {
      errors.push(`${relative(manifestPath)}: Codex manifest must not define Claude adapters`);
    }
  } else if (Object.hasOwn(value, "skills") || Object.hasOwn(value, "interface")) {
    errors.push(`${relative(manifestPath)}: Claude manifest contains Codex-only fields`);
  }
}

async function validateExactInventory(packageRoot, runtime, errors) {
  const expectedFiles = new Set(packageFileManifest(runtime));
  const expectedDirectories = expectedPackageDirectories(expectedFiles);
  const actualFiles = new Set();
  const actualDirectories = new Set();
  let rootStat;
  try {
    rootStat = await lstat(packageRoot);
  } catch (error) {
    errors.push(`${relative(packageRoot)}: ${error.message}`);
    return;
  }
  if (rootStat.isSymbolicLink()) {
    errors.push(`${relative(packageRoot)}: package root must not be a symlink`);
    return;
  }
  if (!rootStat.isDirectory()) {
    errors.push(`${relative(packageRoot)}: package root must be a directory`);
    return;
  }

  const visit = async (directory, prefix = "") => {
    const entries = await readdir(directory);
    for (const name of entries.sort()) {
      const entryPath = path.join(directory, name);
      const packagePath = path.posix.join(prefix, name);
      const entryStat = await lstat(entryPath);
      if (entryStat.isSymbolicLink()) {
        errors.push(`${relative(packageRoot)}: package symlink ${packagePath}`);
      } else if (entryStat.isDirectory()) {
        actualDirectories.add(packagePath);
        await visit(entryPath, packagePath);
      } else if (entryStat.isFile()) {
        actualFiles.add(packagePath);
      } else {
        errors.push(`${relative(packageRoot)}: special package entry ${packagePath}`);
      }
    }
  };
  await visit(packageRoot);

  for (const file of actualFiles) {
    if (!expectedFiles.has(file)) {
      const kind = file.startsWith("schemas/") ? "schema" : "file";
      errors.push(`${relative(packageRoot)}: unexpected package ${kind} ${file}`);
    }
  }
  for (const directory of actualDirectories) {
    if (!expectedDirectories.has(directory)) {
      errors.push(`${relative(packageRoot)}: unexpected package directory ${directory}`);
    }
  }
  for (const file of expectedFiles) {
    if (!actualFiles.has(file)) {
      errors.push(`${relative(packageRoot)}: missing package file ${file}`);
    }
  }
  for (const directory of expectedDirectories) {
    if (!actualDirectories.has(directory)) {
      errors.push(`${relative(packageRoot)}: missing package directory ${directory}`);
    }
  }
}

function expectedPackageDirectories(files) {
  const directories = new Set();
  for (const file of files) {
    let directory = path.posix.dirname(file);
    while (directory !== ".") {
      directories.add(directory);
      directory = path.posix.dirname(directory);
    }
  }
  return directories;
}

async function validateVersionSync(metadata, errors) {
  for (const [label, file] of [
    ["package.json", "package.json"],
    ["Codex manifest", "plugins/codex/leanpowers/.codex-plugin/plugin.json"],
    ["Claude manifest", "plugins/claude/leanpowers/.claude-plugin/plugin.json"],
  ]) {
    try {
      const value = JSON.parse(await readFile(path.join(ROOT, file), "utf8"));
      if (value.version !== metadata.version) {
        errors.push(`${label}: version ${value.version ?? "missing"} does not match ${metadata.version}`);
      }
    } catch (error) {
      errors.push(`${label}: ${error.message}`);
    }
  }
}

async function validateGeneratedArtifacts(errors) {
  let artifacts;
  try {
    artifacts = await expectedArtifacts();
  } catch (error) {
    errors.push(`generator: ${error.message}`);
    return;
  }
  for (const [relativePath, expected] of artifacts) {
    try {
      const actual = await readFile(path.join(ROOT, relativePath), "utf8");
      if (actual !== expected) {
        errors.push(`generated artifact is stale: ${relativePath}`);
      }
    } catch (error) {
      errors.push(`generated artifact missing: ${relativePath} (${error.code ?? error.message})`);
    }
  }
}

async function validateCommonPackage(packageRoot, errors) {
  for (const required of ["README.md", "LICENSE", "skills", "references", "schemas"]) {
    if (!(await exists(path.join(packageRoot, required)))) {
      errors.push(`${relative(packageRoot)}: missing ${required}`);
    }
  }
  for (const forbidden of FORBIDDEN_PACKAGE_ENTRIES) {
    if (await exists(path.join(packageRoot, forbidden))) {
      errors.push(`${relative(packageRoot)}: contains source-only ${forbidden}`);
    }
  }
  for (const skill of SKILLS) {
    const skillFile = path.join(packageRoot, "skills", skill, "SKILL.md");
    try {
      const content = await readFile(skillFile, "utf8");
      const fields = frontmatterFields(content);
      if (fields.join(",") !== "name,description") {
        errors.push(`${relative(skillFile)}: frontmatter must contain only name and description`);
      }
      const words = wordCount(content.replace(/^---[\s\S]*?---\s*/u, ""));
      const budget = skill === "adapt" ? 400 : 800;
      if (words > budget) {
        errors.push(`${relative(skillFile)}: ${words} words exceeds the ${budget}-word budget`);
      }
    } catch (error) {
      errors.push(`${relative(skillFile)}: ${error.message}`);
    }
  }

  await validateLearningAssets(packageRoot, errors);

  for (const file of await listFilesIfPresent(packageRoot)) {
    const content = await readFile(file, "utf8");
    if (/(?:\/Users\/|\/home\/|[A-Za-z]:\\Users\\)/u.test(content)) {
      errors.push(`${relative(file)}: contains a machine-specific absolute path`);
    }
    if (/\b(?:TODO|TBD|CHANGEME)\b/u.test(content)) {
      errors.push(`${relative(file)}: contains placeholder text`);
    }
    if (path.extname(file) === ".md") {
      for (const target of markdownTargets(content)) {
        if (/^(?:https?:|mailto:|#)/u.test(target)) {
          continue;
        }
        const localPath = path.resolve(path.dirname(file), target.split("#", 1)[0]);
        if (!isSameOrAncestor(packageRoot, localPath) || !(await exists(localPath))) {
          errors.push(`${relative(file)}: unresolved package link ${target}`);
        }
      }
    }
  }
}

async function validateLearningAssets(packageRoot, errors) {
  const requiredAssets = [
    "skills/adapt/agents/openai.yaml",
    ...LEARNING_HELPERS.map((name) => `skills/adapt/scripts/${name}`),
    "references/learning-policy.md",
    ...LEARNING_SCHEMAS.map((name) => `schemas/${name}`),
  ];
  for (const required of requiredAssets) {
    if (!(await exists(path.join(packageRoot, required)))) {
      errors.push(`${relative(packageRoot)}: missing ${required}`);
    }
  }

  const schemaRoot = path.join(packageRoot, "schemas");
  let schemaEntries = [];
  try {
    schemaEntries = await readdir(schemaRoot, { withFileTypes: true });
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
  }
  for (const entry of schemaEntries) {
    if (!entry.isFile() || !LEARNING_SCHEMAS.includes(entry.name)) {
      errors.push(`${relative(packageRoot)}: unexpected package schema schemas/${entry.name}`);
    }
  }

  const scriptRoot = path.join(packageRoot, "skills/adapt/scripts");
  let realPackageRoot;
  try {
    realPackageRoot = await realpath(packageRoot);
  } catch (error) {
    errors.push(`${relative(packageRoot)}: cannot realpath package root (${error.message})`);
    return;
  }
  for (const helper of LEARNING_HELPERS) {
    const helperPath = path.join(scriptRoot, helper);
    let content;
    try {
      content = await readFile(helperPath, "utf8");
    } catch {
      continue;
    }
    const imports = scanModuleImports(content);
    for (const error of imports.errors) {
      errors.push(`${relative(helperPath)}: ${error}`);
    }
    for (const specifier of imports.specifiers) {
      if (specifier.startsWith("node:")) {
        continue;
      }
      if (!specifier.startsWith(".")) {
        errors.push(`${relative(helperPath)}: import is not package-local: ${specifier}`);
        continue;
      }
      const imported = path.resolve(path.dirname(helperPath), specifier);
      if (!isSameOrAncestor(packageRoot, imported)) {
        errors.push(`${relative(helperPath)}: import escapes package: ${specifier}`);
        continue;
      }
      try {
        const realImported = await realpath(imported);
        if (!isSameOrAncestor(realPackageRoot, realImported)) {
          errors.push(`${relative(helperPath)}: import resolves outside package: ${specifier}`);
        }
      } catch (error) {
        if (error?.code === "ENOENT") {
          errors.push(`${relative(helperPath)}: unresolved package import ${specifier}`);
        } else {
          errors.push(`${relative(helperPath)}: cannot realpath package import ${specifier}`);
        }
      }
    }
  }

}

async function validateLearningRuntime(packageRoot, errors, timeoutMs) {
  const scriptRoot = path.join(packageRoot, "skills/adapt/scripts");
  const cli = path.join(scriptRoot, "learning.mjs");
  const sandbox = await createRuntimeSandbox();
  // Defense in depth only: controlled paths plus snapshots are not an OS sandbox.
  try {
    for (const helper of LEARNING_HELPERS) {
      const helperPath = path.join(scriptRoot, helper);
      if (!(await exists(helperPath))) {
        continue;
      }
      const checked = await runNode(["--check", helperPath], {
        cwd: sandbox.cwd,
        env: sandbox.env,
        timeoutMs,
      });
      appendProcessError(errors, relative(helperPath), "node --check", checked, timeoutMs);
    }

    if (!(await exists(cli))) {
      return;
    }
    const beforeHelp = await snapshotSandbox(sandbox.root);
    const help = await runNode([cli, "--help"], {
      cwd: sandbox.cwd,
      env: sandbox.env,
      timeoutMs,
    });
    appendProcessError(errors, relative(cli), "--help", help, timeoutMs);
    if (!help.timedOut && help.exitCode === 0 && !/^Usage:/u.test(help.stdout)) {
      errors.push(`${relative(cli)} --help failed: missing Usage output`);
    }
    appendSandboxChanges(
      errors,
      relative(cli),
      "--help",
      beforeHelp,
      await snapshotSandbox(sandbox.root),
    );
    await resetRuntimeSandbox(sandbox);

    const beforeDoctor = await snapshotSandbox(sandbox.root);
    const doctor = await runNode([cli, "doctor"], {
      cwd: sandbox.cwd,
      env: sandbox.env,
      input: "{}\n",
      timeoutMs,
    });
    appendProcessError(errors, relative(cli), "doctor", doctor, timeoutMs);
    if (!doctor.timedOut && doctor.exitCode === 0) {
      try {
        const result = JSON.parse(doctor.stdout);
        if (result?.ok !== true || result?.schemas !== true) {
          errors.push(`${relative(cli)} doctor failed: expected ok and schemas`);
        }
      } catch (error) {
        errors.push(`${relative(cli)} doctor failed: invalid JSON output (${error.message})`);
      }
    }
    appendSandboxChanges(
      errors,
      relative(cli),
      "doctor",
      beforeDoctor,
      await snapshotSandbox(sandbox.root),
    );
  } finally {
    await rm(sandbox.root, { force: true, recursive: true });
  }
}

async function createRuntimeSandbox() {
  const created = await mkdtemp(path.join(os.tmpdir(), "leanpowers-package-check-"));
  const root = await realpath(created);
  const directories = {
    cwd: path.join(root, "cwd"),
    home: path.join(root, "home"),
    path: path.join(root, "path"),
    temp: path.join(root, "tmp"),
    xdgCache: path.join(root, "xdg-cache"),
    xdgConfig: path.join(root, "xdg-config"),
    xdgData: path.join(root, "xdg-data"),
  };
  await Promise.all(
    Object.values(directories).map((directory) => mkdir(directory, { recursive: true })),
  );
  return {
    root,
    directories,
    cwd: directories.cwd,
    env: {
      HOME: directories.home,
      USERPROFILE: directories.home,
      XDG_CONFIG_HOME: directories.xdgConfig,
      XDG_CACHE_HOME: directories.xdgCache,
      XDG_DATA_HOME: directories.xdgData,
      TMPDIR: directories.temp,
      TMP: directories.temp,
      TEMP: directories.temp,
      PATH: directories.path,
    },
  };
}

async function snapshotSandbox(root) {
  const snapshot = new Map();
  const visit = async (directory, prefix = "") => {
    const entries = await readdir(directory);
    for (const name of entries.sort()) {
      const entryPath = path.join(directory, name);
      const relativePath = path.posix.join(prefix, name);
      const entryStat = await lstat(entryPath);
      if (entryStat.isDirectory()) {
        snapshot.set(relativePath, `directory:${entryStat.mode}`);
        await visit(entryPath, relativePath);
      } else if (entryStat.isFile()) {
        snapshot.set(
          relativePath,
          `file:${entryStat.mode}:${(await readFile(entryPath)).toString("base64")}`,
        );
      } else if (entryStat.isSymbolicLink()) {
        snapshot.set(relativePath, "symlink");
      } else {
        snapshot.set(relativePath, `special:${entryStat.mode}`);
      }
    }
  };
  await visit(root);
  return snapshot;
}

function appendSandboxChanges(errors, label, command, before, after) {
  for (const [entry, signature] of after) {
    if (!before.has(entry)) {
      const basename = path.posix.basename(entry);
      if (basename.startsWith(".leanpowers")) {
        errors.push(`${label} ${command} created ${basename}`);
      }
      errors.push(`${label} ${command}: unexpected sandbox entry ${entry}`);
    } else if (before.get(entry) !== signature) {
      errors.push(`${label} ${command}: unexpected sandbox change ${entry}`);
    }
  }
  for (const entry of before.keys()) {
    if (!after.has(entry)) {
      errors.push(`${label} ${command}: removed sandbox entry ${entry}`);
    }
  }
}

async function resetRuntimeSandbox(sandbox) {
  for (const directory of Object.values(sandbox.directories)) {
    await rm(directory, { force: true, recursive: true });
    await mkdir(directory, { recursive: true });
  }
}

function appendProcessError(errors, label, command, result, timeoutMs) {
  if (result.timedOut) {
    errors.push(`${label} ${command} timed out after ${timeoutMs}ms`);
  } else if (result.exitCode !== 0 || result.signal !== null || result.stderr !== "") {
    errors.push(`${label} ${command} failed`);
  }
}

function runNode(args, { cwd, env, input = "", timeoutMs }) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd,
      env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const stdout = [];
    const stderr = [];
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (exitCode, signal) => {
      clearTimeout(timer);
      resolve({
        exitCode,
        signal,
        timedOut,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      });
    });
    child.stdin.end(input);
  });
}

async function validateClaudeStatic(packageRoot, errors) {
  const hook = path.join(packageRoot, "hooks/session-start");
  const descriptorPath = path.join(packageRoot, "hooks/hooks.json");
  try {
    const descriptor = JSON.parse(await readFile(descriptorPath, "utf8"));
    errors.push(...validateHookDescriptor(descriptor));
    const hookStat = await stat(hook);
    if ((hookStat.mode & 0o111) === 0) {
      errors.push(`${relative(hook)}: must be executable`);
    }
    const content = await readFile(hook, "utf8");
    if (wordCount(content) > 200) {
      errors.push(`${relative(hook)}: exceeds 200 words`);
    }
    if (/(?:curl|wget|git |find |rg |grep |rm |mv |cp )/u.test(content)) {
      errors.push(`${relative(hook)}: contains a forbidden side-effect command`);
    }
  } catch (error) {
    errors.push(`${relative(hook)}: ${error.message}`);
  }

  for (const [name, expectedName] of [
    ["reviewer.md", "lean-reviewer"],
    ["verifier.md", "lean-verifier"],
  ]) {
    const agentPath = path.join(packageRoot, "agents", name);
    try {
      validateClaudeAgent(agentPath, await readFile(agentPath, "utf8"), expectedName, errors);
    } catch (error) {
      errors.push(`${relative(agentPath)}: ${error.message}`);
    }
  }
}

function validateClaudeAgent(agentPath, content, expectedName, errors) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]+)$/u);
  if (!match) {
    errors.push(`${relative(agentPath)}: missing agent frontmatter`);
    return;
  }
  const fields = Object.fromEntries(
    match[1].split("\n").map((line) => {
      const separator = line.indexOf(":");
      return separator === -1
        ? [line.trim(), ""]
        : [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
    }),
  );
  if (fields.name !== expectedName) {
    errors.push(`${relative(agentPath)}: agent name must be ${expectedName}`);
  }
  if (!fields.description || fields.tools !== "Read, Grep, Glob, Bash" || fields.model !== "inherit") {
    errors.push(`${relative(agentPath)}: agent frontmatter is incomplete`);
  }
  if (match[2].trim() === "") {
    errors.push(`${relative(agentPath)}: agent instructions must be non-empty`);
  }
}

async function validateClaudeHookRuntime(packageRoot, errors, timeoutMs) {
  const hook = path.join(packageRoot, "hooks/session-start");
  const sandbox = await createRuntimeSandbox();
  try {
    const before = await snapshotSandbox(sandbox.root);
    const { stdout, stderr } = await execFileAsync(hook, [], {
      cwd: sandbox.cwd,
      env: {
        ...sandbox.env,
        CLAUDE_PLUGIN_ROOT: packageRoot,
      },
      timeout: timeoutMs,
    });
    if (stderr !== "") {
      errors.push(`${relative(hook)}: wrote to stderr`);
    }
    try {
      errors.push(...validateHookOutput(JSON.parse(stdout)));
    } catch (error) {
      errors.push(`${relative(hook)}: invalid JSON output (${error.message})`);
    }
    appendSandboxChanges(
      errors,
      relative(hook),
      "hook",
      before,
      await snapshotSandbox(sandbox.root),
    );
  } catch (error) {
    errors.push(`${relative(hook)}: ${error.message}`);
  } finally {
    await rm(sandbox.root, { force: true, recursive: true });
  }
}

export function validateHookDescriptor(descriptor) {
  const errors = [];
  const entries = descriptor?.hooks?.SessionStart;
  if (!Array.isArray(entries) || entries.length !== 1) {
    return ["plugins/claude/leanpowers/hooks/hooks.json: requires one SessionStart entry"];
  }
  const commandHooks = entries[0]?.hooks;
  if (
    typeof entries[0]?.matcher !== "string" ||
    !entries[0].matcher.includes("startup")
  ) {
    errors.push("plugins/claude/leanpowers/hooks/hooks.json: SessionStart matcher must include startup");
  }
  if (!Array.isArray(commandHooks) || commandHooks.length !== 1) {
    errors.push("plugins/claude/leanpowers/hooks/hooks.json: requires one command hook");
    return errors;
  }
  const command = commandHooks[0];
  if (
    command.type !== "command" ||
    command.async !== false ||
    command.command !== '"${CLAUDE_PLUGIN_ROOT}/hooks/session-start"'
  ) {
    errors.push("plugins/claude/leanpowers/hooks/hooks.json: command wiring is invalid");
  }
  return errors;
}

export function validateHookOutput(output) {
  const errors = [];
  if (output?.hookSpecificOutput?.hookEventName !== "SessionStart") {
    errors.push("plugins/claude/leanpowers/hooks/session-start: hookEventName must be SessionStart");
  }
  const charter = output?.hookSpecificOutput?.additionalContext;
  if (typeof charter !== "string" || charter.trim() === "") {
    errors.push("plugins/claude/leanpowers/hooks/session-start: additionalContext must be non-empty");
  } else if (wordCount(charter) > 200) {
    errors.push("plugins/claude/leanpowers/hooks/session-start: additionalContext exceeds 200 words");
  }
  return errors;
}

function frontmatterFields(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/u);
  if (!match) {
    return [];
  }
  return match[1]
    .split("\n")
    .map((line) => line.match(/^([a-z_][a-z0-9_-]*):/u)?.[1])
    .filter(Boolean);
}

async function listFilesIfPresent(directory) {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        files.push(...(await listFilesIfPresent(target)));
      } else if (entry.isFile()) {
        files.push(target);
      }
    }
    return files;
  } catch (error) {
    if (error?.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function exists(target) {
  try {
    await access(target);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

function wordCount(value) {
  return value.trim().split(/\s+/u).filter(Boolean).length;
}

function markdownTargets(content) {
  return [...content.matchAll(/\]\(([^)]+)\)/gu)].map((match) => match[1]);
}

function scanModuleImports(content) {
  const specifiers = [];
  const errors = [];
  const controlParenKeywords = new Set(["catch", "for", "if", "switch", "while", "with"]);
  const regexPrefixKeywords = new Set([
    "await",
    "case",
    "delete",
    "do",
    "else",
    "in",
    "instanceof",
    "new",
    "return",
    "throw",
    "typeof",
    "void",
    "yield",
  ]);

  const readLiteral = (start, dynamic) => {
    const quote = content[start];
    if (quote !== '"' && quote !== "'" && quote !== "`") {
      errors.push(`${dynamic ? "dynamic" : "static"} import specifier is not statically provable`);
      return { end: start + 1, specifier: null };
    }
    let escaped = false;
    let computed = false;
    let value = "";
    let index = start + 1;
    while (index < content.length) {
      const character = content[index];
      if (character === "\\") {
        escaped = true;
        index += 2;
        continue;
      }
      if (quote === "`" && character === "$" && content[index + 1] === "{") {
        computed = true;
      }
      if (character === quote) {
        if (escaped) {
          errors.push("escaped import specifier cannot be proven");
        } else if (computed) {
          errors.push("dynamic import specifier is not statically provable");
        } else {
          value = content.slice(start + 1, index);
        }
        return { end: index + 1, specifier: value || null };
      }
      index += 1;
    }
    errors.push(`${dynamic ? "dynamic" : "static"} import specifier is not statically provable`);
    return { end: content.length, specifier: null };
  };

  const skipTrivia = (start) => {
    let index = start;
    while (index < content.length) {
      if (/\s/u.test(content[index])) {
        index += 1;
      } else if (content.startsWith("//", index)) {
        index = content.indexOf("\n", index + 2);
        if (index === -1) return content.length;
      } else if (content.startsWith("/*", index)) {
        const end = content.indexOf("*/", index + 2);
        return end === -1 ? content.length : skipTrivia(end + 2);
      } else {
        break;
      }
    }
    return index;
  };

  const skipString = (start) => {
    const quote = content[start];
    let index = start + 1;
    while (index < content.length) {
      if (content[index] === "\\") {
        index += 2;
      } else if (content[index] === quote) {
        return index + 1;
      } else if (/[\r\n\u2028\u2029]/u.test(content[index])) {
        errors.push("unterminated string literal cannot be safely classified");
        return index;
      } else {
        index += 1;
      }
    }
    errors.push("unterminated string literal cannot be safely classified");
    return content.length;
  };

  const skipRegexLiteral = (start) => {
    let index = start + 1;
    let inCharacterClass = false;
    while (index < content.length) {
      const character = content[index];
      if (character === "\\") {
        if (index + 1 >= content.length || /[\r\n\u2028\u2029]/u.test(content[index + 1])) {
          errors.push("regex literal cannot be safely classified");
          return content.length;
        }
        index += 2;
        continue;
      }
      if (/[\r\n\u2028\u2029]/u.test(character)) {
        errors.push("regex literal cannot be safely classified");
        return index;
      }
      if (character === "[" && !inCharacterClass) {
        inCharacterClass = true;
      } else if (character === "]" && inCharacterClass) {
        inCharacterClass = false;
      } else if (character === "/" && !inCharacterClass) {
        index += 1;
        while (index < content.length && /[A-Za-z]/u.test(content[index])) {
          index += 1;
        }
        return index;
      }
      index += 1;
    }
    errors.push("regex literal cannot be safely classified");
    return content.length;
  };

  const skipNumber = (start) => {
    let index = start;
    while (index < content.length && /[A-Za-z0-9_.$]/u.test(content[index])) {
      index += 1;
    }
    return index;
  };

  const scanStatic = (start, dynamic) => {
    let index = skipTrivia(start);
    if (dynamic) {
      const literal = readLiteral(index, true);
      if (literal.specifier !== null) specifiers.push(literal.specifier);
      return literal.end;
    }
    if (content[index] === '"' || content[index] === "'") {
      const literal = readLiteral(index, false);
      if (literal.specifier !== null) specifiers.push(literal.specifier);
      return literal.end;
    }
    while (index < content.length && content[index] !== ";") {
      if (content.startsWith("//", index) || content.startsWith("/*", index)) {
        index = skipTrivia(index);
        continue;
      }
      if (/[A-Za-z_$]/u.test(content[index])) {
        const match = content.slice(index).match(/^[A-Za-z_$][A-Za-z0-9_$]*/u);
        const identifier = match[0];
        index += identifier.length;
        if (identifier === "from") {
          const literal = readLiteral(skipTrivia(index), false);
          if (literal.specifier !== null) specifiers.push(literal.specifier);
          return literal.end;
        }
      } else {
        index += 1;
      }
    }
    errors.push("static import specifier is not statically provable");
    return index;
  };

  const scanCode = (start, stopAtTemplateBrace = false) => {
    let index = start;
    let braces = 0;
    let slashContext = "regex";
    let pendingControlParen = false;
    const parenKinds = [];
    while (index < content.length) {
      if (content.startsWith("//", index)) {
        const end = content.indexOf("\n", index + 2);
        index = end === -1 ? content.length : end + 1;
        continue;
      }
      if (content.startsWith("/*", index)) {
        const end = content.indexOf("*/", index + 2);
        index = end === -1 ? content.length : end + 2;
        continue;
      }
      const character = content[index];
      if (character === '"' || character === "'") {
        index = skipString(index);
        slashContext = "division";
        pendingControlParen = false;
        continue;
      }
      if (character === "`") {
        index += 1;
        while (index < content.length) {
          if (content[index] === "\\") {
            index += 2;
          } else if (content[index] === "`") {
            index += 1;
            break;
          } else if (content[index] === "$" && content[index + 1] === "{") {
            index = scanCode(index + 2, true);
          } else {
            index += 1;
          }
        }
        slashContext = "division";
        pendingControlParen = false;
        continue;
      }
      if (character === "/") {
        if (slashContext === "ambiguous") {
          errors.push("slash token cannot be safely classified");
        }
        if (slashContext !== "division") {
          index = skipRegexLiteral(index);
          slashContext = "division";
        } else {
          index += content[index + 1] === "=" ? 2 : 1;
          slashContext = "regex";
        }
        pendingControlParen = false;
        continue;
      }
      if (stopAtTemplateBrace && character === "}" && braces === 0) {
        return index + 1;
      }
      if (
        /[0-9]/u.test(character) ||
        (character === "." && /[0-9]/u.test(content[index + 1] ?? ""))
      ) {
        index = skipNumber(index);
        slashContext = "division";
        pendingControlParen = false;
        continue;
      }
      if (/[A-Za-z_$]/u.test(character)) {
        const match = content.slice(index).match(/^[A-Za-z_$][A-Za-z0-9_$]*/u);
        const identifier = match[0];
        const afterIdentifier = index + identifier.length;
        if (identifier === "import") {
          const next = skipTrivia(afterIdentifier);
          if (content[next] === "(") {
            index = scanStatic(next + 1, true);
            slashContext = "division";
            pendingControlParen = false;
            continue;
          }
          if (content[next] !== ".") {
            index = scanStatic(afterIdentifier, false);
            slashContext = "division";
            pendingControlParen = false;
            continue;
          }
        } else if (identifier === "export") {
          const next = skipTrivia(afterIdentifier);
          if (content[next] === "*" || content[next] === "{") {
            index = scanStatic(afterIdentifier, false);
            slashContext = "division";
            pendingControlParen = false;
            continue;
          }
        }
        pendingControlParen = controlParenKeywords.has(identifier);
        slashContext = regexPrefixKeywords.has(identifier) ? "regex" : "division";
        index = afterIdentifier;
      } else {
        if (character === "(") {
          parenKinds.push(pendingControlParen ? "control" : "expression");
          slashContext = "regex";
        } else if (character === ")") {
          const kind = parenKinds.pop();
          slashContext = kind === "control" ? "regex" : kind ? "division" : "ambiguous";
        } else if (character === "{") {
          braces += 1;
          slashContext = "regex";
        } else if (character === "}") {
          if (braces > 0) braces -= 1;
          slashContext = "ambiguous";
        } else if (character === "[") {
          slashContext = "regex";
        } else if (character === "]") {
          slashContext = "division";
        } else if (";,?:=!~*%&|^<>".includes(character)) {
          slashContext = "regex";
        } else if (character === "+" || character === "-") {
          if (content[index + 1] === character) {
            slashContext = "ambiguous";
            pendingControlParen = false;
            index += 2;
            continue;
          }
          slashContext = "regex";
        } else if (character === ".") {
          slashContext = "ambiguous";
        } else if (!/\s/u.test(character)) {
          slashContext = "ambiguous";
        }
        if (character !== "(" && !/\s/u.test(character)) pendingControlParen = false;
        index += 1;
      }
    }
    return index;
  };

  scanCode(0);
  return {
    errors: [...new Set(errors)],
    specifiers: [...new Set(specifiers)],
  };
}

function isSameOrAncestor(parent, child) {
  const relativePath = path.relative(parent, child);
  return (
    relativePath === "" ||
    (!relativePath.startsWith("..") && !path.isAbsolute(relativePath))
  );
}

function relative(target) {
  return path.relative(ROOT, target) || ".";
}

async function main() {
  const errors = await collectValidationErrors();
  if (errors.length === 0) {
    console.log("LeanPowers package validation passed.");
    return;
  }
  for (const error of errors) {
    console.error(`ERROR ${error}`);
  }
  process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`ERROR ${error.message}`);
    process.exitCode = 1;
  });
}
