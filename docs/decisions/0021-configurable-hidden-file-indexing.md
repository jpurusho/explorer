# 0021 — Configurable hidden file indexing and real-time sync

**Status:** accepted  
**Date:** 2026-06-24

## Context

The search indexer excluded all hidden directories (anything starting with `.`) except `.config`. This meant:
- `.claude` directories under git repos were never indexed
- New files created while the app was running weren't added to the index automatically
- Users couldn't search for files in `.vscode`, `.idea`, or other project-specific hidden dirs

Two problems to solve:
1. **Hidden directory exclusion** — hardcoded logic that only allowed `.config`
2. **Stale index** — no real-time updates when files are created/modified/deleted

## Decision

### Part 1: Configurable hidden patterns

**Hardcoded defaults** (always indexed):
- `.config`
- `.claude`
- `.vscode`

**Settings override** via `settings.json`:
```json
{
  "index_hidden_patterns": [".idea", ".github", ".vscode"]
}
```

Implementation in `indexer.rs`:
- `get_allowed_hidden_patterns()` loads hardcoded list + settings
- `should_exclude()` checks against this list before excluding hidden dirs
- Settings are hot-loaded on every exclusion check (fast — settings file is small)

### Part 2: Real-time index sync

**Watcher events** now emit granular file-level events:
- `file-created` — new file or rename-to
- `file-modified` — content changed
- `file-removed` — deleted or rename-from

**New Tauri commands**:
- `index_file(path)` — upserts a single file to the index
- `unindex_file(path)` — removes a file from the index

**Frontend hook** `useSearchIndexSync()`:
- Listens for `file-created`, `file-modified`, `file-removed` events
- Batches updates over 500ms to avoid index thrashing
- Runs in the background, no UI updates

**Effect**:
- Files appear in search ~500ms after creation (no app restart needed)
- Works for all directories the watcher is subscribed to (currently: the active directory)

## Consequences

### Positive
- `.claude` files now searchable (solves the reported issue)
- Future-proof: users can add more patterns without code changes
- Real-time index keeps search results fresh as you work
- Batching prevents index thrashing on bulk operations (git checkout, npm install, etc.)

### Caveats
- Only directories actively watched get real-time updates (currently: the directory you're viewing)
- Background index sync still runs on startup for un-watched directories
- Settings change requires app restart (no hot-reload UI yet)

### Future enhancements
- Settings UI panel for managing `index_hidden_patterns` (avoid manual JSON editing)
- Watch multiple directories simultaneously (e.g., all pinned/recent dirs)
- Visual indicator when indexing is in progress
- Explicit "reindex this directory" button in the UI

## Why not index all hidden dirs by default?

Too broad — would index `.git` (huge on large repos), `.npm`, `.cargo`, etc. Better to default conservative and let users opt in via settings.

## Why 500ms batch delay?

Balances responsiveness with efficiency:
- Fast enough for interactive workflows (create file → search for it)
- Slow enough to batch rapid changes (git checkout, file watchers firing multiple events)
- Matches the existing directory watcher debounce (300ms)
