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

  assert.match(frontmatter.description, /Use when engineering work/i);
  assert.match(
    frontmatter.description,
    /no specific .*workflow .*selected|without a selected .*workflow|lacks workflow selection/i,
  );
  for (const trigger of ["plan", "implement", "fix", "review", "verify", "deliver"]) {
    assert.match(frontmatter.description, new RegExp(trigger, "i"), trigger);
  }
  assert.match(body, /Choose (?:the )?lowest-safe owner/i);
  assert.match(body, /lowest-safe|lowest safe/i);
  assert.match(body, /choose lowercase owner\/risk/i);
  assert.match(body, /before any task tool[\s\S]{0,120}emit its declaration/i);
  assert.doesNotMatch(body, /workflow=OWNER|risk=RISK/);
  assert.match(body, /explicit-feedback→`adapt`[\s\S]{0,180}implementation\/known-repair→`build`/i);
  assert.match(
    body,
    /`lean` only when[\s\S]{0,180}`clear`[\s\S]{0,180}`local`[\s\S]{0,180}`reversible`[\s\S]{0,180}`establishedValidation`[\s\S]{0,180}no standard or strict signal/i,
  );
  for (const signal of [
    "behaviorChange",
    "boundedUncertainty",
    "dataModelChange",
    "defect",
    "dependencyChange",
    "diagnosisRequested",
    "externalSystem",
    "multiFile",
    "publicBoundaryChange",
    "scopeExpanded",
    "validationFailed",
  ]) {
    assert.match(body, new RegExp(`\\\`${signal}\\\``), signal);
  }
  for (const signal of [
    "authorization",
    "authentication",
    "concurrency",
    "credentialGated",
    "credentials",
    "cryptography",
    "dataRisk",
    "destructive",
    "irreversible",
    "largeRefactor",
    "migration",
    "payment",
    "privacy",
    "production",
    "reviewHighRisk",
    "security",
    "secrets",
    "signatureVerification",
  ]) {
    assert.match(body, new RegExp(`\\\`${signal}\\\``), signal);
  }
  assert.match(body, /`causeKnown=false`[\s\S]{0,100}`standard`/i);
  assert.match(body, /Gates are strict `\[independent_review, current_evidence\]`/i);
  assert.match(body, /leanpowers:route \| workflow=debug \| risk=standard/);
  assert.match(body, /metavariables?[\s\S]{0,80}invalid/i);
  assert.match(body, /alone on line 1/i);
  assert.match(body, /BUILD[\s\S]{0,120}DISCOVER→READ→TEST-PATCH→RED→CODE-PATCH→VALIDATE/i);
  assert.match(body, /DEBUG[\s\S]{0,160}DISCOVER→READ\+REPRODUCE\/TRACE→PATCH→VALIDATE/i);
  assert.match(body, /READ every later-edited existing target[\s\S]{0,180}Before PATCH/i);
  assert.match(body, /Clause→test ledger/i);
  assert.match(body, /must\|only\|exact\|preserve\|reject/i);
  assert.match(body, /Counterexample:[\s\S]{0,120}nearby mutation[\s\S]{0,80}expected boundary/i);
  assert.match(body, /BUILD[\s\S]{0,160}(?:Behavior uses )?tests first/i);
  assert.match(body, /meaningful RED/i);
  assert.match(body, /product files stay locked[\s\S]{0,160}meaningful RED/i);
  assert.match(body, /meaningful RED[\s\S]{0,140}missing behavior[\s\S]{0,100}not syntax\/setup\/unrelated failure/i);
  assert.match(body, /After (?:the )?final edit[\s\S]{0,180}validation/i);
  assert.match(body, /DEBUG[\s\S]{0,180}root cause before editing/i);
  assert.match(body, /regression[\s\S]{0,100}product repair/i);
  assert.match(body, /Validate, then replay the exact reproduction/i);
  assert.match(body, /getter|counter/i);
  assert.match(body, /no-access/i);
  assert.match(body, /immutability/i);
  assert.match(body, /short-circuit/i);
  assert.match(body, /one-property|one-element/i);
  assert.match(body, /exact(?:-| validation )boundar/i);
  assert.match(body, /Codex native `apply_patch`[\s\S]{0,80}Claude `Edit`\/`Write`/i);
  assert.doesNotMatch(body, /One call\/stage/i);
  assert.doesNotMatch(body, /Codex joins `rg --files`|tail -n \+1/i);
  assert.doesNotMatch(body, /mandatory combined|one combined targeted/i);
  assert.doesNotMatch(body, /<repro> && <validation>/i);
  assert.doesNotMatch(body, /One test-only correction/i);
  assert.doesNotMatch(body, /Exact pass immediately finalizes with no later tool/i);
  assert.doesNotMatch(body, /never rediscover\/reread/i);
  assert.ok(
    body.indexOf("First emitted bytes MUST be") < body.indexOf("Choose the lowest-safe owner"),
    "canonical declaration must precede routing prose",
  );
  assert.match(body, /`strict` for[^\n]*\bconcurrency\b/i);
  for (const workflow of ["shape", "build", "debug", "review", "verify", "ship", "adapt"]) {
    assert.match(body, new RegExp(`\\b${workflow}\\b`, "i"), workflow);
  }
  assert.doesNotMatch(body, /1%|before any response|you do not have a choice/i);
  assert.ok(wordCount(content) <= 500, `route has ${wordCount(content)} words`);
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
      "workflow-transitions.md",
    ]) {
      assert.doesNotMatch(content, new RegExp(legacy.replace(".", "\\."), "i"), `${name}: ${legacy}`);
    }
    const subagentLinks = [
      ...content.matchAll(/\.\.\/\.\.\/references\/subagent-policy\.md/giu),
    ].length;
    assert.equal(
      subagentLinks,
      name === "build" || name === "debug" ? 1 : 0,
      `${name}: lazy strict-review policy link count`,
    );
  }

  const route = await readFile(path.join(skillsRoot, "route", "SKILL.md"), "utf8");
  assert.match(
    route,
    /Routed strict loads only the \[subagent policy\]\(\.\.\/\.\.\/references\/subagent-policy\.md\) after green[\s\S]{0,120}Lean\/standard never read it/i,
  );
  assert.equal(
    [...route.matchAll(/\.\.\/\.\.\/references\//giu)].length,
    1,
    "route must lazy-load only the strict review reference",
  );
});

test("ordinary completion is inline while strict review remains mandatory", async () => {
  const build = await readFile(path.join(skillsRoot, "build", "SKILL.md"), "utf8");
  const debug = await readFile(path.join(skillsRoot, "debug", "SKILL.md"), "utf8");
  const review = await readFile(path.join(skillsRoot, "review", "SKILL.md"), "utf8");
  let route = await readFile(path.join(skillsRoot, "route", "SKILL.md"), "utf8");
  const strictPolicy = await readFile(
    path.join(root, "references", "subagent-policy.md"),
    "utf8",
  );
  const runtime = await readFile(path.join(root, "references", "runtime-contract.md"), "utf8");
  const verify = await readFile(path.join(skillsRoot, "verify", "SKILL.md"), "utf8");

  assert.match(build, /lean or standard[\s\S]{0,180}next: null/i);
  assert.match(debug, /lean or standard[\s\S]{0,180}next: null/i);
  assert.doesNotMatch(build, /next:\s*review/i);
  assert.doesNotMatch(debug, /next:\s*review/i);
  assert.match(build, /strict direct entry[\s\S]{0,220}independent read-only reviewer[\s\S]{0,180}same turn[\s\S]{0,120}Review YAML[\s\S]{0,80}`pass`/i);
  assert.match(debug, /strict direct entry[\s\S]{0,220}independent read-only reviewer[\s\S]{0,180}same turn[\s\S]{0,120}Review YAML[\s\S]{0,80}`pass`/i);
  assert.match(verify, /independent_review: pass \| missing \| not_required/i);
  assert.match(build, /affected integration[\s\S]{0,120}full-suite/i);
  assert.match(build, /validation gap blocks `complete`/i);
  assert.match(route, /Unknown-cause defects or reproduce\/trace\/diagnose\/root-cause\/why\/first-wrong-transition requests/i);
  assert.match(route, /`owner=debug` \(overrides fix\/change\/build\), `risk≥standard`/i);
  assert.match(route, /and supplied repro\/cause/i);
  assert.match(route, /Bounded deterministic single-component defects/i);
  assert.match(route, /without (?:another |reading )?Skill\/reference/i);
  assert.match(route, /Other defects load `debug`/i);
  assert.match(route, /non-defects load the selected Skill/i);
  assert.match(route, /ambiguity→`shape`/i);
  assert.match(route, /explicit-feedback→`adapt`/i);
  assert.match(route, /implementation\/known-repair→`build`/i);
  assert.match(route, /First emitted bytes MUST be/i);
  assert.match(route, /leanpowers:route \| workflow=debug \| risk=standard/);
  assert.doesNotMatch(route, /workflow=OWNER|risk=RISK/);
  assert.match(route, /alone on line 1/i);
  assert.match(route, /never prefix or repeat it/i);
  assert.match(route, /If evidence raises risk, emit `leanpowers:risk \| risk=strict`; never downgrade/i);
  assert.match(route, /Selected-owner capsule[\s\S]{0,140}route invocation owns order through completion/i);
  assert.ok(
    route.indexOf("Selected-owner capsule") < route.indexOf("Choose the lowest-safe owner"),
    "owner capsule must precede routing and risk detail",
  );
  assert.match(build, /Routed entry owns workflow order/i);
  assert.match(debug, /Routed entry owns workflow order/i);
  assert.match(build, /Direct-entry slice loop/i);
  assert.match(debug, /Direct-entry root-cause loop/i);
  assert.match(route, /Destructive\/irreversible\/credential-gated\/production action requires prior explicit authorization/i);
  assert.match(route, /BUILD(?: preserves)? DISCOVER→READ→TEST-PATCH→RED→CODE-PATCH→VALIDATE/i);
  assert.match(route, /DEBUG(?: preserves)? DISCOVER→READ\+REPRODUCE\/TRACE→PATCH→VALIDATE/i);
  assert.match(route, /READ every later-edited existing target[\s\S]{0,180}Before PATCH/i);
  assert.match(route, /tests first[\s\S]{0,180}product files stay locked[\s\S]{0,180}meaningful RED/i);
  assert.match(route, /After (?:the )?final edit[\s\S]{0,180}validation/i);
  assert.match(route, /first wrong transition[\s\S]{0,100}root cause[\s\S]{0,160}before edit/i);
  assert.match(route, /regression[\s\S]{0,100}product repair/i);
  assert.match(route, /Validate, then replay the exact reproduction/i);
  assert.match(route, /structured (?:resolved )?output[\s\S]{0,120}separate final command/i);
  assert.match(route, /After (?:the )?final edit[\s\S]{0,220}validation[\s\S]{0,220}Edits invalidate evidence/i);
  assert.match(route, /read-only reporting[\s\S]{0,80}does not/i);
  assert.match(route, /Synchronous reentrancy alone is not concurrency/i);
  assert.match(route, /STRICT after final green[\s\S]{0,120}fresh independent read-only reviewer[\s\S]{0,180}wait[\s\S]{0,100}PASS/i);
  assert.doesNotMatch(route, /next:\s*review|handoff/i);
  assert.match(route, /Lean\/standard never read it/i);
  route = `${route}\n${strictPolicy}`;
  assert.match(route, /one fresh read-only reviewer/i);
  assert.match(route, /full original task/i);
  assert.match(route, /changed paths/i);
  assert.match(route, /current validation/i);
  assert.match(route, /later file edit[\s\S]{0,100}invalidates[\s\S]{0,100}review/i);
  assert.match(route, /read-only reporting[\s\S]{0,100}does not/i);
  assert.match(route, /findings[\s\S]{0,100}repair[\s\S]{0,100}revalidate[\s\S]{0,100}fresh reviewer/i);
  assert.match(route, /unavailable[\s\S]{0,80}blocked/i);
  assert.match(review, /runtime provenance—not prompt self-report/i);
  assert.match(
    review,
    /runtime provenance—not prompt self-report[\s\S]{0,80}fresh agent sole\/designated reviewer[\s\S]{0,100}review directly[\s\S]{0,100}read-only[\s\S]{0,100}never re-delegate/i,
  );
  assert.match(review, /literal `must`[\s\S]{0,100}`only`[\s\S]{0,100}`exact`/i);
  assert.match(review, /positive and negative boundary evidence/i);
  assert.match(review, /Return raw YAML only/i);
  assert.match(review, /`pass` is exactly the three lines shown/i);
  assert.match(runtime, /implementer text never satisfies or overrules review/i);
  assert.match(runtime, /review[\s\S]{0,100}internal same-turn phase/i);
  assert.doesNotMatch(
    runtime,
    /Codex V1|multi_agent_v1|fork_context|tool-search|spawn_agent|wait_agent|wait once/i,
  );
});

test("strict review policy carries complete current context without tool choreography", async () => {
  const route = await readFile(path.join(skillsRoot, "route", "SKILL.md"), "utf8");
  const policy = await readFile(
    path.join(root, "references", "subagent-policy.md"),
    "utf8",
  );
  assert.match(
    route,
    /Destructive\/irreversible\/credential-gated\/production action requires prior explicit authorization/i,
  );
  for (const clause of [
    /native review mechanism/i,
    /internal same-turn phase/i,
    /one fresh read-only reviewer/i,
    /full original task/i,
    /changed paths/i,
    /current validation/i,
    /pass[\s\S]{0,100}(?:satisfies|completes)[\s\S]{0,100}strict/i,
    /later file edit[\s\S]{0,100}invalidates[\s\S]{0,100}review/i,
    /read-only reporting[\s\S]{0,100}does not/i,
  ]) {
    assert.match(policy, clause);
  }
  assert.doesNotMatch(policy, /tool_search|spawn_agent|wait_agent|fork_context|exactly one|call exactly/i);
});

test("runtime recovery freezes accepted evidence without hiding new omissions", async () => {
  const route = await readFile(path.join(skillsRoot, "route", "SKILL.md"), "utf8");
  const build = await readFile(path.join(skillsRoot, "build", "SKILL.md"), "utf8");
  const debug = await readFile(path.join(skillsRoot, "debug", "SKILL.md"), "utf8");

  for (const source of [route, build]) {
    assert.match(
      source,
      /meaningful RED[\s\S]{0,180}(?:freezes[\s\S]{0,100}regression assertion|RED freezes it)/i,
    );
    assert.match(
      source,
      /invalid test design[\s\S]{0,140}restart[\s\S]{0,80}TEST-PATCH→RED[\s\S]{0,140}pre-behavior baseline/i,
    );
    assert.match(source, /never weaken (?:an )?assertions?/i);
  }

  for (const source of [route, debug]) {
    assert.match(
      source,
      /failed (?:supported )?validation[\s\S]{0,180}one[\s\S]{0,100}correction[\s\S]{0,220}identical(?:-| )(?:(?:affected )?checks|command)/i,
    );
    assert.match(
      source,
      /(?:another failure[\s\S]{0,120}(?:blocks|rescope)[\s\S]{0,120}before more edits|No intervening task tool[\s\S]{0,180}second correction[\s\S]{0,80}second failure)/i,
    );
  }

  for (const source of [route, build, debug]) {
    assert.match(
      source,
      /first green[\s\S]{0,120}freezes[\s\S]{0,120}completed acceptance set/i,
    );
    assert.match(
      source,
      /material omission[\s\S]{0,120}starts[\s\S]{0,80}(?:new )?(?:incomplete )?cycle/i,
    );
  }

  for (const source of [route, build]) {
    assert.match(
      source,
      /configuration(?: or |\/)generated output[\s\S]{0,140}(?:baseline|precheck)[\s\S]{0,180}failing evidence[\s\S]{0,120}(?:behavior(?:al change)?|defect)/i,
    );
  }
  assert.doesNotMatch(build, /Configuration or generated output needs a failing/i);
});

test("prospective v6 workflow repairs are hard gates without extra stages", async () => {
  const route = await readFile(path.join(skillsRoot, "route", "SKILL.md"), "utf8");
  const build = await readFile(path.join(skillsRoot, "build", "SKILL.md"), "utf8");
  const debug = await readFile(path.join(skillsRoot, "debug", "SKILL.md"), "utf8");
  const strictPolicy = await readFile(
    path.join(root, "references", "subagent-policy.md"),
    "utf8",
  );

  for (const source of [route, build]) {
    assert.match(source, /first behavioral edit[\s\S]{0,100}test-only/i);
    assert.match(source, /test changes? after RED[\s\S]{0,140}invalidate[\s\S]{0,100}(?:new|another|rerun) RED/i);
    assert.match(source, /never[\s\S]{0,100}(?:implementation|product)[\s\S]{0,80}(?:and|with)[\s\S]{0,80}tests?[\s\S]{0,120}(?:before|without)[\s\S]{0,80}(?:valid|meaningful) RED/i);
    assert.match(source, /each[\s\S]{0,140}(?:qualifier|boundary)[\s\S]{0,140}(?:neighboring|nearby)[\s\S]{0,80}(?:wrong|mutation)/i);
  }
  for (const discriminator of [
    /fresh[\s\S]{0,100}(?:two|twice)[\s\S]{0,100}identit/i,
    /order-independent|regardless of order/i,
    /case-sensitive[\s\S]{0,100}(?:case|character)/i,
    /no-(?:coercion|access)[\s\S]{0,100}(?:trap|counter)/i,
  ]) {
    assert.match(`${route}\n${build}`, discriminator);
  }
  assert.match(debug, /fresh[\s\S]{0,100}(?:two|twice)[\s\S]{0,100}identit/i);
  assert.match(
    debug,
    /exact ordinary[\s\S]{0,120}prototype[\s\S]{0,120}Reflect\.ownKeys[\s\S]{0,120}descriptors/i,
  );
  assert.match(
    build,
    /deep-fresh[\s\S]{0,140}(?:disjoint|share no)[\s\S]{0,120}(?:input|output)[\s\S]{0,120}containers?/i,
  );

  assert.match(
    debug,
    /continuous[\s\S]{0,120}regression[\s\S]{0,100}product repair[\s\S]{0,160}(?:without|no test)[\s\S]{0,80}(?:BUILD )?RED/i,
  );
  assert.match(debug, /pre-edit[\s\S]{0,100}reproduc/i);
  for (const source of [route, debug]) {
    assert.match(source, /pre-edit[\s\S]{0,120}reproduc[\s\S]{0,100}standalone command/i);
  }
  assert.match(debug, /validation[\s\S]{0,100}(?:replay|rerun)[\s\S]{0,80}(?:exact|original)[\s\S]{0,40}reproduc/i);

  for (const source of [route, build, debug, strictPolicy]) {
    assert.match(source, /green (?:is not|!=) completion/i);
  }
  assert.match(strictPolicy, /atomic ledger/i);
  assert.match(strictPolicy, /unavailable review[\s\S]{0,80}(?:blocked|cannot complete)/i);
});

test("runtime compresses repeated context without merging evidence gates", async () => {
  const route = await readFile(path.join(skillsRoot, "route", "SKILL.md"), "utf8");
  const runtime = await readFile(
    path.join(root, "references", "runtime-contract.md"),
    "utf8",
  );

  for (const source of [route, runtime]) {
    assert.match(source, /batch independent reads\/checks when evidence stays attributable/i);
    assert.match(source, /never reread unchanged workflow\/source/i);
    assert.match(source, /limit output to relevant regions\/failure summaries/i);
    assert.match(source, /carry one ledger without restating task\/plan/i);
    assert.match(source, /extra calls require new evidence; never merge gates/i);
  }
});

test("debug reproduction output stays attributable after validation", async () => {
  const route = await readFile(path.join(skillsRoot, "route", "SKILL.md"), "utf8");
  const debug = await readFile(path.join(skillsRoot, "debug", "SKILL.md"), "utf8");

  for (const source of [route, debug]) {
    assert.match(
      source,
      /(?:run[\s\S]{0,200}validation[\s\S]{0,80}then[\s\S]{0,80}|Validate, then replay the )exact reproduction/i,
    );
    assert.match(
      source,
      /structured (?:resolved )?output[\s\S]{0,160}separate final command/i,
    );
  }
  assert.match(
    debug,
    /combined[\s\S]{0,120}only[\s\S]{0,140}no structured output contract[\s\S]{0,120}attribution/i,
  );
});

test("runtime risk prose mirrors the executable classifier", async () => {
  const runtime = await readFile(
    path.join(root, "references", "runtime-contract.md"),
    "utf8",
  );
  const riskPolicy = await readFile(
    path.join(root, "references", "risk-policy.md"),
    "utf8",
  );
  const transitions = await readFile(
    path.join(root, "references", "workflow-transitions.md"),
    "utf8",
  );
  const review = await readFile(path.join(skillsRoot, "review", "SKILL.md"), "utf8");

  assert.match(
    runtime,
    /`lean` only when[\s\S]{0,180}`clear`[\s\S]{0,180}`local`[\s\S]{0,180}`reversible`[\s\S]{0,180}`establishedValidation`[\s\S]{0,180}no standard or strict signal/i,
  );
  for (const signal of [
    "behaviorChange",
    "boundedUncertainty",
    "dataModelChange",
    "defect",
    "dependencyChange",
    "diagnosisRequested",
    "externalSystem",
    "multiFile",
    "publicBoundaryChange",
    "scopeExpanded",
    "validationFailed",
    "authorization",
    "authentication",
    "concurrency",
    "credentialGated",
    "credentials",
    "cryptography",
    "dataRisk",
    "destructive",
    "irreversible",
    "largeRefactor",
    "migration",
    "payment",
    "privacy",
    "production",
    "reviewHighRisk",
    "security",
    "secrets",
    "signatureVerification",
  ]) {
    assert.match(runtime, new RegExp(`\\\`${signal}\\\``), signal);
  }
  assert.match(runtime, /`causeKnown=false`[\s\S]{0,100}`standard`/i);
  assert.match(
    riskPolicy,
    /`lean`[\s\S]{0,140}no standard or strict signal[\s\S]{0,220}`standard`[\s\S]{0,140}(?:behavior change|defect|unknown cause)/i,
  );
  assert.match(
    riskPolicy,
    /strict[\s\S]{0,300}internal same-turn `review/i,
  );
  assert.match(
    transitions,
    /strict[\s\S]{0,100}`review`[\s\S]{0,100}internal[\s\S]{0,80}same turn/i,
  );
  assert.doesNotMatch(review, /tool-search|spawn(?:_agent)?|wait(?:_agent)?/i);
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
  let totalWords = 0;

  for (const name of expectedSkills) {
    const content = await readFile(path.join(skillsRoot, name, "SKILL.md"), "utf8");
    const words = wordCount(content);
    totalWords += words;
    if (name === "adapt") {
      assert.ok(words < 400, `adapt has ${words} words`);
    } else if (name === "route") {
      assert.ok(words <= 500, `route has ${words} words`);
      engineeringWords += words;
    } else {
      assert.ok(words <= 800, `${name} has ${words} words`);
      engineeringWords += words;
    }
  }

  assert.ok(engineeringWords <= 5000, `engineering skills contain ${engineeringWords} words`);
  assert.ok(totalWords <= 4067, `all skills contain ${totalWords} words`);
});

test("core workflows absorb selected engineering lenses without adding stages", async () => {
  const build = await readFile(path.join(skillsRoot, "build", "SKILL.md"), "utf8");
  const debug = await readFile(path.join(skillsRoot, "debug", "SKILL.md"), "utf8");
  const shape = await readFile(path.join(skillsRoot, "shape", "SKILL.md"), "utf8");
  const review = await readFile(path.join(skillsRoot, "review", "SKILL.md"), "utf8");

  assert.match(build, /stable observable seam/i);
  assert.match(build, /expected values?[\s\S]{0,120}independent source of truth/i);
  assert.match(build, /vertical slice/i);
  assert.doesNotMatch(build, /confirm (?:the )?seam with the user|ask the user .*seam/i);

  assert.match(debug, /tight, red-capable feedback loop/i);
  assert.match(debug, /minimi[sz]e/i);
  assert.match(debug, /non-deterministic[\s\S]{0,120}reproduction rate/i);
  assert.match(debug, /tagged instrumentation[\s\S]{0,120}removed/i);

  assert.match(shape, /full shaping for architecture[\s\S]{0,100}three seam checks/i);
  assert.match(shape, /deletion test/i);
  assert.match(shape, /interface is the test surface/i);
  assert.match(shape, /one adapter is hypothetical; two adapters are real/i);
  assert.doesNotMatch(shape, /light shaping[\s\S]{0,120}deletion test/i);

  assert.match(review, /contract fitness/i);
  assert.match(review, /engineering fitness/i);
  assert.match(review, /without splitting reviewers/i);
  assert.match(review, /pass requires both/i);
});

test("build and review reject speculative work without adding a workflow", async () => {
  const build = await readFile(path.join(skillsRoot, "build", "SKILL.md"), "utf8");
  const review = await readFile(path.join(skillsRoot, "review", "SKILL.md"), "utf8");

  assert.match(build, /every changed line[\s\S]{0,80}(?:serve|trace)[\s\S]{0,40}(?:request|requested outcome)/i);
  for (const boundary of [
    /speculative features/i,
    /single-use abstractions/i,
    /unrequested flexibility/i,
    /impossible-case handling/i,
    /slice-created orphans/i,
  ]) {
    assert.match(build, boundary);
  }
  for (const boundary of [
    /speculative features/i,
    /single-use abstractions/i,
    /unrequested flexibility/i,
  ]) {
    assert.match(review, boundary);
  }
});

test("shape supports explicit grilling without making it the default ceremony", async () => {
  const shape = await readFile(path.join(skillsRoot, "shape", "SKILL.md"), "utf8");

  assert.match(shape, /explicit grill\/stress-test request/i);
  assert.match(shape, /only material decision dependencies/i);
  assert.match(shape, /one question per turn/i);
  assert.match(shape, /recommended answer and main tradeoff/i);
  assert.match(shape, /incorporate the reply before continuing/i);
  assert.match(shape, /instead of asking repository-answerable questions/i);
  for (const boundary of ["scope", "acceptance", "architecture", "risk", "authority"]) {
    assert.match(shape, new RegExp(`remaining branches[^.]+${boundary}`, "i"));
  }
  assert.match(shape, /default shaping[\s\S]{0,100}one consolidated question/i);
  assert.doesNotMatch(shape, /(?:always|default(?: shaping)?)[^\n.]{0,80}(?:grill|stress-test)/i);
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
