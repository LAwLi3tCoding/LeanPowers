# LeanPowers usage-driven optimization plan

**Date:** 2026-07-26
**Status:** Implementation complete and locally verified; V8 effect evidence unavailable
**Scope:** Improve LeanPowers from observed v7 failures, recent usage, external evaluation guidance, and multi-agent review without changing any frozen historical result.

## Final state

All planned local optimization work is implemented in the current main-line commits. The changes harden route selection, strict-review handling, mutation-discriminating workflow expectations, benchmark model/tool preflight, workflow-home calibration, sanitized pre-task failure evidence, preflight telemetry, result-gate policy binding, and V8 fixture calibration. README, architecture, benchmark protocol, generated package READMEs, and this plan are synchronized to the implemented code and current evidence boundary.

The authorized V8 live attempt on 2026-07-27 did not produce effect evidence. It failed before any `START` event or task run with `Codex model/tool preflight requires exactly one command_execution tool call`. The output directory was empty and no pilot result, report, or gate artifact exists. The standalone prefreeze calibration had passed, but that is compatibility calibration only and not live task evidence. V8 is therefore `UNSCORED`; its comparative decision is `INELIGIBLE`; the suite is not rerun, repaired, or rescored.

## Implemented optimization slices

| Slice | Implemented outcome | Evidence |
| --- | --- | --- |
| Route behavior repair | Explicit BUILD and known-repair tasks no longer default to DEBUG; unknown-cause tasks still route to DEBUG; strict signals stay sticky | Routing and Skill tests in the local quick/full suites |
| Source/package parity | Canonical sources regenerate the Codex and Claude package READMEs and portable package files | `npm run generate`, `npm run generate:check` |
| Mutation-discriminating workflow expectation | BUILD, DEBUG, REVIEW, and strict paths require boundary-proving regression evidence instead of superficial visible-test success | Skill tests plus V8 fixture calibration |
| Model/tool preflight hardening | Benchmark runs bind exact model, effort, disabled feature, required tool event, complete Token arithmetic, tool count, wall time, and disposable workspace fingerprint | Standalone prefreeze PASS and result-gate tests; live V8 pre-task failure recorded separately |
| Workflow-home calibration and failure audit | A pre-live command prepares the same two installed workflow homes as live, checks both under known failure, rejects revision drift, persists complete runner/evaluator/workflow revision provenance in one exclusive sanitized artifact, and live failures stop before `START` with only `preflight-failure.json` | Fake-Codex home/CLI/drift/privacy tests and live pre-task artifact-order regression |
| DEBUG recovery and reproduction attribution | Recovery is bounded; final DEBUG output preserves the reproduction contract and resolved replay evidence | Development benchmark parser and V8 DEBUG fixture tests |
| Strict review non-skippability | Strict risk requires a fresh independent read-only PASS review after green validation; later mutation invalidates it | Strict review protocol tests and independent strict review PASS |
| Learning scope repair | Project lessons are scoped only to the six engineering workflows, not `route` or `adapt` | Schema, core, CLI, and learning policy tests |
| V8 unseen suite | Three new calibrated cases cover lean BUILD, standard DEBUG, and strict BUILD boundaries | V8 fixture calibration `5/5 PASS` |

## Review and validation ledger

The optimization was checked through at least ten review loops before final documentation:

1. Repository gap audit against v7 failures and existing code.
2. Official-source external evaluation review for bounded claims, predeclared gates, and contamination limits.
3. Architecture review rejecting generic tracing/MCP expansion and requiring preflight/tool-policy binding.
4. Privacy and code review identifying exact-command, workspace-mutation, feature-name, result-gate, and path-reporting risks.
5. Route audit of BUILD/DEBUG/strict transitions and test gaps.
6. External-method review limiting small-sample claims to directional diagnostic evidence.
7. TDD route hardening with RED/GREEN tests.
8. Benchmark contract audit adding suite policy binding and preflight cost telemetry.
9. Fixture calibration audit covering hidden verifier imports, mutant source shape, references, and no workspace mutation.
10. Independent strict review of the pre-V8 implementation after validation, resulting in PASS.
11. Authorized V8 execution audit preserving the empty-output pre-task failure as `UNSCORED`.
12. Prospective preflight design review separating neutral-home calibration, workflow-home calibration, and repeated live gating.
13. TDD preflight hardening review covering safe diagnostics, both workflow homes, revision drift, exclusive writes, and no synthetic scored artifacts.
14. Fresh independent strict review after post-hardening full validation as the final delivery gate.

Current deterministic evidence:

- Quick validation: `181/181 PASS`.
- Full validation: `531/531 PASS`.
- V8 fixture calibration: `5/5 PASS`.
- Independent strict review: a fresh post-hardening review is required after final green validation.

These checks prove local implementation and documentation consistency. They do not prove live comparative effectiveness because the authorized V8 attempt failed before task execution.

## Benchmark evidence boundary

V7 remains the latest scored development-effects result and a frozen FAIL. V8 is an unscored pre-task infrastructure failure. Current releases may cite exact local validation evidence, the frozen V7 scored result, and the V8 unscored audit, but may not claim general non-inferiority, release-gate success, workflow parity, or measured V8 efficiency.

Any future positive benchmark claim requires a new unseen suite frozen after the workflow-home preflight infrastructure is verified. The observed V8 suite remains permanently ineligible for rerun or rescoring.
