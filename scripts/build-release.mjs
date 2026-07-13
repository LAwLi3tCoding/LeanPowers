import { access, cp, mkdir, rename, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildArtifacts } from "./generate.mjs";
import { projectRoot } from "./lib/project.mjs";
import { collectValidationErrors } from "./validate-package.mjs";

const ROOT = fileURLToPath(projectRoot);
const DIST_ROOT = path.join(ROOT, "dist");

export async function buildRelease({
  outputRoot = path.join(ROOT, "dist"),
} = {}) {
  const resolvedOutput = resolveSafeOutputRoot(outputRoot);
  await buildArtifacts({ check: true });
  const errors = await collectValidationErrors();
  if (errors.length > 0) {
    throw new Error(`Release validation failed:\n${errors.join("\n")}`);
  }

  const parent = path.dirname(resolvedOutput);
  const basename = path.basename(resolvedOutput);
  const nonce = `${process.pid}-${Date.now()}`;
  const stage = path.join(parent, `.${basename}.stage-${nonce}`);
  const backup = path.join(parent, `.${basename}.backup-${nonce}`);
  await mkdir(parent, { recursive: true });
  await rm(stage, { force: true, recursive: true });
  await rm(backup, { force: true, recursive: true });
  const outputs = {
    codex: path.join(resolvedOutput, "codex/leanpowers"),
    claude: path.join(resolvedOutput, "claude/leanpowers"),
  };
  const stagedOutputs = {
    codex: path.join(stage, "codex/leanpowers"),
    claude: path.join(stage, "claude/leanpowers"),
  };
  await mkdir(path.dirname(stagedOutputs.codex), { recursive: true });
  await mkdir(path.dirname(stagedOutputs.claude), { recursive: true });
  await cp(path.join(ROOT, "plugins/codex/leanpowers"), stagedOutputs.codex, {
    recursive: true,
  });
  await cp(path.join(ROOT, "plugins/claude/leanpowers"), stagedOutputs.claude, {
    recursive: true,
  });

  const hadExistingOutput = await exists(resolvedOutput);
  try {
    if (hadExistingOutput) {
      await rename(resolvedOutput, backup);
    }
    await rename(stage, resolvedOutput);
    await rm(backup, { force: true, recursive: true });
  } catch (error) {
    if (hadExistingOutput && !(await exists(resolvedOutput)) && (await exists(backup))) {
      await rename(backup, resolvedOutput);
    }
    await rm(stage, { force: true, recursive: true });
    throw error;
  }
  return outputs;
}

export function resolveSafeOutputRoot(outputRoot) {
  const resolved = path.resolve(outputRoot);
  if (isSameOrAncestor(resolved, ROOT)) {
    throw new Error(`Refusing release output that contains the repository: ${resolved}`);
  }
  if (
    isSameOrAncestor(ROOT, resolved) &&
    !isSameOrAncestor(DIST_ROOT, resolved)
  ) {
    throw new Error(`Repository-local release output must stay under dist/: ${resolved}`);
  }
  return resolved;
}

function isSameOrAncestor(parent, child) {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
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

async function main() {
  const outputs = await buildRelease();
  console.log(`Codex release: ${outputs.codex}`);
  console.log(`Claude release: ${outputs.claude}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
