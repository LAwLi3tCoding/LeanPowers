# Subagent policy

Default to one agent. Delegate implementation only when work is independent, verifiable, conflict-free, and worth the coordination cost. Give each child exact scope, acceptance evidence, and stop condition; verify conclusions from the shared workspace.

Lean and standard work may continue without delegation. Strict work requires a genuinely independent agent, fresh session, qualified human, or external review result. If none is available, report the validation gap and do not pass `verify` or enter `ship`.

## Strict review internal phase

STRICT EXIT: green is not completion. After green validation, the implementer uses the runtime's native review mechanism to start one fresh read-only reviewer. This is an internal same-turn phase, never a user-facing workflow return. Provide the full original task, atomic ledger, all changed paths, and current validation commands/results. Wait for the completed Review YAML. The reviewer reads current diff, code, and tests; does not edit or delegate; and returns that verdict.

A pass satisfies the strict independent-review gate. Findings reopen the owning build/debug cycle: repair, revalidate, then use a fresh reviewer. Unavailable review is `blocked`; implementer text cannot overrule it. Any later file edit invalidates validation and review; no mutation follows pass. Read-only reporting does not invalidate either.
