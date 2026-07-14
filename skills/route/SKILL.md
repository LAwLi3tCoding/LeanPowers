---
name: route
description: Use when engineering work lacks a selected workflow; route plan, implement, fix, review, verify, or deliver to lowest-safe owner.
---

# Route

Before tools, report once: `leanpowers:route | workflow=OWNER | risk=RISK`; clear equivalents are valid.

Choose lowest-safe owner. Material request/scope ambiguity→`shape`. Within build/debug, reproduce/trace/diagnose/root-cause/why/first-wrong-transition requires `debug`, risk ≥`standard`, even with supplied repro/cause; `build` requires explicit cause+repair without diagnosis. Capsule handles deterministic single-component defects without reading Skill/reference. Intermittent/disputed/cross-component defects load `debug`; others load only the selected Skill.

`lean`: clear, local, reversible/validated, no public boundary. `strict`: security/authentication/credentials/secrets/cryptography/signatures/authorization/payment/privacy/migration/concurrency/production/irreversible/large-refactor. Otherwise `standard`; preference cannot lower risk.

`OWNER`: explicit-feedback→`adapt`, evidence→`verify`, delivery→`ship`, assessment→`review`; otherwise ambiguity→`shape`, requested diagnosis/cause discovery→`debug`, explicit cause/repair or change→`build`; never a risk. `RISK`: `lean`/`standard`/`strict`.

Derive `required_gates` from risk: strict `[independent_review, current_evidence]`; otherwise `[current_evidence]`.
Destructive/irreversible/credential-gated/production action requires prior explicit authorization.

Green-path budgets: `build` DISCOVER(1)→READ(1)→PATCH(1)→VALIDATE(1); `debug` adds REPRODUCE/TRACE(1) before PATCH. Codex one call/stage; Claude adjacent adapters. Expand failed/missing/contradictory stages only; restart invalidated gates.

1. DISCOVER: Preset repository cwd applies throughout. Codex runs exactly `rg --files .; rg -n -- 'TERMS' .`; TERMS is `a|b`, never backslashed. No prefix/`cd`/pipes/globs/redirections/extra paths. Claude uses adjacent native `Glob`+`Grep`. Identify implementation, callers, tests, repro, validation manifest.
2. READ follows DISCOVER. Codex runs one `tail -n +1 --` with selected candidates and validation manifest; no printf/echo/chaining/re-read. Claude uses adjacent native `Read`, each candidate once without prose/inspection. DEBUG then runs ONE pre-edit failing path showing failure and first wrong transition; inspection/inference is not reproduction.
3. Before PATCH emit `Clause→test ledger:` with nonempty `<constraint>→<test>` mappings for the regression and preserved boundaries; never repeat it. Preflight distinguishing inputs; each rejection changes one passing-case property. PATCH: Codex ONE repository-relative `apply_patch` for all code/tests; Claude adjacent native `Edit`/`Write` without prose/inspection. Include failure-path tests. Failed validation/review opens another cycle.
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
