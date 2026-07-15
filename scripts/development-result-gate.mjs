import { readFile } from "node:fs/promises";

import { evaluateDevelopmentResultGate } from "./lib/development-result-gate.mjs";

const args = process.argv.slice(2);
const resultIndex = args.indexOf("--result");

try {
  if (resultIndex < 0 || !args[resultIndex + 1]) throw new Error("missing result");
  const result = JSON.parse(await readFile(args[resultIndex + 1], "utf8"));
  const verdict = evaluateDevelopmentResultGate(result);
  const reasonText = verdict.reasons.length === 0 ? "none" : verdict.reasons.join(",");
  const advisoryText = verdict.advisories.length === 0
    ? "none"
    : verdict.advisories.join(",");
  console.log(
    `status=${verdict.status} reasons=${reasonText} advisories=${advisoryText} token_assessment=${verdict.evidence.token_target_assessment} token_share=${format(verdict.evidence.aggregate_model_token_share_pct)} median_wall_reduction=${format(verdict.evidence.median_wall_reduction_pct)}`,
  );
  if (verdict.status === "REVIEW") process.exitCode = 2;
  else if (verdict.status !== "PASS") process.exitCode = 1;
} catch {
  console.log("status=FAIL reasons=invalid-result advisories=none token_assessment=miss token_share=n/a median_wall_reduction=n/a");
  process.exitCode = 1;
}

function format(value) {
  return value === null ? "n/a" : String(value);
}
