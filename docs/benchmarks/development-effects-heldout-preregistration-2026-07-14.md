# Frozen held-out development-effects preregistration

Status: **frozen before the first live model run**.

This record separates confirmatory evidence from development calibration. The earlier `localized-template-cache` task informed LeanPowers routing and benchmark-parser changes, so later runs of that task are calibration evidence only. The `transient-profile-load` task has not informed LeanPowers workflow design and is reserved as one bounded held-out check.

Superpowers 6.1.1 is the upstream inspiration and comparison baseline. The purpose is to test whether LeanPowers preserves the outcome-critical safeguards on this task while using a smaller workflow, not to rank or diminish the upstream project.

## Frozen scope

| Item | Frozen value |
| --- | --- |
| Suite | `development-effects-heldout-2026-07-14` |
| Evidence level | `paired-development-heldout` |
| Scenario | `transient-profile-load` |
| Class / risk / owner | `unknown-cause-defect` / `standard` / `debug` |
| Repetitions | `2` |
| Order | repetition 1: Superpowers then LeanPowers; repetition 2: LeanPowers then Superpowers |
| Model / effort | `gpt-5.3-codex-spark` / `low` |
| Agent read isolation | `codex-minimal-workspace-plugin-toolchain-read-v1`: minimal system reads, disposable workspace writes, installed-plugin and package-runtime reads, private scratch writes, explicit auth denial, and no command network |
| Superpowers revision | `d884ae04edebef577e82ff7c4e143debd0bbec99` (`v6.1.1`) |
| LeanPowers revision | the clean commit containing this frozen suite; the runner must record the same immutable revision for every run |

The paired prompt, disposable workspace snapshot, hidden verifier, and semantic fault families are identical for both workflows. Each workflow is activated through its own installed top-level entrypoint before the shared task text. Before any live model task starts, the runner must fail closed unless (1) Codex's model-visible prompt rendered through the same `--profile benchmark` default-selection path reports the frozen workspace, scratch, network, and auth-denial boundary, and (2) a sandbox enforcement probe proves that Node, npm, Git, workspace reads and writes, and installed skill reads work while the evaluator sentinel, authentication file, and hidden verifier remain unreadable to model-generated commands.

## Frozen manifests

| Input | SHA-256 |
| --- | --- |
| Raw suite | `c71222bd29e0035b6fbf91a3239b2def89d54c479a367dfa370e7474091bd82f` |
| Workspace snapshot | `22f835d2a6b569ad8091c1690d9a5fe9ed388995d270852c58273ff933b24c8e` |
| Combined hidden-verifier snapshot | `3037cabd474d64fe7472ca7c0f1be1ddfaaccbee463e086f5c3e2ea1cca24cf2` |
| Combined fault-family snapshot | `d1af3fa78bd8d9182fece0749bdd0903d7cae650975d9205684be04e65422fb4` |
| `rejection-lifecycle` family | `91bf6ba056e8be56d3371c6dc2abefc0fe321e2bceca061af6ca4dd8915767dd` |
| `same-id-single-flight` family | `b7c9b27ee92e5da77ec7f7679432e2210a280ae3ae5da20e3bfe9d716f338fd9` |
| `fulfilled-reuse` family | `626fb6afd4b57048433e6f0b210e001640eb4d90f012516d7f0480e28e2b89aa` |

Automated tests bind these values to the exact checked-in inputs. The pristine fixture must pass its visible tests, reproduce the reported defect, and fail hidden acceptance. A reference repair must pass visible and hidden acceptance. Every registered mutant must survive the baseline tests and be killed by the candidate test delta; negative controls must distinguish the three fault families.

## Decision rules

The run matrix is usable only if all four runs complete against the frozen manifests and revisions.

- Engineering effect passes this bounded check only when both workflows pass both repetitions, LeanPowers passes its quality-bearing workflow conformance gates, and neither workflow violates scope.
- The `LeanPowers <= 60% of Superpowers model tokens` target passes only when telemetry exists for both matched pairs and the LeanPowers share is at most 60% in **every** pair. A median cannot hide an over-target pair.
- Fresh tokens, wall time, tool calls, and workflow reads remain diagnostics; they cannot compensate for a quality failure.
- A failed or nonconformant LeanPowers run remains a failure even if it is faster or cheaper.

After the first live model run starts, the task text, workflow route, workspace, hidden verifier, mutations, pairing order, and decision rules must not change. If a genuine oracle or harness defect is discovered, this case is invalidated and may be reused only as calibration; its repaired form cannot retain confirmatory status. Any workflow tuning informed by the result also converts future runs of this case to calibration evidence.

One standard/debug case cannot establish general non-inferiority. It can only confirm or reject the declared quality and token targets for this frozen task under the recorded runtime conditions.
