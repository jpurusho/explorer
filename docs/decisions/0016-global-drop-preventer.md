# 16. Global Drop Preventer for External Drags

**Status:** Accepted  
**Date:** 2026-06-16

## Context

When users dragged files from Finder into Explorer (dropping on empty space or folder cards), the browser's default drop behavior would navigate to the file, replacing the entire Explorer window with a fullscreen file viewer. This broke the app UX — users had to right-click and go back to restore the file list.

Tauri's `dragDropEnabled: false` in `tauri.conf.json` disables Tauri's file-drop events but doesn't prevent the **browser**'s default navigation behavior when a file is dropped on an HTML page.

## Decision

Add global `dragover` and `drop` event listeners in `src/main.tsx` (before React mounts) that `preventDefault()` on both events, using capture phase to intercept before any child handlers:

```typescript
document.addEventListener("dragover", (e) => {
  e.preventDefault(); // Signal "valid drop target" so drop event fires
}, true);

document.addEventListener("drop", (e) => {
  e.preventDefault(); // Block browser navigation
  console.log("[main] Blocked external drop — Finder→Explorer import not yet supported");
}, true);
```

**Why both events?** The browser requires `preventDefault()` on `dragover` to signal "this is a droppable area" so the `drop` event will fire at all. Without the `dragover` preventDefault, the browser never fires `drop`.

## Consequences

**Positive:**
- Finder→Explorer drops are blocked — no more accidental fullscreen file navigation
- In-app folder-to-folder drops still work (folder `onDrop` handlers fire first, child handlers don't bubble to document)

**Negative:**
- Finder→Explorer "import" feature is explicitly disabled (not yet implemented)
- All external drops are blocked, even if we later want to support some

**Future Work:**
- To support Finder→Explorer import: detect external drops on folder cards, parse `text/uri-list` or `dataTransfer.files`, call Rust command to copy files to target folder
- For now, explicitly log "not yet supported" to set expectations

**Related:**
- Folder drop handlers in `FileCard.tsx`/`FileListItem.tsx` parse both `application/x-explorer-files` (HTML5 in-app) and `text/uri-list` (native macOS) formats
