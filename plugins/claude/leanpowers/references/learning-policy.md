# Learning policy

On an enabled engineering-workflow entry, issue one `query` with current workflow, safe relative paths, and tags. Put at most three relevant behavior-changing advisory rules in the task brief; suppress unrelated, expired, sensitive, or low-confidence lessons.

`scope.workflows` accepts only canonical values: `shape`, `build`, `debug`, `review`, `verify`, `ship`. Map synonyms to the owning workflow; testing uses `build`, `verify`, or both by use.

From the resolved project-root cwd, resolve `scripts/learning.mjs` relative to the installed `adapt` Skill; put only the command in argv and exactly one request as stdin JSON. Never edit `.leanpowers`.

| Command | Exact required stdin shape |
| --- | --- |
| `inspect`, `doctor` | `{}` |
| `query` | `{"workflow":"<canonical-workflow>","paths":["<safe-relative-path>"],"tags":["<tag>"]}` |
| `enable`, `disable` | `{"caller":"leader"}` |
| `record` | `{"caller":"leader","kind":"<kind>","scope":{"workflows":["<workflow>"],"path_prefixes":["<relative-prefix>"],"tags":["<tag>"]},"rule":"<rule>","evidence":{"source":"<source>","summary":"<summary>"}}` |
| `forget` | `{"caller":"leader","lesson_id":"<uuid>"}` |
| `clear` | `{"caller":"leader","all":true}` |
| `delete all` | `{"caller":"leader","all":true}` |
| `delete IDs` | `{"caller":"leader","lesson_ids":["<uuid>"]}` |

Record may add exact `supersedes` IDs and `expires_at`.

Lessons may adjust LeanPowers defaults only, never current instructions/evidence or scope, risk, authorization, root-cause, regression, independent-review, verification, or delivery-authority gates.
