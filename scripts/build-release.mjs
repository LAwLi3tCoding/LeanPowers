import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildArtifacts } from "./generate.mjs";
import { projectRoot } from "./lib/project.mjs";
import { collectValidationErrors } from "./validate-package.mjs";

const ROOT = fileURLToPath(projectRoot);

export async function buildRelease({
  outputRoot = path.join(ROOT, "dist"),
} = {}) {
  const resolvedOutput = path.resolve(outputRoot);
  await buildArtifacts({ check: true });
  const errors = await collectValidationErrors();
  if (errors.length > 0) {
    throw new Error(`Release validation failed:\n${errors.join("\n")}`);
  }

  await rm(resolvedOutput, { force: true, recursive: true });
  const outputs = {
    codex: path.join(resolvedOutput, "codex/leanpowers"),
    claude: path.join(resolvedOutput, "claude/leanpowers"),
  };
  await mkdir(path.dirname(outputs.codex), { recursive: true });
  await mkdir(path.dirname(outputs.claude), { recursive: true });
  await cp(path.join(ROOT, "plugins/codex/leanpowers"), outputs.codex, {
    recursive: true,
  });
  await cp(path.join(ROOT, "plugins/claude/leanpowers"), outputs.claude, {
    recursive: true,
  });
  return outputs;
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
