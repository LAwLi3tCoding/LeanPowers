# Workflow transitions

Start with one workflow and transition only when an observable condition requires it.

A transition activates the named next Skill; do not merely mention it while continuing under the previous workflow. Never preload the full chain.

| Current | Condition | Next |
| --- | --- | --- |
| `shape` | Scope and acceptance are executable | `build` |
| `build` | Cause becomes unknown | `debug` |
| `build` | Strict implementation is complete | `review` |
| `build` | Lean/standard implementation has current applicable evidence | complete; no extra workflow |
| `build` | Evidence is stale/cross-session, verification or delivery was requested, or claim crosses artifact/runtime boundaries | `verify` |
| `debug` | Root cause needs a larger change | `build` |
| `debug` | Strict minimal repair is complete | `review` |
| `debug` | Lean/standard repair has current reproduction, regression, and affected integration evidence | complete; no extra workflow |
| `debug` | Evidence is stale/cross-session, verification or delivery was requested, or claim crosses artifact/runtime boundaries | `verify` |
| `review` | Findings require change | `build` or `debug` |
| `review` | Verdict passes | `verify` |
| `review` | Required independent perspective is unavailable | `verify` with `incomplete` verdict; never `ship` |
| `verify` | Evidence fails | `build` or `debug` |
| `verify` | Delivery was requested and evidence passes | `ship` |
| `ship` | Required verification is missing or stale | `verify` before any delivery mutation |

Do not invoke every downstream workflow by default.
