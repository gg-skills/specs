# Spec Template Reference

Use this template when writing individual spec files inside a `.specs/YYYY-MM-DD-<slug>/` folder.

For the full spec-creation workflow, see `SKILL.md`.

## Required Structure

Every spec file must contain exactly these sections in this order.

### 1. Header Block

```markdown
# NN -- Title

**Priority**: Critical | High | Medium | Low
**Path(s) affected**: Path N (Description)
```

| Field | Rules |
|-------|-------|
| `NN` | Zero-padded number matching the file name (`01`, `02`, ...). |
| Title | Concise and action-oriented (verb + noun). |
| Priority | **Critical**: blocks core flows or causes data loss. **High**: degrades UX significantly. **Medium**: noticeable issue with workaround. **Low**: polish or edge case. |

### 2. Runbook References

```markdown
## Runbook References

- [Link text](../../relative/path) -- 1-2 sentence explanation of what this reference shows.
```

| Rule | Detail |
|------|--------|
| Minimum | 2 references; ideal 3-5. |
| Paths | Relative paths that resolve from the spec file's location. |
| Targets | Runbook path docs, study docs, README known-issues, verification reports. |
| Explanation | Must say WHY this reference matters for THIS spec. |

### 3. User Journey

```markdown
## User Journey (What the user sees)

```
[User action or starting state]
    |
    v (~Ns)
[Visible UI state change]
    |
    v (~Ns)
[Next visible change or failure point]
```
```

| Rule | Detail |
|------|--------|
| Perspective | Show the experience from the USER'S perspective, not system internals. |
| Timing | Include observed timings where available: `(~3s)`, `(~10s)`. |
| Failures | Mark failure points: `[DEAD END]`, `[ERROR]`, `[STUCK]`. |
| UI states | Use square brackets: `[Sidebar shows: "raw URL"]`. |
| Exact text | Use quotes for user-visible text. |
| Contrast | For current-vs-desired comparison, show both flows with clear labels. |

### 4. Current Behavior and Desired Behavior

```markdown
## Current behavior

2-5 sentences describing the present-day problem concretely.

## Desired behavior

2-5 sentences describing the target state with implementation hints.
```

| Rule | Detail |
|------|--------|
| Current | Describe what actually happens, not what should happen. |
| Desired | Include specific implementation hints (function names, approach ideas). |
| Cross-reference | When fixes share root causes, mention the related spec number. |

### 5. Key Files Table

```markdown
## Key Files

| File | Role |
|------|------|
| `path/to/source/file.ts` | Specific role in THIS spec's context. |
```

| Rule | Detail |
|------|--------|
| Minimum | 3 files; typically 4-8. |
| Paths | Repository-relative paths. |
| Role | Must be spec-specific, not a generic file description. |
| Functions | Name specific functions when relevant: "Contains `bigramDiceCoefficient()`..." |
| Order | By investigation priority: most relevant entry point first. |
| Stack span | Include both backend and frontend files when the issue crosses the stack. |

## Naming Conventions

| Artifact | Pattern | Example |
|----------|---------|---------|
| Spec file | `NN-<topic-slug>.md` | `01-distinguish-not-found-from-system-error.md` |
| Folder | `.specs/YYYY-MM-DD-<slug>/` | `.specs/2026-05-03-thread-creation-ux/` |
| Ordering | Critical specs get the lowest numbers. | |

## Clustering Notes

When multiple specs share a root cause:

- Mention the shared root cause in each spec's Desired Behavior.
- Use the `README.md` Clusters section to group them.
- Suggest implementing clustered specs together.

## Publish Command

```bash
npx tsx skills/specs/scripts/finalize-specs.ts \
  --specs-dir ".specs/YYYY-MM-DD-<slug>"
```

Commit scope: only files under that spec folder.
