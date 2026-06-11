import { invoke } from "@tauri-apps/api/core";
import { useNavigationStore } from "../stores/navigationStore";
import { useFileListStore } from "../stores/fileListStore";
import { useClipboardStore } from "../stores/clipboardStore";
import { useUndoStore } from "../stores/undoStore";
import { toast } from "../stores/toastStore";

interface FileOpError {
  path: string;
  error: string;
}
interface FileOpResult {
  succeeded: number;
  failed: FileOpError[];
  created_paths?: string[];
}

function basename(path: string): string {
  return path.split("/").pop() || path;
}

/** Summarize a batch result into a user-facing toast (success or partial failure). */
function reportResult(result: FileOpResult, verb: string) {
  if (result.failed.length > 0) {
    const first = result.failed[0];
    const extra = result.failed.length > 1 ? ` (+${result.failed.length - 1} more)` : "";
    toast.error(`Failed to ${verb} ${basename(first.path)}: ${first.error}${extra}`);
  }
}

function errMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  return String(e);
}

/**
 * Centralized file operations. Both keyboard shortcuts (useKeyboard) and the
 * context menu call these, so behavior — error surfacing, undo recording,
 * directory refresh — stays in ONE place and can't drift.
 */
export const fileActions = {
  /** Mark paths for copy in the shared clipboard. */
  copy(paths: string[]) {
    if (paths.length > 0) useClipboardStore.getState().setPaths(paths, "copy");
  },

  /** Mark paths for move (cut) in the shared clipboard. */
  cut(paths: string[]) {
    if (paths.length > 0) useClipboardStore.getState().setPaths(paths, "cut");
  },

  /** Paste the clipboard into `dest`, recording an undo step and surfacing errors. */
  async paste(dest: string) {
    const { paths, operation } = useClipboardStore.getState();
    if (paths.length === 0 || !operation) return;

    try {
      if (operation === "copy") {
        const r = await invoke<FileOpResult>("copy_items", { paths, destination: dest });
        reportResult(r, "copy");
        if (r.created_paths && r.created_paths.length > 0) {
          useUndoStore.getState().push({ type: "copy", createdPaths: r.created_paths });
        }
      } else {
        const r = await invoke<FileOpResult>("move_items", { paths, destination: dest });
        reportResult(r, "move");
        if (r.created_paths && r.created_paths.length > 0) {
          const moves = paths.map((from, i) => ({
            from,
            to: r.created_paths![i] ?? `${dest}/${basename(from)}`,
          }));
          useUndoStore.getState().push({ type: "move", moves });
        }
        useClipboardStore.getState().clear();
      }
      useNavigationStore.getState().refreshCurrent();
    } catch (e) {
      toast.error(`Paste failed: ${errMessage(e)}`);
    }
  },

  /** Duplicate paths in place (Finder-style "file copy" naming). */
  async duplicate(paths: string[]) {
    if (paths.length === 0) return;
    try {
      const r = await invoke<FileOpResult>("duplicate_items", { paths });
      reportResult(r, "duplicate");
      if (r.created_paths && r.created_paths.length > 0) {
        useUndoStore.getState().push({ type: "duplicate", createdPaths: r.created_paths });
        // Offer to rename the (single) new copy, like Finder.
        if (r.created_paths.length === 1) {
          useFileListStore.getState().requestRename(r.created_paths[0]);
        }
      }
      useNavigationStore.getState().refreshCurrent();
    } catch (e) {
      toast.error(`Duplicate failed: ${errMessage(e)}`);
    }
  },

  /** Move paths to the macOS Trash. */
  async trash(paths: string[]) {
    if (paths.length === 0) return;
    try {
      const r = await invoke<FileOpResult>("trash_items", { paths });
      reportResult(r, "trash");
      useNavigationStore.getState().refreshCurrent();
    } catch (e) {
      toast.error(`Move to Trash failed: ${errMessage(e)}`);
    }
  },

  /** Copy external paths (e.g. a Finder drag-drop) into `dest`. */
  async importPaths(paths: string[], dest: string) {
    if (paths.length === 0) return;
    try {
      const r = await invoke<FileOpResult>("copy_items", { paths, destination: dest });
      reportResult(r, "copy");
      if (r.created_paths && r.created_paths.length > 0) {
        useUndoStore.getState().push({ type: "copy", createdPaths: r.created_paths });
      }
      useNavigationStore.getState().refreshCurrent();
    } catch (e) {
      toast.error(`Drop failed: ${errMessage(e)}`);
    }
  },

  /** Create a new "untitled folder" in `dest`, finding a free name on collision. */
  async newFolder(dest: string) {
    for (let i = 1; i < 100; i++) {
      const name = i === 1 ? "untitled folder" : `untitled folder ${i}`;
      const path = `${dest}/${name}`;
      try {
        await invoke("create_folder", { path });
        // Auto-start renaming the new folder, like Finder.
        useFileListStore.getState().requestRename(path);
        useNavigationStore.getState().refreshCurrent();
        return;
      } catch {
        // name taken — try the next
      }
    }
    toast.error("Could not create a new folder");
  },

  /** Undo the most recent reversible operation. */
  async undo() {
    const ok = await useUndoStore.getState().undo();
    if (ok) {
      useNavigationStore.getState().refreshCurrent();
    } else if (useUndoStore.getState().canUndo()) {
      toast.error("Undo failed");
    }
  },
};

/** Convenience: pull the current selection's paths from the file-list store. */
export function selectedPaths(): string[] {
  return useFileListStore.getState().getSelectedPaths();
}
