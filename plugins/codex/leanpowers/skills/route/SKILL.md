---
name: route
description: Use when engineering work lacks workflow selection: plan/implement/fix/review/verify/deliver.
---

First emitted bytes MUST be `leanpowers:route | workflow=OWNER | risk=RISK` alone on line 1; never prefix or repeat declaration.

Choose lowest-safe owner. Unknown-cause defects or reproduce/trace/diagnose/root-cause/why/first-wrong-transition requests: `OWNER=debug` (overrides fix/change/build), `RISK≥standard`, with supplied repro/cause.

Bounded deterministic single-component defects: capsule without Skill/reference; other defects load `debug`; non-defects load selected Skill.

`lean`: clear, local, reversible/validated. `strict`: security/authentication/credentials/secrets/cryptography/signatures/authorization/payment/privacy/migration/concurrency/production/irreversible/large-refactor. Otherwise `standard`. Synchronous reentrancy alone is not concurrency.

If evidence raises risk, emit `leanpowers:risk | risk=strict` and apply strict gates.

`OWNER`: explicit-feedback→`adapt`, evidence→`verify`, delivery→`ship`, assessment→`review`; ambiguity→`shape`, diagnosis/unknown-cause→`debug`, implementation/known-repair→`build`; never a risk. `RISK`: `lean`/`standard`/`strict`.

`required_gates`: strict `[independent_review, current_evidence]`; otherwise `[current_evidence]`. Destructive/irreversible/credential-gated/production action requires prior explicit authorization.

Green capsule order is mandatory: `build` DISCOVER(1)→READ-BATCH(1)→TEST-PATCH(1)→RED(1)→CODE-PATCH(1)→VALIDATE-COMBINED(1); `debug` uses DISCOVER→READ-BATCH+REPRODUCE/TRACE→PATCH→VALIDATE-COMBINED. One call/stage; narrate only risk changes, failures, blockers, authorization. Only DEBUG recovery repeats the failed validation command. BUILD permits one test-only RED correction before product; otherwise block/debug.

1. DISCOVER(1): skip only when instructions name implementation/caller/test/repro/manifest paths. Codex ONE command: `rg --files SCOPE; rg -n -- 'PRIMARY|TEST' SCOPE`; use task-specific symbols, never literals. Same relative SCOPE twice; `.` only for bounded repository. No `cd`/pipes/globs/redirections/extra paths. Claude uses adjacent `Glob`+`Grep`.
2. READ-BATCH(1) and DEBUG REPRODUCE(1) follow DISCOVER; finish before edits, either order. Codex ONE `tail -n +1 -- path1 path2 ...` covers every edit target plus affected test/manifest/caller; no `cat`/`cd`/separators/unrelated matches/re-reads. Claude uses adjacent `Read`. REPRODUCE proves failure pre-edit. Absent first wrong transition, allow one evidence-adding TRACE/differentiator; cause remains hypothetical.
3. For BUILD behavior changes, test-only mutation is the executable ledger; emit no prose. At nearest contract boundaries, derive positive, adjacent-negative, preservation, identity/side-effect, and interacting-failure assertions from the request; omit inapplicable. Dry-run expected input→return/event/call trace; omit nothing. Async/concurrent tests use deferred settlement and deterministic checkpoints, not sleeps; name each applicable promise settlement before await. After READ, next BUILD mutation MUST touch tests only; any product path invalidates BUILD. Codex uses `apply_patch`; Claude uses adjacent `Edit`/`Write`. Next tool MUST run the targeted test and produce assertion-level RED. Before product, inspect every failure; syntax/import/setup/expectation defects require test-only correction plus new RED. Only then patch product. Never combine BUILD product and test patches. After product, tests freeze; correction invalidates BUILD→debug. Non-behavioral docs/config use PRECHECK→PATCH→VALIDATE and explain RED exemption; behavior-changing config follows RED.
4. DEBUG is not BUILD: never run separate TEST-PATCH/RED. Compose contract interactions. Keep product+regression edits contiguous. Codex uses one repository-relative `apply_patch` containing both; Claude uses adjacent `Edit`/`Write` with no command/other tool. Do not delete/recreate whole files.
5. VALIDATE-COMBINED(1) after last edit: manifest/runner-proven full-suite coverage runs once; otherwise run targeted+applicable integration/lint/typecheck/build/full-suite checks in one shell-safe call. DEBUG runs exact pre-edit REPRODUCE plus validation once as `<exact REPRODUCE> && <validation>`. BUILD failure after product enters full `debug` or stops incomplete. DEBUG alone may inspect-output→one already-read/in-scope, regression-preserving correction→identical rerun; second failure stops incomplete. Never rediscover/reread/change-command/use-post-success-tools, loop, or claim completion. Green lean/standard stops tools; report outcome/root cause, paths, validation, residual risk; strict continues.

6. STRICT only after green VALIDATE: read [subagent policy](../../references/subagent-policy.md) once; execute Mandatory strict review protocol, then stop. Lean/standard never read it.
