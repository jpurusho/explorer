import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useNavigationStore } from "../stores/navigationStore";
import { useFileListStore } from "../stores/fileListStore";
import { useTagStore } from "../stores/tagStore";
import { invalidateCache } from "../lib/previewCache";
import type { FileEntry } from "../types";

export function useDirectory() {
  const currentPath = useNavigationStore((s) => s.currentPath);
  const refreshTrigger = useNavigationStore((s) => s.refreshTrigger);
  const lastPathRef = useRef<string | null>(null);
  // Monotonic generation counter so an effect rerun cancels any in-flight
  // listing from the previous run. Comparing to currentPath alone misses
  // back-to-same-path races (A → B → A while A's first list is in flight).
  const genRef = useRef(0);

  useEffect(() => {
    if (!currentPath) return;
    const targetPath = currentPath;
    const myGen = ++genRef.current;
    const isCurrent = () => genRef.current === myGen;

    const fileStore = useFileListStore.getState();
    const tagStore = useTagStore.getState();

    // Path change vs in-place refresh. Path change is navigation: spinner +
    // accept any result (empty included). In-place refresh is the watcher
    // firing on the same dir: keep entries in view, and guard against the
    // transient empty reads that FSEvents can produce mid-write.
    const isNavigation = lastPathRef.current !== targetPath;
    lastPathRef.current = targetPath;
    if (isNavigation) fileStore.setLoading(true);
    fileStore.setError(null);

    const activeTag = tagStore.activeTagFilter;

    if (activeTag !== null) {
      invoke<string[]>("get_files_by_tag", { tagId: activeTag })
        .then((paths) => {
          if (!isCurrent()) return;
          if (paths.length === 0) {
            fileStore.setEntries([]);
            fileStore.setLoading(false);
            return;
          }
          return invoke<FileEntry[]>("get_file_entries", { paths }).then((entries) => {
            if (!isCurrent()) return;
            fileStore.setEntries(entries);
            tagStore.loadTagsForFiles(paths).catch(() => {});
          });
        })
        .catch(() => {
          if (isCurrent()) {
            fileStore.setEntries([]);
          }
        })
        .finally(() => {
          if (isCurrent()) {
            fileStore.setLoading(false);
          }
        });
    } else {
      invoke<FileEntry[]>("list_directory", { path: targetPath })
        .then((entries) => {
          if (!isCurrent()) return;
          // Defend against transient empty reads during external operations
          // (atomic rename, mid-write FSEvents tick). On a watcher refresh,
          // if the result is empty but we currently have entries, skip the
          // update — the next refresh will confirm. Navigation always
          // commits the result, including a genuinely empty directory.
          if (!isNavigation && entries.length === 0 && fileStore.entries.length > 0) {
            return;
          }
          fileStore.setEntries(entries);
          const paths = entries.map((e) => e.path);
          tagStore.loadTagsForFiles(paths).catch(() => {});
          invoke<Record<string, string>>("get_sync_statuses", { path: targetPath })
            .then((statusObj) => {
              if (!isCurrent()) return;
              const map = new Map(Object.entries(statusObj) as [string, "pushed" | "local"][]);
              useFileListStore.getState().setSyncStatusMap(map);
            })
            .catch(() => {});
        })
        .catch((err) => {
          if (!isCurrent()) return;
          const msg = err instanceof Error ? err.message : String(err);
          // Only auto-navigate to parent on real not-found during user
          // navigation. Watcher-triggered refreshes can transiently fail
          // during atomic renames or mid-write FSEvents ticks; navigating
          // away on those would yank the user back to Home unexpectedly.
          if (isNavigation && (msg.includes("not exist") || msg.includes("Not found") || msg.includes("NotFound"))) {
            const parent = targetPath.split("/").slice(0, -1).join("/") || "/";
            if (parent !== targetPath) {
              useNavigationStore.getState().navigateTo(parent);
              return;
            }
          }
          fileStore.setError(msg);
          fileStore.setEntries([]);
        })
        .finally(() => {
          if (isCurrent()) {
            fileStore.setLoading(false);
          }
        });
    }
  }, [currentPath, refreshTrigger]);

  // Watch current directory for external changes
  useEffect(() => {
    if (!currentPath) return;

    let cancelled = false;
    let resolvedUnlisten: (() => void) | null = null;

    // Watcher setup is independent of list_directory and watcher events are
    // already debounced — register immediately so external edits during the
    // first 500ms after navigation aren't dropped on the floor.
    invoke("watch_directory", { path: currentPath }).catch((err) => {
      console.error("[useDirectory] watch_directory failed:", err);
    });

    let debounce: ReturnType<typeof setTimeout> | null = null;
    const unlisten = listen<string>("directory-changed", (event) => {
      if (event.payload === currentPath) {
        // The watcher event doesn't tell us which file changed (it's
        // directory-scoped), but the visible preview is the most likely
        // target — drop its cached content so the next render re-reads.
        const selected = useFileListStore.getState().selectedPath;
        if (selected) invalidateCache(selected);
        if (debounce) clearTimeout(debounce);
        debounce = setTimeout(() => {
          useNavigationStore.getState().refreshCurrent();
        }, 300);
      }
    });

    // If the effect re-ran before listen() resolved, tear down immediately.
    unlisten.then((fn) => {
      if (cancelled) fn();
      else resolvedUnlisten = fn;
    });

    return () => {
      cancelled = true;
      if (debounce) clearTimeout(debounce);
      if (resolvedUnlisten) resolvedUnlisten();
      invoke("unwatch_directory").catch(() => {});
    };
  }, [currentPath]);
}
