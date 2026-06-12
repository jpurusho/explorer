# 0001. Long-press drag-out, no modifier key

**Date:** 2026-06-12
**Status:** Accepted

## Context

Explorer supports two distinct drag gestures:

1. **In-app drag** — moving/copying files between folders inside
   Explorer (folder-to-folder, folder-to-tag-section). Implemented as
   a standard HTML5 drag-and-drop with a custom MIME payload
   (`application/x-explorer-files`).
2. **Drag-out** — dragging a file out of Explorer's window into
   Finder, the Dock, Warp Terminal, chat apps, etc. Requires a real
   macOS `NSDraggingSession` carrying `public.file-url` /
   `NSFilenamesPboardType` so the destination app gets a real path.

Both gestures originate from the same row/card. Something has to
disambiguate which one fires when the user clicks-and-drags. We've
gone through three designs:

1. **Cmd+drag** — collided with macOS standard "select multiple
   items by clicking individually."
2. **Cmd+Opt+drag** (commits prior to `c5354ac`) — collided with
   macOS Hide Others (Cmd+Opt+H). Users would press the modifier,
   start dragging, accidentally toggle Hide Others, and lose their
   window context.
3. **Long-press, then drag** (`c5354ac` onwards) — hold the mouse
   button down for 350ms before moving. Escalates to a native
   `NSDraggingSession` via `src-tauri/src/commands/drag.rs`.

## Decision

Drag-out triggers via **350ms long-press, then drag**. There is
**no modifier-key alternative**. A normal click-and-drag is always
in-app drag.

The long-press hook is `src/hooks/useLongPressDragOut.ts`. The native
session is initiated by Rust command `start_native_drag` in
`src-tauri/src/commands/drag.rs`, which builds an `NSPasteboardItem`
with multiple representations and runs an `NSDraggingSource`.

## Consequences

- **In-app drag works without ceremony** — most common case is
  unmodified.
- **Drag-out has a learnable wait** — 350ms is long enough to be
  intentional, short enough not to feel sluggish.
- **No modifier collisions** with macOS system shortcuts.
- **Trade-off:** users discovering drag-out for the first time have
  no visual hint that it requires holding. Mitigation parked as
  future work (subtle cursor change after the threshold?).

## Alternatives considered

- **Cmd+drag** — rejected (multi-select collision).
- **Cmd+Opt+drag** — rejected (Hide Others collision).
- **Per-row drag handle button** — rejected (added visual noise to
  every row, broke keyboard-driven workflow).
- **Settings toggle "drag-out always vs. modifier"** — rejected per
  "config settings only for things that genuinely matter to
  developers." This isn't a developer concern; it's a UX choice that
  should have one good answer.
