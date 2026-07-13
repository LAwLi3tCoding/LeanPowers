import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { compareRuns } from "./lib/benchmark.mjs";
import { stableJson } from "./lib/project.mjs";

export async function compareFiles({ baselinePath, candidatePath, outputDirectory }) {
  const baseline = JSON.parse(await readFile(baselinePath, "utf8"));
  const candidate = JSON.parse(await readFile(candidatePath, "utf8"));
  const comparison = compareRuns(baseline, candidate);
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(
    path.join(outputDirectory, "comparison.json"),
    stableJson(comparison),
    "utf8",
  );
  await writeFile(
    path.join(outputDirectory, "comparison.md"),
    renderMarkdown(comparison),
    "utf8",
  );
  return comparison;
}

export function renderMarkdown(comparison) {
  const qualityRows = metricRows(comparison.quality);
  const efficiencyRows = metricRows(comparison.efficiency);
  return [
    "# LeanPowers benchmark comparison",
    "",
    `**Decision:** ${comparison.decision}`,
    "",
    `**Release eligible:** ${comparison.release_eligible ? "yes" : "no"}`,
    "",
    "## Quality deltas",
    "",
    qualityRows,
    "",
    "## Efficiency deltas",
    "",
    efficiencyRows,
    "",
    "## Hard failures",
    "",
    listOrNone(comparison.hard_failures),
    "",
    "## Reasons",
    "",
    listOrNone(comparison.reasons),
    "",
    "## Recommendations",
    "",
    listOrNone(comparison.recommendations),
    "",
  ].join("\n");
}

function metricRows(metrics) {
  const entries = Object.entries(metrics ?? {});
  if (entries.length === 0) {
    return "No comparable metrics.";
  }
  return [
    "| Metric | Value |",
    "| --- | ---: |",
    ...entries.map(([name, value]) => `| ${name} | ${formatValue(value)} |`),
  ].join("\n");
}

function formatValue(value) {
  return typeof value === "number" ? String(Number(value.toFixed(6))) : String(value);
}

function listOrNone(values = []) {
  return values.length === 0 ? "None." : values.map((value) => `- ${value}`).join("\n");
}

function option(args, name) {
  const index = args.indexOf(name);
  if (index === -1 || !args[index + 1]) {
    throw new Error(`Missing required option ${name}`);
  }
  return args[index + 1];
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command !== "compare") {
    throw new Error(
      "Usage: node scripts/benchmark.mjs compare --baseline <file> --candidate <file> --out <directory>",
    );
  }
  const comparison = await compareFiles({
    baselinePath: option(args, "--baseline"),
    candidatePath: option(args, "--candidate"),
    outputDirectory: option(args, "--out"),
  });
  console.log(`Benchmark decision: ${comparison.decision}`);
  if (comparison.decision === "BLOCK") {
    process.exitCode = 2;
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))
) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
