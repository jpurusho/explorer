import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useNavigationStore } from "../stores/navigationStore";
import { useFileListStore } from "../stores/fileListStore";
import { useTagStore } from "../stores/tagStore";
import { useSectionStore } from "../stores/sectionStore";
import type { FileEntry } from "../types";

export function useDirectory() {
  const currentPath = useNavigationStore((s) => s.currentPath);
  const refreshTrigger = useNavigationStore((s) => s.refreshTrigger);

  useEffect(() => {
    if (!currentPath) return;
    const targetPath = currentPath;

    const fileStore = useFileListStore.getState();
    const tagStore = useTagStore.getState();
    const sectionStore = useSectionStore.getState();

    fileStore.setLoading(true);
    fileStore.setError(null);

    const activeTag = tagStore.activeTagFilter;

    if (activeTag !== null) {
      invoke<string[]>("get_files_by_tag", { tagId: activeTag })
        .then((paths) => {
          if (useNavigationStore.getState().currentPath !== targetPath) return;
          if (paths.length === 0) {
            fileStore.setEntries([]);
            fileStore.setLoading(false);
            return;
          }
          return invoke<FileEntry[]>("get_file_entries", { paths }).then((entries) => {
            if (useNavigationStore.getState().currentPath !== targetPath) return;
            fileStore.setEntries(entries);
            tagStore.loadTagsForFiles(paths).catch(() => {});
          });
        })
        .catch(() => {
          if (useNavigationStore.getState().currentPath === targetPath) {
            fileStore.setEntries([]);
          }
        })
        .finally(() => {
          if (useNavigationStore.getState().currentPath === targetPath) {
            fileStore.setLoading(false);
          }
        });
    } else {
      invoke<FileEntry[]>("list_directory", { path: targetPath })
        .then((entries) => {
          if (useNavigationStore.getState().currentPath !== targetPath) return;
          fileStore.setEntries(entries);
          const paths = entries.map((e) => e.path);
          tagStore.loadTagsForFiles(paths).catch(() => {});
          sectionStore.loadSections(targetPath).catch(() => {});
        })
        .catch((err) => {
          if (useNavigationStore.getState().currentPath !== targetPath) return;
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes("not exist") || msg.includes("Not found") || msg.includes("NotFound")) {
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
          if (useNavigationStore.getState().currentPath === targetPath) {
            fileStore.setLoading(false);
          }
        });
    }
  }, [currentPath, refreshTrigger]);

  // Watch current directory for external changes
  useEffect(() => {
    if (!currentPath) return;

    // Delay watcher setup to avoid racing with initial list_directory
    const setupTimeout = setTimeout(() => {
      invoke("watch_directory", { path: currentPath }).catch(() => {});
    }, 500);

    let debounce: ReturnType<typeof setTimeout> | null = null;
    const unlisten = listen<string>("directory-changed", (event) => {
      if (event.payload === currentPath) {
        if (debounce) clearTimeout(debounce);
        debounce = setTimeout(() => {
          useNavigationStore.getState().refreshCurrent();
        }, 300);
      }
    });

    return () => {
      clearTimeout(setupTimeout);
      if (debounce) clearTimeout(debounce);
      unlisten.then((fn) => fn());
      invoke("unwatch_directory").catch(() => {});
    };
  }, [currentPath]);
}
