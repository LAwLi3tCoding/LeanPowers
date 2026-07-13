# Evidence protocol

For each completion claim record: revision fingerprint, command or inspection, supported scope, result, and concise summary.

- Reuse evidence only while its revision and supported scope remain unchanged.
- Invalidate affected evidence after code, configuration, generated-output, dependency, or environment changes.
- A documentation-only edit does not invalidate unrelated code evidence.
- `unavailable` is a validation gap, never a pass.
- Simulated evidence is diagnostic unless the claim itself concerns simulation.
- Keep full logs local; return only the lines needed to support the conclusion.

Ordinary work keeps this ledger in context. Persist only for strict or cross-session work, using runtime plugin data rather than repository files by default.
