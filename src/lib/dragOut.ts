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
  startDrag({ item: paths, icon: icon || DRAG_ICON }).catch((e) => {
    toast.error(`Drag-out failed: ${e instanceof Error ? e.message : String(e)}`);
  });
}
