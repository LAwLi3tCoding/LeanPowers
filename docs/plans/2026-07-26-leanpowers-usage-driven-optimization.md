# LeanPowers usage-driven optimization plan

**Date:** 2026-07-26
**Status:** Implemented and locally verified; new live benchmark pending
**Scope:** Improve LeanPowers from observed v7 failures and current workspace changes without changing the frozen v7 result.

## Source evidence

- `docs/benchmarks/development-effects-performance-confirmatory-v7-audit-2026-07-16.md`: v7 is a frozen FAIL. LeanPowers produced `2/10` Task PASS, `1/10` conformance, no quality-policy population, and only diagnostic efficiency data.
- `docs/benchmark.md`: live checks are bounded evidence. Current releases may cite exact observations but may not claim general non-inferiority or release-gate success.
- Current workspace diff: `skills/route/SKILL.md` reduces DEBUG over-selection, clarifies concrete route declarations, and keeps strict risk sticky.
- Current workspace diff: learning schema and helper code restrict lesson workflow scopes to `shape`, `build`, `debug`, `review`, `verify`, and `ship`.
- Current workspace diff: `scripts/lib/development-benchmark.mjs` disables `image_generation` for Codex benchmark runs to address the v7 model/tool compatibility failure class.
- Current workspace verification: `npm run validate:quick` passed `176/176`; the full `npm run validate` passed `503/503` with macOS fixture isolation available. No new live benchmark has been run.

## Priorities

| Priority | Work | Evidence driver | Acceptance gate |
| --- | --- | --- | --- |
| P0 | Stop route example anchoring and DEBUG over-selection | v7 routed all completed LeanPowers turns to `workflow=debug | risk=standard`; BUILD cases lost required BUILD order | Routing tests prove explicit BUILD and known-repair tasks choose BUILD, unknown-cause tasks choose DEBUG, strict signals stay strict, and route declarations use concrete values without a hard-coded example |
| P0 | Restore source-package parity | Generated package drift repeatedly appeared during concurrent route edits | `npm run generate:check` and package validation pass after regenerating intended artifacts |
| P0 | Keep mutation-discriminating tests as a hard workflow expectation | v7 task failures were dominated by candidate tests that did not kill all semantic fault members | Build/debug/review Skill tests cover boundary-proving tests, meaningful RED, no-access sentinels, identity/snapshot checks, and semantic fault-family adequacy |
| P0 | Prevent Spark model/tool compatibility exclusions | v7 had three pre-agent failures from unsupported advertised image-generation tooling | Runner argument tests prove `--disable image_generation`; the next benchmark preflight must fail closed before suite freeze if selected model/tool support is incompatible |
| P1 | Tighten DEBUG recovery and resolved reproduction attribution | v7 observed recovery protocol and reproduction-window misses | Development benchmark parser tests prove one bounded recovery only, identical rerun command, and standalone final reproduction when structured output is required |
| P1 | Make strict review non-skippable | v7 strict BUILD downgraded risk and lacked current independent PASS review | Route/skill tests prove strict risk monotonicity, post-green review requirement, no mutation after PASS, and `verify` incomplete when review is missing |
| P1 | Bound learning scopes to engineering workflows only | `route` and `adapt` are control-plane surfaces; storing them as lesson workflow scopes would blur retrieval semantics | Schema, core validator, CLI validator, and learning policy tests reject `route` and `adapt` workflow scopes before state mutation |
| P1 | Separate fast and full local validation | Current package script adds `test:quick` and `validate:quick`; README already links these commands | README link tests and package scripts pass; docs explain fast gate versus full gate without treating quick validation as release proof |
| P2 | Run a new frozen live benchmark only after P0/P1 gates pass | v7 cannot be rerun or rescored; old tasks are now calibration evidence | Newly frozen unseen cases, model/tool preflight, clean generated packages, and complete telemetry before making any new effectiveness claim |

## Implemented slices

1. **Documentation and source-of-truth cleanup**
   - Add architecture documentation and this optimization plan.
   - Keep benchmark statements bounded to frozen evidence.
   - Gate: README local links resolve; no claim says a new live benchmark passed.

2. **Route behavior repair**
   - Keep declaration format concrete without embedding one selectable example.
   - Make bug/fix/change wording insufficient for DEBUG unless cause is unknown or diagnosis is explicitly requested.
   - Gate: `tests/routing.test.mjs` and route sections of `tests/skills.test.mjs` pass.

3. **Learning scope repair**
   - Treat lessons as scoped only to the six engineering workflows.
   - Reject noncanonical workflow scopes in JSON schema, runtime validation, and CLI requests before writing `.leanpowers`.
   - Gate: learning schema/core/CLI tests pass and state remains unchanged on invalid input.

4. **Runner compatibility repair**
   - Disable unsupported image-generation tooling in benchmark Codex args or preflight exact selected model/tool support before a run freezes.
   - Gate: benchmark argument tests pass; no future benchmark proceeds after a known unsupported tool advertisement.

5. **Package regeneration and package validation**
   - Regenerate Codex and Claude installables from canonical source after source changes are final.
   - Gate: `npm run generate:check`, `node scripts/validate-package.mjs`, and package parity tests pass.

6. **Full validation and release-readiness check**
   - Run `npm run validate:quick` as the inner-loop gate.
   - Run `npm run validate` before any release or public claim.
   - Gate: all failures are either fixed or documented as blocking gaps; no release claim is made from partial validation.

7. **New benchmark only after local gates**
   - Freeze new unseen tasks, verifier snapshots, retry/exclusion policy, model/tool preflight, and scoring rules before live execution.
   - Gate: complete quality and telemetry populations. Diagnostic-only or failed results stay published as such.

## Acceptance gates

- Source docs exist at `docs/architecture.md` and this plan path.
- README and packaged README local links resolve after generation.
- Generated Codex and Claude packages are source-identical where portable files are expected.
- `npm run generate:check` passes.
- `npm run validate:quick` passes.
- `npm run validate` passes before release.
- Any future benchmark claim names the frozen suite, exact revision, valid-pair population, and PASS/FAIL/DIAGNOSTIC status.

## Known limitations

- No new live benchmark has been run for the current workspace changes.
- V7 remains a frozen FAIL and is not rescored by this plan.
- The route repair is proven by deterministic contract tests, not yet by a newly frozen live conformance matrix.
- Disabling `image_generation` proves the constructed Codex invocation no longer advertises that tool; the next live suite still needs an exact model/tool preflight and complete telemetry.
- Fast validation is an inner-loop convenience, not a substitute for full validation or benchmark evidence.
