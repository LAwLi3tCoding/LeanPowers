# Performance-target development-effects preregistration

Date frozen: 2026-07-15, before the first live model run and before the workflow optimization evaluated by this suite.

Status: **inputs, semantic fault families, and decision rules frozen; no live result inspected**.

This study evaluates whether a smaller, recovery-resistant LeanPowers capsule can retain executable engineering quality while reducing aggregate model-token use to at most 60% of Superpowers and improving paired wall time. Superpowers 6.1.1 remains the respected upstream workflow that inspired LeanPowers. The comparison is intended to measure a specific lightweight design tradeoff and to guide LeanPowers development, not to diminish the upstream project.

## Frozen execution contract

| Field | Frozen value |
| --- | --- |
| Suite | `development-effects-performance-confirmatory-2026-07-15` |
| Suite SHA-256 | `b038bf60cec48038818362c0a717fe7d5b98412590c228217bb534ec686546d7` |
| Runtime | Codex CLI |
| Model | `gpt-5.3-codex-spark` |
| Reasoning effort | `low` |
| Repetitions | `2` |
| Matrix | `3 cases × 2 repetitions × 2 workflows = 12 runs` |
| Pairing | same task, workspace, verifier, model, effort, evaluator, and counterbalanced order |
| Order | repetition 1: Superpowers then LeanPowers; repetition 2: LeanPowers then Superpowers |
| Superpowers revision | `d884ae04edebef577e82ff7c4e143debd0bbec99` (`v6.1.1`) |
| LeanPowers/evaluator revision | one clean revision created after this freeze and before the first live run |
| Agent read isolation | `codex-minimal-workspace-plugin-toolchain-read-v1` |
| Network | disabled inside every agent run |

A partial matrix, changed revision, changed case snapshot, failed isolation preflight, missing positive model-token telemetry, or post-freeze suite edit makes the result ineligible. The tasks may not be reused as confirmatory evidence after their live outputs have influenced another workflow change.

## Frozen task matrix

| Case | Scenario | Risk | LeanPowers owner | Workspace SHA-256 | Hidden verifier SHA-256 | Mutants SHA-256 |
| --- | --- | --- | --- | --- | --- | --- |
| `utf8-byte-chunks` | Unicode-aware feature | standard | build | `4516fac38ca74fe8e4be13d1dc14f20dffcaf4bbe7eadfb26b9b211243f307cd` | `714be9a2dbdf51dc5865af435313852cf830ab8bbaadacfd7ffb4ee52f126a5e` | `b6db71d5ee278796f44e2aca01c59d81550c166be448ca1a85ba37d003c015b0` |
| `simultaneous-text-edits` | original-coordinate feature | standard | build | `50358b23561e72690434e36fa2077c40cee211191cb0ce90581953f0d42cd3d2` | `ea3fe47022dd379b2df90db37271cb43313a83c184f688f4f4b735c95f69f185` | `f547fdad209a11fe27fe24dc1b910dff10bd675b126f2d8e380c523038391896` |
| `snapshot-signal-dispatch` | live-iteration defect | standard | debug | `e58ce66bdc9d43481c43cb271fd9b15cffa61ec198753b4be60012ba1a70b99d` | `2602475e58fe13c0e007039cae3b2d4f76ee89c3eb71397b90a87ee1396d6525` | `76e77c8e25139fdb581a42fe63282b649305949cd6a8814d8d5a8bcf89e42d42` |

The two build cases require boundary-complete regression tests before product edits. The debug case includes a deterministic pre-edit reproduction with a frozen structured first-wrong-transition observation. Specifications explicitly settle Unicode, coordinate, overlap, snapshot, exception, export, and immutability boundaries so reasonable implementations are not penalized for evaluator ambiguity.

## Frozen semantic fault families

The 19 families contain 21 independent mutants. Every mutant must pass the original visible tests, and the candidate test delta must kill every member of every family.

| Case | Family | Members | Manifest SHA-256 |
| --- | --- | ---: | --- |
| UTF-8 chunks | Unicode code-point integrity | 1 | `df7cc9df9c966557b0fc80eb3b3748cb31d097651b4fd0eeaec5756618aa0c75` |
| UTF-8 chunks | UTF-8 byte budget | 2 | `fa57940e7fc652d2bf035256a21790dc3bb7ae2411448b589f58576f16aef3dc` |
| UTF-8 chunks | exact-fit boundary | 1 | `37b80ed375a557e98fedf9766492290c5c4983ebbed98202d2380de6c35e7f9f` |
| UTF-8 chunks | oversized code point | 1 | `ad717e6f3579004ed2deff4cc03d0ab8076a669e171737437747174609e552b6` |
| UTF-8 chunks | unpaired surrogate validation | 1 | `a1b7e33e369d6ae8767832a8cfba6e1b0f1f7b037b07dbb71d837317e1ffa84c` |
| Text edits | unordered normalization | 1 | `ec76155133b7e2e603cc123834fee03ed87658be503e67c4506ebb61ac5ddd2e` |
| Text edits | original-coordinate application | 1 | `3dae6f2501fae81f9e3653b6644958b021c2d2b29cc498a748bebf0d56e12365` |
| Text edits | half-open boundary | 1 | `4ea63be4704bd9008153790fd96e043e226d9052e0148873004f8ae3d3840ded` |
| Text edits | adjacent boundary | 1 | `544c3eb856c560ee6e5ac26398ebf2f9fcb1c45fbf8c9177b94a4b0b57b0c12d` |
| Text edits | overlap rejection | 1 | `d847d7179ecdddbbf9887077ed4c53d18e57cb34a0d974dde9aec5201040a8a8` |
| Text edits | input immutability | 1 | `bd81b21dce58ecb26d005452ba3c7bdf329b961dececdd83dab4a317bc985476` |
| Text edits | UTF-16 coordinates | 1 | `ac1c4951e8eda03fb9141382bd4aba69a3627d061de7a12c3f8d08cb0149bcc2` |
| Signal | self-unsubscribe snapshot | 1 | `8589e0d5c63c6486759f18f007e4e2a6d9a5bdf4ead3fac49c32de4f58c8ca95` |
| Signal | cross-unsubscribe snapshot | 1 | `4e222710090c5870786f4a8eea8645e99527c54b81eda26e3ac95f288c48a671` |
| Signal | delayed listener addition | 1 | `7d9bb4926a3bab65f6a2e8ffbccc18a97a3e829e6f6f465e4ff77971fae917f5` |
| Signal | duplicate subscription independence | 2 | `6792dd140a901444e1052e16163be32dff65c9db400026150c7a2a5e4fb30c39` |
| Signal | synchronous dispatch | 1 | `d5a18ccd23cd9fee80c2205660419054bb0a05af45c575f604162e0af1fe811b` |
| Signal | subscription order | 1 | `348892d945ad5c6b66b68c88ce1788a6cccf3da900a8191c8a92228a1078c1ec` |
| Signal | nested snapshot independence | 1 | `8fbcadf31b03aacacbd28a4e875dd5929d0f6768b8d0ce017d7de0b51935d456` |

Before the first live run, the deterministic fixture audit must prove:

1. every pristine workspace passes visible tests and fails hidden acceptance;
2. the debug reproduction emits its exact frozen structured observation;
3. reference repairs pass visible and hidden acceptance;
4. every mutant passes the original visible tests;
5. the reference candidate-test delta kills all 21 mutants; and
6. verifier and mutant execution restore each candidate workspace exactly.

## Frozen decisions

Quality is lexically prior to efficiency: lower token use or faster execution cannot compensate for a failed task, missing workflow evidence, or evaluator-integrity failure.

### Engineering-effect decision

PASS only if:

- both workflows pass all six executable task runs;
- every run passes visible tests, hidden acceptance, all semantic fault families, changed-path scope checks, and repository-integrity checks;
- all six LeanPowers runs pass activation, routing, pre-change evidence, patch protocol, and current-validation conformance;
- all six Superpowers runs report activation; and
- no run records a scope violation or unauthorized action.

### Aggregate model-token decision

The primary token statistic is:

`sum(LeanPowers model tokens across all six matched runs) / sum(Superpowers model tokens across all six matched runs)`

PASS only when the complete matrix has positive model-token telemetry for every pair and the aggregate share is at most `60%`. The threshold applies to the total task mix, not every individual pair. Fresh-token use, output/reasoning tokens, per-pair shares, tool calls, retries, and context replay remain diagnostics.

### Wall-time decision

PASS only when the complete paired matrix reports a median LeanPowers wall-time reduction greater than `0%`. Wall time is noisier than executable quality and model tokens, so the exact estimate remains bounded to this runtime and matrix; it is nevertheless a required target for this performance goal.

### Combined decision

The target is PASS only when the engineering-effect, aggregate-token, wall-time, and repository-validation gates all pass. The machine gate must reject incomplete matrices, changed snapshots, invalid telemetry, or any failed quality boundary.

## Reporting boundary

This remains a small confirmatory sample: two standard build tasks and one standard debug task, each repeated twice on one model and runtime. A complete PASS would provide bounded evidence for this LeanPowers optimization under these conditions. It would not establish universal equivalence, replace broader public benchmarks, or claim that Superpowers is generally inferior. Raw transcripts and disposable workspaces remain local; only sanitized aggregate evidence and repository-relative findings may be published.
