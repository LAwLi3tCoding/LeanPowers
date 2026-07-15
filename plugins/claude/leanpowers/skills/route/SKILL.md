---
name: route
description: Use when engineering work lacks a selected workflow; route plan, implement, fix, review, verify, or deliver to lowest-safe owner.
---

# Route

FIRST line exactly: `leanpowers:route | workflow=OWNER | risk=RISK`; substitute lowercase OWNER/RISK; no prefix/repeat.

Choose lowest-safe owner. Unknown-cause defects and tasks requesting reproduce/trace/diagnose/root-cause/why/first-wrong-transition set `OWNER=debug` (overrides fix/change/build), `RISK≥standard`, even with supplied repro/cause.

Deterministic single-component defects use capsule without Skill/reference. Intermittent/disputed/cross-component defects load `debug`; others load only the selected Skill.

`lean`: clear, local, reversible/validated, no public boundary. `strict`: security/authentication/credentials/secrets/cryptography/signatures/authorization/payment/privacy/migration/concurrency/production/irreversible/large-refactor. Otherwise `standard`; preference cannot lower risk.

If evidence raises risk, emit `leanpowers:risk | risk=strict` and apply strict gates.

`OWNER`: explicit-feedback→`adapt`, evidence→`verify`, delivery→`ship`, assessment→`review`; otherwise ambiguity→`shape`, diagnosis/unknown-cause→`debug`, implementation/known-repair→`build`; never a risk. `RISK`: `lean`/`standard`/`strict`.

Derive `required_gates` from risk: strict `[independent_review, current_evidence]`; otherwise `[current_evidence]`.
Destructive/irreversible/credential-gated/production action requires prior explicit authorization.

Fixed-order—never swap: `build` DISCOVER(1)→READ(1)→PATCH(1)→VALIDATE(1); `debug` DISCOVER(1)→READ(1)→REPRODUCE/TRACE(1)→PATCH(1)→VALIDATE(1). Codex one call/stage; Claude adjacent adapters. Expand failed/missing/contradictory stages only; restart invalidated gates.

1. DISCOVER: Preset repository cwd applies throughout. Codex runs exactly `rg --files .; rg -n -- 'TERMS' .`; TERMS is `a|b`, never backslashed. No prefix/`cd`/pipes/globs/redirections/extra paths. Claude uses adjacent native `Glob`+`Grep`. Identify implementation, callers, tests, repro, validation manifest.
2. READ follows DISCOVER; REPRODUCE follows READ. Codex runs one `tail -n +1 --` with selected candidates and validation manifest; no printf/echo/chaining/re-read. Claude uses adjacent native `Read`, each candidate once without prose/inspection. DEBUG runs ONE pre-edit failing path showing failure and first wrong transition; inspection/inference is not reproduction.
3. Before PATCH emit once: header-alone `Clause→test ledger:`; one `<constraint>→<test>` line per regression/preserved boundary; one `Counterexample: <task-property>=<task-context>,value=<pass>→<task-context>,value=<one-change>→<expected-boundary>`. Repeat task-context verbatim; no inner arrows; challenge representation, not the bug. PATCH: Codex ONE repository-relative `apply_patch` for all code/tests; Claude adjacent native `Edit`/`Write` without prose/inspection. Include failure-path tests. Failed validation/review opens another cycle.
4. VALIDATE(1): target ONE shell call with the canonical test/build covering regression/affected checks. DEBUG replay combines exact pre-edit REPRODUCE, literal ` && `, and validation. Two ordered calls remain correct but miss the green budget; forbid every other command. Failure enters `debug`; never claim completion. Green lean/standard stops tooling and answers; only strict continues below.

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
