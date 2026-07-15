---
name: route
description: Use when engineering work lacks a selected workflow; route plan, implement, fix, review, verify, or deliver to lowest-safe owner.
---

# Route

FIRST line exactly: `leanpowers:route | workflow=OWNER | risk=RISK`; substitute lowercase OWNER/RISK; no prefix/final repeat.

Choose lowest-safe owner. Unknown-cause defects and tasks requesting reproduce/trace/diagnose/root-cause/why/first-wrong-transition set `OWNER=debug` (overrides fix/change/build), `RISK≥standard`, even with supplied repro/cause.

Deterministic single-component defects with a bounded component scope use capsule without Skill/reference. Other defects load `debug`; non-defects load selected Skill.

`lean`: clear, local, reversible/validated, no public boundary. `strict`: security/authentication/credentials/secrets/cryptography/signatures/authorization/payment/privacy/migration/concurrency/production/irreversible/large-refactor. Otherwise `standard`; preference cannot lower risk.

If evidence raises risk, emit `leanpowers:risk | risk=strict` and apply strict gates.

`OWNER`: explicit-feedback→`adapt`, evidence→`verify`, delivery→`ship`, assessment→`review`; otherwise ambiguity→`shape`, diagnosis/unknown-cause→`debug`, implementation/known-repair→`build`; never a risk. `RISK`: `lean`/`standard`/`strict`.

Derive `required_gates` from risk: strict `[independent_review, current_evidence]`; otherwise `[current_evidence]`.
Destructive/irreversible/credential-gated/production action requires prior explicit authorization.

Capsule hard caps: `build` DISCOVER(1)→READ(1)→PATCH(1)→VALIDATE(1); `debug` DISCOVER(1)→READ(1)+REPRODUCE/TRACE(1) (either order)→PATCH(1)→VALIDATE(1). Codex one successful call/stage; select inputs first. No substitutes/splits on green stages. Truncated/incomplete output fails its stage and allows one narrower complete retry; other failed/missing/contradictory stages may also expand once. Restart invalidated gates.

1. DISCOVER: Preset repository cwd applies throughout. Codex uses `rg --files SCOPE; rg -n -- 'TERMS' SCOPE`, replacing both SCOPE tokens with one repository-relative component path; use `.` only for a bounded repository. TERMS is `a|b`, never backslashed. No prefix/`cd`/pipes/globs/redirections/extra paths. Claude uses adjacent native `Glob`+`Grep`. Identify implementation, callers, tests, repro, validation manifest.
2. READ and DEBUG REPRODUCE follow DISCOVER in either order; finish both before PATCH. Codex READ is exactly one `tail -n +1 --` containing every selected implementation/test/repro/validation file; after complete output, never `cat`, split, or re-read. Claude uses adjacent native `Read`, each candidate once without prose/inspection. REPRODUCE runs ONE pre-edit failing path showing failure and first wrong transition; inspection/inference is not reproduction.
3. Pre-PATCH emit once: header-alone `Clause→test ledger:`; one `<constraint>→<test>` per regression/preserved boundary. Regression tests must fail under plausible shortcuts. For composite identities, vary each component; use inputs with identical concatenated text but different boundaries. First assert the shortcut collides, then assert all inputs reach the operation separately. PATCH: Codex ONE repository-relative `apply_patch` for code/tests; Claude adjacent native `Edit`/`Write` without prose/inspection. Include failure-path tests. Validation/review failure reopens cycle.
4. VALIDATE(1): DEBUG is incomplete until the exact pre-edit REPRODUCE command runs again after PATCH and canonical validation passes. Lean/standard green path runs exactly one `<exact REPRODUCE> && <validation>`; split only after that call fails. Test/build alone cannot support `fixed` or completion. Failure enters `debug`; never claim completion. Green lean/standard stops tooling and answers; only strict continues below.

5. STRICT only after green VALIDATE: read the [subagent policy](../../references/subagent-policy.md) once and execute its Mandatory strict review protocol exactly. Lean/standard never read it; stop without extra stage narration.
