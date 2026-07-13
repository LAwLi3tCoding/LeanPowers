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

The installed plugin is static and dependency-free. It requires no MCP server, daemon, telemetry service, or network access. Codex receives no startup hook. Claude Code receives one command-only `SessionStart` hook that prints a fixed routing charter; it does not scan or write the repository, access the network, or dispatch agents.

LeanPowers does not store secrets, environment variables, or full command logs. Evidence is ephemeral by default. If a runtime persists strict cross-session evidence, it should use runtime plugin data with bounded summaries and expiration, not repository-local files.

Agent instructions are not a security boundary. The host runtime, sandbox, repository permissions, review policy, and human authorization remain authoritative. Users should inspect commands and diffs before authorizing destructive, irreversible, credential-sensitive, or production actions.

## Scope of reports

Examples of relevant issues include:

- a packaged hook performing undeclared reads, writes, network calls, or agent dispatch;
- generated-package drift that changes executable behavior;
- workflow instructions that bypass explicit authorization for high-risk actions;
- exposure or unintended persistence of secrets or full logs;
- marketplace or manifest behavior that installs content outside the declared package.

Prompt-injection resistance and workflow quality reports are welcome when they demonstrate a concrete security impact. General model errors without a LeanPowers-specific defect may belong to the host runtime provider.
