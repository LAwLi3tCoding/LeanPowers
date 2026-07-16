import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { access, mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const root = fileURLToPath(new URL("../", import.meta.url));
const codexRoot = path.join(root, "plugins/codex/leanpowers");
const claudeRoot = path.join(root, "plugins/claude/leanpowers");
const skillNames = ["adapt", "build", "debug", "review", "route", "shape", "ship", "verify"];
const helperNames = ["learning.mjs", "learning-core.mjs", "learning-store.mjs"];
const schemaNames = ["learning-config.schema.json", "lesson-event.schema.json"];

test("both packages contain source-identical portable skills", async () => {
  for (const name of skillNames) {
    const source = await readFile(path.join(root, "skills", name, "SKILL.md"), "utf8");
    const codex = await readFile(path.join(codexRoot, "skills", name, "SKILL.md"), "utf8");
    const claude = await readFile(path.join(claudeRoot, "skills", name, "SKILL.md"), "utf8");
    assert.equal(codex, source, `Codex ${name} drifted`);
    assert.equal(claude, source, `Claude ${name} drifted`);
  }
});

test("both packages contain the complete source-identical adaptive learning capability", async () => {
  const portableFiles = [
    "skills/adapt/agents/openai.yaml",
    ...helperNames.map((name) => `skills/adapt/scripts/${name}`),
    "references/learning-policy.md",
    ...schemaNames.map((name) => `schemas/${name}`),
  ];

  for (const packageRoot of [codexRoot, claudeRoot]) {
    for (const relativePath of portableFiles) {
      assert.equal(
        await readFile(path.join(packageRoot, relativePath), "utf8"),
        await readFile(path.join(root, relativePath), "utf8"),
        `${packageRoot}/${relativePath} drifted from source`,
      );
    }
    assert.deepEqual((await readdir(path.join(packageRoot, "schemas"))).sort(), schemaNames);
  }
});

test("packaged learning helpers parse and run help plus side-effect-free doctor", async (context) => {
  const workspace = await mkdtemp(path.join(os.tmpdir(), "leanpowers-package-smoke-"));
  context.after(() => rm(workspace, { force: true, recursive: true }));

  for (const packageRoot of [codexRoot, claudeRoot]) {
    for (const helper of helperNames) {
      const checked = await executeNode(
        ["--check", path.join(packageRoot, "skills/adapt/scripts", helper)],
        { cwd: workspace },
      );
      assert.equal(checked.exitCode, 0, checked.stderr);
    }

    const cli = path.join(packageRoot, "skills/adapt/scripts/learning.mjs");
    const help = await executeNode([cli, "--help"], { cwd: workspace });
    assert.equal(help.exitCode, 0, help.stderr);
    assert.match(help.stdout, /^Usage:/);

    const doctor = await executeNode([cli, "doctor"], {
      cwd: workspace,
      input: "{}\n",
    });
    assert.equal(doctor.exitCode, 0, doctor.stderr || doctor.stdout);
    assert.equal(JSON.parse(doctor.stdout).ok, true);
    await assert.rejects(access(path.join(workspace, ".leanpowers")));
  }
});

test("Codex package excludes Claude-only root hooks and agents", async () => {
  assert.equal(await exists(path.join(codexRoot, "hooks")), false);
  assert.equal(await exists(path.join(codexRoot, "agents")), false);
  assert.equal(await exists(path.join(codexRoot, ".claude-plugin")), false);
});

test("shared references live outside the skill discovery namespace", async () => {
  for (const packageRoot of [codexRoot, claudeRoot]) {
    assert.equal(await exists(path.join(packageRoot, "skills/_shared")), false);
    assert.equal(await exists(path.join(packageRoot, "references/risk-policy.md")), true);
    assert.equal(await exists(path.join(packageRoot, "references/quality-gates.md")), true);
  }
});

test("installed risk policy preserves mode floors and highest-signal routing", async () => {
  for (const packageRoot of [codexRoot, claudeRoot]) {
    const policy = await readFile(
      path.join(packageRoot, "references/risk-policy.md"),
      "utf8",
    );
    assert.match(policy, /highest applicable signal/i);
    assert.match(policy, /cannot disable safety or evidence gates/i);
    assert.match(policy, /classification is uncertain, use `standard`/i);
  }
});

test("installable packages include user guidance and license without source-only files", async () => {
  const forbidden = [
    "adapters",
    "evals",
    "metadata",
    "scripts",
    "tests",
    "package.json",
  ];
  for (const packageRoot of [codexRoot, claudeRoot]) {
    assert.equal(await exists(path.join(packageRoot, "README.md")), true);
    assert.equal(await exists(path.join(packageRoot, "LICENSE")), true);
    for (const entry of forbidden) {
      assert.equal(
        await exists(path.join(packageRoot, entry)),
        false,
        `${packageRoot} contains source-only ${entry}`,
      );
    }
  }
});

test("package text contains no machine-specific paths or placeholders", async () => {
  for (const packageRoot of [codexRoot, claudeRoot]) {
    for (const file of await textFiles(packageRoot)) {
      const content = await readFile(file, "utf8");
      assert.doesNotMatch(content, /(?:\/Users\/|\/home\/|[A-Za-z]:\\Users\\)/);
      assert.doesNotMatch(content, /\b(?:TODO|TBD|CHANGEME)\b/);
    }
  }
});

test("packaged README contains no unresolved repository-relative links", async () => {
  for (const packageRoot of [codexRoot, claudeRoot]) {
    const readme = await readFile(path.join(packageRoot, "README.md"), "utf8");
    const relativeTargets = [...readme.matchAll(/\]\(([^)]+)\)/gu)]
      .map((match) => match[1])
      .filter((target) => !/^(?:https?:|mailto:|#)/u.test(target));
    assert.deepEqual(relativeTargets, []);
  }
});

test("Claude package includes only the compact native adapter assets", async () => {
  assert.equal(await exists(path.join(claudeRoot, "hooks/hooks.json")), true);
  assert.equal(await exists(path.join(claudeRoot, "hooks/session-start")), true);
  assert.deepEqual((await readdir(path.join(claudeRoot, "agents"))).sort(), [
    "reviewer.md",
    "verifier.md",
  ]);
  assert.equal(await exists(path.join(claudeRoot, ".codex-plugin")), false);
});

test("Claude SessionStart hook emits valid compact JSON without side effects", async () => {
  const hookPath = path.join(claudeRoot, "hooks/session-start");
  const hookStat = await stat(hookPath);
  assert.notEqual(hookStat.mode & 0o111, 0, "session-start must be executable");

  const { stdout, stderr } = await execFileAsync(hookPath, [], {
    cwd: claudeRoot,
    env: { ...process.env, CLAUDE_PLUGIN_ROOT: claudeRoot },
  });
  assert.equal(stderr, "");
  const output = JSON.parse(stdout);
  assert.equal(output.hookSpecificOutput.hookEventName, "SessionStart");
  const charter = output.hookSpecificOutput.additionalContext;
  assert.ok(wordCount(charter) <= 200, `charter has ${wordCount(charter)} words`);
  assert.match(charter, /lowest safe workflow/i);
});

test("optional Codex agent templates are valid source artifacts only", async () => {
  for (const name of ["reviewer", "verifier"]) {
    const content = await readFile(
      path.join(root, "adapters/codex/agents", `${name}.toml`),
      "utf8",
    );
    assert.match(content, new RegExp(`name = "lean-${name}"`));
    assert.match(content, /description = "/);
    assert.match(content, /developer_instructions = """/);
  }
});

test("reviewer templates are unconditionally read-only with one verdict contract", async () => {
  const templates = [
    await readFile(path.join(root, "agent-specs/reviewer.md"), "utf8"),
    await readFile(path.join(root, "adapters/codex/agents/reviewer.toml"), "utf8"),
  ];
  for (const content of templates) {
    assert.match(content, /read-only/i);
    assert.match(content, /never edit or delegate/i);
    assert.match(content, /Review YAML/i);
    assert.match(content, /pass\s*\|?\s*changes_required\s*\|?\s*blocked/i);
    assert.match(content, /unverified_areas/i);
    assert.doesNotMatch(content, /unless .*assigns? (?:a )?repair/i);
  }
});

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

async function textFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await textFiles(target)));
    } else if (entry.isFile()) {
      files.push(target);
    }
  }
  return files;
}

function wordCount(value) {
  return value.trim().split(/\s+/u).filter(Boolean).length;
}

function executeNode(args, { cwd, input = "" } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd,
      env: { PATH: "/usr/bin:/bin" },
      stdio: ["pipe", "pipe", "pipe"],
    });
    const stdout = [];
    const stderr = [];
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("packaged learning helper timed out after 5000ms"));
    }, 5000);
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (exitCode, signal) => {
      clearTimeout(timer);
      if (signal) {
        reject(new Error(`packaged learning helper exited from signal ${signal}`));
        return;
      }
      resolve({
        exitCode,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      });
    });
    child.stdin.end(input);
  });
}
