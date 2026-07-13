# LeanPowers AWB target draft review

The installed AWB initializer currently discovers `AGENTS.md`, `CLAUDE.md`, Claude agents, and Codex agent TOML files, but not Agent Skills. Running it directly against `plugins/codex/leanpowers` therefore returned `No agent files found`.

To preserve an actual initializer pass, the canonical reviewer and verifier TOML adapters were profiled from a temporary directory. The generated draft was then reviewed against the six real `SKILL.md` entrypoints and refined in `leanpowers-target.draft.yaml`. No installed AWB files were modified.

## Confirmed in the draft

- All six portable workflows are modeled as independent entrypoints and roles.
- Owner scopes match each workflow's responsibility.
- Unknown-cause repair, unverified delivery, and unauthorized high-risk delivery are forbidden routes.
- No repository-local state or mandatory artifact path is invented.
- The initial wall-clock and token budgets remain diagnostic defaults.

## Remaining before AWB registration

- Register the reviewed target in an AWB source checkout and adjust `root` relative to that checkout.
- Confirm allowed executables against the selected benchmark repositories; LeanPowers itself does not impose a Node-only project policy.
- Generate paired cases from the registered ContractModel.
- Run identical live Codex/Claude conditions for LeanPowers and Superpowers 6.1.1.
- Keep any simulated run diagnostic-only; it cannot satisfy the release gate.
