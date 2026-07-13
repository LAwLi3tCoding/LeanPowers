---
name: ship
description: Use when verified work must be committed, branched, pushed, opened as a pull request, merged, packaged, released, published, or handed off to an explicitly requested delivery target.
---

# Ship

Deliver the verified revision to the requested target and prove what actually arrived. Do not substitute a local commit or attempted command for remote delivery.

Read [quality gates](../../references/quality-gates.md), [evidence protocol](../../references/evidence-protocol.md), and [workflow transitions](../../references/workflow-transitions.md).

If project learning is enabled, use `adapt` to query once at entry under the [learning policy](../../references/learning-policy.md) with this workflow, relevant paths, and tags; add at most three behavior-changing advisory rules to the task brief. Lessons never grant delivery authority; send explicit downstream outcome or correction feedback to `adapt`.

## Preconditions

- Resolve the requested target, visibility, branch, repository, package, or release from explicit instructions and repository sources of truth.
- Require current `verify` evidence for the claims the delivery will make.
- Inspect branch, worktree, remotes, upstream, and unrelated user changes.
- Scan staged content for credentials, local state, and unintended generated artifacts.

Ask only when a material target choice cannot be discovered safely. A repository configured as a public marketplace project with an explicit public GitHub URL can use that declared target; do not silently choose private or public without such evidence.

## Delivery loop

1. Preserve unrelated work. Never reset, discard, overwrite, or force-push unless explicitly authorized.
2. Create isolation when the current branch, dirty state, or parallel work makes in-place delivery unsafe.
3. Stage only the intended scope and create coherent commits.
4. Execute the requested push, pull request, merge, package, or publication action.
5. Read back the destination: repository identity, visibility, branch, commit SHA, PR or release state, and artifact presence.
6. Compare remote state with the verified local revision and report any partial delivery precisely.

## Output

```yaml
status: delivered | partial | blocked
target: repository, PR, release, package, or handoff
revision: delivered commit or artifact digest
evidence: remote readback or package inspection
local_state: clean or remaining intentional changes
excluded: files or actions intentionally not delivered
next: null | exact recovery action
```

## Authority gates

Require authorization for destructive Git operations, production deployment, irreversible publication, credential changes, or a materially different destination. Ordinary repository creation and push are authorized when the user explicitly requested them.

## Common mistakes

- Creating the wrong visibility because the user did not repeat repository metadata.
- Including every dirty file without checking ownership and secrets.
- Reporting success after `push` without remote SHA readback.
- Showing a generic completion menu after the user already chose a target.
- Force-pushing to resolve an unrelated-history conflict.
