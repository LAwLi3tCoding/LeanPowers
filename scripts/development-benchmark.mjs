import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  loadDevelopmentSuite,
  runDevelopmentPilot,
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
  const suitePath = option(args, "--suite", { required: true });
  if (command === "inspect") {
    const suite = await loadDevelopmentSuite(suitePath);
    console.log(JSON.stringify(suite, null, 2));
    return;
  }
  if (command !== "run") {
    throw new Error(
      "Usage: node scripts/development-benchmark.mjs <inspect|run> --suite <file> [run options]",
    );
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
        console.log(
          `END ${event.run_id} ${event.outcome.status} tokens=${event.telemetry.tokens?.total ?? "n/a"} wall=${event.wall_seconds.toFixed(1)}s`,
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
