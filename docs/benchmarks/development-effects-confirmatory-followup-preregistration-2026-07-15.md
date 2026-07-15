# Follow-up confirmatory development-effects preregistration

Date frozen: 2026-07-15, before the first live model run.

Status: **inputs and decision rules frozen; no live result inspected**.

This follow-up evaluates whether the workflow changes motivated by the first confirmatory study improve LeanPowers' observable engineering discipline on new tasks while retaining its aggregate token advantage. The new tasks were not used to tune those changes. Superpowers 6.1.1 remains the respected upstream reference workflow whose engineering practices inspired LeanPowers; this is a bounded implementation comparison, not a contest or a claim of upstream inferiority.

## Frozen execution contract

| Field | Frozen value |
| --- | --- |
| Suite | `development-effects-confirmatory-followup-2026-07-15` |
| Suite SHA-256 | `e7bfb6dfbf5da73f5283057dbcb42dab03899fe64dcb6e043f8f3c315e3b9874` |
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

The runner must execute all `3 cases × 2 repetitions × 2 workflows = 12` runs. A partial matrix, changed revision, changed case snapshot, failed isolation preflight, missing model-token telemetry, or any post-freeze suite edit makes the result ineligible for the confirmatory decision.

## Frozen task matrix

| Case | Scenario | Risk | LeanPowers owner | Workspace SHA-256 | Hidden-verifier SHA-256 | Mutants SHA-256 |
| --- | --- | --- | --- | --- | --- | --- |
| `canonical-query-entries` | small explicit feature | standard | build | `5aacc749fb3553ccba41f4d7d780f3335ce21b8c53911807b1ad6a03916d5950` | `4e89ce74624384a267efc2c10ea7b814b3ac27e222d2a6ea01e87670410f3dc8` | `533ff272a4f5916d45c302eb211a692810f0f4c587931869ea9a2263f8c176a2` |
| `stable-task-batches` | small explicit feature | standard | build | `05fa508791cbcc6af3ccf252c3e38241a2a79128485a672e46aa1ef2fbc2ce15` | `9900ff60b179adde86232ed124f8b5f608b6a425a66c261cc0ff2e572c1785c7` | `18c04abf52e6fba3ec44196d73a51c9d282b314e9cbf726dd48b81f3d78c2dcb` |
| `per-key-expiry-cache` | unknown-cause cache defect | standard | debug | `65c656f70398f4408f4a13a686cba37e0a9b8405b3d2bedc31143cf2d2491489` | `3f51c2452355ee1c557c28473fef373fdcda4c6129b20c6d5bc63f00b24d1f0a` | `ff78ab8fe597351d4b1c4c80c81a2fe59579817ee4d3932a130fd8d49aa40bc9` |

These cases were designed only after the first confirmatory result and after the LeanPowers route changes had been implemented. The first suite is therefore calibration evidence for the workflow change; this new frozen suite is the first eligible follow-up evidence for that change. No result from these three tasks may be used to edit the workflow and then rerun this same suite as confirmatory evidence.

## Frozen semantic fault families

The 17 families contain 18 independent mutants. Every mutant must pass the original visible tests, and the candidate's added test delta must kill every member of every family.

| Case | Family | Members | Manifest SHA-256 |
| --- | --- | ---: | --- |
| canonical query | canonical entry order | 1 | `d02a786132503e279fa224d3e42170040bb25e0deed56622065f695a434a1b96` |
| canonical query | duplicate preservation | 1 | `ad495fc681281f296888b550d31fc71ecd64dd91dc47cd9eeb89f2d7828a4ac9` |
| canonical query | component encoding | 2 | `f770deefac10c38b61a4072735eabd2953af1085d2bf9a7006d6bfd15fd0c54c` |
| canonical query | encoded value order | 1 | `3245715ab5ab6031bd76c2102136f721e54a7dfab51103b323f69846041a0e3f` |
| canonical query | input immutability | 1 | `76da5fabcd4e065377fa2c59e41bed7d30b65d488b72a0e28767ac9b6d1923ac` |
| task batches | stable ready order | 1 | `5526a55a0153b89e76a4cfe00b03d7bf5d170abaad0e780fe07f17584e372b27` |
| task batches | dependency-level batching | 1 | `b53059e9f2be1dfea2f0715c5b4d2667d9e14f79cb56f807f444f5f100e5c9ee` |
| task batches | missing dependency validation | 1 | `20707cdd4210b6b14611bb7d62dea7941e4f75aacb136019d8824362201a9e16` |
| task batches | cycle validation | 1 | `40d96dd6d0443651da083f55c1e923dc276239fc706d4ab07180d55fe7ea5024` |
| task batches | duplicate ID validation | 1 | `234461899f503505f1e4555e3bcea5a730713f92903acfc6f793c6be987e0fe2` |
| task batches | input immutability | 1 | `06e490d163731a24016d20f341be5ffebdeffdd0bf46a17db5878aaeeaaea48d` |
| task batches | plain-record validation | 1 | `8cfa053c0b336eb0c196e53faee09dd4e45f8b97f2e56bdbf4412b18d09d7088` |
| expiry cache | per-key expiry | 1 | `b693e4c3c76fba93231e1b06cce18d55005733bd18ad88e614b6fdd121449113` |
| expiry cache | exact expiry boundary | 1 | `19d4216df6274a325801aa81066dc93cb7fe44d7113c63e64c07db4165d905cd` |
| expiry cache | zero TTL | 1 | `71106565e03f8378c2a2ce2e31efa772949cb58b8d35363494b2b9316491e859` |
| expiry cache | overwrite expiry | 1 | `fae09ca8a20a9a978ee21abade37dc3774c70ce26a0eb3cc3f055b2a672c09f2` |
| expiry cache | isolated eviction | 1 | `72c307ef5cb001f263ac8cdf115b7cea7149eef816db697cc78e897951ac0a28` |

Before the first live run, deterministic fixture audit must prove:

1. every pristine workspace passes visible tests and fails hidden acceptance;
2. the debug reproduction emits its frozen structured pre-change observation;
3. reference repairs pass visible and hidden acceptance;
4. every mutant passes the original visible tests;
5. the reference candidate-test delta kills all 18 mutants; and
6. verifier and mutation execution restore the candidate workspace exactly.

## Frozen decisions

Quality and efficiency are separate; lower token use can never compensate for a failed task.

### Engineering-effect decision

PASS only if:

- both workflows pass all six executable task runs;
- every run passes visible tests, hidden acceptance, all semantic fault families, and changed-path scope checks;
- all six LeanPowers runs pass the frozen activation, routing, and quality-bearing workflow conformance checks;
- every Superpowers run reports activation; and
- neither workflow records a scope violation, unauthorized action, or evaluator-integrity failure.

Otherwise the engineering-effect decision is FAIL. Per-case outcomes and conformance are reported separately so a workflow-evidence failure cannot be confused with an implementation failure.

### Aggregate model-token decision

The primary token statistic is:

`sum(LeanPowers model tokens across all six matched runs) / sum(Superpowers model tokens across all six matched runs)`

PASS only when the complete matrix has positive model-token telemetry for every matched pair and the aggregate share is at most `60%`. Individual pair shares, paired median, maximum share, fresh-token use, wall time, tool calls, and workflow reads remain diagnostics. One individual pair may exceed `60%`; the frozen target applies to total use across the complete task mix.

The token decision is reported even if engineering quality fails, but it cannot authorize a positive overall claim. The combined target is satisfied only when both the engineering-effect and aggregate-token decisions pass.

## Reporting boundary

This remains a small confirmatory sample: two standard build tasks and one standard debug task, with two repetitions on one model/runtime. Even a full PASS would be bounded evidence that the revised lightweight workflow improved under these conditions—not proof of universal equivalence, a full 11-scenario release result, or a claim that Superpowers is generally inferior. Raw transcripts stay local and are not committed; the repository may receive only sanitized run tables, decision evidence, limitations, and exact frozen revision identifiers.
