---
name: route
description: Use when starting engineering work without a selected LeanPowers workflow; route plan, implement, fix, review, verify, or deliver requests to one lowest-safe owner.
---

# Route

Choose the lowest-safe owner. Clear build: execute this capsule. Otherwise load and execute the selected installed Skill once; never use the build capsule.

`lean`: clear, local, reversible, validated, no public boundary. `strict`: security/authentication/credentials/secrets/cryptography/signatures, authorization, payment, privacy, migration, concurrency, production, irreversible work, or large refactor. Otherwise `standard`; preference cannot lower risk.

`OWNER`: explicit or `adapt` feedback, `verify` evidence, `ship` delivery, `review` assessment, `debug` unknown failure, `shape` ambiguity, `build` change; never a risk. `RISK`: `lean`, `standard`, or `strict`.

First message starts with these four lines; resolve `OWNER`, `RISK`, `GATES`; no fence, label, bullet, or prefix. Prose follows one blank line:

entrypoint: leanpowers:route
workflow: OWNER
risk: RISK
required_gates: GATES

Strict `GATES` is `[independent_review, current_evidence]`; otherwise `[current_evidence]`.

One-call stage targets are not quality ceilings. Expand only for missing, contradictory, or failed evidence; restart affected gates.

1. Green path: ONE shell call locates and prints full implementation, tests, validation metadata; never split reads.
2. Before editing, output a clause→test ledger for every literal `must`/`only`/`exact`/`preserve`/`reject`; each rejection mutates one property of an asserted-passing case. Use one repository-relative multi-file patch for code/tests; never repatch on the green path.
3. Run one applicable validation command. Failure enters `debug`; never claim completion. Green lean/standard may finish; strict **MUST NOT answer**; continue below.

**Mandatory strict gate — final answer forbidden until exact pass**

4. Freeze diff. Codex: if either V1/native tool is hidden, call exactly `tool_search(query="wait_agent targets spawn_agent fork_context", limit=2)`. Spawn only if its result exposes both; otherwise return incomplete before any spawn. Call `multi_agent_v1.spawn_agent` once with only `message`, `fork_context:false`; save ID, then call `multi_agent_v1.wait_agent` once with `targets:[ID]`. No other review-tool action. Claude calls one Agent. Never probe or use `items`, retry, fallback, second/placeholder/`noop`, or “as above”. Copy entire original task byte-for-byte—including case/punctuation—under `Original task:`. Spawn message MUST equal the filled template, starting at its invocation line; omit only the runtime label.

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

5. Read result. Exact pass freezes files; finish. Findings require repair/retest, then restart step 4 with a fresh reviewer and current Test result. Blocked/unavailable returns incomplete. Never rewait/retry a reviewer, add reviewers within a cycle, or overrule findings.
