import { startDrag } from "@crabnebula/tauri-plugin-drag";
import { toast } from "../stores/toastStore";

// A small opaque PNG — the plugin requires a drag image. macOS overlays its own
// file-drag badge, so the exact image barely matters.
const DRAG_ICON =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAJUlEQVR42mNgGAWjYBSMglEwCkbBKBgFo2AUjIJRMApGwSgAAA4cAAGr0p3hAAAAAElFTkSuQmCC";

/**
 * Start a native macOS file drag so the given absolute paths can be dropped into
 * other apps (Finder, Warp, etc.). Surfaces failures via a toast so we can see
 * what's wrong rather than failing silently.
 */
export function startNativeFileDrag(paths: string[], icon?: string): void {
  if (paths.length === 0) return;
  // "move" so the Dock Trash (which only accepts NSDragOperationMove) accepts
  // the drop. Dropping into a Finder folder will therefore MOVE the file there
  // rather than copy it — a deliberate tradeoff, since the drag operation is
  // fixed before we know the destination and Trash support was the ask.
  startDrag({ item: paths, icon: icon || DRAG_ICON, mode: "move" }).catch((e) => {
    toast.error(`Drag-out failed: ${e instanceof Error ? e.message : String(e)}`);
  });
}
