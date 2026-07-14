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

1. Use one green-path inspection tool call; on Codex, one shell command prints implementation/tests and validation metadata without guessed paths.
2. Before editing, output one concise clause→test ledger for every literal `must`/`only`/`exact`/`preserve`/`reject` and positive/negative boundary. Self-check; use one multi-file patch call for implementation and tests; never patch the same file twice on the green path.
3. Run one applicable validation command. Failure enters `debug`; never claim completion. Green lean/standard may finish; strict **MUST NOT answer**; continue below.

**Mandatory strict gate — final answer forbidden until exact pass**

4. Freeze the diff. Codex calls V1 `multi_agent_v1.spawn_agent` once (load if hidden) with `message` only and `fork_context:false`; save ID; load `multi_agent_v1.wait_agent` if hidden. Claude calls one blocking Agent. Never use `items`, retry, fallback, second/placeholder/`noop` reviewer, or “as above”. Copy the entire original user task verbatim and unchanged under `Original task:`. Before reviewer call replace every `{...}` in the matching template; never improvise, omit lines, or copy the `Codex message:`/`Claude message:` heading.

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

5. Codex calls wait once for only that ID; blocking runtimes do not wait again. Exact pass freezes reviewed files: record optional suggestions without editing, reuse tests, finish. Otherwise return incomplete or repair; no retry or added reviewer this cycle. Implementers cannot overrule findings.
