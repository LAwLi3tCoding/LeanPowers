---
name: route
description: Use when starting engineering work without a selected LeanPowers workflow; route plan, implement, fix, review, verify, or deliver requests to one lowest-safe owner.
---

# Route

Choose lowest-safe owner. Route material request/scope ambiguity to `shape`. Within build/debug ownership, reproduce/trace/diagnose/root-cause/why/first-wrong-transition overrides `build`: MUST declare `debug`, risk ≥`standard`, even with supplied repro/cause. `build` only explicit cause+repair without diagnosis. Capsule executes deterministic single-component defects—read no Skill/reference. Intermittent/disputed/cross-component defects load `debug`; other requests load only selected Skill.

`lean`: clear, local, reversible/validated, no public boundary. `strict`: security/authentication/credentials/secrets/cryptography/signatures/authorization/payment/privacy/migration/concurrency/production/irreversible/large-refactor. Otherwise `standard`; preference cannot lower risk.

`OWNER`: explicit-feedback→`adapt`, evidence→`verify`, delivery→`ship`, assessment→`review`; otherwise ambiguity→`shape`, requested diagnosis/cause discovery→`debug`, explicit cause/repair or change→`build`; never a risk. `RISK`: `lean`, `standard`, or `strict`.

BEFORE prose/tool, output exactly these four resolved plain lines once. Never repeat them: final MUST omit lines beginning `entrypoint:`, `workflow:`, `risk:`, or `required_gates:`. Then one blank line and prose:

entrypoint: leanpowers:route
workflow: OWNER
risk: RISK
required_gates: GATES

Strict `GATES` is `[independent_review, current_evidence]`; otherwise `[current_evidence]`.
Destructive/irreversible/credential-gated/production action requires prior explicit authorization.

Green-path budgets: `build` DISCOVER(1)→READ(1)→PATCH(1)→VALIDATE(1); `debug` adds REPRODUCE/TRACE(1) before PATCH. Codex one call/stage; Claude adjacent adapters. Expand failed/missing/contradictory stages only; restart invalidated gates.

1. DISCOVER: Codex MUST run exactly one root command shaped `rg --files .; rg -n -- 'TERMS' .`, replacing only TERMS; no pipes/globs/`cd`/redirects/extra paths. Claude uses adjacent native `Glob`+`Grep`. Identify implementation, callers, tests, repro, and validation manifest.
2. READ immediately follows DISCOVER. Codex MUST run one `tail -n +1 --` command with selected candidates and validation manifest as shell-safe operands; no printf/echo/chaining/re-read. Claude uses adjacent native `Read`, each candidate once without prose/inspection. DEBUG then, pre-edit: ONE focused command executes the real failing path, showing failure and first wrong transition; inspection/inference is not reproduction.
3. Before editing, output a clause→test ledger for every literal `must`/`only`/`exact`/`preserve`/`reject`; each rejection mutates one property of an asserted-passing case. PATCH: Codex ONE repository-relative `apply_patch` containing all code/tests; Claude adjacent native `Edit`/`Write` calls without prose/inspection. Include failure-path tests; never repatch green evidence.
4. VALIDATE uses ONE canonical test/build command covering regression and affected checks; never chain reproduction/diagnostics. Failure enters `debug`; never claim completion. On green lean/standard, STOP tooling, skip step 5, and answer. Only strict continues below. Final MUST omit the four opening ledger lines.

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
