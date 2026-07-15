---
name: route
description: Use when engineering work lacks a selected workflow; route plan, implement, fix, review, verify, or deliver to lowest-safe owner.
---

# Route

First emitted bytes MUST be `leanpowers:route | workflow=OWNER | risk=RISK` alone, unquoted; substitute lowercase OWNER/RISK. Byte 1 is `l`: never prefix, bullet, quote, fence, or final-repeat it.

Choose lowest-safe owner. Unknown-cause defects and tasks requesting reproduce/trace/diagnose/root-cause/why/first-wrong-transition set `OWNER=debug` (overrides fix/change/build), `RISK≥standard`, even with supplied repro/cause.

Deterministic single-component defects with a bounded component scope use capsule without Skill/reference. Other defects load `debug`; non-defects load selected Skill.

`lean`: clear, local, reversible/validated, no public boundary. `strict`: security/authentication/credentials/secrets/cryptography/signatures/authorization/payment/privacy/migration/concurrency/production/irreversible/large-refactor. Otherwise `standard`; preference cannot lower risk.

If evidence raises risk, emit `leanpowers:risk | risk=strict` and apply strict gates.

`OWNER`: explicit-feedback→`adapt`, evidence→`verify`, delivery→`ship`, assessment→`review`; otherwise ambiguity→`shape`, diagnosis/unknown-cause→`debug`, implementation/known-repair→`build`; never a risk. `RISK`: `lean`/`standard`/`strict`.

`required_gates`: strict `[independent_review, current_evidence]`; otherwise `[current_evidence]`. Destructive/irreversible/credential-gated/production action requires prior explicit authorization.

Green capsule: `build` DISCOVER(1)→READ-BATCH(1)→TEST-PATCH(1)→RED(1)→CODE-PATCH(1)→VALIDATE-COMBINED(1); `debug` uses DISCOVER→READ-BATCH+REPRODUCE/TRACE→PATCH→VALIDATE-COMBINED. One successful call/stage. Omit routine narration; emit risk/decision changes, blockers/failures, authorization needs, and host updates. Truncated/incomplete output allows one narrower complete retry; failed/missing/contradictory stages may expand once. Restart invalidated gates.

1. DISCOVER(1): skip only when task/repository instructions bound scope and name every needed implementation/caller/test/repro/manifest path. Otherwise Codex ONE command contains `rg --files SCOPE; rg -n -- 'TERMS' SCOPE`; same relative SCOPE twice, `.` only for bounded repository; TERMS=`a|b`, never backslashed. No `cd`/pipes/globs/redirections/extra paths. Claude uses adjacent `Glob`+`Grep`. Locate implementation, callers, tests, repro, manifest.
2. READ-BATCH(1) and DEBUG REPRODUCE(1) follow DISCOVER when used, in either order; finish before editing. Codex fully reads every edit target and its directly affected tests/manifest in ONE `tail -n +1 --`; include callers only when their contract may change, never unrelated matches or re-reads. Claude uses adjacent `Read`. REPRODUCE executes one pre-edit failing path proving failure and first wrong transition; inference is not reproduction.
3. Pre-PATCH emit header-alone `Clause→test ledger:` then one `<constraint>→<test>` per regression/preserved boundary. Tests must kill plausible shortcuts. Dry-run return/event/call order; async/concurrent tests use deferred settlement and deterministic checkpoints, not sleeps. BUILD behavior changes use a test-only patch, then RED runs that focused test and must fail for the expected missing behavior before product edits. Non-behavior docs/config name why RED does not apply and the pre-change check. Preserve RED tests through completion; later edits restart gates. DEBUG reproduction supplies RED.
4. PATCH: Codex uses ONE repository-relative `apply_patch` for product code and remaining tests; Claude uses adjacent `Edit`/`Write`. Include failure paths. Failure reopens the cycle.
5. VALIDATE-COMBINED(1): BUILD runs the targeted regression plus canonical applicable integration/lint/typecheck/build/full-suite checks in one shell-safe call, deduplicating identical commands. DEBUG reruns exact pre-edit REPRODUCE plus canonical validation in one `<exact REPRODUCE> && <validation>` call; split only after failure. Test/build alone cannot support `fixed`/completion. Failure enters `debug`; never claim completion. Green lean/standard stops tooling and answers concisely with outcome/root cause, changed paths, exact validation result, and residual risk only; strict continues.

6. STRICT only after green VALIDATE: read the [subagent policy](../../references/subagent-policy.md) once and execute its Mandatory strict review protocol exactly. Lean/standard never read it.
