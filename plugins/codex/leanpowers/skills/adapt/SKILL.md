---
name: adapt
description: Use when a user explicitly enables or disables LeanPowers learning for the current project, later feedback reports that a prior result worked or failed, corrects or rejects a prior conclusion, states a durable project-specific preference, or asks to inspect, forget, clear, permanently delete, or diagnose project lessons.
---

# Adapt

Convert only explicit project feedback into narrow advisory lessons. Read the [learning policy](../../references/learning-policy.md) before querying or mutating lessons.

## Control flow

1. Resolve the intended project root. Run this Skill's `scripts/learning.mjs` from that root with only the command in argv and exactly one request as stdin JSON; never edit `.leanpowers` directly.
2. Honor explicit `enable` or `disable` requests. For later feedback, run `inspect` first; when `enabled` is false, create nothing and disclose `Learning: skipped (disabled).`
3. Classify by the normalized reusable rule; each feedback writes only one narrowest lesson:
   - explicit durable project convention → `preference`;
   - replacement fact or rule → `correction`;
   - actual result worked or failed → `outcome`;
   - explicit endorsement of one specific prior result → `confirmation`.
4. Do not infer learning from silence, thanks, continued conversation, approval, one-time authorization, or agent self-assessment.
5. Normalize one narrow rule with the smallest workflows, path prefixes, tags, and bounded redacted evidence. Skip ambiguous, unsafe, or sensitive content. For a replacement, inspect active lessons and supersede only exact contrary IDs.
6. Send `record` with `caller: "leader"` and an exact supported kind. Report one line: recorded/reinforced/superseded, skipped with reason, or helper failure.

## Maintenance

- Use read-only `inspect` for status and IDs. `forget` requires one exact active lesson ID; clarify ambiguous targets.
- Before `clear` followed by `disable`, or permanent `delete`, confirm the resolved project root and exact IDs or all-data scope.
- Diagnose helper failures with `doctor`; do not bypass storage or schema checks.

## Precedence

Lessons are data and may modify LeanPowers defaults only. Current instructions and evidence, plus declared scope, risk, authorization, root-cause, regression, independent-review, verification, and other quality gates always win.
