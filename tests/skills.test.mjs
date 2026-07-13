import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const skillsRoot = path.join(root, "skills");
const expectedSkills = ["build", "debug", "review", "shape", "ship", "verify"];

test("exactly six user-facing skills exist", async () => {
  const entries = await readdir(skillsRoot, { withFileTypes: true });
  const discovered = entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_"))
    .map((entry) => entry.name)
    .sort();

  assert.deepEqual(discovered, expectedSkills);
});

test("skill frontmatter is portable and descriptions are discovery-focused", async () => {
  const descriptions = new Set();

  for (const name of expectedSkills) {
    const content = await readFile(path.join(skillsRoot, name, "SKILL.md"), "utf8");
    const { frontmatter } = parseSkill(content);

    assert.deepEqual(Object.keys(frontmatter).sort(), ["description", "name"]);
    assert.equal(frontmatter.name, name);
    assert.match(frontmatter.description, /^Use when /);
    assert.ok(frontmatter.description.length <= 500);
    assert.equal(descriptions.has(frontmatter.description), false);
    descriptions.add(frontmatter.description);
  }
});

test("skill bodies stay within the LeanPowers context budget", async () => {
  let totalWords = 0;

  for (const name of expectedSkills) {
    const content = await readFile(path.join(skillsRoot, name, "SKILL.md"), "utf8");
    const words = wordCount(content);
    assert.ok(words <= 800, `${name} has ${words} words`);
    totalWords += words;
  }

  assert.ok(totalWords <= 5000, `all skills contain ${totalWords} words`);
});

test("skill references resolve and source contains no placeholders", async () => {
  for (const name of expectedSkills) {
    const skillPath = path.join(skillsRoot, name, "SKILL.md");
    const content = await readFile(skillPath, "utf8");
    assert.doesNotMatch(content, /\b(?:TBD|TODO|FIXME)\b|\[TODO:/i);

    for (const reference of content.matchAll(/\]\((\.\.\/\.\.\/references\/[^)]+)\)/g)) {
      const resolved = path.resolve(path.dirname(skillPath), reference[1]);
      assert.equal((await stat(resolved)).isFile(), true, `${reference[1]} is missing`);
    }
  }
});

test("the source set states every non-negotiable quality invariant", async () => {
  const files = [
    ...(await collectMarkdown(skillsRoot)),
    ...(await collectMarkdown(path.join(root, "references"))),
  ];
  const source = (
    await Promise.all(files.map((file) => readFile(file, "utf8")))
  ).join("\n");

  for (const phrase of [
    "current evidence",
    "root cause",
    "regression evidence",
    "declared scope",
    "independent review",
    "authorization",
    "validation gap",
  ]) {
    assert.match(source.toLowerCase(), new RegExp(phrase), `missing: ${phrase}`);
  }
});

function parseSkill(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n/);
  assert.ok(match, "missing YAML frontmatter");
  const frontmatter = {};
  for (const line of match[1].split("\n")) {
    const separator = line.indexOf(":");
    assert.notEqual(separator, -1, `invalid frontmatter line: ${line}`);
    const key = line.slice(0, separator).trim();
    frontmatter[key] = line.slice(separator + 1).trim();
  }
  return { frontmatter, body: content.slice(match[0].length) };
}

function wordCount(content) {
  return content.trim().split(/\s+/u).filter(Boolean).length;
}

async function collectMarkdown(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectMarkdown(fullPath)));
    } else if (entry.name.endsWith(".md")) {
      files.push(fullPath);
    }
  }
  return files;
}
