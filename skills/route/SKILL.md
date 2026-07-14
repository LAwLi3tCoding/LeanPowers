---
name: route
description: Use when starting engineering work without a selected LeanPowers workflow; route plan, implement, fix, review, verify, or deliver requests to one lowest-safe owner.
---

# Route

Choose the lowest-safe owner. For a clear build, execute the capsule below. Otherwise load and execute the selected installed Skill once; do not use the build capsule.

`lean` means clear, local, reversible, validated work without a public boundary. `strict` means security (including authentication, credentials/secrets, cryptography, or signature verification), authorization, payment, privacy, migration, concurrency, production, irreversible work, or large refactor; otherwise use `standard`. Preference cannot lower risk.

Honor an explicit owner. Otherwise choose `adapt` for feedback, `verify` for evidence, `ship` for delivery, `review` for assessment, `debug` for unknown failure, `shape` for ambiguity, or `build` for executable change.

Before tools, output exactly four resolved lines, replacing placeholders; no fence, label, bullet, prefix, suffix, or prose:

entrypoint: leanpowers:route
workflow: OWNER
risk: RISK
required_gates: GATES

Strict `GATES` is `[independent_review, current_evidence]`; otherwise `[current_evidence]`.

For a clear build, stages 1–3 target one call each on the green path. They are not a quality ceiling: expand only for missing, contradictory, or failed evidence, then restart affected gates.

1. In one green-path inspection tool call, batch search, implementation, tests, and validation metadata. On Codex use one shell command; never search, then reread, then inspect metadata separately.
2. Extract every literal `must`/`only`/`exact`/`preserve`/`reject` clause and positive/negative boundary. Form the complete change first, then use one multi-file patch call for implementation and tests; never patch the same file twice on the green path.
3. Run one applicable validation command. Failure exits to `debug`; never claim completion. If green, lean/standard may finish; strict **MUST NOT answer** and immediately continues below.

**Mandatory strict gate — final answer forbidden until exact pass**

4. Immediately after validation, strict freezes the diff. On Codex call V1 `multi_agent_v1.spawn_agent` once, loading it if hidden, with `message` only and `fork_context:false`; save its ID and load `multi_agent_v1.wait_agent` if hidden. On Claude, call one blocking Agent. Never use `items`, retry, fallback, a second/placeholder/`noop` reviewer, or “as above”. The message starts `$leanpowers:review` on Codex or `/leanpowers:review` on Claude and says: sole designated reviewer; read shared current diff/code; do not edit or delegate; check the verbatim task, strict ledger, changed paths, test result, exact clauses, and boundaries; use Review schema on findings or uncertainty; only a true pass returns:

verdict: pass
findings: []
unverified_areas: []

5. Codex calls wait once for only that ID; blocking runtimes do not wait again. Exact pass freezes reviewed files: record optional suggestions without editing, reuse current tests, and finish. Without exact pass return incomplete or repair; do not retry or add reviewers in this cycle. Implementers cannot overrule findings.
