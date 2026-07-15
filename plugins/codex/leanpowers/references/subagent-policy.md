# Subagent policy

Default to one agent. Delegate only when at least two tasks are independent, independently verifiable, free of shared-file write conflicts, and worth the coordination cost.

- Split by delivery boundary, not by file.
- Use at most two or three direct children in normal work.
- Do not depend on recursive delegation.
- Keep implementation and high-risk review perspectives independent.
- Give each child an exact scope, acceptance evidence, and stop condition.
- Require conclusions, changed files, evidence, and blockers; omit full process logs.
- Verify child work from the shared workspace before accepting it.

If subagents are unavailable, ordinary lean and standard work may continue in one agent without weakening the other quality gates. Strict or high-risk work still requires a genuinely independent agent, fresh session, qualified human, or external review result. If none is available, report the validation gap and do not pass `verify` or enter `ship`.

## Mandatory strict review protocol

Use only after route has a green VALIDATE. Final answer is forbidden until exact pass.

1. Freeze diff. Codex: if either V1/native tool is hidden, call exactly `tool_search(query="wait_agent targets spawn_agent fork_context", limit=2)`. Spawn only if its result exposes both; otherwise return incomplete before any spawn. Call `multi_agent_v1.spawn_agent` once with only `message`, `fork_context:false`; save ID, then call `multi_agent_v1.wait_agent` once with `targets:[ID]`. No other review-tool action. Claude calls one Agent. Never probe or use `items`, retry, fallback, second/placeholder/`noop`, or “as above”. Copy original task byte-for-byte—including case/punctuation—under `Original task:`. Spawn message MUST equal the filled template, starting at its invocation line; omit only the runtime label.

Codex message:

$leanpowers:review
Original task:
{entire original task}

Reviewer context:
Sole reviewer; read diff/code; do not edit/delegate.
Ledger: {one-line clause→boundary evidence; no task restatement}
Paths: {repository-relative changed paths}
Test: exit=0; command={exact validation command}
Return Review YAML raw—no JSON/fence/heading/prose. Pass: exactly these three lines:

verdict: pass
findings: []
unverified_areas: []

Claude message:

/leanpowers:review
Original task:
{entire original task}

Reviewer context:
Sole reviewer; read diff/code; do not edit/delegate.
Ledger: {one-line clause→boundary evidence; no task restatement}
Paths: {repository-relative changed paths}
Test: exit=0; command={exact validation command}
Return Review YAML raw—no JSON/fence/heading/prose. Pass: exactly these three lines:

verdict: pass
findings: []
unverified_areas: []

2. Read result. Exact pass freezes files; finish. Findings require repair/retest, then restart step 1 with a fresh reviewer and current Test result. Blocked/unavailable returns incomplete. Never rewait/retry a reviewer, add reviewers within a cycle, or overrule findings.
