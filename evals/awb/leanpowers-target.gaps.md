# LeanPowers AWB target draft review

The installed AWB initializer currently discovers `AGENTS.md`, `CLAUDE.md`, Claude agents, and Codex agent TOML files, but not Agent Skills. Running it directly against `plugins/codex/leanpowers` therefore returned `No agent files found`.

To preserve an actual initializer pass, the canonical reviewer and verifier TOML adapters were profiled from a temporary directory. The generated draft was then reviewed against all seven canonical `SKILL.md` entrypoints and refined in `leanpowers-target.draft.yaml`. No installed AWB files were modified.

## Confirmed in the draft

- All seven canonical entrypoints are modeled: six portable engineering workflows and the separate `adapt` control Skill.
- Owner scopes match each workflow's responsibility.
- The learning owner is separate from engineering workflow ownership, so `adapt` is not modeled as a mandatory workflow stage.
- Unknown-cause repair, unverified delivery, and unauthorized high-risk delivery are forbidden routes.
- No mandatory learning artifact is invented: `.leanpowers/` is absent by default and exists only after explicit project opt-in.
- The initial wall-clock and token budgets remain diagnostic defaults.

## Remaining before AWB registration

- Register the reviewed target in an AWB source checkout and adjust `root` relative to that checkout.
- Confirm allowed executables against the selected benchmark repositories; LeanPowers itself does not impose a Node-only project policy.
- Generate paired cases from the registered ContractModel.
- Add the canonical four-turn `multi-turn-feedback-learning` case: wrong project assumption, explicit correction, related task, then unrelated task.
- Score the learning gates independently: related-task accuracy improves, unrelated-task contamination is zero, safety bypass is zero, and retrieval is capped at three lessons.
- Run identical live Codex/Claude conditions for LeanPowers and Superpowers 6.1.1.
- Keep checked-in and generated simulated runs diagnostic-only; they cannot satisfy the release gate.
