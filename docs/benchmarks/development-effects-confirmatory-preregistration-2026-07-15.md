# Multi-task confirmatory development-effects preregistration

Date frozen: 2026-07-15, before the first live model run.

Status: **inputs and decision rules frozen; no live result inspected**.

This comparison evaluates whether LeanPowers can retain the outcome-critical engineering safeguards inherited from and inspired by Superpowers while reducing aggregate model-token use. Superpowers 6.1.1 is the respected upstream reference workflow, not an opponent to be diminished or a project this study is designed to “defeat.”

## Frozen execution contract

| Field | Frozen value |
| --- | --- |
| Suite | `development-effects-confirmatory-2026-07-15` |
| Suite SHA-256 | `bed220c33b40871ce4550085f0f3f763a56da0d8af3bd71ae33b2299ec1fbf8c` |
| Runtime | Codex CLI |
| Model | `gpt-5.3-codex-spark` |
| Reasoning effort | `low` |
| Repetitions | `2` |
| Pairing | same task, workspace, verifier, model, effort, and evaluator revision |
| Order | repetition 1: Superpowers then LeanPowers; repetition 2: LeanPowers then Superpowers |
| Superpowers revision | `d884ae04edebef577e82ff7c4e143debd0bbec99` (`v6.1.1`) |
| LeanPowers/evaluator revision | the same clean commit created after this freeze and before the first run |
| Agent read isolation | `codex-minimal-workspace-plugin-toolchain-read-v1` |
| Network | disabled inside every agent run |

The runner must execute all `3 cases × 2 repetitions × 2 workflows = 12` runs. A partial matrix, a changed revision, a changed case snapshot, failed isolation preflight, missing model-token telemetry, or any post-freeze suite edit makes the result ineligible for the confirmatory decision.

## Frozen task matrix

| Case | Scenario | Risk | LeanPowers owner | Workspace SHA-256 | Hidden-verifier SHA-256 | Mutants SHA-256 |
| --- | --- | --- | --- | --- | --- | --- |
| `integer-range-labels` | small explicit feature | standard | build | `1db0e45fb08791c590bfa0e007c90004ad9d2f7f6490d3c456a3df15ecd9bcff` | `3635f87a75e15b605b4bbedb737f4d12ef8615ff31e532bb302ab746084fee03` | `6df4b9d8b747037fd129b6c3c4ceca5e63f3a162692c0d97c50dee03032e2f87` |
| `layered-build-options` | configuration/build compatibility change | standard | build | `73e38bf7c1bb94d6aafbd75579243ee602331f018a54d30841d61191c67f3503` | `f21ae4ded8eabd940fd31d90098ee3cae8fa44b7fc92c9c95eb862f36b1a07ae` | `a3ef7d1c138108667abcb5e0416b37b998bca5639bcb17b542dd3a4a4dd39f07` |
| `chunked-ndjson-decoder` | unknown-cause stream defect | standard | debug | `cd1e071d38c98fc0f8861c4c8446f33ef09ccab2bb2e5ff04acf49d68df351b2` | `4070b2e4e540c19cb6c24c3f0d10308652ee2b55ba4f25da7447f6dff6374f70` | `2f78054f5c1c3f04cd6f84ecfbb1bfcbd54fbb6c2a87a7a30b72df29e850984c` |

These cases were created after the initial active-path optimization. Before any live model run, independent static review found fixture-oracle gaps, corrected the public-boundary feature from lean to standard risk, and found a general capsule gap: build wording no longer required a failing regression between the test-only and product patches. The fixtures, risk label, and general invariant were repaired, every affected hash was recomputed, and the suite was re-frozen on 2026-07-15. No candidate or baseline model run was inspected or used for tuning.

## Frozen semantic fault families

The 13 families contain 17 independent mutants. Every mutant must pass the original visible tests, and the candidate's added test delta must kill every member of every family.

| Case | Family | Manifest SHA-256 |
| --- | --- | --- |
| integer ranges | ascending normalization | `b9a567d81ba2b8cbee85e0390e5e76a4518c5de4776b6add683eee265c7af2b2` |
| integer ranges | duplicate elision | `f4ba55cc455efd80cd42c8fa8ccd5b187c038efab58d2bbcfd8acaec167a8952` |
| integer ranges | two-value run compaction | `c0ec1d3a005de124adc462702b16cfacb635d07cae5050e5731800fe8244b5ba` |
| integer ranges | gap boundary | `7a63273b8917931f8478d91499acebeb9d8cad710bb1dc81e435508c892beb5e` |
| integer ranges | input immutability | `41191aa9a493c9619238cb863b1a8f6182ead4c9114ab7205b3396fc3abd187f` |
| build options | layer precedence | `aa1efd487b60c0176f7d5096ad0ae320c39debefa70355736a29f23481155c2a` |
| build options | override presence | `4fb8516f6b58287435107089a61f47db1a8124ea3949e250e65783f6df0d9a5c` |
| build options | schema boundary | `115cae913152fc425562610e7d5ac894c58168f1422eb66187a1935f085d43c4` |
| build options | input immutability | `7f33189625a86817664f5d1e275680162df106d4b89b09da9dd9b1abe8774c40` |
| NDJSON | fragment buffering | `df04f720055655919dfe0f90df27b8d0382b4c582a2ff368c3541146bdcb592b` |
| NDJSON | batch completeness/order | `ab56bf0c3f30ca2ba8c3b8315d43febc6af939e18d5651b88aa36d8394cb6f5d` |
| NDJSON | synchronous delivery | `daff6c31ce9ab9ca1f7c2318eabc78e59b862f57e5bd14b8fc94d71285f32612` |
| NDJSON | final-record flush | `591765a6e749495faacab1b8863e86e14581f567f00d050073d465da83f8dab5` |

Before the first live run, deterministic fixture audit must prove:

1. every pristine workspace passes visible tests and fails hidden acceptance;
2. the debug reproduction emits its frozen structured pre-change observation;
3. reference repairs pass visible and hidden acceptance;
4. every mutant passes the original visible tests;
5. the reference candidate-test delta kills all 17 mutants; and
6. verifier execution restores the candidate workspace exactly.

## Frozen decisions

Quality and efficiency are separate; lower token use can never compensate for a failed task.

### Engineering-effect decision

PASS only if:

- both workflows pass all six executable task runs;
- every run passes visible tests, hidden acceptance, all semantic fault families, and changed-path scope checks;
- all six LeanPowers runs pass the frozen activation, routing, and quality-bearing workflow conformance checks;
- every Superpowers run reports activation; and
- neither workflow records a scope violation, unauthorized action, or evaluator-integrity failure.

Otherwise the engineering-effect decision is FAIL. Per-case outcomes and conformance are always reported separately so a formatting failure cannot be confused with an implementation failure.

### Aggregate model-token decision

The primary token statistic is:

`sum(LeanPowers model tokens across all six matched runs) / sum(Superpowers model tokens across all six matched runs)`

PASS only when the complete matrix has positive model-token telemetry for every matched pair and the aggregate share is at most `60%`. Individual pair shares, the paired median, maximum share, fresh-token use, wall time, tool calls, and workflow reads remain diagnostics. One individual pair may exceed `60%`; the frozen target applies to total use across the complete task mix.

The token decision is reported even if engineering quality fails, but it cannot authorize a positive overall claim. The outcome target is satisfied only when the engineering-effect decision passes and the aggregate token decision passes.

## Reporting boundary

This is a small confirmatory sample: two standard builds and one standard debug task on one model/runtime. Even a full PASS would be bounded evidence, not proof of universal equivalence, a full 11-scenario release result, or a claim that Superpowers is generally inferior. Raw transcripts stay local and are not committed; the repository may receive only sanitized run tables, decision evidence, limitations, and the exact frozen revision identifiers.
