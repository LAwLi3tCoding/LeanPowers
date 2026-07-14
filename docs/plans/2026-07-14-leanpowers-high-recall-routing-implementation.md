# LeanPowers high-recall routing implementation plan

**Goal:** Add a compact automatic entry layer that improves trigger recall while preserving LeanPowers' one-workflow, risk-adaptive model.

1. Add failing tests for the portable `route` Skill, package parity, context budgets, and Claude hook recovery events.
2. Add `skills/route/SKILL.md` and its Codex UI metadata.
3. Include `route` in canonical generation and package validation.
4. Strengthen the Claude charter and transition policy without adding runtime side effects.
5. Regenerate both runtime packages and update current comparison documentation and exact word counts.
6. Run targeted tests, package validation, the complete test suite, privacy checks, and diff review.

**Stop condition:** All generated artifacts are current, all tests pass, and the diff contains no personal, local-path, company, credential, or unrelated workspace information.
