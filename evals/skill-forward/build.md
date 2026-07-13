# Build forward test

Prompt: one child agent per file, implement first, add tests at the end.

Result: PASS.

Observed behavior after loading `build`:

- Rejected file-level delegation and end-loaded testing.
- Split work by six independently verifiable workflow outcomes.
- Required a failing or baseline signal before each implementation slice.
- Limited parallel children to independent, conflict-free boundaries.
- Preserved debug, review, and verify transitions.
