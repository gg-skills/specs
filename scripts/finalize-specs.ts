#!/usr/bin/env -S npx tsx

/**
 * @fileoverview Finalizes spec bundles created by the specs skill by staging or committing
 * `.specs/` study-style artifacts after drafting sessions complete.
 *
 * Supports `--latest` resolution, optional dry-run, and explicit `--specs-dir` overrides before
 * shelling to git.
 *
 * @example
 * tsx skills/specs/scripts/finalize-specs.ts --latest
 * tsx skills/specs/scripts/finalize-specs.ts \
 *   --specs-dir 2026-04-30-my-feature --dry-run
 *
 * @testing CLI manual: npm run file-overview-standards:target-brief -- --file skills/specs/scripts/finalize-specs.ts
 * @see skills/specs/scripts/init-specs.ts - Counterpart initializer that materializes the spec folders this finalizer stages or commits.
 * @documentation reviewed=2026-04-30 standard=FILE_OVERVIEW_STANDARDS_TYPESCRIPT@3
 */


import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/**
 * Parsed finalize-specs CLI flags after argv normalization.
 *
 * @remarks
 * Either `latest` or a non-empty `specsDir` is required before resolving paths; `parseArgs` enforces
 * that invariant.
 */
type CliArgs = {
  specsDir?: string;
  latest: boolean;
  commitMessage?: string;
  dryRun: boolean;
};

/**
 * Parses finalize-specs argv into structured flags.
 *
 * @remarks
 * Supports `--dry-run`, `--latest`, `--specs-dir`, and `--commit-message` in both `--flag value` and
 * `--flag=value` forms. Throws when neither `--latest` nor a usable `--specs-dir` is provided.
 */
function parseArgs(argv: string[]): CliArgs {
  const parsed: CliArgs = {
    specsDir: undefined,
    latest: false,
    commitMessage: undefined,
    dryRun: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i];

    if (current === "--dry-run") {
      parsed.dryRun = true;
      continue;
    }

    if (current === "--latest") {
      parsed.latest = true;
      continue;
    }

    if (current === "--specs-dir") {
      parsed.specsDir = argv[i + 1] ?? "";
      i += 1;
      continue;
    }

    if (current.startsWith("--specs-dir=")) {
      parsed.specsDir = current.slice("--specs-dir=".length);
      continue;
    }

    if (current === "--commit-message") {
      parsed.commitMessage = argv[i + 1] ?? "";
      i += 1;
      continue;
    }

    if (current.startsWith("--commit-message=")) {
      parsed.commitMessage = current.slice("--commit-message=".length);
    }
  }

  if (!parsed.latest && (!parsed.specsDir || parsed.specsDir.trim().length === 0)) {
    throw new Error("Provide --specs-dir or use --latest.");
  }

  return parsed;
}

/**
 * Runs a git subprocess and returns trimmed stdout.
 *
 * @remarks
 * I/O: synchronous `execSync` against `git` with stdin ignored and stdout captured as UTF-8 text.
 */
function runGitCommand(args: string[], cwd: string): string {
  return execSync(`git ${args.map(shellEscape).join(" ")}`, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

/**
 * Quotes a string for safe interpolation into a single-shell `git ...` invocation.
 *
 * @remarks
 * Uses Bourne-style single-quote escaping so arbitrary folder names survive `execSync`.
 */
function shellEscape(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

/**
 * Resolves the git repository root for the current working directory.
 *
 * @remarks
 * Delegates to `git rev-parse --show-toplevel`; callers assume cwd is inside a git work tree.
 */
function getRepoRoot(): string {
  return runGitCommand(["rev-parse", "--show-toplevel"], process.cwd());
}

/**
 * Lists immediate child directories under the `.specs` root, newest-first by folder name.
 *
 * @remarks
 * Returns an empty array when `specsRoot` does not exist on disk.
 */
function listSpecsDirectories(specsRoot: string): string[] {
  if (!fs.existsSync(specsRoot)) {
    return [];
  }

  const entries = fs.readdirSync(specsRoot, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => b.localeCompare(a));
}

/**
 * Resolves the target specs folder to an absolute path and a repo-relative path.
 *
 * @remarks
 * With `latest`, picks the lexically first directory name after sorting descending (newest dated
 * folders first). Rejects paths outside `specsRoot` and missing/non-directory targets.
 */
function resolveSpecsPath(options: {
  repoRoot: string;
  specsRoot: string;
  providedSpecsDir?: string;
  latest: boolean;
}): { absolutePath: string; relativePath: string } {
  let relativePath = "";

  if (options.latest) {
    const candidates = listSpecsDirectories(options.specsRoot);
    if (candidates.length === 0) {
      throw new Error("No spec directories found under .specs.");
    }
    relativePath = path.join(".specs", candidates[0]);
  } else {
    const provided = options.providedSpecsDir ?? "";
    const normalized = provided.replace(/\\/g, "/");
    relativePath = normalized.startsWith("/")
      ? path.relative(options.repoRoot, normalized)
      : normalized;
  }

  const absolutePath = path.resolve(options.repoRoot, relativePath);
  const normalizedAbsolute = absolutePath.replace(/\\/g, "/");
  const normalizedSpecsRoot = options.specsRoot.replace(/\\/g, "/");

  if (!normalizedAbsolute.startsWith(`${normalizedSpecsRoot}/`)) {
    throw new Error("Specs path must be inside .specs/.");
  }

  if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isDirectory()) {
    throw new Error(`Specs directory not found: ${absolutePath}`);
  }

  return {
    absolutePath,
    relativePath: path.relative(options.repoRoot, absolutePath).replace(/\\/g, "/"),
  };
}

/**
 * Ensures the index has no staged changes before finalize-specs mutates staging.
 *
 * @remarks
 * PRE-CONDITION: callers expect a clean staged area so finalize-specs does not layer on unrelated
 * commits.
 */
function assertNoPreStagedChanges(repoRoot: string): void {
  const staged = runGitCommand(["diff", "--cached", "--name-only"], repoRoot)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (staged.length > 0) {
    throw new Error(
      "Refusing to finalize specs because staged changes already exist. " +
        "Commit or unstage them first.",
    );
  }
}

/**
 * Counts markdown spec files using the numbered `NN-*.md` naming convention.
 *
 * @remarks
 * Used only for the default commit message summary line.
 */
function countSpecFiles(specsDir: string): number {
  const entries = fs.readdirSync(specsDir);

  return entries.filter(
    (entry) => entry.endsWith(".md") && /^\d{2}-/.test(entry),
  ).length;
}

/**
 * CLI entrypoint: stages/commits/pushes the resolved specs folder unless `--dry-run`.
 *
 * @remarks
 * I/O: mutates git index and remote via `git add`, `git commit`, and `git push` when not dry-run;
 * prints a JSON summary to stdout including branch and spec counts.
 */
function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = getRepoRoot();
  const specsRoot = path.join(repoRoot, ".specs");
  const resolvedSpecs = resolveSpecsPath({
    repoRoot,
    specsRoot,
    providedSpecsDir: args.specsDir,
    latest: args.latest,
  });

  assertNoPreStagedChanges(repoRoot);

  const specCount = countSpecFiles(resolvedSpecs.absolutePath);
  const folderName = path.basename(resolvedSpecs.relativePath);
  const commitMessage =
    args.commitMessage && args.commitMessage.trim().length > 0
      ? args.commitMessage.trim()
      : `specs(ux): publish ${folderName} (${specCount} specs)`;

  const branchName = runGitCommand(["rev-parse", "--abbrev-ref", "HEAD"], repoRoot);

  if (!args.dryRun) {
    runGitCommand(["add", "--", resolvedSpecs.relativePath], repoRoot);

    const stagedAfterAdd = runGitCommand(["diff", "--cached", "--name-only"], repoRoot)
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (stagedAfterAdd.length === 0) {
      throw new Error("No spec changes were staged. Nothing to commit.");
    }

    const hasOutsideScope = stagedAfterAdd.some(
      (filePath) =>
        !filePath.startsWith(`${resolvedSpecs.relativePath}/`) &&
        filePath !== resolvedSpecs.relativePath,
    );

    if (hasOutsideScope) {
      throw new Error("Staged files exceed specs scope. Aborting commit.");
    }

    runGitCommand(["commit", "-m", commitMessage], repoRoot);
    runGitCommand(["push"], repoRoot);
  }

  const output = {
    dryRun: args.dryRun,
    repoRoot,
    branchName,
    specsDir: resolvedSpecs.relativePath,
    specCount,
    commitMessage,
    pushed: !args.dryRun,
  };

  console.log(JSON.stringify(output, null, 2));
}

main();
