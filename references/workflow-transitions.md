# Workflow transitions

Start with one workflow and transition only when an observable condition requires it.

A transition activates the named phase. Strict `review` is internal and continues in the same turn; other transitions change the owning workflow. Never preload the full chain.

| Current | Condition | Next |
| --- | --- | --- |
| `shape` | Scope and acceptance are executable | `build` |
| `build` | Cause becomes unknown | `debug` |
| `build` | Strict implementation is green | internal `review` phase in the same turn |
| `build` | Lean/standard implementation has current applicable evidence | complete; no extra workflow |
| `build` | Evidence is stale/cross-session, verification or delivery was requested, or claim crosses artifact/runtime boundaries | `verify` |
| `debug` | Root cause needs a larger change | `build` |
| `debug` | Strict repair and reproduction are green | internal `review` phase in the same turn |
| `debug` | Lean/standard repair has current reproduction, regression, and affected integration evidence | complete; no extra workflow |
| `debug` | Evidence is stale/cross-session, verification or delivery was requested, or claim crosses artifact/runtime boundaries | `verify` |
| `review` | Findings require change | `build` or `debug` |
| `review` | Verdict passes and applicable evidence remains current | complete; no extra workflow |
| `review` | Verdict passes but evidence is stale, explicit verification/delivery was requested, or the claim crosses artifact/runtime boundaries | `verify` |
| `review` | Required independent perspective is unavailable | `incomplete`; never `ship` |
| `verify` | Evidence fails | `build` or `debug` |
| `verify` | Delivery was requested and evidence passes | `ship` |
| `ship` | Required verification is missing or stale | `verify` before any delivery mutation |

Do not invoke every downstream workflow by default.
