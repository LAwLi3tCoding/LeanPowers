---
name: shape
description: Use when an engineering request has material ambiguity, unclear scope, missing acceptance criteria, conflicting constraints, multiple architecture choices, or cross-component risk that must be bounded before implementation.
---

# Shape

Turn an unclear request into the smallest executable brief that preserves correctness. Do not turn clear work into a planning ceremony.

Inherit the routing ledger. If entered directly or the ledger is missing, read the [runtime contract](../../references/runtime-contract.md) once; do not reload it after transitions.

If project learning is enabled, use `adapt` to query once at entry under the [learning policy](../../references/learning-policy.md) with this workflow, relevant paths, and tags; add at most three behavior-changing advisory rules to the task brief. Send explicit downstream outcome, correction, confirmation, or durable-preference feedback to `adapt`.

## Workflow

1. Inspect repository instructions, current implementation, tests, and recent history before asking repository-answerable questions.
2. State the desired outcome, declared scope, constraints, acceptance evidence, and highest applicable risk level.
3. Use `light` shaping for bounded standard work. Use `full` shaping only when architecture, public contracts, irreversible choices, or strict risk require it.
   Full shaping for architecture applies only three seam checks: deletion test; interface is the test surface; one adapter is hypothetical; two adapters are real. Do not apply this gate to light shaping.
4. Make low-risk reversible assumptions explicit and continue. In default shaping, ask one consolidated question only when missing information materially changes the result or authority.
   On an explicit grill/stress-test request, walk only material decision dependencies. Ask one question per turn with a recommended answer and main tradeoff; incorporate the reply before continuing. Inspect the repository instead of asking repository-answerable questions. Stop when remaining branches cannot change scope, acceptance, architecture, risk, or authority.
5. Split work into one to five independently verifiable delivery slices. Split by outcome and interface, never by file or arbitrary time box.

## Output

```yaml
goal: one outcome
scope:
  include: explicit boundaries
  exclude: explicit non-goals
acceptance: observable proof of completion
constraints: hard requirements
risk: lean | standard | strict
assumptions: reversible assumptions made
slices:
  - outcome: independently reviewable result
    evidence: command or inspection that proves it
decision_needed: null | one material user decision
```

Keep the brief in conversation by default. Persist it only for strict, cross-session, or explicitly documented work.

## Decision gate

Pause only for a destructive or irreversible choice, missing credentials or authority, external production impact, or a material product decision with meaningfully different outcomes. Do not pause for ordinary local implementation details.

## Common mistakes

- Expanding “multi-runtime” into every known runtime instead of the declared V1 targets.
- Restating the request without defining evidence.
- Copying implementation code into a plan.
- Asking multiple rounds of questions that repository inspection could answer.
- Treating setup, each file, or each test as a separate delivery slice.

When the brief is executable, transition to `build`. If the request was already executable, skip shaping entirely.
