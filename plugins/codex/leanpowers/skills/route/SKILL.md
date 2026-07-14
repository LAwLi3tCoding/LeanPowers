---
name: route
description: Use when starting engineering work without a selected LeanPowers workflow; route plan, implement, fix, review, verify, or deliver requests to one lowest-safe owner.
---

# Route

Choose lowest-safe owner. Route material request/scope ambiguity to `shape`. A user-evidenced known-cause defect declares `build`, but reproduce/trace/diagnose/root-cause/why/first-wrong-transition overrides `build`: MUST declare `debug` and at least `standard`. Capsule executes builds and deterministic single-component defects—read no Skill/reference. Intermittent/disputed/cross-component defects load `debug`; other requests load only selected Skill.

`lean`: clear, local, reversible/validated, no public boundary. `strict`: security/authentication/credentials/secrets/cryptography/signatures/authorization/payment/privacy/migration/concurrency/production/irreversible/large-refactor. Otherwise `standard`; preference cannot lower risk.

`OWNER`: feedback→explicit/`adapt`, evidence→`verify`, delivery→`ship`, assessment→`review`; otherwise `shape` material request/scope ambiguity, `debug` unknown-cause defect, `build` known-cause defect/change; never a risk. `RISK`: `lean`, `standard`, or `strict`.

BEFORE any prose/tool, output exactly these four resolved plain lines once. Final MUST contain none of `entrypoint:`, `workflow:`, `risk:`, or `required_gates:`; no label/bullet/fence/prefix. Then one blank line and prose:

entrypoint: leanpowers:route
workflow: OWNER
risk: RISK
required_gates: GATES

Strict `GATES` is `[independent_review, current_evidence]`; otherwise `[current_evidence]`.
Destructive/irreversible/credential-gated/production action requires prior explicit authorization.

Green-path logical budgets—not quality ceilings: `build` = DISCOVER(1)→READ(1)→PATCH(1)→VALIDATE(1); `debug` = DISCOVER(1)→READ(1)→REPRODUCE/TRACE(1)→PATCH(1)→VALIDATE(1). Codex: one call/stage; Claude: adjacent native adapters per stage. Expand only on failed/missing/contradictory evidence; wanting context is not evidence. Expand stage; restart invalidated gates.

1. DISCOVER: Codex ONE content-aware shell call, `rg --files .; rg -n -- 'TERMS' .`; Claude adjacent native `Glob`+`Grep`. Search root; Codex prohibits globs/`cd`/absolute/guessed paths; never filename-only. Identify implementation, callers, tests, validation manifests.
2. READ immediately follows DISCOVER. Codex: ONE compound command prints every candidate and validation metadata; Claude: adjacent native `Read`, each candidate once, no prose/inspection. No later green-path read. DEBUG then, pre-edit: ONE focused command executes the real failing path, showing failure and first wrong transition; inspection/inference is not reproduction.
3. Before editing, output a clause→test ledger for every literal `must`/`only`/`exact`/`preserve`/`reject`; each rejection mutates one property of an asserted-passing case. PATCH: Codex ONE repository-relative `apply_patch` containing all code/tests; Claude adjacent native `Edit`/`Write` calls without prose/inspection. Include failure-path tests; never repatch green evidence.
4. VALIDATE is ONE canonical test/build command covering regression and affected checks; never chain standalone reproduction or diagnostics. Failure enters `debug`; never claim completion. Green lean/standard may finish; strict **MUST NOT answer**; continue below. Final output omits all four ledger keys.

**Mandatory strict gate — final answer forbidden until exact pass**

5. Freeze diff. Codex: if either V1/native tool is hidden, call exactly `tool_search(query="wait_agent targets spawn_agent fork_context", limit=2)`. Spawn only if its result exposes both; otherwise return incomplete before any spawn. Call `multi_agent_v1.spawn_agent` once with only `message`, `fork_context:false`; save ID, then call `multi_agent_v1.wait_agent` once with `targets:[ID]`. No other review-tool action. Claude calls one Agent. Never probe or use `items`, retry, fallback, second/placeholder/`noop`, or “as above”. Copy original task byte-for-byte—including case/punctuation—under `Original task:`. Spawn message MUST equal the filled template, starting at its invocation line; omit only the runtime label.

Codex message:

$leanpowers:review
Original task:
{entire original task}

Reviewer context:
Sole reviewer; read diff/code; do not edit/delegate.
Ledger: {one-line clause→boundary evidence; no task restatement}
Paths: {repository-relative changed paths}
Test: exit=0; command={exact validation command}
Return Review YAML raw—no JSON/fence/heading/prose. Pass: exactly these three lines:

verdict: pass
findings: []
unverified_areas: []

Claude message:

/leanpowers:review
Original task:
{entire original task}

Reviewer context:
Sole reviewer; read diff/code; do not edit/delegate.
Ledger: {one-line clause→boundary evidence; no task restatement}
Paths: {repository-relative changed paths}
Test: exit=0; command={exact validation command}
Return Review YAML raw—no JSON/fence/heading/prose. Pass: exactly these three lines:

verdict: pass
findings: []
unverified_areas: []

6. Read result. Exact pass freezes files; finish. Findings require repair/retest, then restart step 5 with a fresh reviewer and current Test result. Blocked/unavailable returns incomplete. Never rewait/retry a reviewer, add reviewers within a cycle, or overrule findings.
