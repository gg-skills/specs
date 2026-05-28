#!/usr/bin/env -S npx tsx

/**
 * @fileoverview Initializes spec bundles for the specs skill by scaffolding one or more
 * dated `.specs/` directories with slug, title, and appendix templates.
 *
 * CLI parses counts, optional `--date`, and `--dry-run` to mirror the study workflow ergonomics
 * without touching git.
 *
 * @example
 * tsx skills/specs/scripts/init-specs.ts \
 *   --slug my-feature --title "My Feature" --count 3
 * tsx skills/specs/scripts/init-specs.ts \
 *   --slug my-feature --dry-run
 *
 * @testing CLI manual: npm run file-overview-standards:target-brief -- --file skills/specs/scripts/init-specs.ts
 * @see skills/specs/scripts/finalize-specs.ts - Spec finalizer that stages or commits the `.specs/` bundles scaffolded here.
 * @documentation reviewed=2026-04-30 standard=FILE_OVERVIEW_STANDARDS_TYPESCRIPT@3
 */


import fs from "node:fs";
import path from "node:path";

/**
 * Parsed CLI options for spec-bundle scaffolding after validation and path normalization.
 *
 * @remarks
 * `slug` is normalized; `root` is absolute; omit `date` to default from `formatDateLocal` at runtime.
 */
type CliArgs = {
  slug: string;
  title: string;
  root: string;
  count: number;
  date?: string;
  dryRun: boolean;
};

/**
 * Normalizes a user-supplied slug into a filesystem-safe kebab-case token.
 *
 * @remarks
 * Trims, lowercases, replaces non-alphanumeric runs with single hyphens, and trims edge hyphens.
 */
function normalizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

/**
 * Formats a calendar date as `YYYY-MM-DD` using the runtime local date fields.
 *
 * @remarks
 * Uses the `Date` instance's local year/month/day, not UTC.
 */
function formatDateLocal(date: Date): string {
  const year = date.getFullYear().toString().padStart(4, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/**
 * Parses process argv into validated CLI options for spec scaffolding.
 *
 * @remarks
 * Throws when `--slug` is missing or empty after normalization, or when `--count` is outside 1–50.
 */
function parseArgs(argv: string[]): CliArgs {
  const defaults = {
    root: process.cwd(),
    dryRun: false,
    slug: "",
    title: "",
    count: 1,
  };

  const parsed = { ...defaults, date: undefined as string | undefined };

  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i];

    if (current === "--dry-run") {
      parsed.dryRun = true;
      continue;
    }

    if (current === "--slug") {
      parsed.slug = argv[i + 1] ?? "";
      i += 1;
      continue;
    }

    if (current.startsWith("--slug=")) {
      parsed.slug = current.slice("--slug=".length);
      continue;
    }

    if (current === "--title") {
      parsed.title = argv[i + 1] ?? "";
      i += 1;
      continue;
    }

    if (current.startsWith("--title=")) {
      parsed.title = current.slice("--title=".length);
      continue;
    }

    if (current === "--count") {
      parsed.count = parseInt(argv[i + 1] ?? "1", 10);
      i += 1;
      continue;
    }

    if (current.startsWith("--count=")) {
      parsed.count = parseInt(current.slice("--count=".length), 10);
      continue;
    }

    if (current === "--root") {
      parsed.root = argv[i + 1] ?? defaults.root;
      i += 1;
      continue;
    }

    if (current.startsWith("--root=")) {
      parsed.root = current.slice("--root=".length);
      continue;
    }

    if (current === "--date") {
      parsed.date = argv[i + 1] ?? "";
      i += 1;
      continue;
    }

    if (current.startsWith("--date=")) {
      parsed.date = current.slice("--date=".length);
    }
  }

  const normalizedSlug = normalizeSlug(parsed.slug);
  if (!normalizedSlug) {
    throw new Error("Missing required --slug value.");
  }

  const finalTitle =
    parsed.title.trim().length > 0
      ? parsed.title.trim()
      : `Specs: ${normalizedSlug.replace(/-/g, " ")}`;

  if (parsed.count < 1 || parsed.count > 50) {
    throw new Error("--count must be between 1 and 50.");
  }

  return {
    slug: normalizedSlug,
    title: finalTitle,
    root: path.resolve(parsed.root),
    count: parsed.count,
    date:
      parsed.date && parsed.date.trim().length > 0
        ? parsed.date.trim()
        : undefined,
    dryRun: parsed.dryRun,
  };
}

/**
 * Left-pads an integer's decimal string with leading zeros to the requested width.
 */
function padNumber(n: number, width: number): string {
  return n.toString().padStart(width, "0");
}

/**
 * Builds markdown body for a numbered placeholder spec file in the scaffold bundle.
 *
 * @remarks
 * Aside from the derived heading number, content is a fixed template for authors to replace.
 */
function buildSpecContent(options: {
  number: number;
  totalWidth: number;
}): string {
  const num = padNumber(options.number, options.totalWidth);

  return `# ${num} -- Title

**Priority**: Critical | High | Medium | Low
**Path(s) affected**: Path N (Description)

## Runbook References

- [Reference title](../../relative/path) -- explains the connection to this evidence source.

## User Journey (What the user sees)

\`\`\`
[Step 1: User action]
    |
    v (~Ns)
[Step 2: What the UI shows]
    |
    v (~Ns)
[Step 3: Where things go wrong or succeed]
\`\`\`

## Current behavior

Describe the present-day problem concretely.

## Desired behavior

Describe the target end state with implementation hints.

## Key Files

| File | Role |
|------|------|
| \`path/to/file.ts\` | What this file does in the context of this spec. |
`;
}

/**
 * Builds README.md for a scaffolded spec bundle, including the index table rows.
 *
 * @remarks
 * Embeds the creation date and one placeholder table row per spec file.
 */
function buildReadmeContent(options: {
  title: string;
  count: number;
  totalWidth: number;
  date: string;
}): string {
  const rows = Array.from({ length: options.count }, (_, i) => {
    const num = padNumber(i + 1, options.totalWidth);
    return `| ${num} | Title | Priority | Path(s) |`;
  }).join("\n");

  return `# ${options.title}

Created: ${options.date}

## Specs

| # | Title | Priority | Affected Paths |
|---|-------|----------|----------------|
${rows}

## Clusters

<!-- Group specs that share root causes -->

## Implementation Order

<!-- Recommended sequence based on clustering -->
`;
}

/**
 * Ensures a directory path exists, creating parent segments as needed.
 *
 * @remarks
 * I/O: synchronous `fs.mkdirSync` with `recursive: true`; harmless when the tree already exists.
 */
function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

/**
 * Writes UTF-8 content to a new file, or no-ops in dry-run mode.
 *
 * @remarks
 * Throws when the target path already exists. Skips disk writes when `dryRun` is true.
 */
function writeFileIfMissing(options: {
  filePath: string;
  content: string;
  dryRun: boolean;
}): void {
  if (fs.existsSync(options.filePath)) {
    throw new Error(`Refusing to overwrite existing file: ${options.filePath}`);
  }

  if (options.dryRun) {
    return;
  }

  fs.writeFileSync(options.filePath, options.content, "utf8");
}

/**
 * CLI entrypoint: scaffolds `.specs/<date>-<slug>/` with numbered specs and README.
 *
 * @remarks
 * Prints a JSON summary to stdout. Throws when the bundle directory already exists on disk.
 */
function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const dateStr = args.date ?? formatDateLocal(new Date());
  const specsDirName = `${dateStr}-${args.slug}`;
  const specsRoot = path.join(args.root, ".specs");
  const specsDir = path.join(specsRoot, specsDirName);

  if (fs.existsSync(specsDir)) {
    throw new Error(`Spec folder already exists: ${specsDir}`);
  }

  const totalWidth = 2;

  if (!args.dryRun) {
    ensureDir(specsDir);
  }

  const specFiles: string[] = [];

  for (let i = 1; i <= args.count; i += 1) {
    const num = padNumber(i, totalWidth);
    const fileName = `${num}-placeholder.md`;
    const filePath = path.join(specsDir, fileName);

    writeFileIfMissing({
      filePath,
      content: buildSpecContent({ number: i, totalWidth }),
      dryRun: args.dryRun,
    });

    specFiles.push(filePath);
  }

  const readmePath = path.join(specsDir, "README.md");
  writeFileIfMissing({
    filePath: readmePath,
    content: buildReadmeContent({
      title: args.title,
      count: args.count,
      totalWidth,
      date: dateStr,
    }),
    dryRun: args.dryRun,
  });

  const output = {
    dryRun: args.dryRun,
    specsRoot,
    specsDir,
    specFiles,
    readmePath,
    slug: args.slug,
    date: dateStr,
    count: args.count,
  };

  console.log(JSON.stringify(output, null, 2));
}

main();
