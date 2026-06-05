# Explorer — Remaining Tasks

## Bugs to Fix (High Priority)

| # | Issue | Status |
|---|-------|--------|
| 1 | **Scrolling broken in some folders** — scripts/, Library/ don't scroll when content exceeds viewport. Virtualizer + table layout interaction. | Pending |
| 7 | **Auto-refresh current folder** — when files are added/removed externally, the file list should update automatically without manual navigation. Needs `notify` watcher on the current directory. | Pending |
| 2 | **Index stats not live** — settings page shows stale stats, needs polling refresh | Pending |
| 3 | **Indexing progress** — show files-indexed counter in status bar, not just "Indexing..." | Pending |
| 4 | **DB size still 1.38GB** — needs VACUUM after rebuild completes to reclaim space | Pending |
| 5 | **Drag-drop from sidebar to workspaces** — doesn't work (WebKit limitation). Using right-click as workaround. | Won't fix (WebKit) |
| 6 | **Font slider value doesn't restore perfectly** on restart in some edge cases | Low priority |

## Features to Implement

### Phase 4 — Advanced Features

| # | Feature | Complexity | Notes |
|---|---------|-----------|-------|
| 1 | **File watcher (notify/FSEvents)** — live index updates while app running | Medium | `notify` crate added, not wired |
| 2 | **Command palette (Cmd+K)** — actions, settings, navigation | Medium | Like VS Code's command palette |
| 3 | **Fuzzy path finder** — type partial path, jump directly | Low | Already have Cmd+P search |
| 4 | **Side-by-side diff** — compare two files with lock-step scrolling | High | Needs diff algorithm + dual editor |
| 5 | **Multiple window instances** — open several explorer windows | Low | Tauri supports this |
| 6 | **FSEvents ID replay** — fast catch-up for short app closures (macOS only) | Medium | Part of Option 4 design |

### Phase 5 — Polish & Distribution

| # | Feature | Complexity |
|---|---------|-----------|
| 1 | **App icon/branding** — custom icon for dock/dmg | Low |
| 2 | **Auto-updater** — check for updates on launch | Medium |
| 3 | **Accessibility (VoiceOver)** — aria labels, focus management | Medium |
| 4 | **Performance profiling** — identify any remaining slow paths | Low |

### User-Requested Features (New)

| # | Feature | Complexity | Notes |
|---|---------|-----------|-------|
| 1 | **Grid card size slider** — ✅ Done | — | |
| 2 | **Indexing progress counter** — show "Indexing... 59,409 files" live | Low | AtomicU64 counter |
| 3 | **Estimated indexing time** — show rate or ETA | Low | Track files/sec |
| 4 | **Live stats refresh** — poll every 3s on settings page | Low | setInterval in React |
| 5 | **Column view (Finder-style)** — 3rd view mode with horizontal columns | High | Each folder opens a column |
| 6 | **Persist Name column width** to config.json | Low | Store field exists, not saved |
| 7 | **Horizontal row lines** in table view (full grid like spreadsheet) | Low | border-bottom on rows |
| 8 | **File watcher while running** — instant index updates | Medium | Wire notify crate |
| 9 | **Show indexing % or rate** in status bar | Low | |
| 10 | **VACUUM after reindex** — shrink DB file | Low | Run once after rebuild |

## Architecture Decisions Pending

- **FSEvents vs notify for macOS** — notify wraps FSEvents but doesn't expose stream IDs for replay. May need raw FSEvents binding for Option 4 full implementation.
- **Index scope** — currently indexes all of $HOME minus exclusions. Consider letting user configure indexed paths.
- **Trigram storage** — 888K trigrams for 60K files = ~15 per file. Acceptable but adds ~20% storage.

## Completed (This Session)

- ✅ Fuzzy search (Cmd+P) with FTS5 + trigrams + Levenshtein
- ✅ Background indexer with incremental sync
- ✅ Schema versioning + auto-rebuild
- ✅ Separate read/write SQLite connections (no search freeze)
- ✅ Real-time index updates on trash/move/copy/rename/create
- ✅ Indexing status indicator in status bar
- ✅ Settings panel search index stats + rebuild buttons
- ✅ HTML table file list with proper column resize
- ✅ Font slider consistency fix (all panels same size)
- ✅ Text selection + Cmd+C in preview panel
- ✅ Settings actions (view mode, hidden files, sort) take effect immediately
- ✅ Preview panel max width cap (60%)
- ✅ Search result auto-selects file after navigation
- ✅ Git status in status bar
- ✅ New themes (Material Dark, GitHub Dark, Monokai, Atom)
- ✅ Syntax highlighting (Dockerfile, shell, ruby, swift, lua, toml, nginx, cmake)
