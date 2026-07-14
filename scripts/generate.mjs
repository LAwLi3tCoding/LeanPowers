import {
  access,
  chmod,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { projectRoot, readMetadata, stableJson } from "./lib/project.mjs";

const PACKAGE_ROOTS = [
  "plugins/codex/leanpowers",
  "plugins/claude/leanpowers",
];
const SKILLS = ["adapt", "build", "debug", "review", "route", "shape", "ship", "verify"];
const REFERENCES = [
  "evidence-protocol.md",
  "learning-policy.md",
  "quality-gates.md",
  "risk-policy.md",
  "subagent-policy.md",
  "workflow-transitions.md",
];
const PORTABLE_PACKAGE_FILES = [
  "LICENSE",
  "README.md",
  ...REFERENCES.map((name) => `references/${name}`),
  "schemas/learning-config.schema.json",
  "schemas/lesson-event.schema.json",
  ...SKILLS.flatMap((name) => [
    `skills/${name}/SKILL.md`,
    `skills/${name}/agents/openai.yaml`,
  ]),
  "skills/adapt/scripts/learning-core.mjs",
  "skills/adapt/scripts/learning-store.mjs",
  "skills/adapt/scripts/learning.mjs",
].sort();

export const PACKAGE_FILE_MANIFEST = Object.freeze({
  portable: Object.freeze(PORTABLE_PACKAGE_FILES),
  codex: Object.freeze([".codex-plugin/plugin.json"]),
  claude: Object.freeze([
    ".claude-plugin/plugin.json",
    "agents/reviewer.md",
    "agents/verifier.md",
    "hooks/hooks.json",
    "hooks/session-start",
  ]),
});

export function packageFileManifest(runtime) {
  if (runtime !== "codex" && runtime !== "claude") {
    throw new Error(`Unsupported package runtime: ${String(runtime)}`);
  }
  return [...PACKAGE_FILE_MANIFEST.portable, ...PACKAGE_FILE_MANIFEST[runtime]].sort();
}

export async function expectedArtifacts() {
  const metadata = await readMetadata();
  const common = {
    name: metadata.id,
    version: metadata.version,
    description: metadata.description,
    author: metadata.author,
    homepage: metadata.homepage,
    repository: metadata.repository,
    license: metadata.license,
    keywords: metadata.keywords,
  };

  const artifacts = new Map();
  const runtimeManifests = {
    codex: stableJson({
      ...common,
      skills: "./skills/",
      interface: metadata.interface,
    }),
    claude: stableJson(common),
  };
  artifacts.set(
    ".agents/plugins/marketplace.json",
    stableJson({
      name: metadata.marketplace.id,
      interface: { displayName: metadata.marketplace.displayName },
      plugins: [
        {
          name: metadata.id,
          source: {
            source: "local",
            path: "./plugins/codex/leanpowers",
          },
          policy: {
            installation: "AVAILABLE",
            authentication: "ON_INSTALL",
          },
          category: metadata.interface.category,
        },
      ],
    }),
  );
  artifacts.set(
    ".claude-plugin/marketplace.json",
    stableJson({
      name: metadata.marketplace.id,
      description: `${metadata.name}: ${metadata.tagline}`,
      owner: metadata.author,
      plugins: [
        {
          name: metadata.id,
          description: metadata.description,
          version: metadata.version,
          source: "./plugins/claude/leanpowers",
          author: metadata.author,
        },
      ],
    }),
  );

  const readme = packageReadme(
    await readFile(new URL("README.md", projectRoot), "utf8"),
    metadata.repository,
  );
  for (const runtime of ["codex", "claude"]) {
    const packageRoot = `plugins/${runtime}/leanpowers`;
    const manifest = runtime === "codex"
      ? ".codex-plugin/plugin.json"
      : ".claude-plugin/plugin.json";
    artifacts.set(`${packageRoot}/${manifest}`, runtimeManifests[runtime]);
    for (const file of PACKAGE_FILE_MANIFEST.portable) {
      if (file === "README.md") {
        artifacts.set(`${packageRoot}/${file}`, readme);
      } else {
        await addFile(artifacts, file, `${packageRoot}/${file}`);
      }
    }
  }
  for (const name of ["reviewer.md", "verifier.md"]) {
    await addFile(
      artifacts,
      `agent-specs/${name}`,
      `plugins/claude/leanpowers/agents/${name}`,
    );
  }
  for (const name of ["hooks.json", "session-start"]) {
    await addFile(
      artifacts,
      `adapters/claude/${name}`,
      `plugins/claude/leanpowers/hooks/${name}`,
    );
  }

  return artifacts;
}

export async function buildArtifacts({ check = false } = {}) {
  const artifacts = await expectedArtifacts();
  const changed = new Set();

  for (const [relativePath, expected] of artifacts) {
    const url = new URL(relativePath, projectRoot);
    const actual = await readIfPresent(url);
    const executable = relativePath === "plugins/claude/leanpowers/hooks/session-start";
    const modeMatches = !executable || (await isExecutable(url));
    if (actual === expected && modeMatches) {
      continue;
    }
    changed.add(relativePath);
  }

  const expectedPackagePaths = new Set(
    [...artifacts.keys()].filter(isPackageArtifact),
  );
  for (const packageRoot of PACKAGE_ROOTS) {
    const files = await listFilesIfPresent(new URL(`${packageRoot}/`, projectRoot));
    for (const file of files) {
      const relativePath = path.posix.join(packageRoot, file);
      if (!expectedPackagePaths.has(relativePath)) {
        changed.add(relativePath);
      }
    }
  }

  const changedPaths = [...changed].sort();
  if (check && changedPaths.length > 0) {
    throw new Error(`Generated artifacts are stale:\n${changedPaths.join("\n")}`);
  }

  if (!check) {
    const rebuildPackages = changedPaths.some(isPackageArtifact);
    if (rebuildPackages) {
      await replacePackagesAtomically(artifacts);
    }

    for (const [relativePath, expected] of artifacts) {
      if (isPackageArtifact(relativePath)) {
        continue;
      }
      if (!rebuildPackages && !changed.has(relativePath)) {
        continue;
      }
      if (rebuildPackages && !changed.has(relativePath)) {
        continue;
      }
      const url = new URL(relativePath, projectRoot);
      await mkdir(new URL("./", url), { recursive: true });
      await writeFile(url, expected, "utf8");
      if (relativePath === "plugins/claude/leanpowers/hooks/session-start") {
        await chmod(url, 0o755);
      }
    }
  }

  return { changed: changedPaths };
}

async function replacePackagesAtomically(artifacts) {
  const nonce = `${process.pid}-${Date.now()}`;
  const staged = [];

  try {
    for (const packageRoot of PACKAGE_ROOTS) {
      const packageUrl = new URL(`${packageRoot}/`, projectRoot);
      const parentUrl = new URL("../", packageUrl);
      const name = path.posix.basename(packageRoot);
      const stageUrl = new URL(`.${name}.stage-${nonce}/`, parentUrl);
      const backupUrl = new URL(`.${name}.backup-${nonce}/`, parentUrl);
      staged.push({ packageUrl, stageUrl, backupUrl });
      await rm(stageUrl, { force: true, recursive: true });
      await rm(backupUrl, { force: true, recursive: true });

      const expected = [...artifacts]
        .filter(([relativePath]) => relativePath.startsWith(`${packageRoot}/`))
        .map(([relativePath, content]) => [
          relativePath.slice(packageRoot.length + 1),
          content,
        ]);
      for (const [relativePath, content] of expected) {
        const outputUrl = new URL(relativePath, stageUrl);
        await mkdir(new URL("./", outputUrl), { recursive: true });
        await writeFile(outputUrl, content, "utf8");
        if (
          packageRoot === "plugins/claude/leanpowers" &&
          relativePath === "hooks/session-start"
        ) {
          await chmod(outputUrl, 0o755);
        }
      }
      await verifyStagedPackage(stageUrl, expected, packageRoot);
    }
    await commitStagedPackages(staged);
  } finally {
    for (const { stageUrl } of staged) {
      await rm(stageUrl, { force: true, recursive: true });
    }
  }
}

export async function commitStagedPackages(
  staged,
  operations = { exists, rename, rm },
) {
  const swapped = [];

  try {
    for (const entry of staged) {
      const hadPackage = await operations.exists(entry.packageUrl);
      if (hadPackage) {
        await operations.rename(entry.packageUrl, entry.backupUrl);
      }
      try {
        await operations.rename(entry.stageUrl, entry.packageUrl);
        swapped.push({ ...entry, hadPackage });
      } catch (swapError) {
        const restoreErrors = [];
        if (hadPackage) {
          try {
            await requireBackup(entry, operations);
            await operations.rename(entry.backupUrl, entry.packageUrl);
          } catch (restoreError) {
            restoreErrors.push(restoreError);
          }
        }
        if (restoreErrors.length > 0) {
          throw new AggregateError(
            [swapError, ...restoreErrors],
            "Package swap failed and rollback was incomplete; backup directories were preserved",
          );
        }
        throw swapError;
      }
    }
  } catch (error) {
    const rollbackErrors = [];
    for (const entry of [...swapped].reverse()) {
      try {
        if (entry.hadPackage) {
          await requireBackup(entry, operations);
        }
        await operations.rm(entry.packageUrl, { force: true, recursive: true });
        if (entry.hadPackage) {
          await operations.rename(entry.backupUrl, entry.packageUrl);
        }
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    }
    if (rollbackErrors.length > 0) {
      throw new AggregateError(
        [error, ...rollbackErrors],
        "Package swap failed and rollback was incomplete; backup directories were preserved",
      );
    }
    throw error;
  }

  const cleanupErrors = [];
  for (const entry of swapped) {
    try {
      await operations.rm(entry.backupUrl, { force: true, recursive: true });
    } catch (cleanupError) {
      cleanupErrors.push(cleanupError);
    }
  }
  if (cleanupErrors.length > 0) {
    throw new AggregateError(
      cleanupErrors,
      "Package swap committed but backup cleanup was incomplete; generated packages are current",
    );
  }
}

async function requireBackup(entry, operations) {
  if (!(await operations.exists(entry.backupUrl))) {
    throw new Error(`Package rollback backup is missing: ${entry.backupUrl}`);
  }
}

async function verifyStagedPackage(stageUrl, expected, packageRoot) {
  const expectedPaths = expected.map(([relativePath]) => relativePath).sort();
  const actualPaths = (await listFiles(stageUrl)).sort();
  if (JSON.stringify(actualPaths) !== JSON.stringify(expectedPaths)) {
    throw new Error(`Staged package file set is incomplete: ${packageRoot}`);
  }
  for (const [relativePath, content] of expected) {
    if ((await readFile(new URL(relativePath, stageUrl), "utf8")) !== content) {
      throw new Error(`Staged package content mismatch: ${packageRoot}/${relativePath}`);
    }
  }
  if (
    packageRoot === "plugins/claude/leanpowers" &&
    !(await isExecutable(new URL("hooks/session-start", stageUrl)))
  ) {
    throw new Error("Staged Claude hook is not executable");
  }
}

async function addFile(artifacts, sourcePath, outputPath) {
  artifacts.set(
    outputPath,
    await readFile(new URL(sourcePath, projectRoot), "utf8"),
  );
}

export function packageReadme(readme, repository) {
  return readme.replace(/\]\(([^)]+)\)/gu, (match, target) => {
    if (/^(?:https?:|mailto:|#)/u.test(target)) {
      return match;
    }
    const [file, anchor] = target.split("#", 2);
    const normalized = file.replace(/^\.\//u, "");
    const suffix = anchor ? `#${anchor}` : "";
    return `](${repository}/blob/main/${normalized}${suffix})`;
  });
}

async function listFiles(directoryUrl, prefix = "") {
  const entries = await readdir(directoryUrl, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const relativePath = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(new URL(`${entry.name}/`, directoryUrl), relativePath)));
    } else if (entry.isFile()) {
      files.push(relativePath);
    }
  }
  return files;
}

async function listFilesIfPresent(directoryUrl) {
  try {
    return await listFiles(directoryUrl);
  } catch (error) {
    if (error?.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

function isPackageArtifact(relativePath) {
  return PACKAGE_ROOTS.some(
    (packageRoot) =>
      relativePath === packageRoot || relativePath.startsWith(`${packageRoot}/`),
  );
}

async function isExecutable(url) {
  try {
    return ((await stat(url)).mode & 0o111) !== 0;
  } catch (error) {
    if (error?.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

async function readIfPresent(url) {
  try {
    await access(url);
    return await readFile(url, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function exists(url) {
  try {
    await access(url);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

async function main() {
  const check = process.argv.includes("--check");
  const { changed } = await buildArtifacts({ check });
  if (check) {
    console.log("Generated artifacts are current.");
  } else if (changed.length === 0) {
    console.log("No generated artifacts changed.");
  } else {
    console.log(`Updated ${changed.length} generated artifacts.`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
