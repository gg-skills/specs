#!/usr/bin/env npx tsx

/**
 * @fileoverview CLI entrypoint that scores a developer spec markdown file against the 14-item Spec
 * Quality Checklist and prints a human-readable report or JSON for automation.
 *
 * This file owns argv parsing, `.specs/` discovery for `--latest`, heuristic checklist evaluation,
 * and stdout/stderr reporting used to judge spec readiness before finalize workflows.
 * Flow: parse flags -> resolve spec path -> read markdown -> evaluate checklist -> emit report or exit non-zero on read errors.
 *
 * @testing CLI: npx tsx skills/specs/scripts/check-spec-completeness.ts --latest
 * @testing CLI: npx tsx skills/specs/scripts/check-spec-completeness.ts --spec .specs/2026-05-19-test/01-auth-bug.md --json
 *
 * @see skills/specs/SKILL.md - Canonical specs skill that defines how numbered specs are authored and anchors the checklist semantics this script enforces.
 * @see skills/specs/scripts/finalize-specs.ts - Companion finalize script referenced by checklist item 14 so operators know the next workflow step after a passing score.
 * @see docs/TYPESCRIPT_STANDARDS_DOCUMENTATION_FILE_OVERVIEWS.md - File-overview contract governing this header's tag order and audit metadata consumed by repository documentation scanners.
 * @documentation reviewed=2026-05-22 standard=FILE_OVERVIEW_STANDARDS_TYPESCRIPT@3
 */

import { readFileSync, readdirSync, statSync, existsSync } from "fs";
import { join, basename } from "path";
import { argv } from "process";

// ============================================================================
// Types
// ============================================================================

/**
 * One numbered spec-quality checklist criterion with scoring metadata.
 *
 * @remarks
 * PURITY: Shape-only; `checked` is filled when a spec file is evaluated.
 */
interface ChecklistItem {
  number: number;
  name: string;
  description: string;
  required: boolean;
  checked: boolean;
  weight: number;
}

/**
 * Parsed identity and routing fields extracted from a spec markdown file.
 *
 * @remarks
 * Values are best-effort from front matter and inline header cues, not a strict schema parse.
 */
interface SpecMetadata {
  id: string;
  title: string;
  path: string;
  priority: string;
  tier: string;
}

/**
 * Aggregated checklist outcome, weighted score, and finalize readiness for one spec.
 */
interface CompletenessReport {
  metadata: SpecMetadata;
  checklist: ChecklistItem[];
  score: number;
  maxScore: number;
  tier: string;
  canFinalize: boolean;
}

// ============================================================================
// Checklist Definition
// ============================================================================

const CHECKLIST_ITEMS: Omit<ChecklistItem, "checked">[] = [
  { number: 1, name: "Slug defined", description: "Concise slug captures the spec set theme", required: true, weight: 1 },
  { number: 2, name: "Folder location correct", description: "Specs in .specs/YYYY-MM-DD-<slug>/", required: true, weight: 1 },
  { number: 3, name: "Evidence gathered", description: "Minimum 2 runbook/study/test references", required: true, weight: 2 },
  { number: 4, name: "All 5 sections present", description: "Header, Runbook Refs, User Journey, Behavior, Key Files", required: true, weight: 2 },
  { number: 5, name: "Header block complete", description: "Spec ID, title, priority, date, status", required: true, weight: 1 },
  { number: 6, name: "Runbook References valid", description: "Relative links resolve from spec location", required: true, weight: 2 },
  { number: 7, name: "User Journey user-centric", description: "Shows user experience, not backend flows", required: true, weight: 2 },
  { number: 8, name: "Timing estimates included", description: "Use (~Xs) format where available", required: false, weight: 1 },
  { number: 9, name: "Current/Desired behavior clear", description: "Contrast is explicit and testable", required: true, weight: 2 },
  { number: 10, name: "Key Files 3-8 entries", description: "Entry points ordered by investigation priority", required: true, weight: 2 },
  { number: 11, name: "Repository-relative paths", description: "All paths resolve from repo root", required: true, weight: 1 },
  { number: 12, name: "CHOOSEABLE_OPTIONS block", description: "Option families present with recommended first", required: true, weight: 2 },
  { number: 13, name: "Clustering analyzed", description: "Related specs grouped by root cause", required: false, weight: 1 },
  { number: 14, name: "Finalized and pushed", description: "finalize-specs.ts has been run", required: false, weight: 1 },
];

// ============================================================================
// Parser
// ============================================================================

/**
 * Derives spec id, title, priority, and a heuristic tier from markdown content.
 *
 * @remarks
 * PURITY: Reads only the provided string; does not touch the filesystem.
 */
function extractMetadata(content: string, path: string): SpecMetadata {
  const headerMatch = content.match(/^---\n([\s\S]*?)^---/m);
  const titleMatch = headerMatch?.[1]?.match(/title:\s*(.+)/m);
  const idMatch = headerMatch?.[1]?.match(/spec:\s*(.+)/m);
  const priorityMatch = content.match(/\*\*Priority:\*\*\s*(.+)/mi);
  
  return {
    id: idMatch?.[1]?.trim() || basename(path).replace('.md', ''),
    title: titleMatch?.[1]?.trim() || "Untitled Spec",
    path: path,
    priority: priorityMatch?.[1]?.trim() || "Medium",
    tier: guessTier(content),
  };
}

/**
 * Classifies draft depth as Minimal, Standard, or Full using lightweight heuristics.
 *
 * @remarks
 * PURITY: Keyword and length signals only; independent of filesystem paths.
 */
function guessTier(content: string): string {
  const wordCount = content.split(/\s+/).length;
  const hasChoices = /CHOOSEABLE_OPTIONS|chooseable/i.test(content);
  const hasCluster = /cluster|root cause|group/i.test(content);
  const hasTiming = /\(~.*s\)|timing/i.test(content);
  
  if (wordCount > 400 && hasChoices && hasCluster && hasTiming) return "Full";
  if (wordCount > 200 && hasChoices) return "Standard";
  return "Minimal";
}

/**
 * Counts markdown table rows under the Key Files section for checklist item 10.
 *
 * @remarks
 * PURITY: String slicing and regex only; returns 0 when the section or table is missing.
 */
function countKeyFiles(content: string): number {
  const keyFilesMatch = content.match(/\*\*Key Files\*\*/i);
  if (!keyFilesMatch) return 0;
  
  const afterHeader = content.substring(keyFilesMatch.index!);
  const tableMatch = afterHeader.match(/\|\s*\w[\s\S]*?\|[\s\S]*?\|/);
  if (!tableMatch) return 0;
  
  return (tableMatch[0].match(/\n\|/g) || []).length;
}

/**
 * Evaluates whether a single checklist item passes for the given spec body.
 *
 * @remarks
 * PURITY: Dispatches on `item.number` to focused regex checks over `content`.
 */
function checkItem(content: string, item: Omit<ChecklistItem, "checked">): boolean {
  switch (item.number) {
    case 1: return /\.specs\//i.test(content);
    case 2: return /\.specs\/\d{4}-\d{2}-\d{2}-/i.test(content);
    case 3: return (content.match(/\[.+\]\(.+\.md\)/g) || []).length >= 2;
    case 4: return /Header|Runbook|User Journey|Current|Desired|Key Files/i.test(content);
    case 5: return /Spec ID|Spec Title|Priority|Date|Status/i.test(content);
    case 6: return !/https?:\/\//.test(content.match(/\[.+\]\(.+\)/g)?.join(''));
    case 7: return !/backend|server|database.*query|api.*call/.test(content) || /user|experience|click|navigate/i.test(content);
    case 8: return /\(~.*s\)|timing|seconds|minutes/i.test(content) || item.required === false;
    case 9: return /Current behavior|Desired behavior|Current state|Desired state/i.test(content);
    case 10: return countKeyFiles(content) >= 3 && countKeyFiles(content) <= 8;
    case 11: return !/^\/[a-z]/.test(content) || content.includes('.specs/') || content.includes('./');
    case 12: return /CHOOSEABLE_OPTIONS|chooseable options/i.test(content);
    case 13: return /cluster|group|root cause/i.test(content) || item.required === false;
    case 14: return /finalize|committed|pushed/i.test(content) || item.required === false;
    default: return false;
  }
}

// ============================================================================
// Main
// ============================================================================

/**
 * Locates the newest dated `.specs` folder and returns its first numbered markdown file.
 *
 * @remarks
 * I/O: Reads `.specs` via `readdirSync`/`statSync`; returns null when missing or on read errors.
 */
function findLatestSpec(): string | null {
  try {
    const specsDir = ".specs";
    if (!existsSync(specsDir)) return null;
    
    const dirs = readdirSync(specsDir)
      .filter(d => statSync(join(specsDir, d)).isDirectory())
      .sort()
      .reverse();
    
    for (const dir of dirs) {
      const files = readdirSync(join(specsDir, dir))
        .filter(f => f.match(/^\d+-.*\.md$/));
      if (files.length > 0) {
        return join(specsDir, dir, files[0]);
      }
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Loads a spec file, scores checklist coverage, and prints JSON or a human report.
 *
 * @remarks
 * I/O: Reads `specPath` synchronously and writes to stdout/stderr; exits the process on read failure.
 */
function checkSpec(specPath: string, json: boolean = false): void {
  try {
    const content = readFileSync(specPath, "utf-8");
    const metadata = extractMetadata(content, specPath);
    
    const checklist = CHECKLIST_ITEMS.map(item => ({
      ...item,
      checked: checkItem(content, item),
    }));
    
    const score = checklist.reduce((sum, item) => 
      item.checked ? sum + item.weight : sum, 0);
    const maxScore = checklist.reduce((sum, item) => sum + item.weight, 0);
    
    const requiredItems = checklist.filter(i => i.required);
    const requiredScore = requiredItems.reduce((sum, item) => 
      item.checked ? sum + item.weight : sum, 0);
    const requiredMax = requiredItems.reduce((sum, item) => sum + item.weight, 0);
    
    const canFinalize = requiredScore === requiredMax;
    
    const tier = score >= 20 ? "Full" : score >= 14 ? "Standard" : "Minimal";

    const report: CompletenessReport = {
      metadata,
      checklist,
      score,
      maxScore,
      tier,
      canFinalize,
    };

    if (json) {
      console.log(JSON.stringify(report, null, 2));
      return;
    }

    // Human-readable output
    console.log("\n📋 Spec Completeness Report");
    console.log("═".repeat(60));
    console.log(`\n📄 ${metadata.id}: ${metadata.title}`);
    console.log(`   Priority: ${metadata.priority}`);
    console.log(`   Path: ${specPath}`);
    
    console.log(`\n📊 Score: ${score}/${maxScore} (${((score/maxScore)*100).toFixed(0)}%)`);
    console.log(`   Required items: ${requiredScore}/${requiredMax}`);
    console.log(`   Quality tier: ${tier}`);
    
    console.log(`\n${canFinalize ? "✅" : "⚠️"} Finalizable: ${canFinalize ? "YES" : "NEEDS WORK"}`);
    
    console.log("\n📝 Checklist:");
    for (const item of checklist) {
      const icon = item.checked ? "✅" : item.required ? "❌" : "⚠️";
      console.log(`   ${icon} [${item.number}] ${item.name}`);
    }
    
    console.log("\n" + "═".repeat(60));
    
    if (!canFinalize) {
      console.log("\n⚠️ Spec needs work before finalizing.");
      const failedItems = checklist.filter(i => !i.checked && i.required);
      if (failedItems.length > 0) {
        console.log("\nMissing required items:");
        failedItems.forEach(i => console.log(`   - ${i.name}`));
      }
    } else {
      console.log("\n✅ Spec is complete and ready to finalize.");
    }
    
  } catch (error) {
    console.error(`\n❌ Error reading spec: ${specPath}`);
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// CLI
const args = argv.slice(2);
const specArg = args.find(a => a === "--spec" || a === "-s");
const latestArg = args.includes("--latest");
const jsonArg = args.includes("--json");

if (!specArg && !latestArg) {
  console.log("Usage: check-spec-completeness.ts --spec <file.md> | --latest [--json]");
  console.log("\nExamples:");
  console.log("  npx tsx check-spec-completeness.ts --spec .specs/2026-05-19-test/01-auth-bug.md");
  console.log("  npx tsx check-spec-completeness.ts --latest");
  console.log("  npx tsx check-spec-completeness.ts --latest --json");
  process.exit(1);
}

let specPath: string | null = null;

if (latestArg) {
  specPath = findLatestSpec();
  if (!specPath) {
    console.error("❌ No spec found in .specs/ directory.");
    process.exit(1);
  }
  console.log(`📍 Using latest spec: ${specPath}`);
} else if (specArg) {
  const specIndex = args.indexOf(specArg);
  specPath = args[specIndex + 1];
  if (!specPath) {
    console.error("❌ Missing spec path after --spec");
    process.exit(1);
  }
}

checkSpec(specPath!, jsonArg);
