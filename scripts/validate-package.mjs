import { access, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { expectedArtifacts } from "./generate.mjs";
import { projectRoot, readMetadata } from "./lib/project.mjs";

const ROOT = fileURLToPath(projectRoot);
const PACKAGE_ROOTS = [
  path.join(ROOT, "plugins/codex/leanpowers"),
  path.join(ROOT, "plugins/claude/leanpowers"),
];
const SKILLS = ["build", "debug", "review", "shape", "ship", "verify"];
const FORBIDDEN_PACKAGE_ENTRIES = [
  "adapters",
  "evals",
  "metadata",
  "schemas",
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
  for (const packageRoot of PACKAGE_ROOTS) {
    await validateCommonPackage(packageRoot, errors);
  }
  await validateRuntimeIsolation(errors);
  await validateClaudeHook(errors);
  return [...new Set(errors)].sort();
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
  for (const required of ["README.md", "LICENSE", "skills", "references"]) {
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
      if (words > 800) {
        errors.push(`${relative(skillFile)}: ${words} words exceeds the 800-word budget`);
      }
    } catch (error) {
      errors.push(`${relative(skillFile)}: ${error.message}`);
    }
  }

  for (const file of await listFilesIfPresent(packageRoot)) {
    const content = await readFile(file, "utf8");
    if (/(?:\/Users\/|\/home\/|[A-Za-z]:\\Users\\)/u.test(content)) {
      errors.push(`${relative(file)}: contains a machine-specific absolute path`);
    }
    if (/\b(?:TODO|TBD|CHANGEME)\b/u.test(content)) {
      errors.push(`${relative(file)}: contains placeholder text`);
    }
  }
}

async function validateRuntimeIsolation(errors) {
  const codex = PACKAGE_ROOTS[0];
  const claude = PACKAGE_ROOTS[1];
  for (const forbidden of ["hooks", "agents", ".claude-plugin"]) {
    if (await exists(path.join(codex, forbidden))) {
      errors.push(`plugins/codex/leanpowers: must not contain ${forbidden}`);
    }
  }
  if (await exists(path.join(claude, ".codex-plugin"))) {
    errors.push("plugins/claude/leanpowers: must not contain .codex-plugin");
  }
  for (const required of ["hooks/hooks.json", "hooks/session-start", "agents/reviewer.md", "agents/verifier.md"]) {
    if (!(await exists(path.join(claude, required)))) {
      errors.push(`plugins/claude/leanpowers: missing ${required}`);
    }
  }
}

async function validateClaudeHook(errors) {
  const hook = path.join(PACKAGE_ROOTS[1], "hooks/session-start");
  try {
    const hookStat = await stat(hook);
    if ((hookStat.mode & 0o111) === 0) {
      errors.push("plugins/claude/leanpowers/hooks/session-start: must be executable");
    }
    const content = await readFile(hook, "utf8");
    if (wordCount(content) > 200) {
      errors.push("plugins/claude/leanpowers/hooks/session-start: exceeds 200 words");
    }
    if (/(?:curl|wget|git |find |rg |grep |rm |mv |cp )/u.test(content)) {
      errors.push("plugins/claude/leanpowers/hooks/session-start: contains a forbidden side-effect command");
    }
  } catch (error) {
    errors.push(`plugins/claude/leanpowers/hooks/session-start: ${error.message}`);
  }
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
