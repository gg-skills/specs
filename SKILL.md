---
name: specs
description: when configuring developer briefs linking behavior to source code entry points. Numbered specs under .specs/. Handoff to plan. MCP-compatible. Not for non-spec documentation.
---

# GG → Specs → Developer Briefs

## Overview

Use this skill to produce actionable specification files that bridge user-facing observations
(runbook tests, production incidents, UX audits) to the source files a developer needs to start
working. Each spec is a self-contained investigation brief: it tells the reader what is broken,
how it looks from the user's perspective, what the desired behavior is, and exactly which files
to open first.

For a direct command lookup, see [Quick Commands](#quick-commands) below.

## When to Use This Skill

**TRIGGER when:**
- A study, runbook, or audit produces findings that need to be broken into discrete, actionable developer briefs.
- Browser tests, pipeline audits, or log analysis reveal multiple related issues that should be tracked as numbered specs.
- The user asks to convert observations into structured specs with source-code entry points and user-journey diagrams.
- Codex session analysis identifies patterns that deserve per-issue investigation briefs.

**SKIP when:**
- The task is a single bug fix with a known one-file change — write the fix directly instead.
- The user only needs a high-level plan without individual issue breakdowns — use plan directly.
- The observations are purely speculative with no concrete evidence (runbook, study, or test results).

## Common Misconceptions

| # | Misconception | Correction | Key concept |
|---|---------------|------------|-------------|
| 1 | Specs should live in `docs/` | Specs belong in `.specs/`; `docs/` is for human-facing documentation. | Separation of investigation artifacts from product docs. |
| 2 | User Journey diagrams should show system internals | Diagrams must show the user's visible experience, not backend flows. | User-centric framing. |
| 3 | A spec can reference just one runbook document | Minimum 2 references, ideally 3-5, each explaining why it matters. | Evidence breadth. |
| 4 | Specs can be left uncommitted until later | Finalize immediately with the script. | Artifact hygiene. |
| 5 | Key Files tables should list every touched file | List 3-8 entry points ordered by investigation priority. | Focused entry points. |
| 6 | Specs can be written without evidence | Every claim must be grounded in concrete evidence. | Evidence-first |
| 7 | Any file path is acceptable in Key Files | Use repository-relative paths that resolve correctly. | Path correctness |

## Quick Commands

```bash
# Initialize a spec set with N placeholder files
npx tsx skills/specs/scripts/init-specs.ts --slug "<slug>" --title "<title>" --count <N>

# Finalize, commit, and push the latest spec set
npx tsx skills/specs/scripts/finalize-specs.ts --latest

# Dry-run to preview what finalize would do
npx tsx skills/specs/scripts/finalize-specs.ts --specs-dir "YYYY-MM-DD-<slug>" --dry-run

# Check spec completeness (14-item checklist)
npx tsx skills/specs/scripts/check-spec-completeness.ts --latest
npx tsx skills/specs/scripts/check-spec-completeness.ts --spec <spec-file.md>

# Validate spec structure
npx tsx skills/specs/scripts/validate-specs.ts --specs-dir <path>
```

For full script flags and options, see `scripts/init-specs.ts` and `scripts/finalize-specs.ts`.

## Spec Quality Checklist

Use this checklist before finalizing any spec. Each item is a gate—the spec is not ready until all required items are satisfied.

| # | Checklist Item | Why It Matters | Gate |
|---|---------------|---------------|------|
| 1 | **Slug defined** — Concise slug captures the spec set theme | Enables discoverability | Pre-spec |
| 2 | **Folder location correct** — Specs in `.specs/YYYY-MM-DD-<slug>/` | Separation of artifacts | Pre-spec |
| 3 | **Evidence gathered** — Minimum 2 runbook/study/test references | Grounding claims | Draft |
| 4 | **All 5 sections present** — Header, Runbook Refs, User Journey, Behavior, Key Files | Structural completeness | Draft |
| 5 | **Header block complete** — Spec ID, title, priority, date, status | Metadata | Draft |
| 6 | **Runbook References valid** — Relative links resolve from spec location | Correctness | Draft |
| 7 | **User Journey user-centric** — Shows user experience, not backend flows | Correct framing | Draft |
| 8 | **Timing estimates included** — Use `(~Xs)` format where available | Reality check | Draft |
| 9 | **Current/Desired behavior clear** — Contrast is explicit and testable | Actionability | Draft |
| 10 | **Key Files 3-8 entries** — Entry points ordered by investigation priority | Focused scope | Draft |
| 11 | **Repository-relative paths** — All paths resolve from repo root | Correctness | Draft |
| 12 | **CHOOSEABLE_OPTIONS block** — Option families present with recommended first | Enables handoff | Closeout |
| 13 | **Clustering analyzed** — Related specs grouped by root cause | Sequencing | Closeout |
| 14 | **Finalized and pushed** — finalize-specs.ts has been run | Artifact hygiene | Closeout |

### Quality Tiers

| Tier | Criteria | Use When |
|------|----------|----------|
| **Minimal** | Items 1-5, 9, 12 | Quick investigation brief |
| **Standard** | Items 1-10, 12 | Complete spec with evidence |
| **Full** | All 14 items | Production-ready spec with clustering |

### Pre-Finalization Verification

Before running finalize-specs.ts, verify:

```
□ All spec files follow NN-<topic>.md naming
□ Header block present and complete in each spec
□ Minimum 2 runbook references per spec
□ User Journey diagrams are user-centric
□ Timing estimates included (~Xs format)
□ Current/Desired behavior contrast is explicit
□ Key Files has 3-8 entries with priority ordering
□ All paths are repository-relative
□ CHOOSEABLE_OPTIONS block present
□ Cluster analysis complete
□ No relative links broken
```

## Spec Consistency Validator

Before finalizing a spec set, run these consistency checks.

### Consistency Check Matrix

| Check | What to Verify | How to Fix |
|-------|---------------|------------|
| **Numbering vs Priority** | Critical specs have lowest numbers | Reorder |
| **Links vs Files** | All relative links resolve to existing files | Fix paths |
| **Behavior vs Evidence** | Current/Desired behavior grounded in references | Add citations |
| **Key Files vs Code** | Entry points verified against actual codebase | Trace paths |
| **Clustering vs Root Cause** | Groups share actual root causes | Analyze dependencies |

### Red Flags (Never Present)

A spec with any of these must be fixed before finalizing:

- [ ] Spec without any runbook references
- [ ] User Journey showing backend internals
- [ ] Key Files with absolute paths
- [ ] Missing CHOOSEABLE_OPTIONS block
- [ ] Broken relative links
- [ ] Spec without timing estimates

## Non-Negotiable Policy

1. Save new specs under `.specs/YYYY-MM-DD-<slug>/` as numbered markdown files (`NN-<topic>.md`), never under `docs/` unless explicitly requested.
2. Every spec MUST contain all five structural sections: Header block, Runbook References, User Journey, Current/Desired behavior, and Key Files table.
3. Keep every claim tied to concrete evidence (runbook observations, log excerpts, test results, screenshots). Do not create specs without evidence.
4. Use repository-relative paths throughout. Runbook references must use relative markdown links that resolve from the spec file's location.
5. Number specs in priority order (Critical first). User Journey diagrams must show the experience from the user's perspective with timing estimates.
6. Every spec set must end with a `CHOOSEABLE_OPTIONS` block. Keep the recommended option first and include at least one generation path each for plans, studies, online research, and comparisons.
7. After completing a spec set, run the finalize script immediately. Do not leave spec artifacts uncommitted or unpushed.
8. Never reconstruct shell commands, CLI flags, or setup steps from memory — always read the relevant reference file first.

## Standard Output Layout

Inside each dated spec folder:

1. Numbered spec files: `01-<topic>.md` through `NN-<topic>.md` (Critical = lowest numbers).
2. Optional `README.md` linking to all specs with a summary table and cluster analysis.

For the exact file structure and section templates, see `references/spec-template.md`.

## Workflow

1. **Define scope and slug.**
   - Choose a concise slug that captures the spec set's theme (e.g., `thread-creation-ux-recommendations`).
2. **Initialize spec workspace.**
   - Run `init-specs.ts` (see Quick Commands).
   - This creates `.specs/YYYY-MM-DD-<slug>/` with N numbered placeholder files and a `README.md`.
3. **Gather evidence.**
   - Read runbook documents, study findings, browser test results, and log excerpts that inform each spec.
   - Identify key source files by tracing from observed behavior to code.
4. **Write each spec.**
   - Follow the required structure (see `references/spec-template.md`).
   - Ensure Runbook References use relative links that resolve correctly.
   - Build User Journey diagrams from actual observed behavior, not hypotheticals.
   - Populate Key Files tables by tracing the code path, not guessing.
5. **Review cross-references.**
   - Verify that all relative links resolve to existing files.
   - Check that Key Files paths are correct repository-relative paths.
   - Ensure priority ordering is consistent across numbered files.
6. **Prepare the completion menu.**
   - Build a `CHOOSEABLE_OPTIONS` block adapted to the completed spec set.
   - Include at least one explicit generation option for plans, studies, online research, and comparisons.
   - Keep the recommended option first.
7. **Finalize and publish immediately.**
   - Run `finalize-specs.ts` (see Quick Commands).
   - This stages only that spec folder, creates a commit, and pushes the current branch.
   - Do not skip this step by default; only skip if the user explicitly asks.

## Completion Output Contract

When presenting completed specs, include:

1. Summary table of all specs with number, title, priority, and affected paths.
2. Cluster analysis showing which specs share root causes.
3. Recommended implementation order based on clustering.
4. Confirmation that spec artifacts were committed and pushed.
5. A `CHOOSEABLE_OPTIONS` block ending the response (context-adapted, recommended option first).

Required option families (rename to fit context):

| Option | Purpose |
|--------|---------|
| `GENERATE_IMPLEMENTATION_PLAN` | Write execution plans for the highest-priority cluster using plan. |
| `GENERATE_DEEP_DIVE_STUDY` | Investigate the most complex spec or cluster with study. |
| `GENERATE_ONLINE_RESEARCH` | Run external best-practice or benchmark research with research-online. |
| `GENERATE_SPEC_COMPARISON` | Produce a comparison artifact across specs or clusters. |

Optional: `GENERATE_VISUAL_EXPLANATION_PACKET` through explain when sequencing is dense or cross-cutting.

## Cross-Skill Handoffs

### AUTO_TRIGGER_WHEN

1. Spec set is complete and user asks to implement:
   - trigger `plan/SKILL.md`.
2. Specs need execution tracking or task-linkage notes:
   - include candidate task grouping in the planning handoff; do not mutate external trackers from this skill.
3. A spec requires deeper investigation before implementation:
   - trigger `study/SKILL.md`.
4. A completed spec set exposes external-pattern, benchmark, or vendor unknowns:
   - trigger `research-online/SKILL.md`.
5. User chooses a comparison-first follow-up across specs or clusters:
   - trigger `study/SKILL.md` with comparison-matrix intent.

### AUTO_SUGGEST_WHEN

1. Specs identify browser-testable behavior changes:
   - suggest the `playwright-cli` workflow.
2. Specs reference pipeline behavior that could be audited:
   - suggest the `pipeline-auditing` workflow.
3. Specs include skill file changes:
   - suggest `npm run skills:sync` as a closeout requirement.
4. Spec evidence came from a study:
   - suggest linking back to the study in Runbook References.
5. Specs identify documentation drift:
   - suggest the `documentation-sync` workflow.
6. Spec clusters need explicit tradeoff framing before plan selection:
   - suggest `study/SKILL.md` for a durable comparison artifact.
7. Specs expose unresolved external product or best-practice questions:
   - suggest `research-online/SKILL.md`.
8. Spec clusters are correct but too dense for fast sequencing:
   - suggest `explain/SKILL.md`.

### BLOCKING_GATES

1. Do not start implementation directly from this skill without a planning handoff.
2. Do not claim implementation readiness when no `.plans/...` execution plan exists.
3. Do not create specs without concrete evidence (runbook, study, or test results).
4. Every spec must pass structural validation: all five sections present and non-empty.

### HANDOFF_OUTPUTS

1. To `plan/SKILL.md`:
   - specs folder path, priority-ordered spec list, cluster analysis with recommended sequence, key files inventory.
2. To downstream task tracking when explicitly requested outside this skill:
   - specs folder path, one candidate task per spec or cluster, priority and affected paths.
3. To `study/SKILL.md`:
   - specific spec needing deeper analysis, open questions, evidence gaps.
4. To `research-online/SKILL.md`:
   - specs folder path, prioritized external research questions, affected specs/clusters, target domains.
5. To `study/SKILL.md` (comparison):
   - specs folder path, comparison scope, axes (root cause overlap, file overlap, sequencing, risk, validation cost), recommended decision.
6. To `explain/SKILL.md`:
   - specs folder path, cluster or sequencing question, highest-priority files/contracts, recommended downstream action.

## Troubleshooting

| Symptom | Cause and fix | Reference |
|---------|---------------|-----------|
| `init-specs.ts` throws "Spec folder already exists" | Dated folder already exists. Use `--date` to override or choose a different slug. | `scripts/init-specs.ts` |
| `finalize-specs.ts` throws "Refusing to finalize because staged changes already exist" | Existing staged changes detected. Commit or unstage them first. | `scripts/finalize-specs.ts` |
| `finalize-specs.ts` throws "No spec changes were staged" | Directory already committed or contains no `NN-*.md` files. Verify file naming. | `scripts/finalize-specs.ts` |
| Relative links in Runbook References break | Paths computed from wrong base. Always resolve from the spec file's location inside `.specs/YYYY-MM-DD-<slug>/`. | `references/spec-template.md` |
| Key Files table has fewer than 3 entries | Insufficient code-path tracing. Trace from observed behavior to at least 3 entry points before writing. | `references/spec-template.md` |

## Common Pitfalls

1. **Writing specs without concrete evidence.** Start only after gathering runbook docs, study findings, or test results.
2. **Using absolute file paths in Key Files.** Always use repository-relative paths like `path/to/source/...`.
3. **Generic Role descriptions in Key Files.** Describe what the file does in the context of THIS spec, not a generic summary.
4. **Missing timing estimates in User Journey.** Include observed timings where available; use `(~Xs)` format.
5. **Forgetting the CHOOSEABLE_OPTIONS block.** Every completed spec set must end with this block before finalizing.
6. **Committing files outside the spec folder.** The finalize script stages only the spec directory; keep unrelated changes separate.
7. **Numbering specs by discovery order rather than priority.** Reorder so Critical specs get the lowest numbers.

## Guidance Alignment

- Last reviewed: 2026-04-30.
- Apply repository guidance consistently with `AGENTS.md`, `CLAUDE.md`, and `GEMINI.md`.
- If this skill file is updated, run `npm run skills:sync` so IDEs pick up the new version immediately.
- If guidance semantics changed, run the `agents-sync` workflow before workflow closure.
- For current web information or external docs lookup, follow `docs/SKILLS_WEB_RESEARCH.md` and prefer Firecrawl CLI via `research-online/SKILL.md` before the built-in `web` tool.

## Local Corpus Layout

The `references/` directory contains a flat set of Markdown files (no subfolders):

- `references/spec-template.md` — reusable template reference for individual spec files, covering the five required sections, naming conventions, and clustering notes.

## Scripts

- `scripts/init-specs.ts` — Initializes `.specs/YYYY-MM-DD-<slug>/` with numbered placeholder spec files and a `README.md`.
- `scripts/finalize-specs.ts` — Stages only the specified spec folder, commits it, and pushes the current branch.
