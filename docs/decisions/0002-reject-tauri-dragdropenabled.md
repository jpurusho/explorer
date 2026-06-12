# 0002. Reject Tauri `dragDropEnabled: true` for drag-in

**Date:** 2026-06-12
**Status:** Accepted

## Context

Tauri v2 exposes a window-level config flag `dragDropEnabled`. When
**true**, Tauri intercepts OS-level drops at the native
`NSDraggingDestination` layer and forwards real absolute file paths
to the WebView via `getCurrentWebviewWindow().onDragDropEvent(...)`.
When **false**, the WebView receives raw HTML5
`dragenter`/`dragover`/`drop` events with sandboxed `File` blobs (no
real path).

In v1.7.5 we set `dragDropEnabled: true` to enable accepting
file drops *into* Explorer from Finder/other apps (drag-in). That
shipped and immediately regressed two existing features:

1. **In-app folder→folder drag broke.** The OS interception fired
   first and consumed the drop, so the per-folder `onDrop` handlers
   on `<FileListItem>` / `<FileCard>` (which know which target
   directory the user is hovering over) never ran. The Tauri event
   only carries paths and overall window position, not "what
   element was hovered."
2. **Drag-out to Finder broke** intermittently. The native
   destination registered on our own window could intercept our own
   outgoing `NSDraggingSession`.

## Decision

Keep `dragDropEnabled: false`. Drag-in from outside Explorer is
**parked, not supported**, until we have a per-element
hover-target story that coexists with the existing HTML5 handlers.

In-app drag (HTML5) and drag-out (native `NSDraggingSource` from
`src-tauri/src/commands/drag.rs`) both work because they don't
require Tauri's destination interception.

## Consequences

- Users cannot drag a file from Finder *into* Explorer to copy it
  into the current directory. They can use Cmd+C in Finder + Cmd+V
  in Explorer, or open a second Explorer window.
- All in-app drag flows continue to work as designed.
- The drag-out path stays clean.

## Alternatives considered

- **Keep `dragDropEnabled: true` and route everything to
  `currentPath`** — done in v1.7.5; broke in-app drag entirely.
- **Hybrid: enable Tauri destination but check `event.payload`'s
  position against per-folder bounding rects in JS** — fiddly,
  fragile across virtual scroll, and would require maintaining a
  hit-test registry. Possible but high-risk for a feature that's
  not on the daily critical path.
- **Accept HTML5-only drops and read the file blob via FileReader**
  — works for drag-in but yields no real path, so we couldn't use
  the existing `copy_items` Rust command. Would need a separate
  "import bytes" path. Not worth the duplication.

## Future work

If drag-in becomes important, the path is: keep the destination
disabled for "the whole window," instead register specific element
ranges (per virtual row, per sidebar folder) using a tracking
dictionary, and route the Tauri event through a hit-test that
matches the cursor position to the registered range. Until then,
the parked feature stays parked.
