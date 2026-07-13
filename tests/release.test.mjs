import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import {
  access,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import {
  buildRelease,
  resolveSafeOutputRoot,
} from "../scripts/build-release.mjs";
import * as packageValidator from "../scripts/validate-package.mjs";

const {
  collectValidationErrors,
  validateHookDescriptor,
  validateHookOutput,
} = packageValidator;
const root = path.resolve(new URL("../", import.meta.url).pathname);
const codexRoot = path.join(root, "plugins/codex/leanpowers");
const claudeRoot = path.join(root, "plugins/claude/leanpowers");
const execFile = promisify(execFileCallback);

test("repository package validation passes", async () => {
  assert.deepEqual(await collectValidationErrors(), []);
});

test("standalone validation rejects malformed Claude hook wiring and output", () => {
  assert.ok(validateHookDescriptor({ hooks: {} }).length > 0);
  assert.ok(
    validateHookOutput({
      hookSpecificOutput: { hookEventName: "Other", additionalContext: "" },
    }).length >= 2,
  );
});

test("one runtime-aware controller backs explicit and standalone package validation", async (context) => {
  assert.equal(typeof packageValidator.validatePackage, "function");
  for (const runtime of ["codex", "claude"]) {
    const packageRoot = await packageFixture(context, runtime);
    const explicit = await packageValidator.validatePackage(packageRoot, { runtime });
    assert.deepEqual(explicit, []);
    assert.deepEqual(await validateStandalone(packageRoot), explicit);
  }
});

test("standalone inference and explicit validation reject missing or wrong manifests", async (context) => {
  const missing = await packageFixture(context);
  await rm(path.join(missing, ".codex-plugin"), { recursive: true });
  assert.ok(
    (await validateStandalone(missing)).some((error) =>
      error.includes("requires exactly one runtime manifest"),
    ),
  );

  const wrong = await packageFixture(context);
  const errors = await validateRuntime(wrong, "claude");
  assert.ok(errors.some((error) => error.includes("missing package file .claude-plugin/plugin.json")));
  assert.ok(errors.some((error) => error.includes("unexpected package directory .codex-plugin")));
});

test("runtime-aware validation rejects Codex runtime extras", async (context) => {
  const packageRoot = await packageFixture(context);
  await mkdir(path.join(packageRoot, "hooks"));
  await writeFile(path.join(packageRoot, "hooks/unsafe"), "#!/bin/sh\n");

  assert.ok(
    (await validateRuntime(packageRoot, "codex")).some((error) =>
      error.includes("unexpected package directory hooks"),
    ),
  );
});

test("runtime-aware validation rejects missing or malformed Claude hook and agents", async (context) => {
  const missingAgent = await packageFixture(context, "claude");
  await rm(path.join(missingAgent, "agents/reviewer.md"));
  assert.ok(
    (await validateRuntime(missingAgent, "claude")).some((error) =>
      error.includes("missing package file agents/reviewer.md"),
    ),
  );

  const malformedHook = await packageFixture(context, "claude");
  await writeFile(path.join(malformedHook, "hooks/hooks.json"), '{"hooks":{}}\n');
  assert.ok(
    (await validateRuntime(malformedHook, "claude")).some((error) =>
      error.includes("requires one SessionStart entry"),
    ),
  );

  const malformedAgent = await packageFixture(context, "claude");
  await writeFile(path.join(malformedAgent, "agents/verifier.md"), "malformed agent\n");
  assert.ok(
    (await validateRuntime(malformedAgent, "claude")).some((error) =>
      error.includes("agents/verifier.md: missing agent frontmatter"),
    ),
  );
});

test("standalone package validation rejects extra schemas and missing helpers", async (context) => {
  const extraSchema = await packageFixture(context);
  await writeFile(path.join(extraSchema, "schemas/evidence.schema.json"), "{}\n");
  assert.ok(
    (await validateStandalone(extraSchema)).some((error) =>
      error.includes("unexpected package schema schemas/evidence.schema.json"),
    ),
  );

  const missingHelper = await packageFixture(context);
  await rm(path.join(missingHelper, "skills/adapt/scripts/learning-core.mjs"));
  assert.ok(
    (await validateStandalone(missingHelper)).some((error) =>
      error.includes("missing skills/adapt/scripts/learning-core.mjs"),
    ),
  );
});

test("standalone package validation rejects every manifest-external file and directory", async (context) => {
  const cases = [
    ["extra Skill", async (packageRoot) => {
      const directory = path.join(packageRoot, "skills/eighth");
      await mkdir(directory, { recursive: true });
      await writeFile(path.join(directory, "SKILL.md"), "---\nname: eighth\ndescription: Use when extra.\n---\n");
    }],
    ["extra helper", async (packageRoot) => {
      await writeFile(path.join(packageRoot, "skills/adapt/scripts/extra.mjs"), "export {};\n");
    }],
    ["nested docs/evals", async (packageRoot) => {
      const directory = path.join(packageRoot, "docs/evals");
      await mkdir(directory, { recursive: true });
      await writeFile(path.join(directory, "case.json"), "{}\n");
    }],
    ["unexpected empty directory", async (packageRoot) => {
      await mkdir(path.join(packageRoot, "empty-unexpected"));
    }],
  ];

  for (const [label, mutate] of cases) {
    const packageRoot = await packageFixture(context);
    await mutate(packageRoot);
    assert.ok(
      (await validateStandalone(packageRoot)).some((error) =>
        /unexpected package (?:file|directory)/i.test(error),
      ),
      label,
    );
  }
});

test("standalone package validation rejects symlinks without following them", async (context) => {
  const packageRoot = await packageFixture(context);
  await symlink("README.md", path.join(packageRoot, "linked-readme"));

  assert.ok(
    (await validateStandalone(packageRoot)).some((error) =>
      /package symlink.*linked-readme/i.test(error),
    ),
  );
});

test("standalone package validation rejects special entries where supported", async (context) => {
  const packageRoot = await packageFixture(context);
  const special = path.join(packageRoot, "special-entry");
  try {
    await execFile("mkfifo", [special]);
  } catch {
    context.skip("mkfifo is unavailable on this platform");
    return;
  }

  assert.ok(
    (await validateStandalone(packageRoot)).some((error) =>
      /special package entry.*special-entry/i.test(error),
    ),
  );
});

test("standalone package validation rejects helper imports outside the package", async (context) => {
  const packageRoot = await packageFixture(context);
  const helper = path.join(packageRoot, "skills/adapt/scripts/learning.mjs");
  const source = await readFile(helper, "utf8");
  await writeFile(
    helper,
    source.replace("./learning-core.mjs", "../../../../../outside.mjs"),
  );

  assert.ok(
    (await validateStandalone(packageRoot)).some((error) =>
      error.includes("import escapes package: ../../../../../outside.mjs"),
    ),
  );
});

test("standalone package validation scans dynamic imports with options", async (context) => {
  const packageRoot = await packageFixture(context);
  const helper = path.join(packageRoot, "skills/adapt/scripts/learning-core.mjs");
  await appendFile(
    helper,
    '\nexport async function escapedDynamicFixture() { return import("../../../../../outside.mjs", { with: { type: "json" } }); }\n',
  );

  assert.ok(
    (await validateStandalone(packageRoot)).some((error) =>
      error.includes("import escapes package: ../../../../../outside.mjs"),
    ),
  );
});

test(
  "standalone package validation cannot hide commented dynamic imports after regex literals",
  async (context) => {
    const packageRoot = await packageFixture(context);
    const helper = path.join(packageRoot, "skills/adapt/scripts/learning-core.mjs");
    await appendFile(
      helper,
      '\nconst marker = /`/; export const pending = import /*comment*/ ("../../../../../outside.mjs");\n',
    );

    assert.ok(
      (await validateStandalone(packageRoot)).some((error) =>
        error.includes("import escapes package: ../../../../../outside.mjs"),
      ),
    );
  },
);

test(
  "standalone package validation lexes regex classes escapes flags and division conservatively",
  async (context) => {
    const prefixes = [
      ["character class and flags", "const marker = /[`]+/giu;"],
      ["escaped slash", "const marker = /\\//g;"],
      ["regex after control condition", 'if (true) /[`]/u.test("`");'],
      ["division after expression", "const ratio = (12 + 6) / 3;"],
    ];

    for (const [label, prefix] of prefixes) {
      const packageRoot = await packageFixture(context);
      const helper = path.join(packageRoot, "skills/adapt/scripts/learning-core.mjs");
      await appendFile(
        helper,
        `\n${prefix} export const pending = import /*comment*/ ("../../../../../outside.mjs");\n`,
      );

      assert.ok(
        (await validateStandalone(packageRoot)).some((error) =>
          error.includes("import escapes package: ../../../../../outside.mjs"),
        ),
        label,
      );
    }
  },
);

test("standalone package validation fails closed when slash lexical context is ambiguous", async (context) => {
  const packageRoot = await packageFixture(context);
  const helper = path.join(packageRoot, "skills/adapt/scripts/learning-core.mjs");
  await appendFile(
    helper,
    '\nif (true) {} /[`]/u.test("`"); export const pending = import /*comment*/ ("../../../../../outside.mjs");\n',
  );

  assert.ok(
    (await validateStandalone(packageRoot)).some((error) =>
      error.includes("slash token cannot be safely classified"),
    ),
  );
});

test("standalone package validation cannot hide imports after postfix updates", async (context) => {
  for (const operator of ["++", "--"]) {
    const packageRoot = await packageFixture(context);
    const helper = path.join(packageRoot, "skills/adapt/scripts/learning-core.mjs");
    await appendFile(
      helper,
      `\nfunction dormant(y){ let x=1; return x${operator} / y + import("/outside.mjs"); }\n`,
    );

    assert.ok(
      (await validateStandalone(packageRoot)).some((error) =>
        error.includes("slash token cannot be safely classified"),
      ),
      operator,
    );
  }
});

test("standalone package validation fails closed on unterminated strings", async (context) => {
  const packageRoot = await packageFixture(context);
  const helper = path.join(packageRoot, "skills/adapt/scripts/learning-core.mjs");
  await appendFile(helper, '\nexport const unclosed = "unterminated');

  assert.ok(
    (await validateStandalone(packageRoot)).some((error) =>
      error.includes("unterminated string literal cannot be safely classified"),
    ),
  );
});

test("standalone package validation accepts simple template imports with options", async (context) => {
  const packageRoot = await packageFixture(context);
  const helper = path.join(packageRoot, "skills/adapt/scripts/learning-core.mjs");
  await appendFile(
    helper,
    "\nexport async function templateImportFixture() { return import(`node:fs`, { with: {} }); }\n",
  );

  assert.deepEqual(await validateStandalone(packageRoot), []);
});

test("standalone package validation rejects computed template imports", async (context) => {
  const packageRoot = await packageFixture(context);
  const helper = path.join(packageRoot, "skills/adapt/scripts/learning-core.mjs");
  await appendFile(
    helper,
    "\nexport async function computedImportFixture(name) { return import(`./${name}.mjs`); }\n",
  );

  assert.ok(
    (await validateStandalone(packageRoot)).some((error) =>
      error.includes("dynamic import specifier is not statically provable"),
    ),
  );
});

test("standalone package validation rejects escaped import specifiers", async (context) => {
  const packageRoot = await packageFixture(context);
  const helper = path.join(packageRoot, "skills/adapt/scripts/learning-core.mjs");
  await appendFile(
    helper,
    '\nexport async function escapedImportFixture() { return import("\\u002e\\u002e/\\u002e\\u002e/outside.mjs"); }\n',
  );

  assert.ok(
    (await validateStandalone(packageRoot)).some((error) =>
      error.includes("escaped import specifier cannot be proven"),
    ),
  );
});

test("standalone package validation realpaths symlink import targets", async (context) => {
  const packageRoot = await packageFixture(context);
  const outside = path.join(path.dirname(packageRoot), "outside.mjs");
  const imported = path.join(packageRoot, "skills/adapt/scripts/learning-core.mjs");
  await writeFile(outside, "export {};\n");
  await rm(imported);
  await symlink(outside, imported);

  assert.ok(
    (await validateStandalone(packageRoot)).some((error) =>
      error.includes("import resolves outside package: ./learning-core.mjs"),
    ),
  );
});

test("learning runtime validation isolates every environment path under one sandbox", async (context) => {
  const packageRoot = await packageFixture(context);
  await writeFile(
    path.join(packageRoot, "skills/adapt/scripts/learning.mjs"),
    `import path from "node:path";
const keys = ["HOME", "USERPROFILE", "XDG_CONFIG_HOME", "XDG_CACHE_HOME", "XDG_DATA_HOME", "TMPDIR", "TMP", "TEMP", "PATH"];
const values = keys.map((key) => process.env[key]);
const sandbox = values[0] && path.dirname(values[0]);
const isolated = values.every((value) => typeof value === "string" && path.dirname(value) === sandbox)
  && process.cwd() === path.join(sandbox, "cwd")
  && process.env.PATH === path.join(sandbox, "path");
if (!isolated) {
  process.stderr.write("runtime paths are not isolated\\n");
  process.exitCode = 9;
} else if (process.argv[2] === "--help") {
  process.stdout.write("Usage: fixture\\n");
} else {
  process.stdout.write(JSON.stringify({ ok: true, schemas: true }) + "\\n");
}
`,
  );

  assert.deepEqual(await validateStandalone(packageRoot), []);
});

test("learning runtime validation rejects host-home and unexpected sandbox side effects", async (context) => {
  const packageRoot = await packageFixture(context);
  await writeFile(
    path.join(packageRoot, "skills/adapt/scripts/learning.mjs"),
    `import { writeFile } from "node:fs/promises";
import path from "node:path";
await writeFile(path.join(process.env.HOME ?? process.cwd(), ".leanpowers-host"), "created\\n");
await writeFile(path.join(process.env.TMPDIR ?? process.cwd(), "unexpected-entry"), "created\\n");
if (process.argv[2] === "--help") {
  process.stdout.write("Usage: fixture\\n");
} else {
  process.stdout.write(JSON.stringify({ ok: true, schemas: true }) + "\\n");
}
`,
  );

  const errors = await validateStandalone(packageRoot);
  assert.ok(errors.some((error) => error.includes("created .leanpowers-host")));
  assert.ok(errors.some((error) => error.includes("unexpected sandbox entry")));
});

test("standalone package validation reports learning help and doctor failures or timeouts", async (context) => {
  const helpFailure = await packageFixture(context);
  await writeFile(
    path.join(helpFailure, "skills/adapt/scripts/learning.mjs"),
    "process.stderr.write('help failed\\n'); process.exitCode = 9;\n",
  );
  assert.ok(
    (await validateStandalone(helpFailure)).some((error) =>
      error.includes("learning.mjs --help failed"),
    ),
  );

  const doctorFailure = await packageFixture(context);
  await writeFile(
    path.join(doctorFailure, "skills/adapt/scripts/learning.mjs"),
    `if (process.argv[2] === "--help") {
  process.stdout.write("Usage: fixture\\n");
} else {
  process.stdin.resume();
  process.stdin.on("end", () => { process.exitCode = 9; });
}
`,
  );
  assert.ok(
    (await validateStandalone(doctorFailure)).some((error) =>
      error.includes("learning.mjs doctor failed"),
    ),
  );

  const timeout = await packageFixture(context);
  await writeFile(
    path.join(timeout, "skills/adapt/scripts/learning.mjs"),
    "setInterval(() => {}, 1000);\n",
  );
  assert.ok(
    (await validateStandalone(timeout, { timeoutMs: 25 })).some((error) =>
      error.includes("timed out"),
    ),
  );
});

test("release builder creates isolated Codex and Claude distributions", async (context) => {
  const outputRoot = await mkdtemp(path.join(os.tmpdir(), "leanpowers-release-"));
  context.after(() => rm(outputRoot, { force: true, recursive: true }));

  const outputs = await buildRelease({ outputRoot });
  assert.equal(outputs.codex, path.join(outputRoot, "codex/leanpowers"));
  assert.equal(outputs.claude, path.join(outputRoot, "claude/leanpowers"));
  await access(path.join(outputs.codex, ".codex-plugin/plugin.json"));
  await access(path.join(outputs.claude, ".claude-plugin/plugin.json"));
  await access(path.join(outputs.codex, "README.md"));
  await access(path.join(outputs.claude, "LICENSE"));
  await access(path.join(outputs.codex, "skills/adapt/scripts/learning.mjs"));
  await access(path.join(outputs.claude, "schemas/learning-config.schema.json"));
  await access(path.join(outputs.codex, "schemas/lesson-event.schema.json"));
  await assert.rejects(access(path.join(outputs.codex, "hooks")));
  await assert.rejects(access(path.join(outputs.claude, ".codex-plugin")));
});

test("release builder validates staged package copies before swapping output", async (context) => {
  const outputRoot = await mkdtemp(path.join(os.tmpdir(), "leanpowers-release-stage-"));
  await rm(outputRoot, { recursive: true });
  context.after(() => rm(outputRoot, { force: true, recursive: true }));

  await assert.rejects(
    buildRelease(
      { outputRoot },
      {
        async afterStage(staged) {
          await mkdir(path.join(staged.codex, "unexpected-empty"));
        },
      },
    ),
    /staged release validation failed[\s\S]*unexpected package directory unexpected-empty/i,
  );
  await assert.rejects(access(outputRoot));
});

test("release builder rejects repository and source-package overlap", () => {
  assert.throws(() => resolveSafeOutputRoot(root), /contains the repository/);
  assert.throws(
    () => resolveSafeOutputRoot(path.dirname(root)),
    /contains the repository/,
  );
  assert.throws(
    () => resolveSafeOutputRoot(path.join(root, "plugins/codex/leanpowers")),
    /must stay under dist/,
  );
  assert.equal(
    resolveSafeOutputRoot(path.join(root, "dist/custom")),
    path.join(root, "dist/custom"),
  );
});

test("metadata, package.json, and generated manifests keep one version", async () => {
  const [metadata, packageJson, codexManifest, claudeManifest] = await Promise.all(
    [
      "metadata/plugin.json",
      "package.json",
      "plugins/codex/leanpowers/.codex-plugin/plugin.json",
      "plugins/claude/leanpowers/.claude-plugin/plugin.json",
    ].map(async (file) => JSON.parse(await readFile(new URL(`../${file}`, import.meta.url)))),
  );
  assert.equal(packageJson.version, metadata.version);
  assert.equal(codexManifest.version, metadata.version);
  assert.equal(claudeManifest.version, metadata.version);
});

async function packageFixture(context, runtime = "codex") {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "leanpowers-validator-"));
  context.after(() => rm(temporaryRoot, { force: true, recursive: true }));
  const packageRoot = path.join(temporaryRoot, "leanpowers");
  await cp(runtime === "codex" ? codexRoot : claudeRoot, packageRoot, { recursive: true });
  return packageRoot;
}

async function appendFile(file, content) {
  await writeFile(file, `${await readFile(file, "utf8")}${content}`);
}

async function validateStandalone(packageRoot, options) {
  assert.equal(
    typeof packageValidator.validateStandalonePackage,
    "function",
    "validator must export validateStandalonePackage",
  );
  return packageValidator.validateStandalonePackage(packageRoot, options);
}

async function validateRuntime(packageRoot, runtime, options = {}) {
  assert.equal(
    typeof packageValidator.validatePackage,
    "function",
    "validator must export validatePackage",
  );
  return packageValidator.validatePackage(packageRoot, { ...options, runtime });
}
