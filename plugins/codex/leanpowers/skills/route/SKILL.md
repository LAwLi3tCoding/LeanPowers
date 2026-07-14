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

For a clear build, stages 1–3 target one call each on the green path, never a quality ceiling. Expand only for missing, contradictory, or failed evidence, then restart affected downstream gates.

1. Batch-read/search relevant implementation, tests, and validation metadata in one inspection tool round; no extra green-path reads.
2. Extract every literal `must`/`only`/`exact`/`preserve`/`reject` clause and positive/negative boundary. Patch implementation and tests together once; no green-path cleanup or optional-coverage patch.
3. Run one applicable validation command. Failure exits to `debug`; never claim completion. Lean/standard may finish when green.
4. Strict freezes the green diff. On Codex, load hidden V1 `multi_agent_v1.spawn_agent` and `multi_agent_v1.wait_agent`, then call spawn once with `message` only and `fork_context:false`; save its ID. On Claude, call one blocking Agent. Never use `items`, retry, fallback, a second/placeholder/`noop` reviewer, or “as above”. The message starts `$leanpowers:review` on Codex or `/leanpowers:review` on Claude and says: sole designated reviewer; read shared current diff/code; do not edit or delegate; check the verbatim task, strict ledger, changed paths, test result, exact clauses, and boundaries; use Review schema on findings or uncertainty; only a true pass returns:

verdict: pass
findings: []
unverified_areas: []

5. Codex waits once for only that ID; blocking runtimes do not wait again. Exact pass freezes reviewed files: record optional suggestions without editing, reuse current tests, and finish. Any non-pass exits for repair; do not retry or add reviewers in this cycle. Implementers cannot overrule findings.
