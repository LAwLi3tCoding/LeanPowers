# Workflow transitions

Start with one workflow and transition only when an observable condition requires it.

| Current | Condition | Next |
| --- | --- | --- |
| `shape` | Scope and acceptance are executable | `build` |
| `build` | Cause becomes unknown | `debug` |
| `build` | High-risk implementation is complete | `review` |
| `debug` | Root cause needs a larger change | `build` |
| `debug` | Minimal repair is complete | `verify` |
| `review` | Findings require change | `build` or `debug` |
| `review` | Verdict passes | `verify` |
| `review` | Required independent perspective is unavailable | `verify` with `incomplete` verdict; never `ship` |
| `verify` | Evidence fails | `build` or `debug` |
| `verify` | Delivery was requested and evidence passes | `ship` |

Do not invoke every downstream workflow by default.
