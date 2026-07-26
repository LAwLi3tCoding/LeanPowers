import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  loadDevelopmentSuite,
  runDevelopmentPilot,
  runStandaloneCodexModelToolPreflight,
} from "./lib/development-benchmark.mjs";

function option(args, name, { required = false } = {}) {
  const index = args.indexOf(name);
  if (index === -1) {
    if (required) throw new Error(`Missing required option ${name}`);
    return undefined;
  }
  if (!args[index + 1] || args[index + 1].startsWith("--")) {
    throw new Error(`Missing value for ${name}`);
  }
  return args[index + 1];
}

function options(args, name) {
  const values = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === name) {
      if (!args[index + 1] || args[index + 1].startsWith("--")) {
        throw new Error(`Missing value for ${name}`);
      }
      values.push(args[index + 1]);
    }
  }
  return values;
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command === "preflight") {
    const outputFile = path.resolve(option(args, "--out", { required: true }));
    const disabledFeatures = options(args, "--disable-feature");
    const evidence = await runStandaloneCodexModelToolPreflight({
      authFile: option(args, "--auth-file"),
      codexExecutable: option(args, "--codex") ?? "codex",
      disabledFeatures:
        disabledFeatures.length === 0 ? undefined : disabledFeatures,
      effort: option(args, "--effort") ?? "medium",
      model: option(args, "--model", { required: true }),
    });
    await mkdir(path.dirname(outputFile), { recursive: true });
    await writeFile(
      outputFile,
      `${JSON.stringify(evidence, null, 2)}\n`,
      { flag: "wx" },
    );
    console.log("Model/tool preflight PASS");
    return;
  }
  if (!["inspect", "run"].includes(command)) {
    throw new Error(
      "Usage: node scripts/development-benchmark.mjs <inspect|preflight|run> [options]",
    );
  }
  const suitePath = option(args, "--suite", { required: true });
  if (command === "inspect") {
    const suite = await loadDevelopmentSuite(suitePath);
    console.log(JSON.stringify(suite, null, 2));
    return;
  }
  const result = await runDevelopmentPilot({
    suitePath,
    outputDirectory: path.resolve(option(args, "--out", { required: true })),
    superpowersMarketplace: option(args, "--superpowers-marketplace", { required: true }),
    leanpowersMarketplace:
      option(args, "--leanpowers-marketplace") ??
      path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
    model: option(args, "--model"),
    codexExecutable: option(args, "--codex") ?? "codex",
    authFile: option(args, "--auth-file"),
    repetitions: option(args, "--repetitions")
      ? Number(option(args, "--repetitions"))
      : undefined,
    caseIds: options(args, "--case"),
    onProgress(event) {
      if (event.type === "start") {
        console.log(`START ${event.runId}`);
      } else {
        const wall = Number.isFinite(event.wall_seconds)
          ? `${event.wall_seconds.toFixed(1)}s`
          : "n/a";
        console.log(
          `END ${event.run_id} ${event.outcome.status} tokens=${event.telemetry.tokens?.total ?? "n/a"} wall=${wall}`,
        );
      }
    },
  });
  console.log(
    `Wrote ${result.runs.length} real development runs to ${path.resolve(option(args, "--out", { required: true }))}`,
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
