import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const skillsRoot = path.join(root, "skills");
const engineeringSkills = ["build", "debug", "review", "shape", "ship", "verify"];
const controlSkills = ["adapt", "route"];
const expectedSkills = [...controlSkills, ...engineeringSkills].sort();

test("six engineering workflows plus route and adapt control skills exist", async () => {
  const entries = await readdir(skillsRoot, { withFileTypes: true });
  const discovered = entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_"))
    .map((entry) => entry.name)
    .sort();

  assert.deepEqual(discovered, expectedSkills);
});

test("route is a high-recall, low-ceremony engineering entry point", async () => {
  const content = await readFile(path.join(skillsRoot, "route", "SKILL.md"), "utf8");
  const { frontmatter, body } = parseSkill(content);

  assert.match(frontmatter.description, /start(?:ing| of) .*engineering work/i);
  assert.match(
    frontmatter.description,
    /no specific .*workflow .*selected|without a selected .*workflow/i,
  );
  for (const trigger of ["plan", "implement", "fix", "review", "verify", "deliver"]) {
    assert.match(frontmatter.description, new RegExp(trigger, "i"), trigger);
  }
  assert.match(body, /Choose the lowest-safe owner/i);
  assert.match(body, /lowest-safe|lowest safe/i);
  assert.match(body, /security.*authorization.*payment.*privacy/is);
  assert.match(body, /risk: RISK/i);
  assert.match(body, /`lean`(?::| means) clear, local/i);
  assert.match(body, /`strict`(?::| means) security/i);
  assert.match(body, /otherwise(?: use)? `standard`/i);
  assert.match(body, /required_gates/i);
  assert.match(body, /entrypoint: leanpowers:route/i);
  for (const workflow of ["shape", "build", "debug", "review", "verify", "ship", "adapt"]) {
    assert.match(body, new RegExp(`\\b${workflow}\\b`, "i"), workflow);
  }
  assert.doesNotMatch(body, /1%|before any response|you do not have a choice/i);
  assert.ok(wordCount(content) <= 470, `route has ${wordCount(content)} words`);
});

test("direct workflow entry loads one compact runtime contract at most once", async () => {
  const contract = await readFile(
    path.join(root, "references", "runtime-contract.md"),
    "utf8",
  );
  assert.ok(wordCount(contract) <= 360, `runtime contract has ${wordCount(contract)} words`);

  for (const phrase of [
    "current evidence",
    "root cause",
    "regression evidence",
    "declared scope",
    "independent review",
    "authorization",
    "validation gap",
    "strict is sticky",
  ]) {
    assert.match(contract.toLowerCase(), new RegExp(phrase), `missing: ${phrase}`);
  }

  for (const name of engineeringSkills) {
    const content = await readFile(path.join(skillsRoot, name, "SKILL.md"), "utf8");
    assert.match(content, /runtime contract/i, name);
    assert.match(content, /loaded|read[\s\S]{0,80}once/i, name);
    for (const legacy of [
      "risk-policy.md",
      "quality-gates.md",
      "evidence-protocol.md",
      "subagent-policy.md",
      "workflow-transitions.md",
    ]) {
      assert.doesNotMatch(content, new RegExp(legacy.replace(".", "\\."), "i"), `${name}: ${legacy}`);
    }
  }

  const route = await readFile(path.join(skillsRoot, "route", "SKILL.md"), "utf8");
  assert.doesNotMatch(route, /\.\.\/\.\.\/references\//i);
});

test("ordinary completion is inline while strict review remains mandatory", async () => {
  const build = await readFile(path.join(skillsRoot, "build", "SKILL.md"), "utf8");
  const debug = await readFile(path.join(skillsRoot, "debug", "SKILL.md"), "utf8");
  const review = await readFile(path.join(skillsRoot, "review", "SKILL.md"), "utf8");
  const route = await readFile(path.join(skillsRoot, "route", "SKILL.md"), "utf8");
  const runtime = await readFile(path.join(root, "references", "runtime-contract.md"), "utf8");
  const verify = await readFile(path.join(skillsRoot, "verify", "SKILL.md"), "utf8");

  assert.match(build, /lean or standard[\s\S]{0,180}next: null/i);
  assert.match(debug, /lean or standard[\s\S]{0,180}next: null/i);
  assert.match(build, /strict[\s\S]{0,100}next: review/i);
  assert.match(debug, /strict[\s\S]{0,100}next: review/i);
  assert.match(verify, /independent_review: pass \| missing \| not_required/i);
  assert.match(build, /affected integration[\s\S]{0,120}full-suite/i);
  assert.match(build, /validation gap blocks `complete`/i);
  assert.match(route, /Clear build: execute this capsule/i);
  assert.match(route, /Otherwise load and execute the selected installed Skill once/i);
  assert.match(route, /never use the build capsule/i);
  assert.match(route, /stages 1–3 target one call each/i);
  assert.match(route, /not a quality ceiling/i);
  assert.match(route, /Expand only for missing, contradictory, or failed evidence/i);
  assert.match(route, /one green-path inspection tool call/i);
  assert.match(route, /one-property mutations of valid cases/i);
  assert.match(route, /one shell command/i);
  assert.match(route, /one multi-file patch(?: call)? for (?:implementation and tests|code\/tests)/i);
  assert.match(route, /never (?:patch the same file twice|repatch) on the green path/i);
  assert.match(route, /output one concise clause→test ledger/i);
  assert.match(route, /Run one applicable validation command/i);
  assert.match(route, /strict \*\*MUST NOT answer\*\*/i);
  assert.match(route, /Mandatory strict gate/i);
  assert.match(route, /multi_agent_v1\.spawn_agent[\s\S]{0,220}wait_agent/i);
  assert.match(route, /`tool_search` once[\s\S]{0,80}`spawn_agent wait_agent`[\s\S]{0,40}limit 2/i);
  assert.match(route, /if either remains unavailable, return incomplete/i);
  assert.match(route, /save ID, then call `multi_agent_v1\.wait_agent` once with `targets:\[ID\]`/i);
  assert.match(route, /No other review-tool action\./i);
  assert.match(route, /fork_context:false/i);
  assert.match(route, /original (?:user )?task verbatim/i);
  assert.match(route, /spawn_agent` once/i);
  assert.match(route, /with (?:`message` only|only `message`)[\s\S]{0,220}Never use `items`/i);
  assert.match(route, /second\/placeholder\/`noop`/i);
  assert.match(route, /as above/i);
  assert.match(route, /\$leanpowers:review/i);
  assert.match(route, /\/leanpowers:review/i);
  assert.match(route, /Codex message:\s*\$leanpowers:review\s*Original task:/i);
  assert.match(route, /Claude message:\s*\/leanpowers:review\s*Original task:/i);
  assert.match(route, /replace every `\{\.\.\.\}`[\s\S]{0,100}never improvise, omit lines/i);
  assert.match(route, /do not edit(?: or |\/)delegate/i);
  assert.match(route, /copy the (?:entire )?original (?:user )?task verbatim/i);
  assert.match(route, /under `Original task:`/i);
  assert.match(route, /wait_agent` once with `targets:\[ID\]`/i);
  assert.match(route, /blocking runtimes do not wait again/i);
  assert.match(route, /suggestions without editing/i);
  assert.match(route, /Review schema on findings or uncertainty/i);
  assert.match(route, /only a true pass returns/i);
  assert.match(route, /verdict: pass[\s\S]{0,80}findings: \[\][\s\S]{0,80}unverified_areas: \[\]/i);
  assert.match(review, /runtime provenance, not self-report/i);
  assert.match(review, /designated fresh reviewer reviews directly and never re-delegates/i);
  assert.match(review, /literal `must`[\s\S]{0,100}`only`[\s\S]{0,100}`exact`/i);
  assert.match(review, /positive and negative boundary evidence/i);
  assert.match(runtime, /implementer text never satisfies or overrules review/i);
  assert.match(runtime, /multi_agent_v1\.spawn_agent[\s\S]{0,100}wait_agent/i);
  assert.match(runtime, /fork_context:false/i);
  assert.match(runtime, /verbatim task/i);
});

test("strict route protocol rejects one-property instruction regressions", async () => {
  const route = await readFile(path.join(skillsRoot, "route", "SKILL.md"), "utf8");
  const clauses = [
    "if either V1/native tool is hidden, call `tool_search` once (`spawn_agent wait_agent`, limit 2) to load both",
    "if either remains unavailable, return incomplete. Call `multi_agent_v1.spawn_agent` once",
    "with only `message`, `fork_context:false`; save ID, then call `multi_agent_v1.wait_agent` once with `targets:[ID]`",
    "No other review-tool action.",
    "Copy the original task verbatim under `Original task:`.",
  ];
  const preservesStrictProtocol = (candidate) =>
    clauses.every((clause) => candidate.includes(clause));

  assert.equal(preservesStrictProtocol(route), true);
  for (const [index, clause] of clauses.entries()) {
    assert.equal(
      preservesStrictProtocol(route.replace(clause, `[mutated strict clause ${index}]`)),
      false,
      clause,
    );
  }
});

test("skill frontmatter is portable and descriptions are discovery-focused", async () => {
  const descriptions = new Set();

  for (const name of expectedSkills) {
    const content = await readFile(path.join(skillsRoot, name, "SKILL.md"), "utf8");
    const { frontmatter } = parseSkill(content);

    assert.deepEqual(Object.keys(frontmatter).sort(), ["description", "name"]);
    assert.equal(frontmatter.name, name);
    assert.match(frontmatter.description, /^Use when /);
    assert.ok(frontmatter.description.length <= 500);
    assert.equal(descriptions.has(frontmatter.description), false);
    descriptions.add(frontmatter.description);
  }
});

test("skill bodies stay within the LeanPowers context budget", async () => {
  let engineeringWords = 0;

  for (const name of expectedSkills) {
    const content = await readFile(path.join(skillsRoot, name, "SKILL.md"), "utf8");
    const words = wordCount(content);
    if (name === "adapt") {
      assert.ok(words < 400, `adapt has ${words} words`);
    } else {
      assert.ok(words <= 800, `${name} has ${words} words`);
      engineeringWords += words;
    }
  }

  assert.ok(engineeringWords <= 5000, `engineering skills contain ${engineeringWords} words`);
});

test("adapt triggers on explicit downstream feedback but not educational learning", async () => {
  const content = await readFile(path.join(skillsRoot, "adapt", "SKILL.md"), "utf8");
  const { frontmatter } = parseSkill(content);

  assert.match(
    frontmatter.description,
    /reports? .*worked|reports? .*failed|corrects?|durable .*preference/i,
  );
  assert.doesNotMatch(frontmatter.description, /help .* learn/i);
});

test("engineering workflows query bounded project lessons and route explicit feedback", async () => {
  for (const name of engineeringSkills) {
    const content = await readFile(path.join(skillsRoot, name, "SKILL.md"), "utf8");
    const integration = content
      .split("\n")
      .find((line) => line.startsWith("If project learning is enabled"));

    assert.ok(integration, `${name} is missing its learning integration paragraph`);
    assert.match(integration, /use `adapt` to query once/i, name);
    assert.match(
      integration,
      /\[learning policy\]\(\.\.\/\.\.\/references\/learning-policy\.md\)/i,
      name,
    );
    assert.equal(
      integration.match(/[.!?](?=\s|$)/g)?.length,
      2,
      `${name} learning integration must remain two sentences`,
    );
    assert.match(content, /learning is enabled[\s\S]{0,180}query/i, name);
    assert.match(content, /workflow[\s\S]{0,80}path[\s\S]{0,80}tag/i, name);
    assert.match(content, /(?:no more than|at most) three[\s\S]{0,100}(?:advisory|behavior-changing)/i, name);
    assert.match(content, /explicit[\s\S]{0,100}(?:feedback|outcome)[\s\S]{0,80}`adapt`/i, name);
  }
});

test("learning policy makes every read request and helper invocation executable", async () => {
  const policy = await readFile(path.join(root, "references", "learning-policy.md"), "utf8");

  assert.match(policy, /`inspect`, `doctor`\s*\|\s*`\{\}`/);
  assert.ok(
    policy.includes(
      '`query` | `{"workflow":"<canonical-workflow>","paths":["<safe-relative-path>"],"tags":["<tag>"]}`',
    ),
    "query must document its exact stdin JSON",
  );
  assert.match(policy, /installed `adapt` Skill/i);
  assert.match(policy, /resolve `scripts\/learning\.mjs` relative to/i);
  assert.match(policy, /project-root cwd/i);
  assert.match(policy, /command[^\n]{0,40}argv/i);
  assert.match(policy, /request[^\n]{0,40}stdin JSON/i);
});

test("adapt uses the tested stdin helper and preserves control-plane precedence", async () => {
  const content = await readFile(path.join(skillsRoot, "adapt", "SKILL.md"), "utf8");
  assert.match(content, /scripts\/learning\.mjs/);
  assert.match(content, /stdin JSON/i);
  assert.match(content, /caller[^\n]{0,40}leader/i);
  assert.match(content, /instructions[\s\S]{0,120}evidence[\s\S]{0,220}quality gates/i);
  assert.match(content, /scope[\s\S]{0,120}risk[\s\S]{0,120}authorization/i);
});

test("adapt record shape nests all matching fields under scope", async () => {
  const source = await adaptSource();
  assert.match(
    source,
    /"scope":\{"workflows":\[[^\]]+\],"path_prefixes":\[[^\]]+\],"tags":\[[^\]]+\]\}/,
  );
  assert.match(source, /record[\s\S]{0,500}"caller":"leader"[\s\S]{0,500}"scope":/i);
  assert.match(source, /record may add exact `supersedes` IDs and `expires_at`/i);
});

test("adapt classifies one narrow lesson by the normalized reusable rule", async () => {
  const source = await adaptSource();
  assert.match(source, /normalized reusable rule/i);
  assert.match(source, /project convention[\s\S]{0,80}`preference`/i);
  assert.match(source, /replacement fact or rule[\s\S]{0,80}`correction`/i);
  assert.match(source, /actual result[\s\S]{0,80}`outcome`/i);
  assert.match(source, /specific prior result[\s\S]{0,80}`confirmation`/i);
  assert.match(source, /each feedback[\s\S]{0,80}one[\s\S]{0,80}narrowest lesson/i);
});

test("adapt documents exact maintenance mutation request shapes", async () => {
  const source = await adaptSource();
  assert.match(source, /enable.*disable[\s\S]{0,160}\{"caller":"leader"\}/i);
  assert.match(source, /clear[\s\S]{0,160}\{"caller":"leader","all":true\}/i);
  assert.match(source, /delete all[\s\S]{0,160}\{"caller":"leader","all":true\}/i);
  assert.match(
    source,
    /delete IDs[\s\S]{0,180}\{"caller":"leader","lesson_ids":\["<uuid>"\]\}/i,
  );
});

test("lesson scopes use only the six canonical engineering workflows", async () => {
  const source = await adaptSource();
  assert.match(source, /scope\.workflows/i);
  assert.match(source, /shape.*build.*debug.*review.*verify.*ship/is);
  assert.match(source, /only (?:these )?canonical/i);
});

test("learning policy and Claude routing stay within their budgets", async () => {
  const policy = await readFile(path.join(root, "references", "learning-policy.md"), "utf8");
  const claude = await readFile(path.join(root, "adapters", "claude", "session-start"), "utf8");

  assert.ok(wordCount(policy) < 180, `learning policy has ${wordCount(policy)} words`);
  assert.ok(wordCount(claude) < 120, `Claude session-start has ${wordCount(claude)} words`);
  assert.match(claude, /explicit[\s\S]{0,100}feedback[\s\S]{0,100}adapt/i);
  assert.doesNotMatch(claude, /writeFile|mkdir|\.leanpowers/);
});

test("skill references resolve and source contains no placeholders", async () => {
  for (const name of expectedSkills) {
    const skillPath = path.join(skillsRoot, name, "SKILL.md");
    const content = await readFile(skillPath, "utf8");
    assert.doesNotMatch(content, /\b(?:TBD|TODO|FIXME)\b|\[TODO:/i);

    for (const reference of content.matchAll(/\]\((\.\.\/\.\.\/references\/[^)]+)\)/g)) {
      const resolved = path.resolve(path.dirname(skillPath), reference[1]);
      assert.equal((await stat(resolved)).isFile(), true, `${reference[1]} is missing`);
    }
  }
});

test("the source set states every non-negotiable quality invariant", async () => {
  const files = [
    ...(await collectMarkdown(skillsRoot)),
    ...(await collectMarkdown(path.join(root, "references"))),
  ];
  const source = (
    await Promise.all(files.map((file) => readFile(file, "utf8")))
  ).join("\n");

  for (const phrase of [
    "current evidence",
    "root cause",
    "regression evidence",
    "declared scope",
    "independent review",
    "authorization",
    "validation gap",
  ]) {
    assert.match(source.toLowerCase(), new RegExp(phrase), `missing: ${phrase}`);
  }
});

test("strict review never degrades to implementer self-review", async () => {
  const policy = await readFile(
    new URL("../references/subagent-policy.md", import.meta.url),
    "utf8",
  );
  const verify = await readFile(
    new URL("../skills/verify/SKILL.md", import.meta.url),
    "utf8",
  );
  assert.match(policy, /genuinely independent agent, fresh session, qualified human/i);
  assert.match(policy, /do not pass `verify` or enter `ship`/i);
  assert.match(verify, /return `incomplete` and do not transition to `ship`/i);
});

function parseSkill(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n/);
  assert.ok(match, "missing YAML frontmatter");
  const frontmatter = {};
  for (const line of match[1].split("\n")) {
    const separator = line.indexOf(":");
    assert.notEqual(separator, -1, `invalid frontmatter line: ${line}`);
    const key = line.slice(0, separator).trim();
    frontmatter[key] = line.slice(separator + 1).trim();
  }
  return { frontmatter, body: content.slice(match[0].length) };
}

function wordCount(content) {
  return content.trim().split(/\s+/u).filter(Boolean).length;
}

async function collectMarkdown(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectMarkdown(fullPath)));
    } else if (entry.name.endsWith(".md")) {
      files.push(fullPath);
    }
  }
  return files;
}

async function adaptSource() {
  return (
    await Promise.all([
      readFile(path.join(skillsRoot, "adapt", "SKILL.md"), "utf8"),
      readFile(path.join(root, "references", "learning-policy.md"), "utf8"),
    ])
  ).join("\n");
}
