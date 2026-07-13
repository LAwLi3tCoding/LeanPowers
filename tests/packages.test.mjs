import assert from "node:assert/strict";
import { access, readFile, readdir, stat } from "node:fs/promises";
import { execFile } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const root = fileURLToPath(new URL("../", import.meta.url));
const codexRoot = path.join(root, "plugins/codex/leanpowers");
const claudeRoot = path.join(root, "plugins/claude/leanpowers");
const skillNames = ["build", "debug", "review", "shape", "ship", "verify"];

test("both packages contain source-identical portable skills", async () => {
  for (const name of skillNames) {
    const source = await readFile(path.join(root, "skills", name, "SKILL.md"), "utf8");
    const codex = await readFile(path.join(codexRoot, "skills", name, "SKILL.md"), "utf8");
    const claude = await readFile(path.join(claudeRoot, "skills", name, "SKILL.md"), "utf8");
    assert.equal(codex, source, `Codex ${name} drifted`);
    assert.equal(claude, source, `Claude ${name} drifted`);
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

test("installable packages include user guidance and license without source-only files", async () => {
  const forbidden = [
    "adapters",
    "evals",
    "metadata",
    "schemas",
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
