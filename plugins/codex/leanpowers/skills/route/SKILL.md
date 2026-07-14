---
name: route
description: Use when starting engineering work without a selected LeanPowers workflow; route plan, implement, fix, review, verify, or deliver requests to one lowest-safe owner.
---

# Route

Choose the lowest-safe owner. Clear build: execute this capsule. Otherwise load and execute the selected installed Skill once; never use the build capsule.

`lean`: clear, local, reversible, validated, no public boundary. `strict`: security (authentication, credentials/secrets, cryptography, signatures), authorization, payment, privacy, migration, concurrency, production, irreversible work, or large refactor. Otherwise `standard`; preference cannot lower risk.

Honor explicit owner; otherwise: `adapt` feedback, `verify` evidence, `ship` delivery, `review` assessment, `debug` unknown failure, `shape` ambiguity, `build` executable change.

First message starts with these four lines; resolve `OWNER`, `RISK`, `GATES`; no fence, label, bullet, or prefix. Prose follows one blank line:

entrypoint: leanpowers:route
workflow: OWNER
risk: RISK
required_gates: GATES

Strict `GATES` is `[independent_review, current_evidence]`; otherwise `[current_evidence]`.

Stages 1–3 target one call each, not a quality ceiling. Expand only for missing, contradictory, or failed evidence; restart affected gates.

1. Use one green-path inspection tool call; one shell command locates/prints implementation/tests and all validation metadata.
2. Before editing, output one concise clause→test ledger for every literal `must`/`only`/`exact`/`preserve`/`reject`; test rejections with one-property mutations of valid cases. Self-check; use one multi-file patch for code/tests; never repatch on the green path.
3. Run one applicable validation command. Failure enters `debug`; never claim completion. Green lean/standard may finish; strict **MUST NOT answer**; continue below.

**Mandatory strict gate — final answer forbidden until exact pass**

4. Freeze diff. Codex: before spawn, if either V1/native tool is hidden, call `tool_search` once (`spawn_agent wait_agent`, limit 2) to load both; if either remains unavailable, return incomplete. Call `multi_agent_v1.spawn_agent` once with only `message`, `fork_context:false`; save ID, then call `multi_agent_v1.wait_agent` once with `targets:[ID]`. No other review-tool action. Claude calls one blocking Agent. Never use `items`, retry, fallback, second/placeholder/`noop`, or “as above”. Copy the original task verbatim under `Original task:`. Replace every `{...}` in the matching template; never improvise, omit lines, or copy its heading.

Codex message:

$leanpowers:review
Original task:
{entire original task}

Reviewer context:
Sole reviewer; read diff/code; do not edit/delegate.
Ledger: {strict ledger, exact clauses, positive/negative boundaries}
Paths: {changed paths}
Test: {command and result}
Use Review schema on findings or uncertainty. Only a true pass returns:

verdict: pass
findings: []
unverified_areas: []

Claude message:

/leanpowers:review
Original task:
{entire original task}

Reviewer context:
Sole reviewer; read diff/code; do not edit/delegate.
Ledger: {strict ledger, exact clauses, positive/negative boundaries}
Paths: {changed paths}
Test: {command and result}
Use Review schema on findings or uncertainty. Only a true pass returns:

verdict: pass
findings: []
unverified_areas: []

5. Read that result; blocking runtimes do not wait again. Exact pass freezes files: record suggestions without editing, reuse tests, finish. Otherwise return incomplete or repair; no retry or added reviewer this cycle. Implementers cannot overrule findings.
