# 0023 — Manual reindex required after exclusion rule changes

**Status:** accepted  
**Date:** 2026-06-24

## Context

When users change `index_hidden_patterns` in settings (adding `.idea`, `.github`, etc.), the new patterns don't take effect until a full reindex runs. The app doesn't auto-trigger this — users must click "Full Reindex" manually.

Why not auto-reindex? Why is it manual?

## The Problem: Incremental Sync Optimization

`incremental_sync()` has an mtime-based fast path:

```rust
if dir_mtime < last_shutdown {
    // Directory unchanged — skip scanning its contents
    continue;
}
```

When exclusion rules change (e.g., `.claude` added to allowlist), incremental sync on next startup sees `.claude` directories with old mtimes and skips them — "directory hasn't changed since last run, skip it."

The directory *didn't* change — the **rules** changed. Incremental sync has no way to know that previously-excluded directories should now be revisited.

## Why Full Reindex is a Complete Rebuild

`reindex()` command doesn't patch the existing index — it:

1. `DROP TABLE files`
2. `DROP TABLE trigrams`  
3. `DROP TABLE files_fts`
4. Rebuilds from scratch by walking the entire filesystem tree

This is slow (minutes for large home directories) but simple and correct.

## Decision

**No auto-reindex.** Users must manually click "Full Reindex" after changing `index_paths` or `index_hidden_patterns`.

**Why manual:**
- Reindex is expensive (minutes for 100K+ files)
- User might be experimenting with patterns (adding multiple)
- Clear intent: "I'm done configuring, apply changes now"
- Toast warns: "Pattern added. Run 'Full Reindex' to apply."

**Alternative considered:** Auto-reindex on settings save. Rejected because:
- User adds 3 patterns → 3 consecutive full reindexes (wasteful)
- No chance to batch changes
- Surprise CPU spike while user is still working

## Consequences

- Users must remember to click "Full Reindex" after changing patterns
- First reindex after adding `.claude` to allowlist takes time proportional to total home directory size, not just new `.claude` files
- Settings UI mitigates with clear toast: "Run 'Full Reindex' to apply"
- Reindex button description explains when to use it

## Future: Smarter Incremental Update

Could track "exclusion rules version" in index metadata and trigger auto-reindex only when rules change. Or: selective re-scan of only previously-excluded patterns. Deferred until user feedback shows it's worth the complexity.
