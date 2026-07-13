# Security policy

## Supported versions

Security fixes are provided for the latest released LeanPowers version. Pre-release branches and historical tags may receive fixes at the maintainers' discretion.

## Report a vulnerability

Please use GitHub's **Report a vulnerability** flow in the repository Security tab to submit a private security advisory. Include:

- affected LeanPowers version or commit;
- affected runtime and version;
- minimal reproduction or malicious input;
- expected and observed behavior;
- impact, required permissions, and whether secrets or production state are involved;
- any safe mitigation already tested.

Do not open a public issue for an unpatched vulnerability. Do not include real credentials, private source, customer data, or unredacted logs in a report.

## Security model

The installed plugin requires no MCP server, daemon, telemetry service, network access, or third-party package installation. Its six engineering workflows remain dependency-free static instructions. Codex receives zero startup injection. Claude Code receives one command-only, read-only `SessionStart` hint; it prints fixed routing text and does not scan or write the repository, inspect learning state, access the network, or dispatch agents.

Adaptive learning is disabled by default. Installation and startup do not read or create `.leanpowers/`. A user must explicitly enable learning for one project before the bundled helper writes a project-local ledger. In Git repositories the helper adds `.leanpowers/` to the local path returned by `git rev-parse --git-path info/exclude`; it does not modify tracked `.gitignore` files. There is no global store, background process, network synchronization, telemetry, or cross-project sharing.

Enabled learning stores normalized rules and bounded evidence summaries, not raw conversations, complete prompts, command output, stack traces, secrets, credentials, environment-variable values, or unrelated repository content. Unsafe or materially ambiguous feedback is skipped. Lessons remain advisory and cannot authorize actions or lower safety, scope, risk, root-cause, regression, independent-review, or completion-evidence gates. Node.js 20+ is required only when learning is enabled; if it is unavailable, LeanPowers refuses enablement instead of creating best-effort state.

The package validator checks an exact file manifest, import containment, runtime isolation, and side-effect-free helper probes. These checks are defense-in-depth for trusted local and build artifacts, not an OS sandbox for executing untrusted packages. Validate provenance and inspect unfamiliar package contents before running any executable artifact.

Agent instructions are not a security boundary. The host runtime, sandbox, repository permissions, review policy, and human authorization remain authoritative. Users should inspect commands and diffs before authorizing destructive, irreversible, credential-sensitive, or production actions.

## Scope of reports

Examples of relevant issues include:

- a packaged hook performing undeclared reads, writes, network calls, or agent dispatch;
- learning state being read or written before explicit project opt-in, outside the resolved project, or without local Git exclusion;
- raw chats, logs, secrets, or unrelated repository content being persisted as a lesson;
- generated-package drift that changes executable behavior;
- workflow instructions that bypass explicit authorization for high-risk actions;
- exposure or unintended persistence of secrets or full logs;
- marketplace or manifest behavior that installs content outside the declared package.

Prompt-injection resistance and workflow quality reports are welcome when they demonstrate a concrete security impact. General model errors without a LeanPowers-specific defect may belong to the host runtime provider.
