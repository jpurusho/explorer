# 0013 — Stability fixes for daily-driver use

Date: 2026-06-15
Status: Accepted

## Context

User reports made the app unusable for daily work:

1. **Watcher → Home navigation.** Editing a file in Terminal would yank the
   user back to the Home folder.
2. **Long-press drag-out "broken".** Long-press, then release without
   dragging, would replace the window with a fullscreen preview of the
   file — recoverable only via right-click → Back.
3. **General flakiness.** Silent failures on common actions (new folder,
   reindex, autosave), confusing rebuild progress that lied about
   completion, occasional empty directory listings during external
   writes.

## Findings (from dev-server logs and code review)

### Issue 1 — Watcher filter was too narrow

`watcher.rs` only emitted `directory-changed` when an event path's
**parent** equaled the watched directory. FSEvents on macOS emits other
shapes too:

- the watched directory itself (metadata change)
- nested descendants (atomic-rename intermediates, mid-write ticks)
- empty `paths` arrays (some FSEvents flushes)

Events outside that one shape were dropped. When the listing did fire
and `list_directory` transiently failed (a race FSEvents naturally
produces during atomic rename / mid-write), the frontend's
"directory-not-found → navigate to parent" recovery would walk all the
way up to `/`, then to Home. **Both bugs together produced the Home jump.**

### Issue 2 — Long-press fired drag, but the mouseup still clicked

`useLongPressDragOut` set `firedRef.current = true` after the 350ms
timer fired and then started the native drag, but it provided **no
mechanism to suppress the click that the same mouseup would deliver to
`onClick`**. The grid/list click handler ran, selected/opened the file,
and the existing onDoubleClick → `navigateTo(file.path)` codepath
loaded a fullscreen webview of the file.

The dev-server log confirmed the drag itself succeeds end-to-end:
`[drag] beginDraggingSessionWithItems_event_source returned successfully`.
The user's report of "drag-out doesn't work" was actually
**"the click that follows the long-press destroys the UI"**.

### Issue 3 — Silent failures across the surface area

- `invoke("create_folder")` and `invoke("reindex")` in CommandPalette had no
  `.catch()`.
- The rebuild/reindex buttons in SettingsPanel used a hardcoded
  `setTimeout(5000)` to flip the spinner off — completely decoupled
  from actual completion. A 30s reindex looked "done" after 5s.
- Autosave swallowed write errors with `.catch(() => {})` AND marked
  the buffer clean — silently losing changes on read-only files.
- `settingsStore.updateSettings` swallowed save errors with no log.

## Decision

### Watcher (Rust)

`event.paths.is_empty() || event.paths.iter().any(|p| p == &watched ||
p.parent() == Some(&watched) || p.starts_with(&watched))`. The empty
case keeps us responsive when FSEvents flushes without paths; the
ancestry case absorbs nested-descendant emits that the old check
silently dropped.

### Watcher recovery (TypeScript)

The "directory not found → go to parent" recovery now only runs when
`isNavigation` is true (the user actually clicked a directory). On a
watcher refresh of the same path, a transient failure leaves the user
where they are — the next refresh will confirm. This kills the
cascade-to-Home behavior even if a stray event still slipped through.

### Long-press click leak

`useLongPressDragOut` exports a new `shouldSuppressClick()` that
returns true for 500ms after the long-press fires. Both `FileGrid` and
`FileList` consult it in `onClick` and `onDoubleClick` and bail before
selecting/opening. The 500ms window is long enough to cover the
release plus any propagation delay, short enough that a deliberate
click after an aborted drag still works.

### Race-safe directory listing

Added a monotonic generation counter (`genRef`) in `useDirectory`.
Each effect run captures `myGen = ++genRef.current`. Async results
check `genRef.current === myGen` instead of comparing paths against
`useNavigationStore.getState().currentPath`. The path comparison missed
the back-to-same-path race (A → B → A while A's first listing is in
flight); the generation counter doesn't.

### Watcher setup timeout removal

The 500ms `setTimeout` before `watch_directory` was a defensive guess
("avoid racing with initial list_directory"). The two operations are
independent — the watcher just registers an FSEvents observer. Removed
so external edits in the first 500ms after navigation aren't dropped.

### Error visibility

- CommandPalette's `create_folder`/`reindex` actions now `try/catch`
  and toast on failure.
- SettingsPanel's rebuild button `await`s the actual operation; the
  spinner flips off when the work finishes (not on a timer). The
  reindex button keeps a 10s timeout because the command kicks off a
  background indexer rather than blocking until done.
- Autosave logs and toasts on failure and **does not mark the buffer
  saved** when the write fails, so the dirty indicator stays on.
- `settingsStore.updateSettings` logs save failures.

## Consequences

- Long-press drag-out is now usable: hold to lift, drag to drop, release
  in place to cancel — all without nuking the UI.
- Editing files via Terminal updates the in-app listing without
  navigating away.
- Failed user-facing operations now surface as toasts rather than
  appearing to silently succeed.
- Slight perf cost in the watcher: more events pass the filter and
  reach the 300ms debounce. Negligible in practice.

## Non-decisions

The cosmetic AppKit warning `'NSFilenamesPboardType' is not a valid
UTI string. Cannot set data for an invalid UTI.` is left in place.
The drag still completes successfully (modern destinations read
`public.file-url`), and the legacy type is best-effort
backward-compat for old Electron consumers. Investigating the right
constant name (`com.apple.NSFilenamesPboardType`?) is a separate
follow-up if any destination is found that needs it.
