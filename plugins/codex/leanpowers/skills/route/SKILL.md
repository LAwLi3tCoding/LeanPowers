---
name: route
description: Use when engineering work lacks a selected workflow; route plan, implement, fix, review, verify, deliver to lowest-safe owner.
---

# Route

First emitted bytes MUST be `leanpowers:route | workflow=OWNER | risk=RISK` alone, unquoted; substitute lowercase OWNER/RISK. Byte 1 is `l`: never prefix, bullet, quote, fence, or final-repeat it.

Choose lowest-safe owner. Unknown-cause defects and tasks requesting reproduce/trace/diagnose/root-cause/why/first-wrong-transition set `OWNER=debug` (overrides fix/change/build), `RISK≥standard`, even with supplied repro/cause.

Deterministic single-component defects with a bounded component scope use capsule without Skill/reference. Other defects load `debug`; non-defects load selected Skill.

`lean`: clear, local, reversible/validated, no public boundary. `strict`: security/authentication/credentials/secrets/cryptography/signatures/authorization/payment/privacy/migration/concurrency/production/irreversible/large-refactor. Otherwise `standard`; preference cannot lower risk.

If evidence raises risk, emit `leanpowers:risk | risk=strict` and apply strict gates.

`OWNER`: explicit-feedback→`adapt`, evidence→`verify`, delivery→`ship`, assessment→`review`; otherwise ambiguity→`shape`, diagnosis/unknown-cause→`debug`, implementation/known-repair→`build`; never a risk. `RISK`: `lean`/`standard`/`strict`.

`required_gates`: strict `[independent_review, current_evidence]`; otherwise `[current_evidence]`. Destructive/irreversible/credential-gated/production action requires prior explicit authorization.

Green capsule order is mandatory: `build` DISCOVER(1)→READ-BATCH(1)→TEST-PATCH(1)→RED(1)→CODE-PATCH(1)→VALIDATE-COMBINED(1); `debug` uses DISCOVER→READ-BATCH+REPRODUCE/TRACE→PATCH→VALIDATE-COMBINED. One successful call/stage. Narrate only risk/decision changes, failures/blockers, authorization. Incomplete output permits one narrower retry; failed/missing/contradictory stages may expand once. Restart invalidated gates.

1. DISCOVER(1): skip only when instructions bound scope and name every needed implementation/caller/test/repro/manifest path. Otherwise Codex ONE command: `rg --files SCOPE; rg -n -- 'a|b' SCOPE`; same relative SCOPE twice, `.` only for bounded repository. No `cd`/pipes/globs/redirections/extra paths. Claude uses adjacent `Glob`+`Grep`. Locate implementation, callers, tests, repro, manifest.
2. READ-BATCH(1) and DEBUG REPRODUCE(1) follow DISCOVER in either order; finish before editing. Codex executes exactly ONE `tail -n +1 -- path1 path2 ...` covering every edit target and affected test/manifest; no `cat`, `cd`, separators, unrelated matches, or re-reads. Include contract-changing callers. Claude uses adjacent `Read`. REPRODUCE executes one pre-edit failing path proving failure and first wrong transition; inference is not reproduction.
3. Pre-PATCH emit header-alone `Clause→test ledger:` then one `<constraint>→<test>` per boundary. Tests must kill plausible shortcuts. Dry-run return/event/call order; async/concurrent tests use deferred settlement and deterministic checkpoints, not sleeps. BUILD behavior changes: patch tests only until the test ends in an assertion-level missing-behavior failure, then patch product only. Inspect RED output: syntax/import/setup/expectation defects are not RED. After product begins, final RED tests never change; any needed correction invalidates BUILD and enters debug. Non-behavior docs/config name why RED does not apply and the pre-change check. DEBUG reproduction supplies RED.
4. PATCH: after valid RED/reproduction, Codex uses repository-relative `apply_patch`; Claude uses adjacent `Edit`/`Write`. Include failure paths. BUILD preserves final RED tests. DEBUG keeps product+regression edits contiguous in one mutation window: prefer `apply_patch`, or adjacent edits with no command/other tool.
5. VALIDATE-COMBINED(1): after the last edit, BUILD runs targeted regression plus integration/lint/typecheck/build/full-suite checks in one shell-safe call, deduplicating commands. DEBUG reruns exact pre-edit REPRODUCE plus validation in one `<exact REPRODUCE> && <validation>` call; split only after failure. Test/build alone cannot support `fixed`/completion. Failure enters `debug`; never claim completion. Green lean/standard stops tooling and reports outcome/root cause, changed paths, validation, and residual risk; strict continues.

6. STRICT only after green VALIDATE: read the [subagent policy](../../references/subagent-policy.md) once and execute its Mandatory strict review protocol exactly. Lean/standard never read it.
