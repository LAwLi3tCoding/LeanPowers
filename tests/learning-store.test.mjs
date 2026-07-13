import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFile as execFileCallback } from "node:child_process";
import {
  access,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  stat,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";

import {
  compactLedger,
  deleteLearning,
  disableProject,
  enableProject,
  readLearningState,
  recordCandidate,
  resolveProject,
} from "../skills/adapt/scripts/learning-store.mjs";

const execFile = promisify(execFileCallback);
const NOW = "2026-07-13T12:00:00.000Z";
const PROJECT_ID_PATTERN = /^sha256:[a-f0-9]{64}$/;
const EVENT_COUNT_LIMIT = 256;
const LEDGER_BYTE_LIMIT = 256 * 1024;
const POST_COMMIT_LOCK_WARNING = {
  code: "STORAGE_LOCK_CLEANUP_FAILED",
  phase: "post_commit",
  message: "Learning mutation committed, but its owned project lock could not be removed.",
};
const AFTER_FAILURE_LOCK_WARNING = {
  code: "STORAGE_LOCK_CLEANUP_FAILED",
  phase: "after_failure",
  message: "Learning mutation failed and its owned project lock could not be removed.",
};

const eventId = (sequence) =>
  `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`;

const lessonId = (sequence) =>
  `10000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`;

const activateEvent = (project, sequence = 1, overrides = {}) => ({
  schema_version: 1,
  event_id: eventId(sequence),
  project_id: project.projectId,
  recorded_at: `2026-07-13T${String(sequence % 24).padStart(2, "0")}:00:00.000Z`,
  action: "activate",
  lesson_id: lessonId(sequence),
  kind: "correction",
  scope: {
    workflows: ["debug"],
    path_prefixes: ["src/"],
    tags: ["storage"],
  },
  rule: `Keep project learning event ${sequence} local and transactional.`,
  evidence: {
    source: "explicit_user_feedback",
    summary: "A verified result established this bounded project rule.",
    revision: project.revision,
  },
  confidence: 0.9,
  supersedes: [],
  expires_at: null,
  ...overrides,
});

const serializeEvents = (events) =>
  events.length === 0 ? "" : `${events.map((event) => JSON.stringify(event)).join("\n")}\n`;

const sha256 = (text) => createHash("sha256").update(text).digest("hex");

async function temporaryDirectory(context, prefix = "leanpowers-store-") {
  const root = await mkdtemp(path.join(os.tmpdir(), prefix));
  context.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

async function git(directory, ...args) {
  return execFile("git", args, { cwd: directory, encoding: "utf8" });
}

async function createGitFixture(context, { origin = "git@github.com:owner/project.git" } = {}) {
  const root = await temporaryDirectory(context, "leanpowers-git-");
  await git(root, "init", "-q");
  await git(root, "config", "user.name", "LeanPowers Test");
  await git(root, "config", "user.email", "leanpowers@example.invalid");
  await writeFile(path.join(root, ".gitignore"), "dist/\n");
  await writeFile(path.join(root, "package.json"), '{"name":"fixture"}\n');
  await mkdir(path.join(root, "src"));
  await writeFile(path.join(root, "src", "index.mjs"), "export const value = 1;\n");
  await git(root, "add", ".");
  await git(root, "commit", "-qm", "fixture");
  if (origin !== null) {
    await git(root, "remote", "add", "origin", origin);
  }
  const excludePathText = (await git(root, "rev-parse", "--git-path", "info/exclude")).stdout.trim();
  return {
    root,
    excludePath: path.resolve(root, excludePathText),
  };
}

async function enabledFixture(context, options = {}) {
  const repo = await createGitFixture(context, options);
  const project = await resolveProject(repo.root, { caller: "leader" });
  await enableProject(project, NOW);
  return {
    ...repo,
    project,
    storePath: path.join(project.root, ".leanpowers"),
    configPath: path.join(project.root, ".leanpowers", "config.json"),
    ledgerPath: path.join(project.root, ".leanpowers", "lessons.jsonl"),
    archivePath: path.join(project.root, ".leanpowers", "archive"),
  };
}

async function readTree(root, encoding = "utf8") {
  const entries = [];
  const visit = async (directory, relative = "") => {
    for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      const relativePath = path.join(relative, entry.name);
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(absolutePath, relativePath);
      } else {
        entries.push([
          relativePath,
          await readFile(absolutePath, encoding === null ? undefined : encoding),
        ]);
      }
    }
  };
  await visit(root);
  return entries;
}

async function writeArchive(fixture, name, events) {
  await mkdir(fixture.archivePath, { recursive: true });
  await writeFile(path.join(fixture.archivePath, name), serializeEvents(events));
}

async function authenticateTransaction(fixture, artifactPath, kind) {
  const prefixName = kind === "initial" ? "tmp" : kind === "replacement" ? "replace" : kind;
  const prefix = `.leanpowers.${prefixName}-`;
  const transactionId = path.basename(artifactPath).slice(prefix.length);
  const owner = JSON.parse(
    await readFile(path.join(fixture.project.root, ".leanpowers.owner.json"), "utf8"),
  );
  await writeFile(
    `${artifactPath}.owner.json`,
    `${JSON.stringify({
      version: 1,
      kind,
      owner_id: owner.owner_id,
      project_id: fixture.project.projectId,
      transaction_id: transactionId,
    })}\n`,
  );
}

const privateOwnerPathFor = (project) =>
  project.privateOwnerPath ?? path.join(path.dirname(project.excludePath), "leanpowers-owner.json");

async function listTemporaryArtifacts(root) {
  const parent = path.dirname(root);
  const base = path.basename(root);
  return (await readdir(parent)).filter(
    (name) => name.startsWith(`${base}.tmp-`) || name.startsWith(`${base}.replace-`) || name.startsWith(`${base}.backup-`),
  );
}

function deferred() {
  let resolve;
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

test("ordinary Git resolution canonicalizes origin, root, revision, and dirty state", async (context) => {
  const repo = await createGitFixture(context, {
    origin: "https://token@example.com/owner/project.git",
  });
  const nested = path.join(repo.root, "src");
  const project = await resolveProject(nested, { caller: "leader" });
  const head = (await git(repo.root, "rev-parse", "HEAD")).stdout.trim();

  assert.equal(project.root, await realpath(repo.root));
  assert.equal(project.git, true);
  assert.equal(project.origin, "example.com/owner/project");
  assert.equal(project.revision, `git:${head}:clean`);
  assert.match(project.projectId, PROJECT_ID_PATTERN);
  assert.equal(JSON.stringify(project).includes("token"), false);

  await writeFile(path.join(repo.root, "src", "index.mjs"), "export const value = 2;\n");
  const dirty = await resolveProject(nested, { caller: "leader" });
  assert.equal(dirty.revision, `git:${head}:dirty`);
});

test("Git projects without origin use their real root identity", async (context) => {
  const first = await createGitFixture(context, { origin: null });
  const second = await createGitFixture(context, { origin: null });
  const firstProject = await resolveProject(first.root, { caller: "leader" });
  const secondProject = await resolveProject(second.root, { caller: "leader" });
  const expected = `sha256:${sha256(`git-path\0${await realpath(first.root)}`)}`;

  assert.equal(firstProject.origin, null);
  assert.equal(firstProject.projectId, expected);
  assert.notEqual(firstProject.projectId, secondProject.projectId);
});

test("linked worktrees resolve their own root and git-path exclude", async (context) => {
  const repo = await createGitFixture(context);
  const linked = await temporaryDirectory(context, "leanpowers-worktree-");
  await rm(linked, { recursive: true, force: true });
  await git(repo.root, "worktree", "add", "-qb", "linked-fixture", linked);
  const project = await resolveProject(linked, { caller: "leader" });
  const gitPath = (await git(linked, "rev-parse", "--git-path", "info/exclude")).stdout.trim();

  assert.equal(project.root, await realpath(linked));
  assert.equal(project.excludePath, path.resolve(linked, gitPath));
  await enableProject(project, NOW);
  assert.match(await readFile(project.excludePath, "utf8"), /^\.leanpowers\/$/m);
  assert.equal(await readFile(path.join(linked, ".gitignore"), "utf8"), "dist/\n");
});

test("non-Git resolution uses the workspace root and a content manifest revision", async (context) => {
  const workspace = await temporaryDirectory(context, "leanpowers-workspace-");
  const nested = path.join(workspace, "packages", "app");
  await mkdir(nested, { recursive: true });
  await writeFile(path.join(workspace, "package.json"), '{"name":"workspace"}\n');
  await writeFile(path.join(nested, "index.mjs"), "export default 1;\n");

  const first = await resolveProject(nested, { caller: "leader", workspaceRoot: workspace });
  assert.equal(first.root, await realpath(workspace));
  assert.equal(first.git, false);
  assert.equal(first.excludePath, null);
  assert.equal(first.projectId, `sha256:${sha256(`workspace\0${await realpath(workspace)}`)}`);
  assert.match(first.revision, /^workspace:[a-f0-9]{64}$/);

  await writeFile(path.join(nested, "index.mjs"), "export default 2;\n");
  const second = await resolveProject(nested, { caller: "leader", workspaceRoot: workspace });
  assert.notEqual(first.revision, second.revision);
});

test("non-Git manifest skips reserved directories at every depth", async (context) => {
  const workspace = await temporaryDirectory(context, "leanpowers-manifest-ignore-");
  const nested = path.join(workspace, "packages", "app");
  const ignoredFiles = [
    path.join(workspace, "packages", ".leanpowers", "lessons.jsonl"),
    path.join(workspace, "packages", ".git", "config"),
    path.join(workspace, "packages", "node_modules", "dependency", "index.mjs"),
  ];
  await mkdir(nested, { recursive: true });
  await writeFile(path.join(nested, "index.mjs"), "export default 1;\n");
  for (const file of ignoredFiles) {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, "ignored-one\n");
  }
  let ignoredReads = 0;
  const dependencies = {
    caller: "leader",
    workspaceRoot: workspace,
    fs: {
      async readFile(file, ...args) {
        if (/(?:^|[/\\])(?:\.leanpowers|\.git|node_modules)(?:[/\\]|$)/.test(String(file))) {
          ignoredReads += 1;
          throw new Error(`reserved manifest read: ${file}`);
        }
        return readFile(file, ...args);
      },
    },
  };

  const first = await resolveProject(nested, dependencies);
  for (const file of ignoredFiles) {
    await writeFile(file, "ignored-two\n");
  }
  const second = await resolveProject(nested, dependencies);

  assert.equal(ignoredReads, 0);
  assert.equal(second.revision, first.revision);
});

test("non-Git projects never use worktree owner data for cross-process recovery", async (context) => {
  const workspace = await temporaryDirectory(context, "leanpowers-nongit-owner-");
  await writeFile(path.join(workspace, "package.json"), '{"name":"workspace"}\n');
  const project = await resolveProject(workspace, {
    caller: "leader",
    workspaceRoot: workspace,
  });
  await enableProject(project, NOW);
  const fixture = {
    project,
    storePath: path.join(project.root, ".leanpowers"),
  };
  const replacement = `${fixture.storePath}.replace-nongit-residue`;
  await cp(fixture.storePath, replacement, { recursive: true });
  await authenticateTransaction(fixture, replacement, "replacement");
  const before = await readTree(replacement, null);

  await assert.rejects(
    readLearningState(project),
    (error) =>
      error.code === "STORAGE_RECOVERY_FAILED" && /non-Git transaction residue/.test(error.message),
  );
  assert.deepEqual(await readTree(replacement, null), before);
});

test("multi-root resolution selects the deepest workspace containing cwd", async (context) => {
  const outer = await temporaryDirectory(context, "leanpowers-multiroot-");
  const inner = path.join(outer, "packages", "service");
  const cwd = path.join(inner, "src");
  const unrelated = await temporaryDirectory(context, "leanpowers-unrelated-");
  await mkdir(cwd, { recursive: true });
  await writeFile(path.join(cwd, "index.mjs"), "export {};\n");

  const project = await resolveProject(cwd, {
    caller: "leader",
    workspaceRoots: [unrelated, outer, inner],
  });
  assert.equal(project.root, await realpath(inner));
});

test("enable uses git-path exclude idempotently and never changes tracked gitignore", async (context) => {
  const repo = await createGitFixture(context);
  const project = await resolveProject(repo.root);

  await enableProject(project, NOW);
  await enableProject(project, NOW);

  const exclude = await readFile(repo.excludePath, "utf8");
  assert.equal(exclude.match(/^\.leanpowers\/$/gm)?.length, 1);
  assert.equal(await readFile(path.join(repo.root, ".gitignore"), "utf8"), "dist/\n");
  assert.deepEqual(JSON.parse(await readFile(path.join(repo.root, ".leanpowers", "config.json"))), {
    schema_version: 1,
    enabled: true,
    project_id: project.projectId,
    enabled_at: NOW,
  });
});

test("enable creates one closed project-local random store owner identity", async (context) => {
  const repo = await createGitFixture(context);
  const project = await resolveProject(repo.root, { caller: "leader" });
  const ownerPath = path.join(project.root, ".leanpowers.owner.json");

  await enableProject(project, NOW);
  const first = JSON.parse(await readFile(ownerPath, "utf8"));
  await enableProject(project, NOW);
  const second = JSON.parse(await readFile(ownerPath, "utf8"));

  assert.deepEqual(Object.keys(first).sort(), ["owner_id", "project_id", "version"]);
  assert.equal(first.version, 1);
  assert.equal(first.project_id, project.projectId);
  assert.match(first.owner_id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  assert.deepEqual(second, first);
  assert.match(await readFile(repo.excludePath, "utf8"), /^\.leanpowers\.owner\.json$/m);
  assert.equal(await readFile(path.join(repo.root, ".gitignore"), "utf8"), "dist/\n");
});

test("legacy owner upgrade requires an artifact-free project root", async (context) => {
  const clean = await enabledFixture(context);
  const cleanOwner = path.join(clean.project.root, ".leanpowers.owner.json");
  await rm(cleanOwner);
  await enableProject(clean.project, NOW);
  assert.match(
    JSON.parse(await readFile(cleanOwner, "utf8")).owner_id,
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );

  const blocked = await enabledFixture(context);
  const blockedOwner = path.join(blocked.project.root, ".leanpowers.owner.json");
  const replacement = `${blocked.storePath}.replace-ownerless`;
  await cp(blocked.storePath, replacement, { recursive: true });
  await authenticateTransaction(blocked, replacement, "replacement");
  const beforeArtifact = await readTree(replacement, null);
  await rm(blockedOwner);

  await assert.rejects(
    enableProject(blocked.project, NOW),
    (error) => error.code === "STORAGE_RECOVERY_FAILED",
  );
  await assert.rejects(access(blockedOwner));
  assert.deepEqual(await readTree(replacement, null), beforeArtifact);
});

test("first Git opt-in rejects an exact preseeded worktree owner and transaction", async (context) => {
  const repo = await createGitFixture(context);
  const project = await resolveProject(repo.root, { caller: "leader" });
  const owner = {
    version: 1,
    project_id: project.projectId,
    owner_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  };
  const artifact = path.join(project.root, ".leanpowers.replace-preseed");
  const marker = `${artifact}.owner.json`;
  await writeFile(path.join(project.root, ".leanpowers.owner.json"), `${JSON.stringify(owner)}\n`);
  await mkdir(artifact);
  await writeFile(
    path.join(artifact, "config.json"),
    `${JSON.stringify({
      schema_version: 1,
      enabled: true,
      project_id: project.projectId,
      enabled_at: NOW,
    })}\n`,
  );
  await writeFile(path.join(artifact, "lessons.jsonl"), "");
  await writeFile(
    marker,
    `${JSON.stringify({
      version: 1,
      kind: "replacement",
      owner_id: owner.owner_id,
      project_id: project.projectId,
      transaction_id: "preseed",
    })}\n`,
  );
  const beforeArtifact = await readTree(artifact, null);
  const beforeMarker = await readFile(marker);

  await assert.rejects(
    enableProject(project, NOW),
    (error) =>
      error.code === "STORAGE_RECOVERY_FAILED" && /private owner identity/.test(error.message),
  );
  assert.deepEqual(await readTree(artifact, null), beforeArtifact);
  assert.deepEqual(await readFile(marker), beforeMarker);
  await assert.rejects(access(privateOwnerPathFor(project)));
  await assert.rejects(access(path.join(project.root, ".leanpowers")));
});

test("linked worktrees use distinct confined Git-private owner roots", async (context) => {
  const repo = await createGitFixture(context);
  const linked = await temporaryDirectory(context, "leanpowers-owner-worktree-");
  await rm(linked, { recursive: true, force: true });
  await git(repo.root, "worktree", "add", "-qb", "owner-linked-fixture", linked);
  const mainProject = await resolveProject(repo.root, { caller: "leader" });
  const linkedProject = await resolveProject(linked, { caller: "leader" });

  await enableProject(mainProject, NOW);
  await enableProject(linkedProject, NOW);
  const mainPrivate = privateOwnerPathFor(mainProject);
  const linkedPrivate = privateOwnerPathFor(linkedProject);
  const mainOwner = JSON.parse(await readFile(mainPrivate, "utf8"));
  const linkedOwner = JSON.parse(await readFile(linkedPrivate, "utf8"));

  assert.notEqual(mainPrivate, linkedPrivate);
  assert.deepEqual(
    JSON.parse(await readFile(path.join(mainProject.root, ".leanpowers.owner.json"), "utf8")),
    mainOwner,
  );
  assert.deepEqual(
    JSON.parse(await readFile(path.join(linkedProject.root, ".leanpowers.owner.json"), "utf8")),
    linkedOwner,
  );
  assert.equal(path.dirname(mainPrivate), mainProject.privateOwnerRoot);
  assert.equal(path.dirname(linkedPrivate), linkedProject.privateOwnerRoot);
  assert.equal(await realpath(mainProject.privateGitRoot), mainProject.privateGitRoot);
  assert.equal(await realpath(linkedProject.privateGitRoot), linkedProject.privateGitRoot);
});

test("tracked worktree owner or transaction artifacts are never trusted", async (context) => {
  const trackedOwner = await enabledFixture(context);
  await git(trackedOwner.project.root, "add", "-f", ".leanpowers.owner.json");
  await git(trackedOwner.project.root, "commit", "-qm", "track forged owner");
  await assert.rejects(
    recordCandidate(trackedOwner.project, activateEvent(trackedOwner.project, 97)),
    (error) =>
      error.code === "STORAGE_RECOVERY_FAILED" && /tracked learning metadata/.test(error.message),
  );

  const trackedArtifact = await enabledFixture(context);
  const replacement = `${trackedArtifact.storePath}.replace-tracked`;
  const marker = `${replacement}.owner.json`;
  await cp(trackedArtifact.storePath, replacement, { recursive: true });
  await authenticateTransaction(trackedArtifact, replacement, "replacement");
  await git(
    trackedArtifact.project.root,
    "add",
    "-f",
    path.basename(replacement),
    path.basename(marker),
  );
  await git(trackedArtifact.project.root, "commit", "-qm", "track forged transaction");
  const before = await readTree(replacement, null);
  await assert.rejects(
    readLearningState(trackedArtifact.project),
    (error) =>
      error.code === "STORAGE_RECOVERY_FAILED" && /tracked learning metadata/.test(error.message),
  );
  assert.deepEqual(await readTree(replacement, null), before);
});

test("Git-private owner malformed, symlinked, or missing with artifacts fails closed", async (context) => {
  const malformed = await enabledFixture(context);
  const malformedPrivate = privateOwnerPathFor(malformed.project);
  await writeFile(malformedPrivate, '{"version":1}\n');
  await assert.rejects(
    readLearningState(malformed.project),
    (error) => error.code === "STORAGE_RECOVERY_FAILED",
  );

  const linked = await enabledFixture(context);
  const linkedPrivate = privateOwnerPathFor(linked.project);
  const external = path.join(await temporaryDirectory(context, "leanpowers-private-owner-"), "owner.json");
  await cp(linkedPrivate, external);
  await rm(linkedPrivate);
  await symlink(external, linkedPrivate);
  const beforeExternal = await readFile(external);
  await assert.rejects(
    recordCandidate(linked.project, activateEvent(linked.project, 96)),
    (error) => error.code === "STORAGE_CONFINEMENT_FAILED",
  );
  assert.deepEqual(await readFile(external), beforeExternal);

  const missing = await enabledFixture(context);
  const replacement = `${missing.storePath}.replace-private-missing`;
  await cp(missing.storePath, replacement, { recursive: true });
  await authenticateTransaction(missing, replacement, "replacement");
  const beforeReplacement = await readTree(replacement, null);
  await rm(privateOwnerPathFor(missing.project));
  await assert.rejects(
    readLearningState(missing.project),
    (error) =>
      error.code === "STORAGE_RECOVERY_FAILED" && /private owner identity/.test(error.message),
  );
  assert.deepEqual(await readTree(replacement, null), beforeReplacement);
});

test("owner upgrade preserves and rejects an unknown owner temp artifact", async (context) => {
  const fixture = await enabledFixture(context);
  const ownerPath = path.join(fixture.project.root, ".leanpowers.owner.json");
  const unknownTemp = `${ownerPath}.tmp-user-data`;
  await rm(ownerPath);
  await writeFile(unknownTemp, "user-owned bytes\n");

  await assert.rejects(
    enableProject(fixture.project, NOW),
    (error) =>
      error.code === "STORAGE_RECOVERY_FAILED" &&
      /owner temp artifact/.test(error.message),
  );
  await assert.rejects(access(ownerPath));
  assert.equal(await readFile(unknownTemp, "utf8"), "user-owned bytes\n");
});

test("Git exclusion covers prepared replacements and retained backups", async (context) => {
  const fixture = await enabledFixture(context);
  const target = activateEvent(fixture.project, 1);
  await writeFile(fixture.ledgerPath, serializeEvents([target]));
  let preparedStatus = null;

  await assert.rejects(
    deleteLearning(fixture.project, { lessonIds: [target.lesson_id] }, {
      async afterPrepare() {
        preparedStatus = (
          await git(fixture.project.root, "status", "--porcelain", "--untracked-files=all")
        ).stdout;
      },
      fs: {
        async rename(source, destination) {
          if (
            String(source).includes(".leanpowers.replace-") ||
            String(source).includes(".leanpowers.backup-")
          ) {
            throw Object.assign(new Error("injected retained-backup failure"), { code: "EIO" });
          }
          return rename(source, destination);
        },
      },
    }),
    (error) => error.code === "STORAGE_ROLLBACK_FAILED",
  );

  const residueStatus = (
    await git(fixture.project.root, "status", "--porcelain", "--untracked-files=all")
  ).stdout;
  assert.equal(preparedStatus.includes(".leanpowers"), false);
  assert.equal(residueStatus.includes(".leanpowers"), false);
  const exclude = await readFile(fixture.excludePath, "utf8");
  for (const pattern of [
    ".leanpowers/",
    ".leanpowers.lock/",
    ".leanpowers.owner.json",
    ".leanpowers.owner.json.tmp-*",
    ".leanpowers.tmp-*/",
    ".leanpowers.tmp-*.owner.json",
    ".leanpowers.replace-*/",
    ".leanpowers.replace-*.owner.json",
    ".leanpowers.backup-*/",
    ".leanpowers.backup-*.owner.json",
  ]) {
    assert.equal(exclude.split(/\r?\n/).filter((line) => line === pattern).length, 1);
  }
});

test("enable exclusion failure leaves config and learning tree absent", async (context) => {
  const repo = await createGitFixture(context);
  const project = await resolveProject(repo.root);

  await assert.rejects(
    enableProject(project, NOW, {
      fs: {
        async rename(source, destination) {
          if (String(destination) === project.excludePath) {
            throw Object.assign(new Error("injected exclude failure"), { code: "EIO" });
          }
          return rename(source, destination);
        },
      },
    }),
    /injected exclude failure/,
  );

  await assert.rejects(access(path.join(project.root, ".leanpowers")));
  assert.equal(
    (await git(project.root, "status", "--porcelain", "--untracked-files=all")).stdout.includes(
      ".leanpowers",
    ),
    false,
  );
});

test("missing config returns disabled without creating state or reading a ledger", async (context) => {
  const repo = await createGitFixture(context);
  const project = await resolveProject(repo.root, { caller: "leader" });
  let ledgerReads = 0;

  const state = await readLearningState(project, {
    fs: {
      async readFile(file, ...args) {
        if (String(file).endsWith("lessons.jsonl")) ledgerReads += 1;
        return readFile(file, ...args);
      },
    },
  });

  assert.equal(state.config, null);
  assert.deepEqual(state.events, []);
  assert.deepEqual(state.active, []);
  assert.equal(state.code, "LEARNING_DISABLED");
  assert.equal(ledgerReads, 0);
  await assert.rejects(access(path.join(repo.root, ".leanpowers")));
});

test("disabled config is read but its ledger and archives remain untouched", async (context) => {
  const fixture = await enabledFixture(context);
  await recordCandidate(fixture.project, activateEvent(fixture.project));
  await disableProject(fixture.project, NOW);
  let learningDataReads = 0;

  const state = await readLearningState(fixture.project, {
    fs: {
      async readFile(file, ...args) {
        if (/lessons\.jsonl|archive/.test(String(file))) learningDataReads += 1;
        return readFile(file, ...args);
      },
    },
  });

  assert.equal(state.config.enabled, false);
  assert.equal(state.code, "LEARNING_DISABLED");
  assert.deepEqual(state.events, []);
  assert.equal(learningDataReads, 0);
});

test("config project mismatch stops retrieval and mutation before ledger access", async (context) => {
  const fixture = await enabledFixture(context);
  const config = JSON.parse(await readFile(fixture.configPath));
  config.project_id = `sha256:${"f".repeat(64)}`;
  await writeFile(fixture.configPath, `${JSON.stringify(config)}\n`);
  let ledgerReads = 0;

  await assert.rejects(
    readLearningState(fixture.project, {
      fs: {
        async readFile(file, ...args) {
          if (String(file).endsWith("lessons.jsonl")) ledgerReads += 1;
          return readFile(file, ...args);
        },
      },
    }),
    (error) => error.code === "PROJECT_MISMATCH",
  );
  await assert.rejects(
    recordCandidate(fixture.project, activateEvent(fixture.project)),
    (error) => error.code === "PROJECT_MISMATCH",
  );
  assert.equal(ledgerReads, 0);
});

test("every mutation rejects non-leader callers", async (context) => {
  const repo = await createGitFixture(context);
  const leader = await resolveProject(repo.root, { caller: "leader" });
  const worker = { ...leader, caller: "worker" };

  await assert.rejects(enableProject(worker, NOW), (error) => error.code === "LEADER_REQUIRED");
  await enableProject(leader, NOW);
  const candidate = activateEvent(leader);
  for (const operation of [
    () => disableProject(worker, NOW),
    () => recordCandidate(worker, candidate),
    () => compactLedger(worker),
    () => deleteLearning(worker, { lessonIds: [candidate.lesson_id] }),
  ]) {
    await assert.rejects(operation(), (error) => error.code === "LEADER_REQUIRED");
  }
});

test("persisted config and events contain no raw project path", async (context) => {
  const fixture = await enabledFixture(context, { origin: null });
  await recordCandidate(fixture.project, activateEvent(fixture.project));

  assert.equal(JSON.stringify(await readTree(fixture.storePath)).includes(fixture.project.root), false);
  assert.equal((await readFile(fixture.configPath, "utf8")).includes(fixture.project.root), false);
  assert.equal((await readFile(fixture.ledgerPath, "utf8")).includes(fixture.project.root), false);
});

test("a single concurrent mutation triggers a complete re-read and successful retry", async (context) => {
  const fixture = await enabledFixture(context);
  let attempts = 0;
  const candidate = activateEvent(fixture.project);

  const result = await recordCandidate(fixture.project, candidate, {
    async beforeCommit() {
      attempts += 1;
      if (attempts === 1) {
        await writeFile(path.join(fixture.storePath, "concurrent-marker"), "one\n");
      }
    },
  });

  assert.equal(result.status, "recorded");
  assert.equal(attempts, 2);
  assert.deepEqual((await readLearningState(fixture.project)).events, [candidate]);
  assert.equal(await readFile(path.join(fixture.storePath, "concurrent-marker"), "utf8"), "one\n");
  assert.deepEqual(await listTemporaryArtifacts(fixture.storePath), []);
});

test("a second concurrent mutation fails without losing the original ledger", async (context) => {
  const fixture = await enabledFixture(context);
  const original = activateEvent(fixture.project, 1);
  const candidate = activateEvent(fixture.project, 2);
  await recordCandidate(fixture.project, original);
  let attempts = 0;

  await assert.rejects(
    recordCandidate(fixture.project, candidate, {
      async beforeCommit() {
        attempts += 1;
        await writeFile(path.join(fixture.storePath, "concurrent-marker"), `${attempts}\n`);
      },
    }),
    (error) => error.code === "WRITE_CONFLICT" && /write conflict/i.test(error.message),
  );

  assert.equal(attempts, 2);
  assert.deepEqual((await readLearningState(fixture.project)).events, [original]);
  assert.deepEqual(await listTemporaryArtifacts(fixture.storePath), []);
});

test("two writers cannot both commit snapshots from the same digest", async (context) => {
  const fixture = await enabledFixture(context);
  const first = activateEvent(fixture.project, 1);
  const second = activateEvent(fixture.project, 2);
  const firstPrepared = deferred();
  const releaseFirst = deferred();

  const firstWrite = recordCandidate(fixture.project, first, {
    async afterPrepare() {
      firstPrepared.resolve();
      await releaseFirst.promise;
    },
  });
  await firstPrepared.promise;
  const secondResult = await Promise.allSettled([
    recordCandidate(fixture.project, second),
  ]);
  releaseFirst.resolve();
  await firstWrite;

  assert.equal(secondResult[0].status, "rejected");
  assert.equal(secondResult[0].reason.code, "WRITE_CONFLICT");
  assert.deepEqual(
    (await readLearningState(fixture.project)).events,
    [first],
  );
});

test("post-commit lock cleanup failure returns truthful success for every tree mutation", async (context) => {
  const cases = [
    {
      name: "enable",
      async arrange() {
        const repo = await createGitFixture(context);
        const project = await resolveProject(repo.root, { caller: "leader" });
        return {
          project,
          invoke: (dependencies) => enableProject(project, NOW, dependencies),
          async assertCommitted() {
            assert.equal(
              JSON.parse(await readFile(path.join(project.root, ".leanpowers", "config.json"))).enabled,
              true,
            );
          },
        };
      },
    },
    ...["record", "disable"].map((name, index) => ({
      name,
      async arrange() {
        const fixture = await enabledFixture(context);
        const candidate = activateEvent(fixture.project, 90 + index);
        return {
          project: fixture.project,
          invoke: (dependencies) =>
            name === "record"
              ? recordCandidate(fixture.project, candidate, dependencies)
              : disableProject(fixture.project, NOW, dependencies),
          async assertCommitted() {
            if (name === "record") {
              const events = (await readFile(fixture.ledgerPath, "utf8"))
                .trim()
                .split("\n")
                .filter(Boolean)
                .map((line) => JSON.parse(line));
              assert.deepEqual(events, [candidate]);
            } else {
              assert.equal(JSON.parse(await readFile(fixture.configPath)).enabled, false);
            }
          },
        };
      },
    })),
  ];

  for (const lockCase of cases) {
    await context.test(lockCase.name, async () => {
      const fixture = await lockCase.arrange();
      const result = await fixture.invoke({
        fs: {
          async unlink(target) {
            if (String(target).endsWith(".leanpowers.lock/owner.json")) {
              throw Object.assign(new Error("injected lock owner unlink failure"), { code: "EIO" });
            }
            return unlink(target);
          },
        },
      });

      assert.deepEqual(result.cleanup_warnings, [POST_COMMIT_LOCK_WARNING]);
      await fixture.assertCommitted();
      await assert.rejects(
        disableProject(fixture.project, NOW),
        (error) => error.code === "WRITE_CONFLICT",
      );
      assert.equal(
        JSON.parse(
          await readFile(path.join(fixture.project.root, ".leanpowers.lock", "owner.json")),
        ).kind,
        "lock",
      );
    });
  }
});

test("primary mutation failure survives a secondary lock cleanup failure", async (context) => {
  const fixture = await enabledFixture(context);
  const before = await readTree(fixture.storePath, null);
  let captured;

  try {
    await recordCandidate(fixture.project, activateEvent(fixture.project, 95), {
      async afterPrepare({ preparedPath }) {
        await writeFile(path.join(preparedPath, "lessons.jsonl"), "invalid\n");
      },
      fs: {
        async unlink(target) {
          if (String(target).endsWith(".leanpowers.lock/owner.json")) {
            throw Object.assign(new Error("injected lock owner unlink failure"), { code: "EIO" });
          }
          return unlink(target);
        },
      },
    });
  } catch (error) {
    captured = error;
  }

  assert.equal(captured?.code, "INVALID_LEARNING_STATE");
  assert.deepEqual(captured?.cleanup_warnings, [AFTER_FAILURE_LOCK_WARNING]);
  assert.deepEqual(await readTree(fixture.storePath, null), before);
  await assert.rejects(
    disableProject(fixture.project, NOW),
    (error) => error.code === "WRITE_CONFLICT",
  );
});

test("store and direct state symlinks fail closed without changing external bytes", async (context) => {
  const cases = [
    {
      name: "enable store root",
      async arrange() {
        const repo = await createGitFixture(context);
        const project = await resolveProject(repo.root, { caller: "leader" });
        const external = await temporaryDirectory(context, "leanpowers-external-enable-");
        const sentinel = path.join(external, "sentinel.txt");
        await writeFile(sentinel, "external-enable\n");
        await symlink(external, path.join(project.root, ".leanpowers"));
        return { project, sentinel, invoke: () => enableProject(project, NOW) };
      },
    },
    {
      name: "read config",
      async arrange() {
        const fixture = await enabledFixture(context);
        const external = path.join(await temporaryDirectory(context, "leanpowers-external-read-"), "config.json");
        await cp(fixture.configPath, external);
        await rm(fixture.configPath);
        await symlink(external, fixture.configPath);
        return { project: fixture.project, sentinel: external, invoke: () => readLearningState(fixture.project) };
      },
    },
    {
      name: "disable config",
      async arrange() {
        const fixture = await enabledFixture(context);
        const external = path.join(await temporaryDirectory(context, "leanpowers-external-disable-"), "config.json");
        await cp(fixture.configPath, external);
        await rm(fixture.configPath);
        await symlink(external, fixture.configPath);
        return { project: fixture.project, sentinel: external, invoke: () => disableProject(fixture.project, NOW) };
      },
    },
    ...["record", "delete"].map((name, index) => ({
      name: `${name} ledger`,
      async arrange() {
        const fixture = await enabledFixture(context);
        const existing = activateEvent(fixture.project, 10 + index);
        const external = path.join(await temporaryDirectory(context, `leanpowers-external-${name}-`), "lessons.jsonl");
        await writeFile(external, serializeEvents([existing]));
        await rm(fixture.ledgerPath);
        await symlink(external, fixture.ledgerPath);
        return {
          project: fixture.project,
          sentinel: external,
          invoke: () =>
            name === "record"
              ? recordCandidate(fixture.project, activateEvent(fixture.project, 20 + index))
              : deleteLearning(fixture.project, { lessonIds: [existing.lesson_id] }),
        };
      },
    })),
  ];

  for (const fixtureCase of cases) {
    await context.test(fixtureCase.name, async () => {
      const fixture = await fixtureCase.arrange();
      const before = await readFile(fixture.sentinel);
      await assert.rejects(
        fixture.invoke(),
        (error) => error.code === "STORAGE_CONFINEMENT_FAILED",
      );
      assert.deepEqual(await readFile(fixture.sentinel), before);
    });
  }
});

test("rename failure removes the sibling temporary file and preserves the ledger", async (context) => {
  const fixture = await enabledFixture(context);
  const original = activateEvent(fixture.project, 1);
  await recordCandidate(fixture.project, original);

  await assert.rejects(
    recordCandidate(fixture.project, activateEvent(fixture.project, 2), {
      fs: {
        async rename(source, destination) {
          if (
            String(source).includes(".leanpowers.replace-") &&
            String(destination).endsWith(".leanpowers")
          ) {
            throw Object.assign(new Error("injected rename failure"), { code: "EIO" });
          }
          return rename(source, destination);
        },
      },
    }),
    /injected rename failure/,
  );

  assert.deepEqual((await readLearningState(fixture.project)).events, [original]);
  assert.deepEqual(await listTemporaryArtifacts(fixture.storePath), []);
});

test("prepared-state validation failure cleans up without changing the source", async (context) => {
  const fixture = await enabledFixture(context);
  const original = activateEvent(fixture.project, 1);
  await recordCandidate(fixture.project, original);

  await assert.rejects(
    recordCandidate(fixture.project, activateEvent(fixture.project, 2), {
      async afterPrepare({ preparedPath }) {
        await writeFile(path.join(preparedPath, "lessons.jsonl"), "not-json\n");
      },
    }),
    (error) => error.code === "INVALID_LEARNING_STATE",
  );

  assert.deepEqual((await readLearningState(fixture.project)).events, [original]);
  assert.deepEqual(await listTemporaryArtifacts(fixture.storePath), []);
});

test("compaction uses strict event-count threshold and archives inactive history", async (context) => {
  const fixture = await enabledFixture(context);
  const atLimit = Array.from({ length: EVENT_COUNT_LIMIT }, (_, index) =>
    activateEvent(fixture.project, index + 1),
  );
  await writeFile(fixture.ledgerPath, serializeEvents(atLimit));

  const unchanged = await compactLedger(fixture.project, { now: () => NOW });
  assert.equal(unchanged.status, "unchanged");
  assert.equal((await readLearningState(fixture.project)).events.length, EVENT_COUNT_LIMIT);
  await assert.rejects(access(fixture.archivePath));

  const clear = {
    schema_version: 1,
    event_id: eventId(EVENT_COUNT_LIMIT + 1),
    project_id: fixture.project.projectId,
    recorded_at: NOW,
    action: "clear",
  };
  await writeFile(fixture.ledgerPath, serializeEvents([...atLimit, clear]));
  const compacted = await compactLedger(fixture.project, { now: () => NOW });
  assert.equal(compacted.status, "compacted");
  assert.deepEqual((await readLearningState(fixture.project)).events, []);
  const archives = await readdir(fixture.archivePath);
  assert.equal(archives.length, 1);
  assert.equal((await readFile(path.join(fixture.archivePath, archives[0]), "utf8")).split("\n").filter(Boolean).length, EVENT_COUNT_LIMIT + 1);
});

test("compaction preserves complete reinforced active lesson semantics", async (context) => {
  const fixture = await enabledFixture(context);
  const activation = activateEvent(fixture.project, 1);
  const reinforcements = Array.from({ length: EVENT_COUNT_LIMIT }, (_, index) => ({
    schema_version: 1,
    event_id: eventId(index + 2),
    project_id: fixture.project.projectId,
    recorded_at: NOW,
    action: "reinforce",
    lesson_id: activation.lesson_id,
    evidence: {
      source: "verified_outcome",
      summary: "A later verified outcome supplied the latest bounded evidence.",
      revision: fixture.project.revision,
    },
    confidence: 0.95,
  }));
  await writeFile(fixture.ledgerPath, serializeEvents([activation, ...reinforcements]));
  const before = structuredClone((await readLearningState(fixture.project)).active);

  assert.equal((await compactLedger(fixture.project, { now: () => NOW })).status, "compacted");

  const after = (await readLearningState(fixture.project)).active;
  assert.deepEqual(after, before);
  assert.notEqual(after[0].activated_at, after[0].last_supported_at);
});

function exactSizedEvents(project, targetBytes, count = 240) {
  const events = Array.from({ length: count }, (_, index) =>
    activateEvent(project, index + 1, {
      rule: "r",
      evidence: {
        source: "explicit_user_feedback",
        summary: "s",
        revision: project.revision,
      },
    }),
  );
  let current = Buffer.byteLength(serializeEvents(events));
  let remaining = targetBytes - current;
  assert.ok(remaining >= 0, `base ledger ${current} must fit target ${targetBytes}`);
  for (const event of events) {
    const ruleGrowth = Math.min(499, remaining);
    event.rule += "r".repeat(ruleGrowth);
    remaining -= ruleGrowth;
    const summaryGrowth = Math.min(499, remaining);
    event.evidence.summary += "s".repeat(summaryGrowth);
    remaining -= summaryGrowth;
    if (remaining === 0) break;
  }
  assert.equal(remaining, 0, "fixtures must have enough schema-valid padding capacity");
  assert.equal(Buffer.byteLength(serializeEvents(events)), targetBytes);
  return events;
}

test("compaction uses strict 256 KiB threshold", async (context) => {
  const fixture = await enabledFixture(context);
  const exact = exactSizedEvents(fixture.project, LEDGER_BYTE_LIMIT);
  await writeFile(fixture.ledgerPath, serializeEvents(exact));

  assert.equal((await compactLedger(fixture.project, { now: () => NOW })).status, "unchanged");
  await assert.rejects(access(fixture.archivePath));

  const over = structuredClone(exact);
  const expandable = over.find(
    (event) => event.rule.length < 500 || event.evidence.summary.length < 500,
  );
  assert.ok(expandable, "exact-limit fixture must retain one byte of valid capacity");
  if (expandable.rule.length < 500) expandable.rule += "x";
  else expandable.evidence.summary += "x";
  assert.equal(Buffer.byteLength(serializeEvents(over)), LEDGER_BYTE_LIMIT + 1);
  await writeFile(fixture.ledgerPath, serializeEvents(over));
  assert.equal((await compactLedger(fixture.project, { now: () => NOW })).status, "compacted");
  assert.equal((await readdir(fixture.archivePath)).length, 1);
});

test("record compacts in the same transaction when append crosses the event limit", async (context) => {
  const fixture = await enabledFixture(context);
  const atLimit = Array.from({ length: EVENT_COUNT_LIMIT }, (_, index) =>
    activateEvent(fixture.project, index + 1),
  );
  const crossing = activateEvent(fixture.project, EVENT_COUNT_LIMIT + 1);
  await writeFile(fixture.ledgerPath, serializeEvents(atLimit));

  const result = await recordCandidate(fixture.project, crossing, { now: () => NOW });

  assert.equal(result.status, "recorded");
  assert.equal(result.compacted, true);
  assert.equal((await readdir(fixture.archivePath)).length, 1);
  assert.equal((await readLearningState(fixture.project)).active.length, EVENT_COUNT_LIMIT + 1);
});

test("record compacts in the same transaction when append crosses 256 KiB", async (context) => {
  const fixture = await enabledFixture(context);
  const crossing = activateEvent(fixture.project, 1000);
  const crossingBytes = Buffer.byteLength(serializeEvents([crossing]));
  const before = exactSizedEvents(
    fixture.project,
    LEDGER_BYTE_LIMIT - crossingBytes + 1,
    240,
  );
  await writeFile(fixture.ledgerPath, serializeEvents(before));
  assert.equal(
    Buffer.byteLength(serializeEvents([...before, crossing])),
    LEDGER_BYTE_LIMIT + 1,
  );

  const result = await recordCandidate(fixture.project, crossing, { now: () => NOW });

  assert.equal(result.status, "recorded");
  assert.equal(result.compacted, true);
  assert.equal((await readdir(fixture.archivePath)).length, 1);
});

test("archives do not participate in normal retrieval", async (context) => {
  const fixture = await enabledFixture(context);
  const active = activateEvent(fixture.project, 1);
  const archivedClear = {
    schema_version: 1,
    event_id: eventId(2),
    project_id: fixture.project.projectId,
    recorded_at: NOW,
    action: "clear",
  };
  await writeFile(fixture.ledgerPath, serializeEvents([active]));
  await writeArchive(fixture, "old.jsonl", [archivedClear]);

  const state = await readLearningState(fixture.project);
  assert.equal(state.active.length, 1);
  assert.equal(state.active[0].lesson_id, active.lesson_id);
  assert.deepEqual(state.events, [active]);
});

test("duplicate event IDs across active ledger and archives are rejected", async (context) => {
  const fixture = await enabledFixture(context);
  const active = activateEvent(fixture.project, 1);
  const duplicate = activateEvent(fixture.project, 2, { event_id: active.event_id });
  await writeFile(fixture.ledgerPath, serializeEvents([active]));
  await writeArchive(fixture, "duplicate.jsonl", [duplicate]);

  await assert.rejects(
    readLearningState(fixture.project),
    (error) => error.code === "DUPLICATE_EVENT_ID",
  );
  await assert.rejects(
    recordCandidate(fixture.project, activateEvent(fixture.project, 3)),
    (error) => error.code === "DUPLICATE_EVENT_ID",
  );
});

test("permanent deletion removes target references across active and archive closure", async (context) => {
  const fixture = await enabledFixture(context);
  const target = activateEvent(fixture.project, 1);
  const replacement = activateEvent(fixture.project, 2, {
    action: "supersede",
    supersedes: [target.lesson_id],
  });
  const survivor = activateEvent(fixture.project, 3);
  const survivorReplacement = activateEvent(fixture.project, 4, {
    action: "supersede",
    supersedes: [target.lesson_id, survivor.lesson_id],
  });
  await writeFile(fixture.ledgerPath, serializeEvents([replacement, survivorReplacement]));
  await writeArchive(fixture, "history.jsonl", [target, survivor]);

  const result = await deleteLearning(fixture.project, { lessonIds: [target.lesson_id] });

  assert.equal(result.status, "deleted");
  assert.deepEqual(new Set(result.deletedLessonIds), new Set([target.lesson_id, replacement.lesson_id]));
  const tree = await readTree(fixture.storePath);
  const persisted = tree.map(([, text]) => text).join("\n");
  assert.equal(persisted.includes(target.lesson_id), false);
  assert.equal(persisted.includes(replacement.lesson_id), false);
  assert.equal(persisted.includes(survivor.lesson_id), true);
  const state = await readLearningState(fixture.project);
  assert.equal(state.events[0].lesson_id, survivorReplacement.lesson_id);
  assert.deepEqual(state.events[0].supersedes, [survivor.lesson_id]);
});

test("delete replacement failure rolls the complete old tree back", async (context) => {
  const fixture = await enabledFixture(context);
  const target = activateEvent(fixture.project, 1);
  const survivor = activateEvent(fixture.project, 2);
  await writeFile(fixture.ledgerPath, serializeEvents([target]));
  await writeArchive(fixture, "history.jsonl", [survivor]);
  const before = await readTree(fixture.storePath);

  await assert.rejects(
    deleteLearning(fixture.project, { lessonIds: [target.lesson_id] }, {
      fs: {
        async rename(source, destination) {
          if (String(source).includes(".leanpowers.replace-") && String(destination).endsWith(".leanpowers")) {
            throw Object.assign(new Error("injected replacement failure"), { code: "EIO" });
          }
          return rename(source, destination);
        },
      },
    }),
    /injected replacement failure/,
  );

  assert.deepEqual(await readTree(fixture.storePath), before);
  assert.deepEqual(await listTemporaryArtifacts(fixture.storePath), []);
});

test("rollback failure keeps the complete old tree in its backup", async (context) => {
  const fixture = await enabledFixture(context);
  const target = activateEvent(fixture.project, 1);
  await writeFile(fixture.ledgerPath, serializeEvents([target]));
  const before = await readTree(fixture.storePath);

  await assert.rejects(
    deleteLearning(fixture.project, { lessonIds: [target.lesson_id] }, {
      fs: {
        async rename(source, destination) {
          if (
            String(source).includes(".leanpowers.replace-") ||
            String(source).includes(".leanpowers.backup-")
          ) {
            throw Object.assign(new Error("injected rollback failure"), { code: "EIO" });
          }
          return rename(source, destination);
        },
      },
    }),
    (error) => error.code === "STORAGE_ROLLBACK_FAILED",
  );

  const backupName = (await readdir(fixture.project.root)).find((name) =>
    name.startsWith(".leanpowers.backup-"),
  );
  assert.ok(backupName);
  assert.deepEqual(await readTree(path.join(fixture.project.root, backupName)), before);
});

test("backup cleanup failure rejects success and restores the old canonical tree", async (context) => {
  const fixture = await enabledFixture(context);
  const target = activateEvent(fixture.project, 1);
  await writeFile(fixture.ledgerPath, serializeEvents([target]));
  const before = await readTree(fixture.storePath);

  await assert.rejects(
    deleteLearning(fixture.project, { lessonIds: [target.lesson_id] }, {
      fs: {
        async rm(targetPath, options) {
          if (String(targetPath).includes(".leanpowers.backup-")) {
            throw Object.assign(new Error("injected backup cleanup failure"), { code: "EIO" });
          }
          return rm(targetPath, options);
        },
      },
    }),
    (error) => error.code === "STORAGE_COMMIT_FAILED",
  );

  assert.deepEqual(await readTree(fixture.storePath), before);
  assert.equal(
    (await readdir(fixture.project.root)).some((name) => name.startsWith(".leanpowers.backup-")),
    false,
  );
});

test("prepared marker unlink failure never exposes a failed committed mutation", async (context) => {
  const cases = [
    {
      name: "initial enable",
      async arrange() {
        const repo = await createGitFixture(context);
        const project = await resolveProject(repo.root, { caller: "leader" });
        return {
          project,
          before: null,
          storePath: path.join(project.root, ".leanpowers"),
          invoke: (dependencies) => enableProject(project, NOW, dependencies),
        };
      },
    },
    ...["record", "disable"].map((name, index) => ({
      name,
      async arrange() {
        const fixture = await enabledFixture(context);
        await recordCandidate(fixture.project, activateEvent(fixture.project, 40 + index));
        return {
          project: fixture.project,
          before: await readTree(fixture.storePath, null),
          storePath: fixture.storePath,
          invoke: (dependencies) =>
            name === "record"
              ? recordCandidate(fixture.project, activateEvent(fixture.project, 50 + index), dependencies)
              : disableProject(fixture.project, NOW, dependencies),
        };
      },
    })),
  ];

  for (const markerCase of cases) {
    await context.test(markerCase.name, async () => {
      const fixture = await markerCase.arrange();
      await assert.rejects(
        fixture.invoke({
          fs: {
            async unlink(target) {
              if (/\.leanpowers\.(?:tmp|replace)-[^/]+\.owner\.json$/.test(String(target))) {
                throw Object.assign(new Error("injected prepared marker unlink failure"), {
                  code: "EIO",
                });
              }
              return unlink(target);
            },
          },
        }),
        /injected prepared marker unlink failure/,
      );
      if (fixture.before === null) {
        await assert.rejects(access(fixture.storePath));
      } else {
        assert.deepEqual(await readTree(fixture.storePath, null), fixture.before);
      }
    });
  }
});

test("backup marker unlink failure rolls the new tree back before reporting failure", async (context) => {
  const fixture = await enabledFixture(context);
  const original = activateEvent(fixture.project, 61);
  await recordCandidate(fixture.project, original);
  const before = await readTree(fixture.storePath, null);

  await assert.rejects(
    recordCandidate(fixture.project, activateEvent(fixture.project, 62), {
      fs: {
        async unlink(target) {
          if (/\.leanpowers\.backup-[^/]+\.owner\.json$/.test(String(target))) {
            throw Object.assign(new Error("injected backup marker unlink failure"), {
              code: "EIO",
            });
          }
          return unlink(target);
        },
      },
    }),
    /injected backup marker unlink failure/,
  );

  assert.deepEqual(await readTree(fixture.storePath, null), before);
  assert.deepEqual((await readLearningState(fixture.project)).events, [original]);
});

test("read recovers an authoritative backup over a swapped canonical tree", async (context) => {
  const fixture = await enabledFixture(context);
  const target = activateEvent(fixture.project, 1);
  await writeFile(fixture.ledgerPath, serializeEvents([target]));
  const backupPath = `${fixture.storePath}.backup-manual`;
  await cp(fixture.storePath, backupPath, { recursive: true });
  await authenticateTransaction(fixture, backupPath, "backup");
  await writeFile(fixture.ledgerPath, "");

  const state = await readLearningState(fixture.project);

  assert.deepEqual(state.events, [target]);
  await assert.rejects(access(backupPath));
  await assert.rejects(access(`${backupPath}.owner.json`));
});

test("non-leader read requires recovery without mutating reserved state", async (context) => {
  const fixture = await enabledFixture(context);
  const target = activateEvent(fixture.project, 1);
  await writeFile(fixture.ledgerPath, serializeEvents([target]));
  const worker = { ...fixture.project, caller: "worker" };
  assert.deepEqual((await readLearningState(worker)).events, [target]);

  const backupPath = `${fixture.storePath}.backup-worker`;
  await cp(fixture.storePath, backupPath, { recursive: true });
  await authenticateTransaction(fixture, backupPath, "backup");
  await writeFile(fixture.ledgerPath, "");
  const beforeCanonical = await readTree(fixture.storePath);
  const beforeBackup = await readTree(backupPath);
  const beforeExclude = await readFile(fixture.excludePath);
  let mutations = 0;

  await assert.rejects(
    readLearningState(worker, {
      fs: {
        async rm(...args) {
          mutations += 1;
          return rm(...args);
        },
        async rename(...args) {
          mutations += 1;
          return rename(...args);
        },
        async writeFile(...args) {
          if (!String(args[0]).includes(".leanpowers.lock")) mutations += 1;
          return writeFile(...args);
        },
      },
    }),
    (error) => error.code === "STORAGE_RECOVERY_REQUIRED",
  );

  assert.equal(mutations, 0);
  assert.deepEqual(await readTree(fixture.storePath), beforeCanonical);
  assert.deepEqual(await readTree(backupPath), beforeBackup);
  assert.deepEqual(await readFile(fixture.excludePath), beforeExclude);
});

async function assertInvalidBackupPreserved(fixture, mutateBackup, expectedCode) {
  const backupPath = `${fixture.storePath}.backup-invalid`;
  await cp(fixture.storePath, backupPath, { recursive: true });
  await authenticateTransaction(fixture, backupPath, "backup");
  await mutateBackup(backupPath);
  const beforeCanonical = await readTree(fixture.storePath);
  const beforeBackup = await readTree(backupPath);
  const beforeExclude = await readFile(fixture.excludePath);
  let mutations = 0;

  await assert.rejects(
    readLearningState(fixture.project, {
      fs: {
        async rm(...args) {
          mutations += 1;
          return rm(...args);
        },
        async rename(...args) {
          mutations += 1;
          return rename(...args);
        },
        async writeFile(...args) {
          if (!String(args[0]).includes(".leanpowers.lock")) mutations += 1;
          return writeFile(...args);
        },
      },
    }),
    (error) => error.code === expectedCode,
  );

  assert.equal(mutations, 0);
  assert.deepEqual(await readTree(fixture.storePath), beforeCanonical);
  assert.deepEqual(await readTree(backupPath), beforeBackup);
  assert.deepEqual(await readFile(fixture.excludePath), beforeExclude);
}

test("invalid authoritative backup project mismatch is read-only", async (context) => {
  const fixture = await enabledFixture(context);
  await recordCandidate(fixture.project, activateEvent(fixture.project, 1));
  await assertInvalidBackupPreserved(
    fixture,
    async (backupPath) => {
      const configPath = path.join(backupPath, "config.json");
      const config = JSON.parse(await readFile(configPath, "utf8"));
      config.project_id = `sha256:${"f".repeat(64)}`;
      await writeFile(configPath, `${JSON.stringify(config)}\n`);
    },
    "PROJECT_MISMATCH",
  );
});

test("invalid authoritative backup config schema is read-only", async (context) => {
  const fixture = await enabledFixture(context);
  await assertInvalidBackupPreserved(
    fixture,
    async (backupPath) => {
      await writeFile(path.join(backupPath, "config.json"), '{"enabled":true}\n');
    },
    "INVALID_LEARNING_CONFIG",
  );
});

test("invalid authoritative backup truncated ledger is read-only", async (context) => {
  const fixture = await enabledFixture(context);
  await assertInvalidBackupPreserved(
    fixture,
    async (backupPath) => {
      await writeFile(path.join(backupPath, "lessons.jsonl"), '{"truncated"\n');
    },
    "INVALID_LEARNING_STATE",
  );
});

test("invalid authoritative backup duplicate archive ID is read-only", async (context) => {
  const fixture = await enabledFixture(context);
  const active = activateEvent(fixture.project, 1);
  await writeFile(fixture.ledgerPath, serializeEvents([active]));
  await assertInvalidBackupPreserved(
    fixture,
    async (backupPath) => {
      const archivePath = path.join(backupPath, "archive");
      await mkdir(archivePath, { recursive: true });
      await writeFile(path.join(archivePath, "duplicate.jsonl"), serializeEvents([active]));
    },
    "DUPLICATE_EVENT_ID",
  );
});

test("enable validates an invalid backup before repairing missing Git exclusions", async (context) => {
  const fixture = await enabledFixture(context);
  const backupPath = `${fixture.storePath}.backup-invalid-enable`;
  await cp(fixture.storePath, backupPath, { recursive: true });
  await authenticateTransaction(fixture, backupPath, "backup");
  await writeFile(path.join(backupPath, "config.json"), '{"enabled":true}\n');
  await writeFile(fixture.excludePath, "# preserve this exclude file byte-for-byte\n");
  const beforeCanonical = await readTree(fixture.storePath, null);
  const beforeBackup = await readTree(backupPath, null);
  const beforeExclude = await readFile(fixture.excludePath);

  await assert.rejects(
    enableProject(fixture.project, NOW),
    (error) => error.code === "INVALID_LEARNING_CONFIG",
  );

  assert.deepEqual(await readTree(fixture.storePath, null), beforeCanonical);
  assert.deepEqual(await readTree(backupPath, null), beforeBackup);
  assert.deepEqual(await readFile(fixture.excludePath), beforeExclude);
});

test("record validates a mismatched backup before repairing missing Git exclusions", async (context) => {
  const fixture = await enabledFixture(context);
  const backupPath = `${fixture.storePath}.backup-mismatched-record`;
  await cp(fixture.storePath, backupPath, { recursive: true });
  await authenticateTransaction(fixture, backupPath, "backup");
  const backupConfigPath = path.join(backupPath, "config.json");
  const backupConfig = JSON.parse(await readFile(backupConfigPath, "utf8"));
  backupConfig.project_id = `sha256:${"f".repeat(64)}`;
  await writeFile(backupConfigPath, `${JSON.stringify(backupConfig)}\n`);
  await writeFile(fixture.excludePath, "# preserve this exclude file byte-for-byte\n");
  const beforeCanonical = await readTree(fixture.storePath, null);
  const beforeBackup = await readTree(backupPath, null);
  const beforeExclude = await readFile(fixture.excludePath);

  await assert.rejects(
    recordCandidate(fixture.project, activateEvent(fixture.project, 2)),
    (error) => error.code === "PROJECT_MISMATCH",
  );

  assert.deepEqual(await readTree(fixture.storePath, null), beforeCanonical);
  assert.deepEqual(await readTree(backupPath, null), beforeBackup);
  assert.deepEqual(await readFile(fixture.excludePath), beforeExclude);
});

test("multiple authoritative backups fail explicitly without mutation", async (context) => {
  const fixture = await enabledFixture(context);
  const firstBackup = `${fixture.storePath}.backup-first`;
  const secondBackup = `${fixture.storePath}.backup-second`;
  await cp(fixture.storePath, firstBackup, { recursive: true });
  await cp(fixture.storePath, secondBackup, { recursive: true });
  await authenticateTransaction(fixture, firstBackup, "backup");
  await authenticateTransaction(fixture, secondBackup, "backup");
  const beforeCanonical = await readTree(fixture.storePath);
  const beforeFirst = await readTree(firstBackup);
  const beforeSecond = await readTree(secondBackup);

  await assert.rejects(
    readLearningState(fixture.project),
    (error) => error.code === "STORAGE_RECOVERY_FAILED",
  );

  assert.deepEqual(await readTree(fixture.storePath), beforeCanonical);
  assert.deepEqual(await readTree(firstBackup), beforeFirst);
  assert.deepEqual(await readTree(secondBackup), beforeSecond);
});

test("leader read cleans stale initial temp and replacement trees", async (context) => {
  const fixture = await enabledFixture(context);
  const active = activateEvent(fixture.project, 1);
  await writeFile(fixture.ledgerPath, serializeEvents([active]));
  const initialTemp = `${fixture.storePath}.tmp-stale`;
  const replacement = `${fixture.storePath}.replace-stale`;
  await cp(fixture.storePath, initialTemp, { recursive: true });
  await cp(fixture.storePath, replacement, { recursive: true });
  await authenticateTransaction(fixture, initialTemp, "initial");
  await authenticateTransaction(fixture, replacement, "replacement");

  assert.deepEqual((await readLearningState(fixture.project)).events, [active]);
  await assert.rejects(access(initialTemp));
  await assert.rejects(access(replacement));
});

test("unknown transaction-like directories are preserved and block recovery", async (context) => {
  const fixture = await enabledFixture(context);
  const userArtifacts = [
    path.join(fixture.project.root, ".leanpowers.replace-user-data"),
    path.join(fixture.project.root, ".leanpowers.tmp-user-data"),
  ];
  for (const artifact of userArtifacts) {
    await mkdir(artifact);
    await writeFile(path.join(artifact, "sentinel.txt"), `${path.basename(artifact)}\n`);
  }
  const before = await Promise.all(userArtifacts.map((artifact) => readTree(artifact, null)));

  await assert.rejects(
    enableProject(fixture.project, NOW),
    (error) => error.code === "STORAGE_RECOVERY_FAILED",
  );

  for (let index = 0; index < userArtifacts.length; index += 1) {
    assert.deepEqual(await readTree(userArtifacts[index], null), before[index]);
  }
});

test("symlinked and forged transaction artifacts remain untouched and fail closed", async (context) => {
  const fixture = await enabledFixture(context);
  const external = await temporaryDirectory(context, "leanpowers-external-transaction-");
  const externalSentinel = path.join(external, "sentinel.txt");
  const linkedArtifact = path.join(fixture.project.root, ".leanpowers.replace-user-link");
  await writeFile(externalSentinel, "external-transaction\n");
  await symlink(external, linkedArtifact);

  await assert.rejects(
    readLearningState(fixture.project),
    (error) => error.code === "STORAGE_CONFINEMENT_FAILED",
  );
  assert.equal(await readFile(externalSentinel, "utf8"), "external-transaction\n");
  assert.equal(
    (await readdir(fixture.project.root, { withFileTypes: true })).find(
      (entry) => entry.name === path.basename(linkedArtifact),
    )?.isSymbolicLink(),
    true,
  );

  await rm(linkedArtifact);
  const forged = path.join(fixture.project.root, ".leanpowers.replace-forged");
  await cp(fixture.storePath, forged, { recursive: true });
  await writeFile(
    `${forged}.owner.json`,
    `${JSON.stringify({
      version: 1,
      kind: "replacement",
      owner_id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
      project_id: fixture.project.projectId,
      transaction_id: "forged",
      extra: true,
    })}\n`,
  );
  const before = await readTree(forged, null);

  await assert.rejects(
    readLearningState(fixture.project),
    (error) => error.code === "STORAGE_RECOVERY_FAILED",
  );
  assert.deepEqual(await readTree(forged, null), before);
  assert.equal((await access(`${forged}.owner.json`)) ?? true, true);
});

test("an exact derivable transaction marker cannot authenticate a forged artifact", async (context) => {
  const fixture = await enabledFixture(context);
  const forged = path.join(fixture.project.root, ".leanpowers.replace-exact-forgery");
  await cp(fixture.storePath, forged, { recursive: true });
  await writeFile(
    `${forged}.owner.json`,
    `${JSON.stringify({
      version: 1,
      kind: "replacement",
      project_id: fixture.project.projectId,
      transaction_id: "exact-forgery",
    })}\n`,
  );
  const beforeArtifact = await readTree(forged, null);
  const beforeMarker = await readFile(`${forged}.owner.json`);

  await assert.rejects(
    readLearningState(fixture.project),
    (error) => error.code === "STORAGE_RECOVERY_FAILED",
  );
  assert.deepEqual(await readTree(forged, null), beforeArtifact);
  assert.deepEqual(await readFile(`${forged}.owner.json`), beforeMarker);
});

test("malformed or symlinked store owner identity fails closed", async (context) => {
  const malformed = await enabledFixture(context);
  const malformedOwner = path.join(malformed.project.root, ".leanpowers.owner.json");
  await writeFile(malformedOwner, '{"version":1}\n');
  await assert.rejects(
    readLearningState(malformed.project),
    (error) => error.code === "STORAGE_RECOVERY_FAILED",
  );

  const linked = await enabledFixture(context);
  const linkedOwner = path.join(linked.project.root, ".leanpowers.owner.json");
  const external = path.join(await temporaryDirectory(context, "leanpowers-owner-link-"), "owner.json");
  await writeFile(external, '{"external":true}\n');
  await rm(linkedOwner, { force: true });
  await symlink(external, linkedOwner);
  const before = await readFile(external);
  await assert.rejects(
    recordCandidate(linked.project, activateEvent(linked.project, 80)),
    (error) => error.code === "STORAGE_CONFINEMENT_FAILED",
  );
  assert.deepEqual(await readFile(external), before);
});

test("stale replacement cleanup failure is explicit and preserves bytes", async (context) => {
  const fixture = await enabledFixture(context);
  const replacement = `${fixture.storePath}.replace-cleanup-failure`;
  await cp(fixture.storePath, replacement, { recursive: true });
  await authenticateTransaction(fixture, replacement, "replacement");
  const beforeCanonical = await readTree(fixture.storePath);
  const beforeReplacement = await readTree(replacement);

  await assert.rejects(
    readLearningState(fixture.project, {
      fs: {
        async rm(targetPath, options) {
          if (String(targetPath) === replacement) {
            throw Object.assign(new Error("injected stale cleanup failure"), { code: "EIO" });
          }
          return rm(targetPath, options);
        },
      },
    }),
    (error) => error.code === "STORAGE_RECOVERY_FAILED",
  );

  assert.deepEqual(await readTree(fixture.storePath), beforeCanonical);
  assert.deepEqual(await readTree(replacement), beforeReplacement);
});

test("double cleanup and rollback failure preserves an unowned backup and safe-fails", async (context) => {
  const fixture = await enabledFixture(context);
  const target = activateEvent(fixture.project, 1);
  await writeFile(fixture.ledgerPath, serializeEvents([target]));
  const before = await readTree(fixture.storePath, null);

  await assert.rejects(
    deleteLearning(fixture.project, { lessonIds: [target.lesson_id] }, {
      fs: {
        async rm(targetPath, options) {
          if (String(targetPath).includes(".leanpowers.backup-")) {
            throw Object.assign(new Error("injected backup cleanup failure"), { code: "EIO" });
          }
          return rm(targetPath, options);
        },
        async rename(source, destination) {
          if (
            String(source).includes(".leanpowers.backup-") &&
            String(destination).endsWith(".leanpowers")
          ) {
            throw Object.assign(new Error("injected immediate recovery failure"), { code: "EIO" });
          }
          return rename(source, destination);
        },
      },
    }),
    (error) => error.code === "STORAGE_ROLLBACK_FAILED",
  );

  await assert.rejects(access(fixture.storePath));
  const backupName = (await readdir(fixture.project.root)).find(
    (name) => name.startsWith(".leanpowers.backup-") && !name.endsWith(".owner.json"),
  );
  assert.ok(backupName);
  const backupPath = path.join(fixture.project.root, backupName);
  assert.deepEqual(await readTree(backupPath, null), before);
  await assert.rejects(access(`${backupPath}.owner.json`));

  await assert.rejects(
    deleteLearning(fixture.project, { lessonIds: [target.lesson_id] }),
    (error) =>
      error.code === "STORAGE_RECOVERY_FAILED" &&
      /unowned learning transaction artifact/.test(error.message),
  );
  assert.deepEqual(await readTree(backupPath, null), before);
});

test("delete validation failure cleans its replacement tree and preserves the old tree", async (context) => {
  const fixture = await enabledFixture(context);
  const target = activateEvent(fixture.project, 1);
  await writeFile(fixture.ledgerPath, serializeEvents([target]));
  const before = await readTree(fixture.storePath);

  await assert.rejects(
    deleteLearning(fixture.project, { lessonIds: [target.lesson_id] }, {
      async afterPrepare({ preparedPath }) {
        if (path.basename(preparedPath).includes(".leanpowers.replace-")) {
          await writeFile(path.join(preparedPath, "lessons.jsonl"), "invalid\n");
        }
      },
    }),
    (error) => error.code === "INVALID_LEARNING_STATE",
  );

  assert.deepEqual(await readTree(fixture.storePath), before);
  assert.deepEqual(await listTemporaryArtifacts(fixture.storePath), []);
});

test("delete all clears active and archived events while retaining enabled config", async (context) => {
  const fixture = await enabledFixture(context);
  const first = activateEvent(fixture.project, 1);
  const second = activateEvent(fixture.project, 2);
  await writeFile(fixture.ledgerPath, serializeEvents([first]));
  await writeArchive(fixture, "history.jsonl", [second]);

  const result = await deleteLearning(fixture.project, { all: true });
  const state = await readLearningState(fixture.project);
  assert.equal(result.status, "deleted");
  assert.deepEqual(new Set(result.deletedLessonIds), new Set([first.lesson_id, second.lesson_id]));
  assert.equal(state.config.enabled, true);
  assert.deepEqual(state.events, []);
  assert.deepEqual(state.active, []);
  await assert.rejects(access(fixture.archivePath));
});

test("store artifacts remain ordinary local files with no dependency or background surface", async (context) => {
  const fixture = await enabledFixture(context);
  await recordCandidate(fixture.project, activateEvent(fixture.project));
  const entries = await readTree(fixture.storePath);
  assert.deepEqual(entries.map(([name]) => name), ["config.json", "lessons.jsonl"]);
  assert.equal((await stat(fixture.ledgerPath)).isFile(), true);
});
