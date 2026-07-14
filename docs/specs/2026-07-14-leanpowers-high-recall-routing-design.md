# LeanPowers high-recall routing design

## Outcome

Increase automatic LeanPowers discovery in Codex and Claude Code without adopting Superpowers' full bootstrap, 1% invocation threshold, or mandatory workflow chain.

## Decision

Add a portable `route` control Skill. Its metadata broadly matches the start of software engineering work and common intents such as plan, implement, fix, review, verify, and deliver. Its body remains at most 260 words and performs only one action: select exactly one lowest-safe owning workflow.

The six engineering workflows remain unchanged. `route` and `adapt` are control-plane Skills, not additional engineering stages.

## Runtime behavior

- Codex keeps zero startup injection. Native Skill metadata discovers `route`; the Skill then activates one specific workflow.
- Claude Code keeps a static, read-only `SessionStart` charter under 120 words. The hook runs on `startup`, `clear`, and `compact`, names `route`, and restores routing after context loss.
- Other Agent Skills runtimes may discover `route` through its portable frontmatter.

When a specific workflow already clearly owns a request, the runtime may invoke it directly and skip `route`. When no LeanPowers workflow applies, `route` exits and the agent answers normally.

## Routing order

Explicit compatible workflow choices win only when their entry contracts hold. Feedback learning uses `adapt`; unverified delivery and completion claims use `verify`; verified delivery-only work uses `ship`; independent assessment uses `review`; unknown failures use `debug`; material ambiguity uses `shape`; executable changes use `build`.

A workflow transition activates only the named next Skill after its observable condition is satisfied. No workflow preloads the full chain.

## Safety and efficiency constraints

- Keep current authorization, scope, root-cause, regression, independent-review, and current-evidence gates.
- Do not add a daemon, repository scan, network request, telemetry, or startup write.
- Do not use Superpowers' “1% chance” rule, “before any response” mandate, or anti-rationalization table.
- Keep `route` at no more than 260 words and the Claude startup script below 120 words.
- Preserve one-agent default and risk-triggered escalation.

## Acceptance evidence

1. Both generated packages contain source-identical `route` Skill files.
2. Tests prove broad engineering entry metadata, one-workflow selection, absence of coercive Superpowers language, and word budgets.
3. Hook validation requires `startup`, `clear`, and `compact`.
4. Package generation, validation, privacy scanning, and the full test suite pass.
