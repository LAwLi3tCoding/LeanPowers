import {
  access,
  chmod,
  mkdir,
  readFile,
  readdir,
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
  artifacts.set(
    "plugins/codex/leanpowers/.codex-plugin/plugin.json",
    stableJson({
      ...common,
      skills: "./skills/",
      interface: metadata.interface,
    }),
  );
  artifacts.set(
    "plugins/claude/leanpowers/.claude-plugin/plugin.json",
    stableJson(common),
  );
  artifacts.set(
    ".agents/plugins/marketplace.json",
    stableJson({
      name: metadata.marketplace.id,
      interface: { displayName: metadata.marketplace.displayName },
      plugins: [
        {
          name: metadata.id,
          source: {
            source: "url",
            url: "./plugins/codex/leanpowers",
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

  await addTree(artifacts, "skills", "plugins/codex/leanpowers/skills");
  await addTree(artifacts, "skills", "plugins/claude/leanpowers/skills");
  await addTree(artifacts, "references", "plugins/codex/leanpowers/references");
  await addTree(artifacts, "references", "plugins/claude/leanpowers/references");
  await addFile(artifacts, "README.md", "plugins/codex/leanpowers/README.md");
  await addFile(artifacts, "README.md", "plugins/claude/leanpowers/README.md");
  await addFile(artifacts, "LICENSE", "plugins/codex/leanpowers/LICENSE");
  await addFile(artifacts, "LICENSE", "plugins/claude/leanpowers/LICENSE");
  await addTree(artifacts, "agent-specs", "plugins/claude/leanpowers/agents");
  await addTree(artifacts, "adapters/claude", "plugins/claude/leanpowers/hooks", {
    rename: new Map([["hooks.json", "hooks.json"], ["session-start", "session-start"]]),
  });

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
      for (const packageRoot of PACKAGE_ROOTS) {
        await rm(new URL(`${packageRoot}/`, projectRoot), {
          force: true,
          recursive: true,
        });
      }
    }

    for (const [relativePath, expected] of artifacts) {
      if (!rebuildPackages && !changed.has(relativePath)) {
        continue;
      }
      if (rebuildPackages && !isPackageArtifact(relativePath) && !changed.has(relativePath)) {
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

async function addTree(artifacts, sourceDirectory, outputDirectory, options = {}) {
  const sourceUrl = new URL(`${sourceDirectory}/`, projectRoot);
  const files = await listFiles(sourceUrl);
  for (const relativePath of files) {
    const outputName = options.rename?.get(relativePath) ?? relativePath;
    const content = await readFile(new URL(relativePath, sourceUrl), "utf8");
    artifacts.set(path.posix.join(outputDirectory, outputName), content);
  }
}

async function addFile(artifacts, sourcePath, outputPath) {
  artifacts.set(
    outputPath,
    await readFile(new URL(sourcePath, projectRoot), "utf8"),
  );
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
