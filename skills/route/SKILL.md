---
name: route
description: Use when starting software engineering work and no specific LeanPowers workflow has already been selected, including requests to plan, implement, fix, review, verify, or deliver changes; select exactly one lowest-safe workflow before acting.
---

# Route

Select exactly one lowest-safe workflow that owns the task. Do not perform the engineering work in this Skill, preload every workflow, or create a mandatory chain.

## Selection

1. Honor an explicit LeanPowers choice only when its entry contract holds; otherwise select what establishes it.
2. Use `adapt` for explicit downstream feedback or project-learning maintenance.
3. Use `verify` for delivery without current evidence, or for completion, safety, readiness, or passing claims.
4. Use `ship` for delivery-only work with current verification evidence.
5. Use `review` for an independent assessment.
6. Use `debug` when a failure is unexpected and its cause is unknown or disputed.
7. Use `shape` when scope, acceptance, architecture, or authority is materially unclear.
8. Otherwise use `build` for an executable software change.

If no workflow applies, stop routing and answer normally. If two appear applicable, choose the earliest workflow that resolves the blocking uncertainty. Classify risk by the highest applicable signal in the selected workflow's risk policy.

Activate the selected Skill before acting. Later, activate only a documented next workflow when observable evidence satisfies its transition condition.
