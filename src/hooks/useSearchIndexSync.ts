import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

interface FileChangeEvent {
  kind: "created" | "modified" | "removed";
  path: string;
}

/**
 * Listens for file system changes and keeps the search index in sync.
 * Runs in the background - no UI updates needed.
 */
export function useSearchIndexSync() {
  useEffect(() => {
    let unlistenCreated: (() => void) | null = null;
    let unlistenModified: (() => void) | null = null;
    let unlistenRemoved: (() => void) | null = null;

    // Debounce batch updates to avoid hammering the index on rapid changes
    const pendingUpdates = new Map<string, "index" | "unindex">();
    let flushTimer: ReturnType<typeof setTimeout> | null = null;

    const flushPending = () => {
      for (const [path, action] of pendingUpdates.entries()) {
        if (action === "index") {
          invoke("index_file", { path }).catch((err) => {
            console.warn(`[search-sync] Failed to index ${path}:`, err);
          });
        } else {
          invoke("unindex_file", { path }).catch((err) => {
            console.warn(`[search-sync] Failed to unindex ${path}:`, err);
          });
        }
      }
      pendingUpdates.clear();
    };

    const scheduleFlush = () => {
      if (flushTimer) clearTimeout(flushTimer);
      flushTimer = setTimeout(flushPending, 500);
    };

    // File created or renamed-to
    listen<FileChangeEvent>("file-created", (event) => {
      pendingUpdates.set(event.payload.path, "index");
      scheduleFlush();
    }).then((fn) => {
      unlistenCreated = fn;
    });

    // File modified
    listen<FileChangeEvent>("file-modified", (event) => {
      pendingUpdates.set(event.payload.path, "index");
      scheduleFlush();
    }).then((fn) => {
      unlistenModified = fn;
    });

    // File removed or renamed-from
    listen<FileChangeEvent>("file-removed", (event) => {
      pendingUpdates.set(event.payload.path, "unindex");
      scheduleFlush();
    }).then((fn) => {
      unlistenRemoved = fn;
    });

    return () => {
      if (flushTimer) {
        clearTimeout(flushTimer);
        flushPending(); // Flush on unmount
      }
      if (unlistenCreated) unlistenCreated();
      if (unlistenModified) unlistenModified();
      if (unlistenRemoved) unlistenRemoved();
    };
  }, []);
}
