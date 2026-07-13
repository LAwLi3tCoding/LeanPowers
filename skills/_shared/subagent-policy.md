# Subagent policy

Default to one agent. Delegate only when at least two tasks are independent, independently verifiable, free of shared-file write conflicts, and worth the coordination cost.

- Split by delivery boundary, not by file.
- Use at most two or three direct children in normal work.
- Do not depend on recursive delegation.
- Keep implementation and high-risk review perspectives independent.
- Give each child an exact scope, acceptance evidence, and stop condition.
- Require conclusions, changed files, evidence, and blockers; omit full process logs.
- Verify child work from the shared workspace before accepting it.

If subagents are unavailable, continue in one agent without reducing quality gates.
