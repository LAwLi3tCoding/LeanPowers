import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";

const ROOT = path.resolve(import.meta.dirname, "..");
const EXPECTED_NAME = "LAwLi3tCoding";
const HISTORICAL_NOREPLY_EMAIL = "203456625+LAwLi3tCoding@users.noreply.github.com";
const APPROVED_PERSONAL_EMAIL_DOMAINS = new Set([
  "hotmail.co.uk",
  "hotmail.com",
  "live.com",
  "msn.com",
  "outlook.cn",
  "outlook.com",
]);
const DEPRECATED_IDENTITY = ["LAwLi3t", "CN"].join("-");
const MACHINE_HOME = /(?:\/Users\/(?!alice(?=[/"'\s),.;]|$)|example(?=[/"'\s),.;]|$))[^/\s]+|\/home\/[^/\s]+|\/root\/(?!private(?=[/"'\s),.;]|$))[^/\s]+|[A-Za-z]:\\Users\\[^\\\s]+)/u;
const EMAIL = /([A-Za-z0-9._%+-]+)@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/gu;
const SAFE_EMAIL_DOMAINS = new Set([
  "example.com",
  "example.invalid",
  "users.noreply.github.com",
]);
const HISTORY_CANDIDATE_PATTERN = [
  ["", "Users", ""].join("/"),
  ["", "home", ""].join("/"),
  ["", "root", ""].join("/"),
  String.raw`[A-Za-z]:\\Users\\`,
  String.raw`[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}`,
  DEPRECATED_IDENTITY,
].join("|");

function privacyFindings(content) {
  const findings = [];
  if (MACHINE_HOME.test(content)) {
    findings.push("machine-specific home path");
  }
  if (content.includes(DEPRECATED_IDENTITY)) {
    findings.push("deprecated public identity");
  }
  for (const match of content.matchAll(EMAIL)) {
    const [, localPart, rawDomain] = match;
    const domain = rawDomain.toLowerCase();
    const nextCharacter = content[match.index + match[0].length];
    const isGitAddress = domain === "github.com"
      && (localPart === "git" || localPart === "token")
      && (nextCharacter === "/" || nextCharacter === ":");
    if (!SAFE_EMAIL_DOMAINS.has(domain) && !isGitAddress) {
      findings.push("non-public email address");
    }
  }
  return findings;
}

function approvedCommitIdentity(identity) {
  const [authorName, authorEmail, committerName, committerEmail, ...extra] =
    identity.split("|");
  if (
    extra.length > 0
    || authorName !== EXPECTED_NAME
    || committerName !== EXPECTED_NAME
    || authorEmail !== committerEmail
  ) {
    return false;
  }
  if (authorEmail === HISTORICAL_NOREPLY_EMAIL) {
    return true;
  }
  const separator = authorEmail.lastIndexOf("@");
  return separator > 0
    && APPROVED_PERSONAL_EMAIL_DOMAINS.has(authorEmail.slice(separator + 1).toLowerCase());
}

function gitLines(args) {
  return execFileSync("git", args, {
    cwd: ROOT,
    encoding: "utf8",
  }).split("\n").filter(Boolean);
}

function matchingHistoryLines(commit) {
  const result = spawnSync(
    "git",
    ["grep", "-I", "-n", "-E", HISTORY_CANDIDATE_PATTERN, commit, "--"],
    { cwd: ROOT, encoding: "utf8" },
  );
  if (result.status !== 0 && result.status !== 1) {
    throw new Error(result.stderr || `git grep failed with exit ${result.status}`);
  }
  return result.stdout.split("\n").filter(Boolean);
}

test("privacy detector rejects private values but permits public and synthetic fixtures", () => {
  const privateHome = ["", "Users", "private-user", "project"].join("/");
  const publicSyntheticHome = ["", "Users", "example", "repository"].join("/");
  const privateEmail = ["author", "private-company.test"].join("@");

  assert.deepEqual(privacyFindings(privateHome), ["machine-specific home path"]);
  assert.deepEqual(privacyFindings(privateEmail), ["non-public email address"]);
  assert.deepEqual(
    privacyFindings("203456625+LAwLi3tCoding@users.noreply.github.com"),
    [],
  );
  assert.deepEqual(privacyFindings("git@github.com:owner/repository.git"), []);
  assert.deepEqual(privacyFindings(publicSyntheticHome), []);
});

test("commit identity policy accepts historical noreply and personal Outlook metadata", () => {
  const personalEmail = ["developer", "outlook.com"].join("@");
  assert.equal(
    approvedCommitIdentity(
      [EXPECTED_NAME, HISTORICAL_NOREPLY_EMAIL, EXPECTED_NAME, HISTORICAL_NOREPLY_EMAIL]
        .join("|"),
    ),
    true,
  );
  assert.equal(
    approvedCommitIdentity([EXPECTED_NAME, personalEmail, EXPECTED_NAME, personalEmail].join("|")),
    true,
  );
  assert.equal(
    approvedCommitIdentity(["other", personalEmail, "other", personalEmail].join("|")),
    false,
  );
});

test("all reachable commits use an approved GitHub identity", () => {
  const identities = gitLines([
    "log",
    "HEAD",
    "--format=%an|%ae|%cn|%ce",
  ]);
  assert.ok(identities.length > 0);
  assert.ok(
    identities.every(approvedCommitIdentity),
    "reachable commit identity is outside the approved GitHub policy",
  );
});

test("all reachable commit messages, paths, and text blobs pass the privacy guard", () => {
  const findings = [];

  for (const commit of gitLines(["rev-list", "HEAD"])) {
    const message = execFileSync(
      "git",
      ["show", "-s", "--format=%B", commit],
      { cwd: ROOT, encoding: "utf8" },
    );
    for (const finding of privacyFindings(message)) {
      findings.push(`${commit}: commit message: ${finding}`);
    }

    const paths = execFileSync(
      "git",
      ["ls-tree", "-r", "--name-only", "-z", commit],
      { cwd: ROOT, encoding: "utf8" },
    ).split("\0").filter(Boolean);
    for (const filePath of paths) {
      for (const finding of privacyFindings(filePath)) {
        findings.push(`${commit}:${filePath}: path: ${finding}`);
      }
    }

    for (const line of matchingHistoryLines(commit)) {
      for (const finding of privacyFindings(line)) {
        findings.push(`${commit}: ${finding}: ${line}`);
      }
    }
  }

  assert.deepEqual(findings, []);
});
