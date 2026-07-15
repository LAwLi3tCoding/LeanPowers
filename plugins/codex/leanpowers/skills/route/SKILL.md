---
name: route
description: Use when engineering work lacks workflow selection: plan/implement/fix/review/verify/deliver.
---

First emitted bytes MUST be `leanpowers:route | workflow=OWNER | risk=RISK` alone on line 1; OWNER/RISK=lowercase. Never prefix or repeat declaration.

Choose lowest-safe owner. Unknown-cause defects or reproduce/trace/diagnose/root-cause/why/first-wrong-transition requests: `OWNER=debug` (overrides fix/change/build), `RISK≥standard`, with supplied repro/cause.

Bounded deterministic single-component defects use capsule without Skill/reference; other defects load `debug`; non-defects load selected Skill.

`lean`: clear, local, reversible/validated, no public boundary. `strict`: security/authentication/credentials/secrets/cryptography/signatures/authorization/payment/privacy/migration/concurrency/production/irreversible/large-refactor. Otherwise `standard`; risk is sticky.

If evidence raises risk, emit `leanpowers:risk | risk=strict` and apply strict gates.

`OWNER`: explicit-feedback→`adapt`, evidence→`verify`, delivery→`ship`, assessment→`review`; ambiguity→`shape`, diagnosis/unknown-cause→`debug`, implementation/known-repair→`build`; never a risk. `RISK`: `lean`/`standard`/`strict`.

`required_gates`: strict `[independent_review, current_evidence]`; otherwise `[current_evidence]`. Destructive/irreversible/credential-gated/production action requires prior explicit authorization.

Green capsule order is mandatory for behavior changes: `build` DISCOVER(1)→READ-BATCH(1)→TEST-PATCH(1)→RED(1)→CODE-PATCH(1)→VALIDATE-COMBINED(1); `debug` uses DISCOVER→READ-BATCH+REPRODUCE/TRACE→PATCH→VALIDATE-COMBINED. One successful call/stage; narrate only changed risk/decisions, failures/blockers, authorization. Never repeat an unchanged failed/no-output command; at most one changed retry that adds evidence, then enter debug/blocker.

1. DISCOVER(1): skip only when instructions name all needed implementation/caller/test/repro/manifest paths. Codex ONE command: `rg --files SCOPE; rg -n -- 'PRIMARY|TEST' SCOPE`; substitute task-specific implementation/test/repro symbols, never literals. Same relative SCOPE twice; `.` only for bounded repository. No `cd`/pipes/globs/redirections/extra paths. Claude uses adjacent `Glob`+`Grep`.
2. READ-BATCH(1) and DEBUG REPRODUCE(1) follow DISCOVER; finish before edits, either order. Codex executes exactly ONE `tail -n +1 -- path1 path2 ...` covering every edit target and affected test/manifest; no `cat`/`cd`/separators/unrelated matches/re-reads. Include contract-changing callers. Claude uses adjacent `Read`. REPRODUCE proves failure with one pre-edit failing path. If first wrong transition is absent, one evidence-adding TRACE/differentiator may run before edits; cause remains hypothesis meanwhile.
3. Test-only mutation is the executable ledger; emit no prose. Privately map every explicit changed/preserved boundary to an assertion whose expected trace differs from a plausible shortcut; trigger mutation before distinguishing observation. Emit no map; omit none. Dry-run the expected input→return/event/call trace. Async/concurrent tests use deferred settlement and deterministic checkpoints, not sleeps. For BUILD behavior changes, after READ, the next mutation MUST touch tests only; any product path invalidates BUILD. Codex uses `apply_patch`; Claude uses adjacent `Edit`/`Write`. Next tool MUST run the targeted test and produce assertion-level RED. Only then patch product. Never combine BUILD product and test patches. Inspect RED output: syntax/import/setup/expectation defects are not RED. Final RED tests freeze before product; correction invalidates BUILD→debug. Non-behavioral docs/config use PRECHECK→PATCH→VALIDATE and explain RED exemption; behavior-changing config follows RED.
4. Include failure paths. DEBUG keeps product+regression edits contiguous in one mutation window. Codex uses repository-relative `apply_patch`, exactly one containing product+regression for DEBUG. Claude uses adjacent `Edit`/`Write`; no command/other tool.
5. VALIDATE-COMBINED(1) after last edit: manifest/runner-proven full-suite coverage runs once; otherwise run targeted+applicable integration/lint/typecheck/build/full-suite checks in one shell-safe call. DEBUG reruns exact pre-edit REPRODUCE plus validation in one `<exact REPRODUCE> && <validation>` call. Test/build alone cannot support `fixed`/completion. Failure enters `debug`; never claim completion. Green lean/standard stops tooling and reports outcome/root cause, changed paths, validation, and residual risk; strict continues.

6. STRICT only after green VALIDATE: read [subagent policy](../../references/subagent-policy.md) once; execute Mandatory strict review protocol. Lean/standard never read it.
