# 0009. Persistent editor buffers via live EditorView reparenting

**Date:** 2026-06-13  
**Status:** Accepted (extends [#0006](./0006-unsaved-changes-warning.md))

## Context

Switching panels (Cmd+E to ScratchPad, Cmd+, to Settings) unmounts
PreviewPanel, destroying the CodeMirror EditorView. Edits, undo
history, cursor position, Vim mode state — all lost. ADR 0006's
confirm dialog doesn't help here because panel switches don't involve
file selection.

## Decision

Keep EditorView instances alive in a Zustand store (`editorBufferStore`)
keyed by file path. On unmount, detach the view's DOM from the
container (do NOT call `view.destroy()`). On remount, reparent it into
the new container via `appendChild` + `requestMeasure()`.

- **Max 5 live views** with LRU eviction (destroy oldest on overflow).
- **Autosave** is opt-in (Settings → File Display → Auto-save) with a
  configurable debounce (500ms–5s). Saving does NOT clear undo history.
- **Dirty detection** via `content !== savedContent` in the buffer
  entry, surfaced as an amber dot in the preview header.

## Consequences

- Panel switches are instant — no data loss, no confirm dialog needed.
- Undo (Cmd+Z) works across saves when autosave is enabled.
- Vim mode, cursor, scroll position, selection all survive.
- Evicted buffers lose undo history but preserve text content.
- React StrictMode double-mount is handled via `parentElement` guards.

## Alternatives considered

**Serialize via EditorState.toJSON():** Preserves doc + basic history
but NOT Vim mode state, cursor blink phase, or scroll offset. Rejected
because this app uses `@replit/codemirror-vim` whose state is opaque.

**Never unmount PreviewPanel (CSS hide):** Would preserve everything
trivially but breaks the existing panel architecture (settings/scratch
replace the panel slot) and accumulates hidden DOM weight.
