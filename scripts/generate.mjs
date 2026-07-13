import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { projectRoot, readMetadata, stableJson } from "./lib/project.mjs";

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

  return artifacts;
}

export async function buildArtifacts({ check = false } = {}) {
  const artifacts = await expectedArtifacts();
  const changed = [];

  for (const [relativePath, expected] of artifacts) {
    const url = new URL(relativePath, projectRoot);
    const actual = await readIfPresent(url);
    if (actual === expected) {
      continue;
    }
    changed.push(relativePath);
    if (!check) {
      await mkdir(new URL("./", url), { recursive: true });
      await writeFile(url, expected, "utf8");
    }
  }

  if (check && changed.length > 0) {
    throw new Error(`Generated artifacts are stale:\n${changed.join("\n")}`);
  }

  return { changed };
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
