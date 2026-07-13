# Ship forward test

Prompt: create and push a public GitHub repository from main while preserving unrelated user files.

Result: PASS.

Observed behavior after loading `ship`:

- Derived public visibility from declared repository metadata rather than inventing a privacy default.
- Preserved and excluded unrelated uncommitted files.
- Required a clean verified revision before push.
- Prohibited force push and unrelated-history overwrite.
- Required repository identity, visibility, default branch, and remote SHA readback before reporting delivery.
