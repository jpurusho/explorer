import { invoke } from "@tauri-apps/api/core";
import { toast } from "../stores/toastStore";

/**
 * Start a native macOS file drag so the given absolute paths can be dropped
 * into other apps. Calls into our own Rust command (src-tauri/src/commands/drag.rs)
 * which advertises both the modern `public.file-url` UTI and the legacy
 * `NSFilenamesPboardType` plist on the pasteboard, with a permissive operation
 * mask (Copy | Move | Generic | Link). That combination matches Finder's
 * behavior, so destinations from Dock Trash to Electron chat apps all
 * recognize the drag.
 */
export function startNativeFileDrag(paths: string[]): void {
  if (paths.length === 0) return;
  invoke("start_native_drag", { paths }).catch((e) => {
    toast.error(`Drag-out failed: ${e instanceof Error ? e.message : String(e)}`);
  });
}
