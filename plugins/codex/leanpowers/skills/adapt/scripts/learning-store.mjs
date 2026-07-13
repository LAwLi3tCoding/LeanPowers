import { randomUUID } from "node:crypto";
import { execFile as execFileCallback } from "node:child_process";
import * as nodeFs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import {
  computeProjectId,
  normalizeOriginUrl,
  reduceLessonEvents,
  validateConfig,
  validateEvent,
} from "./learning-core.mjs";

const execFile = promisify(execFileCallback);
const EVENT_COUNT_LIMIT = 256;
const LEDGER_BYTE_LIMIT = 256 * 1024;
const STORE_NAME = ".leanpowers";
const CONFIG_NAME = "config.json";
const LEDGER_NAME = "lessons.jsonl";
const ARCHIVE_PREFIX = "archive/";
const REPLACEMENT_PREFIX = `${STORE_NAME}.replace-`;
const BACKUP_PREFIX = `${STORE_NAME}.backup-`;
const INITIAL_TEMP_PREFIX = `${STORE_NAME}.tmp-`;
const LOCK_NAME = `${STORE_NAME}.lock`;
const OWNER_SUFFIX = ".owner.json";
const STORE_OWNER_NAME = `${STORE_NAME}.owner.json`;
const STORE_OWNER_TEMP_PREFIX = `${STORE_OWNER_NAME}.tmp-`;
const TRANSACTION_VERSION = 1;
const MUTATION_LOCK = Symbol("leanpowersMutationLock");
const GIT_EXCLUDE_PATTERNS = [
  `${STORE_NAME}/`,
  `${LOCK_NAME}/`,
  STORE_OWNER_NAME,
  `${STORE_OWNER_TEMP_PREFIX}*`,
  `${INITIAL_TEMP_PREFIX}*/`,
  `${INITIAL_TEMP_PREFIX}*${OWNER_SUFFIX}`,
  `${REPLACEMENT_PREFIX}*/`,
  `${REPLACEMENT_PREFIX}*${OWNER_SUFFIX}`,
  `${BACKUP_PREFIX}*/`,
  `${BACKUP_PREFIX}*${OWNER_SUFFIX}`,
];
const TRANSACTION_KINDS = [
  { kind: "backup", prefix: BACKUP_PREFIX },
  { kind: "replacement", prefix: REPLACEMENT_PREFIX },
  { kind: "initial", prefix: INITIAL_TEMP_PREFIX },
];
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LOCK_CLEANUP_MESSAGES = {
  post_commit: "Learning mutation committed, but its owned project lock could not be removed.",
  after_failure: "Learning mutation failed and its owned project lock could not be removed.",
};

const domainError = (code, message, cause) => {
  const error = new Error(message, cause === undefined ? undefined : { cause });
  error.code = code;
  return error;
};

const fsFor = (dependencies = {}) => ({ ...nodeFs, ...(dependencies.fs ?? {}) });

const storePaths = (context) => {
  const store = path.join(context.root, STORE_NAME);
  return {
    store,
    config: path.join(store, CONFIG_NAME),
    ledger: path.join(store, LEDGER_NAME),
  };
};

const sha256 = async (value) => {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(value).digest("hex");
};

const requireLeader = (context) => {
  if (context?.caller !== "leader") {
    throw domainError("LEADER_REQUIRED", "learning writes require caller leader");
  }
};

const isMissing = (error) => error?.code === "ENOENT";

const lstatIfPresent = async (target, operations) => {
  try {
    return await operations.lstat(target);
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }
};

const confinementError = (target) =>
  domainError(
    "STORAGE_CONFINEMENT_FAILED",
    `learning storage path is not confined: ${path.basename(target)}`,
  );

async function assertDirectoryPath(target, operations, { allowMissing = false } = {}) {
  const metadata = await lstatIfPresent(target, operations);
  if (metadata === null) {
    if (allowMissing) return null;
    throw domainError("STORAGE_RECOVERY_FAILED", `missing learning transaction artifact ${path.basename(target)}`);
  }
  if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
    throw confinementError(target);
  }
  return metadata;
}

async function assertRegularPath(target, operations, { allowMissing = false } = {}) {
  const metadata = await lstatIfPresent(target, operations);
  if (metadata === null) {
    if (allowMissing) return null;
    throw domainError("STORAGE_RECOVERY_FAILED", `missing learning transaction marker ${path.basename(target)}`);
  }
  if (metadata.isSymbolicLink() || !metadata.isFile()) {
    throw confinementError(target);
  }
  return metadata;
}

async function assertStoreConfinement(context, operations) {
  const { store } = storePaths(context);
  const metadata = await assertDirectoryPath(store, operations, { allowMissing: true });
  if (metadata === null) return false;
  const canonical = await operations.realpath(store);
  if (canonical !== store || !containsPath(context.root, canonical)) {
    throw confinementError(store);
  }
  return true;
}

async function assertDirectStoreFile(context, target, operations, { allowMissing = false } = {}) {
  await assertStoreConfinement(context, operations);
  const metadata = await assertRegularPath(target, operations, { allowMissing });
  if (metadata === null) return null;
  const canonical = await operations.realpath(target);
  const { store } = storePaths(context);
  if (!containsPath(store, canonical)) throw confinementError(target);
  return metadata;
}

const readFileIfPresent = async (file, operations) => {
  try {
    return await operations.readFile(file);
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }
};

const pathExists = async (target, operations) => {
  try {
    await operations.stat(target);
    return true;
  } catch (error) {
    if (isMissing(error)) return false;
    throw error;
  }
};

const cleanup = async (target, operations) => {
  try {
    await operations.rm(target, { recursive: true, force: true });
  } catch (error) {
    throw domainError("STORAGE_CLEANUP_FAILED", `failed to clean transaction artifact ${path.basename(target)}`, error);
  }
};

const ownershipMarkerPath = (artifactPath) => `${artifactPath}${OWNER_SUFFIX}`;

const ownershipDocument = (kind, transactionId, context, ownerId) => ({
  version: TRANSACTION_VERSION,
  kind,
  owner_id: ownerId,
  project_id: context.projectId,
  transaction_id: transactionId,
});

const lockOwnershipDocument = (transactionId, context) => ({
  version: TRANSACTION_VERSION,
  kind: "lock",
  project_id: context.projectId,
  transaction_id: transactionId,
});

function parseOwnershipDocument(buffer, expected, markerPath) {
  let document;
  try {
    document = JSON.parse(buffer.toString("utf8"));
  } catch (error) {
    throw domainError(
      "STORAGE_RECOVERY_FAILED",
      `invalid learning transaction marker ${path.basename(markerPath)}`,
      error,
    );
  }
  const keys =
    document !== null && typeof document === "object" && !Array.isArray(document)
      ? Object.keys(document).sort()
      : [];
  const expectedKeys = ["kind", "owner_id", "project_id", "transaction_id", "version"];
  if (
    keys.length !== expectedKeys.length ||
    keys.some((key, index) => key !== expectedKeys[index]) ||
    document.version !== TRANSACTION_VERSION ||
    document.kind !== expected.kind ||
    document.owner_id !== expected.ownerId ||
    document.project_id !== expected.projectId ||
    document.transaction_id !== expected.transactionId
  ) {
    throw domainError(
      "STORAGE_RECOVERY_FAILED",
      `untrusted learning transaction marker ${path.basename(markerPath)}`,
    );
  }
  return document;
}

async function readOwnershipMarker(markerPath, expected, operations) {
  await assertRegularPath(markerPath, operations);
  return parseOwnershipDocument(await operations.readFile(markerPath), expected, markerPath);
}

function parseLockOwnershipDocument(buffer, expected, markerPath) {
  let document;
  try {
    document = JSON.parse(buffer.toString("utf8"));
  } catch (error) {
    throw domainError("STORAGE_RECOVERY_FAILED", "invalid learning lock owner", error);
  }
  const keys =
    document !== null && typeof document === "object" && !Array.isArray(document)
      ? Object.keys(document).sort()
      : [];
  const expectedKeys = ["kind", "project_id", "transaction_id", "version"];
  if (
    keys.length !== expectedKeys.length ||
    keys.some((key, index) => key !== expectedKeys[index]) ||
    document.version !== TRANSACTION_VERSION ||
    document.kind !== "lock" ||
    document.project_id !== expected.projectId ||
    document.transaction_id !== expected.transactionId
  ) {
    throw domainError(
      "STORAGE_RECOVERY_FAILED",
      `untrusted learning lock owner ${path.basename(markerPath)}`,
    );
  }
  return document;
}

async function readLockMarker(markerPath, expected, operations) {
  await assertRegularPath(markerPath, operations);
  return parseLockOwnershipDocument(await operations.readFile(markerPath), expected, markerPath);
}

async function createOwnershipMarker(
  artifactPath,
  kind,
  transactionId,
  context,
  ownerId,
  operations,
) {
  const markerPath = ownershipMarkerPath(artifactPath);
  await operations.writeFile(
    markerPath,
    `${JSON.stringify(ownershipDocument(kind, transactionId, context, ownerId))}\n`,
    { flag: "wx" },
  );
  return markerPath;
}

const storeOwnerPath = (context) => path.join(context.root, STORE_OWNER_NAME);

function parseStoreOwnerDocument(buffer, context, ownerPath) {
  let document;
  try {
    document = JSON.parse(buffer.toString("utf8"));
  } catch (error) {
    throw domainError("STORAGE_RECOVERY_FAILED", "invalid learning store owner identity", error);
  }
  const keys =
    document !== null && typeof document === "object" && !Array.isArray(document)
      ? Object.keys(document).sort()
      : [];
  const expectedKeys = ["owner_id", "project_id", "version"];
  if (
    keys.length !== expectedKeys.length ||
    keys.some((key, index) => key !== expectedKeys[index]) ||
    document.version !== TRANSACTION_VERSION ||
    document.project_id !== context.projectId ||
    !UUID_V4_PATTERN.test(document.owner_id)
  ) {
    throw domainError(
      "STORAGE_RECOVERY_FAILED",
      `untrusted learning store owner identity ${path.basename(ownerPath)}`,
    );
  }
  return document;
}

async function readStoreOwner(context, operations, { allowMissing = false } = {}) {
  const ownerPath = storeOwnerPath(context);
  const metadata = await assertRegularPath(ownerPath, operations, { allowMissing });
  if (metadata === null) return null;
  const canonical = await operations.realpath(ownerPath);
  if (canonical !== ownerPath || !containsPath(context.root, canonical)) {
    throw confinementError(ownerPath);
  }
  return parseStoreOwnerDocument(await operations.readFile(ownerPath), context, ownerPath);
}

async function readPrivateStoreOwner(context, operations, { allowMissing = false } = {}) {
  if (!context.git || !context.privateOwnerPath || !context.privateOwnerRoot) return null;
  const rootMetadata = await assertDirectoryPath(context.privateOwnerRoot, operations, {
    allowMissing: true,
  });
  if (rootMetadata === null) {
    if (allowMissing) return null;
    throw domainError("STORAGE_RECOVERY_FAILED", "Git-private owner root is missing");
  }
  const canonicalRoot = await operations.realpath(context.privateOwnerRoot);
  if (
    canonicalRoot !== context.privateOwnerRoot ||
    !containsPath(context.privateGitRoot, canonicalRoot)
  ) {
    throw confinementError(context.privateOwnerRoot);
  }
  const metadata = await assertRegularPath(context.privateOwnerPath, operations, { allowMissing });
  if (metadata === null) return null;
  const canonical = await operations.realpath(context.privateOwnerPath);
  if (
    canonical !== context.privateOwnerPath ||
    !containsPath(context.privateOwnerRoot, canonical)
  ) {
    throw confinementError(context.privateOwnerPath);
  }
  return parseStoreOwnerDocument(
    await operations.readFile(context.privateOwnerPath),
    context,
    context.privateOwnerPath,
  );
}

const sameOwner = (left, right) =>
  left?.version === right?.version &&
  left?.project_id === right?.project_id &&
  left?.owner_id === right?.owner_id;

async function assertNoOwnerTempArtifacts(context, operations) {
  const entries = await operations.readdir(context.root, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.name.startsWith(STORE_OWNER_TEMP_PREFIX)) continue;
    const target = path.join(context.root, entry.name);
    if (entry.isSymbolicLink()) throw confinementError(target);
    throw domainError(
      "STORAGE_RECOVERY_FAILED",
      `unknown learning store owner temp artifact ${entry.name}`,
    );
  }
}

async function assertNoPrivateOwnerTempArtifacts(context, operations) {
  if (!context.git || !context.privateOwnerRoot) return;
  const rootMetadata = await assertDirectoryPath(context.privateOwnerRoot, operations, {
    allowMissing: true,
  });
  if (rootMetadata === null) return;
  const canonicalRoot = await operations.realpath(context.privateOwnerRoot);
  if (
    canonicalRoot !== context.privateOwnerRoot ||
    !containsPath(context.privateGitRoot, canonicalRoot)
  ) {
    throw confinementError(context.privateOwnerRoot);
  }
  const entries = await operations.readdir(context.privateOwnerRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === "leanpowers-owner.json") continue;
    const target = path.join(context.privateOwnerRoot, entry.name);
    if (entry.isSymbolicLink()) throw confinementError(target);
    const label = entry.name.startsWith("leanpowers-owner.json.tmp-")
      ? "unknown Git-private owner temp artifact"
      : "unknown Git-private owner artifact";
    throw domainError("STORAGE_RECOVERY_FAILED", `${label} ${entry.name}`);
  }
}

async function ensurePrivateOwnerRoot(context, operations) {
  const existing = await lstatIfPresent(context.privateOwnerRoot, operations);
  if (existing === null) {
    try {
      await operations.mkdir(context.privateOwnerRoot, { recursive: false });
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
    }
  }
  await assertDirectoryPath(context.privateOwnerRoot, operations);
  const canonical = await operations.realpath(context.privateOwnerRoot);
  if (canonical !== context.privateOwnerRoot || !containsPath(context.privateGitRoot, canonical)) {
    throw confinementError(context.privateOwnerRoot);
  }
}

function transactionDescriptor(name) {
  const marker = name.endsWith(OWNER_SUFFIX);
  const artifactName = marker ? name.slice(0, -OWNER_SUFFIX.length) : name;
  const type = TRANSACTION_KINDS.find(({ prefix }) => artifactName.startsWith(prefix));
  if (!type) return null;
  const transactionId = artifactName.slice(type.prefix.length);
  if (!/^[0-9A-Za-z][0-9A-Za-z-]{0,127}$/.test(transactionId)) {
    throw domainError("STORAGE_RECOVERY_FAILED", `invalid learning transaction artifact ${name}`);
  }
  return { ...type, marker, artifactName, transactionId };
}

async function transactionRecords(context, operations) {
  const entries = await operations.readdir(context.root, { withFileTypes: true });
  const records = new Map();
  for (const entry of entries) {
    const descriptor = transactionDescriptor(entry.name);
    if (descriptor === null) continue;
    if (entry.isSymbolicLink()) throw confinementError(path.join(context.root, entry.name));
    const record = records.get(descriptor.artifactName) ?? {
      kind: descriptor.kind,
      transactionId: descriptor.transactionId,
      artifactName: descriptor.artifactName,
      artifactPath: path.join(context.root, descriptor.artifactName),
      markerPath: path.join(context.root, `${descriptor.artifactName}${OWNER_SUFFIX}`),
      artifact: false,
      marker: false,
    };
    if (descriptor.marker) {
      if (!entry.isFile()) throw confinementError(path.join(context.root, entry.name));
      record.marker = true;
    } else {
      if (!entry.isDirectory()) throw confinementError(path.join(context.root, entry.name));
      record.artifact = true;
    }
    records.set(descriptor.artifactName, record);
  }

  return [...records.values()].sort((left, right) =>
    left.artifactName.localeCompare(right.artifactName),
  );
}

async function assertGitMetadataUntracked(context, records, dependencies) {
  if (!context.git) return;
  const candidates = [
    STORE_OWNER_NAME,
    ...records.flatMap((record) => [record.artifactName, `${record.artifactName}${OWNER_SUFFIX}`]),
  ];
  const tracked = await runGit(context.root, ["ls-files", "--", ...candidates], dependencies);
  if (tracked === null) {
    throw domainError("STORAGE_RECOVERY_FAILED", "could not verify tracked learning metadata");
  }
  if (tracked !== "") {
    throw domainError("STORAGE_RECOVERY_FAILED", "tracked learning metadata is never trusted");
  }
}

async function trustedStoreOwner(context, records, operations, dependencies) {
  await assertGitMetadataUntracked(context, records, dependencies);
  const mirror = await readStoreOwner(context, operations, { allowMissing: true });
  if (!context.git) {
    if (records.length > 0) {
      throw domainError(
        "STORAGE_RECOVERY_FAILED",
        "non-Git transaction residue has no private ownership root",
      );
    }
    return mirror;
  }
  const privateOwner = await readPrivateStoreOwner(context, operations, { allowMissing: true });
  if (privateOwner === null) {
    if (mirror !== null || records.length > 0) {
      throw domainError("STORAGE_RECOVERY_FAILED", "Git-private owner identity is missing");
    }
    return null;
  }
  if (mirror === null) {
    if (records.length > 0) {
      throw domainError("STORAGE_RECOVERY_FAILED", "worktree owner mirror is missing");
    }
    return privateOwner;
  }
  if (!sameOwner(privateOwner, mirror)) {
    throw domainError("STORAGE_RECOVERY_FAILED", "worktree owner mirror does not match Git-private owner identity");
  }
  return privateOwner;
}

async function ownedArtifacts(context, operations, dependencies) {
  const result = await transactionRecords(context, operations);
  const owner = await trustedStoreOwner(context, result, operations, dependencies);
  if (result.length === 0) return result;
  for (const record of result) {
    if (!record.marker) {
      throw domainError(
        "STORAGE_RECOVERY_FAILED",
        `unowned learning transaction artifact ${record.artifactName}`,
      );
    }
    await readOwnershipMarker(
      record.markerPath,
      {
        kind: record.kind,
        ownerId: owner.owner_id,
        projectId: context.projectId,
        transactionId: record.transactionId,
      },
      operations,
    );
    record.ownerId = owner.owner_id;
  }
  return result;
}

async function createOwnerFile(context, ownerPath, ownerRoot, document, dependencies) {
  const operations = fsFor(dependencies);
  if (!containsPath(ownerRoot, ownerPath)) throw confinementError(ownerPath);
  const prefix = ownerPath === storeOwnerPath(context)
    ? STORE_OWNER_TEMP_PREFIX
    : "leanpowers-owner.json.tmp-";
  const prepared = path.join(ownerRoot, `${prefix}${randomId(dependencies)}`);
  let preparedExists = false;
  try {
    await operations.writeFile(prepared, `${JSON.stringify(document)}\n`, { flag: "wx" });
    preparedExists = true;
    parseStoreOwnerDocument(await operations.readFile(prepared), context, prepared);
    await operations.rename(prepared, ownerPath);
    preparedExists = false;
  } catch (error) {
    if (preparedExists) await cleanup(prepared, operations);
    throw error;
  }
}

async function ensureStoreOwner(context, dependencies) {
  const operations = fsFor(dependencies);
  await assertNoOwnerTempArtifacts(context, operations);
  await assertNoPrivateOwnerTempArtifacts(context, operations);
  const records = await transactionRecords(context, operations);
  await assertGitMetadataUntracked(context, records, dependencies);
  const mirror = await readStoreOwner(context, operations, { allowMissing: true });
  if (!context.git) {
    if (records.length > 0) {
      throw domainError(
        "STORAGE_RECOVERY_FAILED",
        "non-Git transaction residue has no private ownership root",
      );
    }
    if (mirror !== null) return mirror;
  } else {
    const privateOwner = await readPrivateStoreOwner(context, operations, { allowMissing: true });
    if (privateOwner === null && (mirror !== null || records.length > 0)) {
      throw domainError("STORAGE_RECOVERY_FAILED", "Git-private owner identity is missing");
    }
    if (privateOwner !== null && mirror !== null) {
      if (!sameOwner(privateOwner, mirror)) {
        throw domainError("STORAGE_RECOVERY_FAILED", "worktree owner mirror does not match Git-private owner identity");
      }
      return privateOwner;
    }
    if (privateOwner !== null) {
      if (records.length > 0) {
        throw domainError("STORAGE_RECOVERY_FAILED", "worktree owner mirror is missing");
      }
      await createOwnerFile(context, storeOwnerPath(context), context.root, privateOwner, dependencies);
      return privateOwner;
    }
  }
  if (records.length > 0) {
    throw domainError(
      "STORAGE_RECOVERY_FAILED",
      "learning store owner identity is missing while transaction artifacts exist",
    );
  }
  const ownerId = randomId(dependencies);
  if (!UUID_V4_PATTERN.test(ownerId)) {
    throw domainError("STORAGE_RECOVERY_FAILED", "generated learning store owner identity is invalid");
  }
  const document = { version: TRANSACTION_VERSION, project_id: context.projectId, owner_id: ownerId };
  if (context.git) {
    await ensurePrivateOwnerRoot(context, operations);
    await createOwnerFile(
      context,
      context.privateOwnerPath,
      context.privateOwnerRoot,
      document,
      dependencies,
    );
  }
  await createOwnerFile(context, storeOwnerPath(context), context.root, document, dependencies);
  return document;
}

async function removeOwnedMarker(record, context, operations) {
  await readOwnershipMarker(
    record.markerPath,
    {
      kind: record.kind,
      ownerId: record.ownerId,
      projectId: context.projectId,
      transactionId: record.transactionId,
    },
    operations,
  );
  await operations.unlink(record.markerPath);
}

async function cleanupOwnedArtifact(record, context, operations) {
  if (record.artifact) {
    await assertDirectoryPath(record.artifactPath, operations);
    try {
      await cleanup(record.artifactPath, operations);
    } catch (error) {
      throw domainError(
        "STORAGE_RECOVERY_FAILED",
        `failed to clean stale learning transaction artifact ${record.artifactName}`,
        error,
      );
    }
  }
  await removeOwnedMarker(record, context, operations);
}

async function validateAuthoritativeBackup(context, backup, operations) {
  await assertDirectoryPath(backup, operations);
  const files = await readTree(backup, operations);
  validateFiles(files, context);
}

async function restoreAuthoritativeBackup(context, record, operations) {
  const { store } = storePaths(context);
  try {
    if (await assertStoreConfinement(context, operations)) {
      await cleanup(store, operations);
    }
    await operations.rename(record.artifactPath, store);
    record.artifact = false;
    await removeOwnedMarker(record, context, operations);
  } catch (error) {
    throw domainError(
      "STORAGE_RECOVERY_FAILED",
      "failed to restore the authoritative learning backup",
      error,
    );
  }
}

const lockPaths = (context) => {
  const lock = path.join(context.root, LOCK_NAME);
  return { lock, marker: path.join(lock, "owner.json") };
};

async function acquireMutationLock(context, dependencies) {
  const operations = fsFor(dependencies);
  const { lock, marker } = lockPaths(context);
  const transactionId = randomId(dependencies);
  try {
    await operations.mkdir(lock, { recursive: false });
  } catch (error) {
    if (error?.code === "EEXIST") {
      const metadata = await lstatIfPresent(lock, operations);
      if (metadata?.isSymbolicLink()) throw confinementError(lock);
      throw domainError("WRITE_CONFLICT", "another learning mutation owns the project lock", error);
    }
    throw error;
  }
  try {
    await operations.writeFile(
      marker,
      `${JSON.stringify(lockOwnershipDocument(transactionId, context))}\n`,
      { flag: "wx" },
    );
  } catch (error) {
    try {
      await operations.rmdir(lock);
    } catch {
      // The empty directory was created by this call, but failed cleanup remains fail-closed.
    }
    throw error;
  }
  return { lock, marker, transactionId, operations };
}

async function releaseMutationLock(context, owner) {
  try {
    await assertDirectoryPath(owner.lock, owner.operations);
    await readLockMarker(
      owner.marker,
      { projectId: context.projectId, transactionId: owner.transactionId },
      owner.operations,
    );
    await owner.operations.unlink(owner.marker);
    await owner.operations.rmdir(owner.lock);
  } catch (error) {
    throw domainError("STORAGE_LOCK_RELEASE_FAILED", "failed to release the owned learning mutation lock", error);
  }
}

async function withMutationLock(context, dependencies, callback) {
  const held = dependencies[MUTATION_LOCK];
  if (held?.root === context.root && held?.projectId === context.projectId) {
    return callback(dependencies);
  }
  const owner = await acquireMutationLock(context, dependencies);
  const lockedDependencies = {
    ...dependencies,
    [MUTATION_LOCK]: { root: context.root, projectId: context.projectId },
  };
  let result;
  let failure;
  try {
    result = await callback(lockedDependencies);
  } catch (error) {
    failure = error;
  }
  let releaseFailure;
  try {
    await releaseMutationLock(context, owner);
  } catch (error) {
    releaseFailure = error;
  }
  if (failure) {
    if (releaseFailure) {
      failure.cleanup_warnings = [
        ...(Array.isArray(failure.cleanup_warnings) ? failure.cleanup_warnings : []),
        {
          code: "STORAGE_LOCK_CLEANUP_FAILED",
          phase: "after_failure",
          message: LOCK_CLEANUP_MESSAGES.after_failure,
        },
      ];
    }
    throw failure;
  }
  if (releaseFailure) {
    return {
      ...result,
      cleanup_warnings: [
        ...(Array.isArray(result?.cleanup_warnings) ? result.cleanup_warnings : []),
        {
          code: "STORAGE_LOCK_CLEANUP_FAILED",
          phase: "post_commit",
          message: LOCK_CLEANUP_MESSAGES.post_commit,
        },
      ],
    };
  }
  return result;
}

async function recoverStoreLocked(context, dependencies) {
  const operations = fsFor(dependencies);
  const artifacts = await ownedArtifacts(context, operations, dependencies);
  if (artifacts.length === 0) return;
  const backups = artifacts.filter((record) => record.kind === "backup" && record.artifact);
  if (backups.length > 1) {
    throw domainError(
      "STORAGE_RECOVERY_FAILED",
      "multiple learning backups require explicit recovery",
    );
  }
  if (backups.length === 1) {
    await validateAuthoritativeBackup(context, backups[0].artifactPath, operations);
  }
  const canonicalExists = await assertStoreConfinement(context, operations);
  for (const record of artifacts) {
    if (record.kind === "backup" && !record.artifact && !canonicalExists) {
      throw domainError("STORAGE_RECOVERY_FAILED", "learning backup marker has no authoritative tree");
    }
  }
  await ensureGitExclude(context, dependencies);
  if (backups.length === 1) {
    await restoreAuthoritativeBackup(context, backups[0], operations);
  }
  for (const record of artifacts) {
    if (record !== backups[0]) await cleanupOwnedArtifact(record, context, operations);
  }
}

async function recoverStore(context, dependencies = {}) {
  const operations = fsFor(dependencies);
  if (!dependencies[MUTATION_LOCK]) {
    const { lock } = lockPaths(context);
    const lockMetadata = await lstatIfPresent(lock, operations);
    if (lockMetadata !== null) {
      if (lockMetadata.isSymbolicLink()) throw confinementError(lock);
      throw domainError("WRITE_CONFLICT", "another learning mutation owns the project lock");
    }
  }
  await assertNoOwnerTempArtifacts(context, operations);
  const artifacts = await ownedArtifacts(context, operations, dependencies);
  if (artifacts.length === 0) return;
  if (context.caller !== "leader") {
    throw domainError(
      "STORAGE_RECOVERY_REQUIRED",
      "learning transaction recovery requires caller leader",
    );
  }
  if (dependencies[MUTATION_LOCK]) {
    return recoverStoreLocked(context, dependencies);
  }
  return withMutationLock(context, dependencies, (locked) => recoverStoreLocked(context, locked));
}

const runGit = async (cwd, args, dependencies) => {
  const execute = dependencies.execFile ?? execFile;
  try {
    const result = await execute("git", args, { cwd, encoding: "utf8" });
    return String(result.stdout ?? "").trim();
  } catch {
    return null;
  }
};

const containsPath = (root, candidate) => {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
};

async function chooseWorkspaceRoot(cwd, dependencies, operations) {
  const candidates = [
    ...(Array.isArray(dependencies.workspaceRoots) ? dependencies.workspaceRoots : []),
    ...(dependencies.workspaceRoot ? [dependencies.workspaceRoot] : []),
  ];
  const resolved = [];
  for (const candidate of candidates) {
    try {
      resolved.push(await operations.realpath(candidate));
    } catch {
      // A runtime-provided root that no longer exists cannot own cwd.
    }
  }
  const containing = resolved.filter((candidate) => containsPath(candidate, cwd));
  containing.sort((left, right) => right.length - left.length || left.localeCompare(right));
  return containing[0] ?? cwd;
}

async function workspaceManifest(root, operations) {
  const entries = [];
  const visit = async (directory, relative = "") => {
    const children = await operations.readdir(directory, { withFileTypes: true });
    children.sort((left, right) => left.name.localeCompare(right.name));
    for (const child of children) {
      if (child.isDirectory() && [".git", STORE_NAME, "node_modules"].includes(child.name)) {
        continue;
      }
      const relativePath = path.posix.join(relative.split(path.sep).join(path.posix.sep), child.name);
      const absolutePath = path.join(directory, child.name);
      if (child.isDirectory()) {
        await visit(absolutePath, relativePath);
      } else if (child.isFile()) {
        const content = await operations.readFile(absolutePath);
        entries.push(`${relativePath}\0${await sha256(content)}`);
      }
    }
  };
  await visit(root);
  return sha256(entries.join("\n"));
}

export async function resolveProject(cwd, dependencies = {}) {
  const operations = fsFor(dependencies);
  const realCwd = await operations.realpath(cwd);
  const gitRootText = await runGit(realCwd, ["rev-parse", "--show-toplevel"], dependencies);
  if (gitRootText !== null) {
    const root = await operations.realpath(gitRootText);
    const rawOrigin = await runGit(root, ["config", "--get", "remote.origin.url"], dependencies);
    const origin = normalizeOriginUrl(rawOrigin);
    const head = (await runGit(root, ["rev-parse", "HEAD"], dependencies)) ?? "unborn";
    const status = await runGit(root, ["status", "--porcelain", "--untracked-files=normal"], dependencies);
    const gitPath = await runGit(root, ["rev-parse", "--git-path", "info/exclude"], dependencies);
    const gitDirectory = await runGit(root, ["rev-parse", "--git-dir"], dependencies);
    if (gitPath === null || gitDirectory === null) {
      throw domainError("PROJECT_RESOLUTION_FAILED", "Git did not return required metadata paths");
    }
    const excludePath = path.resolve(root, gitPath);
    const privateGitRoot = await operations.realpath(path.resolve(root, gitDirectory));
    const privateOwnerRoot = path.join(privateGitRoot, "leanpowers");
    return {
      root,
      git: true,
      origin,
      projectId: computeProjectId({ git: true, gitOrigin: rawOrigin, realRoot: root }),
      revision: `git:${head}:${status ? "dirty" : "clean"}`,
      excludePath,
      privateGitRoot,
      privateOwnerRoot,
      privateOwnerPath: path.join(privateOwnerRoot, "leanpowers-owner.json"),
      caller: dependencies.caller ?? "leader",
    };
  }

  const root = await chooseWorkspaceRoot(realCwd, dependencies, operations);
  return {
    root,
    git: false,
    origin: null,
    projectId: computeProjectId({ git: false, realRoot: root }),
    revision: `workspace:${await workspaceManifest(root, operations)}`,
    excludePath: null,
    privateGitRoot: null,
    privateOwnerRoot: null,
    privateOwnerPath: null,
    caller: dependencies.caller ?? "leader",
  };
}

const serializeEvents = (events) =>
  events.length === 0 ? "" : `${events.map((event) => JSON.stringify(event)).join("\n")}\n`;

const parseConfig = (buffer, context) => {
  let config;
  try {
    config = JSON.parse(buffer.toString("utf8"));
  } catch (error) {
    throw domainError("INVALID_LEARNING_CONFIG", "learning config is not valid JSON", error);
  }
  const errors = validateConfig(config);
  if (errors.length > 0) {
    throw domainError("INVALID_LEARNING_CONFIG", `invalid learning config: ${errors.join("; ")}`);
  }
  if (config.project_id !== context.projectId) {
    throw domainError("PROJECT_MISMATCH", "learning config does not match the current project");
  }
  return config;
};

const parseEvents = (buffer, label, context) => {
  const text = buffer.toString("utf8");
  if (text === "") return [];
  const lines = text.split("\n");
  if (lines.at(-1) === "") lines.pop();
  return lines.map((line, index) => {
    let event;
    try {
      event = JSON.parse(line);
    } catch (error) {
      throw domainError(
        "INVALID_LEARNING_STATE",
        `${label}:${index + 1} is not valid JSON`,
        error,
      );
    }
    const errors = validateEvent(event);
    if (errors.length > 0) {
      throw domainError(
        "INVALID_LEARNING_STATE",
        `${label}:${index + 1} is invalid: ${errors.join("; ")}`,
      );
    }
    if (event.project_id !== context.projectId) {
      throw domainError("PROJECT_MISMATCH", `${label}:${index + 1} does not match the current project`);
    }
    return event;
  });
};

async function readTree(directory, operations) {
  await assertDirectoryPath(directory, operations);
  const files = new Map();
  const visit = async (current, relative = "") => {
    const children = await operations.readdir(current, { withFileTypes: true });
    children.sort((left, right) => left.name.localeCompare(right.name));
    for (const child of children) {
      const childRelative = path.posix.join(relative, child.name);
      const absolute = path.join(current, child.name);
      if (child.isSymbolicLink()) throw confinementError(absolute);
      if (
        child.isFile() &&
        relative === "" &&
        (child.name.startsWith(`${CONFIG_NAME}.tmp-`) ||
          child.name.startsWith(`${LEDGER_NAME}.tmp-`))
      ) {
        continue;
      }
      if (child.isDirectory()) {
        await visit(absolute, childRelative);
      } else if (child.isFile()) {
        files.set(childRelative, await operations.readFile(absolute));
      } else {
        throw domainError("INVALID_LEARNING_STATE", `${childRelative} is not a regular file`);
      }
    }
  };
  await visit(directory);
  return files;
}

async function treeDigest(files) {
  const parts = [];
  for (const [relative, content] of [...files].sort(([left], [right]) => left.localeCompare(right))) {
    parts.push(Buffer.from(relative), Buffer.from([0]), content, Buffer.from([0]));
  }
  return `sha256:${await sha256(Buffer.concat(parts))}`;
}

function validateFiles(files, context) {
  const configBuffer = files.get(CONFIG_NAME);
  if (!configBuffer) {
    throw domainError("INVALID_LEARNING_CONFIG", "learning store has no config.json");
  }
  const config = parseConfig(configBuffer, context);
  const events = parseEvents(files.get(LEDGER_NAME) ?? Buffer.alloc(0), LEDGER_NAME, context);
  const archiveEvents = [];
  const archives = new Map();
  for (const [relative, content] of [...files].sort(([left], [right]) => left.localeCompare(right))) {
    if (relative.startsWith(ARCHIVE_PREFIX) && relative.endsWith(".jsonl")) {
      const parsed = parseEvents(content, relative, context);
      archives.set(relative, parsed);
      archiveEvents.push(...parsed);
    }
  }
  const ids = new Set();
  for (const event of [...events, ...archiveEvents]) {
    if (ids.has(event.event_id)) {
      throw domainError("DUPLICATE_EVENT_ID", `duplicate event ID: ${event.event_id}`);
    }
    ids.add(event.event_id);
  }
  const reduced = reduceLessonEvents(events, { projectId: context.projectId });
  if (reduced.errors.length > 0) {
    throw domainError("INVALID_LEARNING_STATE", reduced.errors.join("; "));
  }
  const persisted = JSON.stringify({ config, events, archiveEvents });
  if (context.root.length > 1 && persisted.includes(context.root)) {
    throw domainError("RAW_PROJECT_PATH", "learning state contains the raw project path");
  }
  return {
    config,
    events,
    archives,
    archiveEvents,
    active: reduced.active,
    inactive: reduced.inactive,
  };
}

async function readConfigGate(context, dependencies, { skipRecovery = false } = {}) {
  if (!skipRecovery) {
    await recoverStore(context, dependencies);
  }
  const operations = fsFor(dependencies);
  const { config } = storePaths(context);
  const storeExists = await assertStoreConfinement(context, operations);
  if (!storeExists) {
    return { config: null, configBuffer: null, operations };
  }
  const configMetadata = await assertDirectStoreFile(context, config, operations, {
    allowMissing: true,
  });
  if (configMetadata === null) {
    return { config: null, configBuffer: null, operations };
  }
  const configBuffer = await readFileIfPresent(config, operations);
  if (configBuffer === null) {
    return { config: null, configBuffer: null, operations };
  }
  return { config: parseConfig(configBuffer, context), configBuffer, operations };
}

async function readSnapshot(
  context,
  dependencies = {},
  { includeDisabledData = false, skipRecovery = false } = {},
) {
  const gate = await readConfigGate(context, dependencies, { skipRecovery });
  if (gate.config === null) {
    return {
      config: null,
      events: [],
      archives: new Map(),
      archiveEvents: [],
      active: [],
      inactive: [],
      files: null,
      digest: "missing",
      operations: gate.operations,
    };
  }
  if (!gate.config.enabled && !includeDisabledData) {
    return {
      config: gate.config,
      events: [],
      archives: new Map(),
      archiveEvents: [],
      active: [],
      inactive: [],
      files: null,
      digest: `sha256:${await sha256(gate.configBuffer)}`,
      operations: gate.operations,
    };
  }
  const { store } = storePaths(context);
  const files = await readTree(store, gate.operations);
  const validated = validateFiles(files, context);
  return {
    ...validated,
    files,
    digest: await treeDigest(files),
    operations: gate.operations,
  };
}

export async function readLearningState(context, dependencies = {}) {
  const snapshot = await readSnapshot(context, dependencies);
  return {
    config: snapshot.config,
    events: snapshot.events,
    active: snapshot.active,
    digest: snapshot.digest,
    ...(snapshot.config?.enabled ? {} : { code: "LEARNING_DISABLED" }),
  };
}

export async function inspectLearningState(context, dependencies = {}) {
  const snapshot = await readSnapshot(context, dependencies, { includeDisabledData: true });
  return {
    config: snapshot.config,
    events: snapshot.events,
    archiveEvents: snapshot.archiveEvents,
    active: snapshot.active,
    inactive: snapshot.inactive,
    digest: snapshot.digest,
  };
}

const cloneFiles = (files) =>
  new Map([...files].map(([relative, content]) => [relative, Buffer.from(content)]));

async function writeTree(directory, files, operations) {
  await operations.mkdir(directory, { recursive: false });
  for (const [relative, content] of [...files].sort(([left], [right]) => left.localeCompare(right))) {
    const destination = path.join(directory, ...relative.split("/"));
    await operations.mkdir(path.dirname(destination), { recursive: true });
    await operations.writeFile(destination, content, { flag: "wx" });
  }
}

async function validatePreparedTree(prepared, context, operations) {
  const files = await readTree(prepared, operations);
  validateFiles(files, context);
  return files;
}

const transactionRecord = (context, kind, transactionId, ownerId) => {
  const prefix = TRANSACTION_KINDS.find((candidate) => candidate.kind === kind)?.prefix;
  const artifactName = `${prefix}${transactionId}`;
  const artifactPath = path.join(context.root, artifactName);
  return {
    kind,
    transactionId,
    artifactName,
    artifactPath,
    markerPath: ownershipMarkerPath(artifactPath),
    ownerId,
    artifact: false,
    marker: false,
  };
};

async function prepareOwnedTree(record, files, context, operations) {
  await createOwnershipMarker(
    record.artifactPath,
    record.kind,
    record.transactionId,
    context,
    record.ownerId,
    operations,
  );
  record.marker = true;
  await writeTree(record.artifactPath, files, operations);
  record.artifact = true;
}

async function cleanupCurrentTransaction(record, context, operations) {
  if (record.artifact) {
    if (record.marker) {
      await cleanupOwnedArtifact(record, context, operations);
      record.marker = false;
    } else {
      await cleanup(record.artifactPath, operations);
    }
    record.artifact = false;
    return;
  }
  if (record.marker) {
    await removeOwnedMarker(record, context, operations);
    record.marker = false;
  }
}

async function removeCurrentMarker(record, context, operations) {
  await removeOwnedMarker(record, context, operations);
  record.marker = false;
}

async function restoreBackupAfterFailedCommit(context, backup, operations, operation) {
  const { store } = storePaths(context);
  try {
    if (await assertStoreConfinement(context, operations)) await cleanup(store, operations);
    await operations.rename(backup.artifactPath, store);
    backup.artifact = false;
  } catch (rollbackError) {
    throw domainError(
      "STORAGE_ROLLBACK_FAILED",
      `${operation} failed and the old learning tree could not be restored`,
      rollbackError,
    );
  }
}

async function commitTreeMutation(
  context,
  dependencies,
  { operation, includeDisabledData = false, build },
) {
  return withMutationLock(context, dependencies, async (lockedDependencies) => {
    const operations = fsFor(lockedDependencies);
    const { store } = storePaths(context);
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const snapshot = await readSnapshot(context, lockedDependencies, { includeDisabledData });
      await ensureGitExclude(context, lockedDependencies);
      const next = await build(snapshot);
      if (next.unchanged && snapshot.config === null) return next.result;
      const storeOwner = await ensureStoreOwner(context, lockedDependencies);
      if (next.unchanged) return next.result;
      validateFiles(next.files, context);
      const prepared = transactionRecord(
        context,
        snapshot.config === null ? "initial" : "replacement",
        randomId(lockedDependencies),
        storeOwner.owner_id,
      );
      let backup = null;
      try {
        await prepareOwnedTree(prepared, next.files, context, operations);
        await lockedDependencies.afterPrepare?.({
          operation,
          attempt,
          preparedPath: prepared.artifactPath,
          context,
        });
        await validatePreparedTree(prepared.artifactPath, context, operations);
        await lockedDependencies.beforeCommit?.({
          operation,
          attempt,
          preparedPath: prepared.artifactPath,
          context,
        });
        const current = await readSnapshot(context, lockedDependencies, {
          includeDisabledData,
          skipRecovery: true,
        });
        if (current.digest !== snapshot.digest) {
          await cleanupCurrentTransaction(prepared, context, operations);
          if (attempt === 2) {
            throw domainError("WRITE_CONFLICT", `${operation} write conflict after retry`);
          }
          continue;
        }

        await removeCurrentMarker(prepared, context, operations);

        if (snapshot.config === null) {
          try {
            await operations.rename(prepared.artifactPath, store);
            prepared.artifact = false;
          } catch (error) {
            if (error?.code === "EEXIST" || error?.code === "ENOTEMPTY") {
              await cleanupCurrentTransaction(prepared, context, operations);
              if (attempt === 2) {
                throw domainError("WRITE_CONFLICT", `${operation} write conflict after retry`, error);
              }
              continue;
            }
            throw error;
          }
        } else {
          backup = transactionRecord(
            context,
            "backup",
            randomId(lockedDependencies),
            storeOwner.owner_id,
          );
          await createOwnershipMarker(
            backup.artifactPath,
            backup.kind,
            backup.transactionId,
            context,
            backup.ownerId,
            operations,
          );
          backup.marker = true;
          await operations.rename(store, backup.artifactPath);
          backup.artifact = true;
          try {
            await operations.rename(prepared.artifactPath, store);
            prepared.artifact = false;
          } catch (error) {
            try {
              await operations.rename(backup.artifactPath, store);
              backup.artifact = false;
            } catch (rollbackError) {
              throw domainError(
                "STORAGE_ROLLBACK_FAILED",
                `${operation} failed and the old learning tree could not be restored`,
                rollbackError,
              );
            }
            throw error;
          }
          try {
            await removeCurrentMarker(backup, context, operations);
          } catch (markerError) {
            await restoreBackupAfterFailedCommit(context, backup, operations, operation);
            throw markerError;
          }
          try {
            await cleanup(backup.artifactPath, operations);
            backup.artifact = false;
          } catch (cleanupError) {
            try {
              await restoreBackupAfterFailedCommit(context, backup, operations, operation);
            } catch (rollbackError) {
              throw rollbackError;
            }
            throw domainError(
              "STORAGE_COMMIT_FAILED",
              `${operation} was rolled back because backup cleanup failed`,
              cleanupError,
            );
          }
        }
        return next.result;
      } catch (error) {
        if (prepared.marker || prepared.artifact) {
          await cleanupCurrentTransaction(prepared, context, operations);
        }
        if (backup?.marker && !backup.artifact) {
          await cleanupCurrentTransaction(backup, context, operations);
        }
        throw error;
      }
    }
    throw domainError("WRITE_CONFLICT", `${operation} write conflict after retry`);
  });
}

const randomId = (dependencies) => (dependencies.randomUUID ?? randomUUID)();

async function ensureGitExclude(context, dependencies) {
  if (!context.git || !context.excludePath) return false;
  const operations = fsFor(dependencies);
  const target = context.excludePath;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const original = (await readFileIfPresent(target, operations)) ?? Buffer.alloc(0);
    const text = original.toString("utf8");
    const lines = new Set(text.split(/\r?\n/));
    const missing = GIT_EXCLUDE_PATTERNS.filter((pattern) => !lines.has(pattern));
    if (missing.length === 0) return true;
    const separator = text.length === 0 || text.endsWith("\n") ? "" : "\n";
    const next = Buffer.from(`${text}${separator}${missing.join("\n")}\n`);
    const prepared = `${target}.tmp-${randomId(dependencies)}`;
    try {
      await operations.mkdir(path.dirname(target), { recursive: true });
      await operations.writeFile(prepared, next, { flag: "wx" });
      const current = (await readFileIfPresent(target, operations)) ?? Buffer.alloc(0);
      if (!current.equals(original)) {
        await cleanup(prepared, operations);
        if (attempt === 2) {
          throw domainError("WRITE_CONFLICT", "Git exclude write conflict after retry");
        }
        continue;
      }
      await operations.rename(prepared, target);
      return true;
    } catch (error) {
      await cleanup(prepared, operations);
      throw error;
    }
  }
  throw domainError("WRITE_CONFLICT", "Git exclude write conflict after retry");
}

export async function enableProject(context, now, dependencies = {}) {
  requireLeader(context);
  const config = {
    schema_version: 1,
    enabled: true,
    project_id: context.projectId,
    enabled_at: now,
  };
  const configErrors = validateConfig(config);
  if (configErrors.length > 0) {
    throw domainError("INVALID_INPUT", `invalid enable request: ${configErrors.join("; ")}`);
  }
  return commitTreeMutation(context, dependencies, {
    operation: "enable",
    includeDisabledData: true,
    async build(snapshot) {
      if (snapshot.config?.enabled && snapshot.config.enabled_at === now) {
        return { unchanged: true, result: { status: "enabled", enabled: true } };
      }
      if (snapshot.config === null) {
        const operations = fsFor(dependencies);
        try {
          const metadata = await operations.stat(storePaths(context).store);
          if (metadata.isDirectory()) {
            throw domainError("INVALID_LEARNING_CONFIG", "learning store exists without config.json");
          }
        } catch (error) {
          if (!isMissing(error)) throw error;
        }
      }
      const files = snapshot.files ? cloneFiles(snapshot.files) : new Map();
      files.set(CONFIG_NAME, Buffer.from(`${JSON.stringify(config)}\n`));
      if (!files.has(LEDGER_NAME)) files.set(LEDGER_NAME, Buffer.alloc(0));
      return { files, result: { status: "enabled", enabled: true } };
    },
  });
}

export async function disableProject(context, _now, dependencies = {}) {
  requireLeader(context);
  return commitTreeMutation(context, dependencies, {
    operation: "disable",
    async build(snapshot) {
      if (snapshot.config === null || !snapshot.config.enabled) {
        return { unchanged: true, result: { status: "disabled", enabled: false } };
      }
      const config = { ...snapshot.config, enabled: false };
      const files = cloneFiles(snapshot.files);
      files.set(CONFIG_NAME, Buffer.from(`${JSON.stringify(config)}\n`));
      return {
        files,
        result: { status: "disabled", enabled: false },
      };
    },
  });
}

const assertEnabled = (snapshot) => {
  if (!snapshot.config?.enabled) {
    throw domainError("LEARNING_DISABLED", "learning is not enabled for this project");
  }
};

const assertCandidate = (context, candidate) => {
  const errors = validateEvent(candidate);
  if (errors.length > 0) {
    throw domainError("INVALID_INPUT", `invalid learning event: ${errors.join("; ")}`);
  }
  if (candidate.project_id !== context.projectId) {
    throw domainError("PROJECT_MISMATCH", "learning event does not match the current project");
  }
};

const exceedsLedgerLimit = (events) =>
  events.length > EVENT_COUNT_LIMIT || Buffer.byteLength(serializeEvents(events)) > LEDGER_BYTE_LIMIT;

function canonicalEvents(snapshot, dependencies) {
  return snapshot.active.flatMap((lesson) => {
    const activation = {
      schema_version: 1,
      event_id: randomId(dependencies),
      project_id: lesson.project_id,
      recorded_at: lesson.activated_at,
      action: "activate",
      lesson_id: lesson.lesson_id,
      kind: lesson.kind,
      scope: structuredClone(lesson.scope),
      rule: lesson.rule,
      evidence: structuredClone(lesson.evidence),
      confidence: lesson.confidence,
      supersedes: [...lesson.supersedes],
      expires_at: lesson.expires_at ?? null,
    };
    if (lesson.last_supported_at === lesson.activated_at) {
      return [activation];
    }
    return [
      activation,
      {
        schema_version: 1,
        event_id: randomId(dependencies),
        project_id: lesson.project_id,
        recorded_at: lesson.last_supported_at,
        action: "reinforce",
        lesson_id: lesson.lesson_id,
        evidence: structuredClone(lesson.evidence),
        confidence: lesson.confidence,
      },
    ];
  });
}

const archiveName = (dependencies) => {
  const instant = (dependencies.now?.() ?? new Date().toISOString()).replace(/[^0-9A-Za-z]+/g, "-");
  return `${ARCHIVE_PREFIX}${instant}-${randomId(dependencies)}.jsonl`;
};

function compactedFiles(snapshot, dependencies) {
  const files = cloneFiles(snapshot.files);
  files.set(LEDGER_NAME, Buffer.from(serializeEvents(canonicalEvents(snapshot, dependencies))));
  if (snapshot.events.length > 0) {
    files.set(archiveName(dependencies), Buffer.from(serializeEvents(snapshot.events)));
  }
  return files;
}

export async function recordCandidate(context, candidate, dependencies = {}) {
  requireLeader(context);
  assertCandidate(context, candidate);
  return commitTreeMutation(context, dependencies, {
    operation: "record",
    async build(snapshot) {
      assertEnabled(snapshot);
      if (snapshot.events.some((event) => event.event_id === candidate.event_id) || snapshot.archiveEvents.some((event) => event.event_id === candidate.event_id)) {
        throw domainError("DUPLICATE_EVENT_ID", `duplicate event ID: ${candidate.event_id}`);
      }
      const events = [...snapshot.events, candidate];
      if (exceedsLedgerLimit(events)) {
        const reduced = reduceLessonEvents(events, { projectId: context.projectId });
        if (reduced.errors.length > 0) {
          throw domainError("INVALID_LEARNING_STATE", reduced.errors.join("; "));
        }
        const files = compactedFiles(
          { ...snapshot, events, active: reduced.active },
          dependencies,
        );
        return {
          files,
          result: { status: "recorded", compacted: true, event: candidate },
        };
      }
      const files = cloneFiles(snapshot.files);
      files.set(LEDGER_NAME, Buffer.from(serializeEvents(events)));
      return {
        files,
        result: { status: "recorded", compacted: false, event: candidate },
      };
    },
  });
}

export async function compactLedger(context, dependencies = {}) {
  requireLeader(context);
  return commitTreeMutation(context, dependencies, {
    operation: "compact",
    async build(snapshot) {
      if (snapshot.config === null || !snapshot.config.enabled) {
        return {
          unchanged: true,
          result: { status: "unchanged", code: "LEARNING_DISABLED" },
        };
      }
      assertEnabled(snapshot);
      if (!exceedsLedgerLimit(snapshot.events)) {
        return { unchanged: true, result: { status: "unchanged" } };
      }
      return {
        files: compactedFiles(snapshot, dependencies),
        result: { status: "compacted", archivedEvents: snapshot.events.length },
      };
    },
  });
}

const eventLessonIds = (events) =>
  [...new Set(events.flatMap((event) => (event.lesson_id ? [event.lesson_id] : [])))].sort();

function deletionPlan(snapshot, request) {
  if (request === null || typeof request !== "object" || Array.isArray(request)) {
    throw domainError("INVALID_INPUT", "delete request must be an object");
  }
  const allEvents = [...snapshot.events, ...snapshot.archiveEvents];
  if (request.all === true) {
    return { all: true, deleted: new Set(eventLessonIds(allEvents)) };
  }
  if (!Array.isArray(request.lessonIds) || request.lessonIds.length === 0 || request.lessonIds.some((id) => typeof id !== "string")) {
    throw domainError("INVALID_INPUT", "delete request requires non-empty lessonIds");
  }
  const existing = new Set(eventLessonIds(allEvents));
  const deleted = new Set(request.lessonIds.filter((id) => existing.has(id)));
  let changed = true;
  while (changed) {
    changed = false;
    for (const event of allEvents) {
      if (event.action !== "supersede" || deleted.has(event.lesson_id)) continue;
      const remaining = event.supersedes.filter((id) => !deleted.has(id));
      if (event.supersedes.length > 0 && remaining.length === 0) {
        deleted.add(event.lesson_id);
        changed = true;
      }
    }
  }
  return { all: false, deleted };
}

function deleteFromEvents(events, plan) {
  if (plan.all) return [];
  return events
    .filter((event) => !event.lesson_id || !plan.deleted.has(event.lesson_id))
    .map((event) =>
      Array.isArray(event.supersedes)
        ? { ...event, supersedes: event.supersedes.filter((id) => !plan.deleted.has(id)) }
        : event,
    );
}

export async function deleteLearning(context, request, dependencies = {}) {
  requireLeader(context);
  return commitTreeMutation(context, dependencies, {
    operation: "delete",
    includeDisabledData: true,
    async build(snapshot) {
      if (snapshot.config === null) {
        return {
          unchanged: true,
          result: { status: "deleted", deletedLessonIds: [] },
        };
      }
      const plan = deletionPlan(snapshot, request);
      const files = cloneFiles(snapshot.files);
      files.set(LEDGER_NAME, Buffer.from(serializeEvents(deleteFromEvents(snapshot.events, plan))));
      for (const [relative, events] of snapshot.archives) {
        const remaining = deleteFromEvents(events, plan);
        if (remaining.length === 0) files.delete(relative);
        else files.set(relative, Buffer.from(serializeEvents(remaining)));
      }
      return {
        files,
        result: { status: "deleted", deletedLessonIds: [...plan.deleted].sort() },
      };
    },
  });
}
