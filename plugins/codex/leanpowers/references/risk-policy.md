# Risk policy

Use the highest applicable signal. Do not average risks down.

| Level | Signals | Default path |
| --- | --- | --- |
| `lean` | Clear, local, reversible, established validation, no public boundary | `build -> complete` with current applicable evidence; otherwise `verify` |
| `standard` | Normal feature, multi-file behavior, bounded uncertainty or dependency change | `shape(light, if unclear) -> build/debug -> complete` |
| `strict` | Security (including authentication, credentials/secrets, cryptography, signature verification), authorization, payment, privacy, migration, concurrency, production, irreversible change, large refactor | `shape(full, if unclear) -> build/debug -> review -> verify -> ship(if requested)` |

Strict is sticky until independent review and current verification pass. Upgrade when scope expands, validation fails, the cause is unknown, a public boundary changes, an external system is affected, or review finds high/critical risk. If classification is uncertain, use `standard`. User preference may increase rigor but cannot disable safety or evidence gates.
