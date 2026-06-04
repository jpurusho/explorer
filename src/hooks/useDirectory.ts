import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
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
    let cancelled = false;

    const fileStore = useFileListStore.getState();
    const tagStore = useTagStore.getState();
    const sectionStore = useSectionStore.getState();

    fileStore.setLoading(true);
    fileStore.setError(null);

    const activeTag = tagStore.activeTagFilter;

    if (activeTag !== null) {
      // Virtual tag view: show ALL files with this tag across all directories
      invoke<string[]>("get_files_by_tag", { tagId: activeTag })
        .then((paths) => {
          if (cancelled) return;
          if (paths.length === 0) {
            fileStore.setEntries([]);
            fileStore.setLoading(false);
            return;
          }
          return invoke<FileEntry[]>("get_file_entries", { paths }).then((entries) => {
            if (cancelled) return;
            fileStore.setEntries(entries);
            tagStore.loadTagsForFiles(paths).catch(() => {});
          });
        })
        .catch(() => {
          if (!cancelled) {
            fileStore.setEntries([]);
          }
        })
        .finally(() => {
          if (!cancelled) fileStore.setLoading(false);
        });
    } else {
      // Normal directory view
      invoke<FileEntry[]>("list_directory", { path: currentPath })
        .then((entries) => {
          if (cancelled) return;
          fileStore.setEntries(entries);
          const paths = entries.map((e) => e.path);
          tagStore.loadTagsForFiles(paths).catch(() => {});
          sectionStore.loadSections(currentPath).catch(() => {});
        })
        .catch((err) => {
          if (cancelled) return;
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes("not exist") || msg.includes("Not found") || msg.includes("NotFound")) {
            const parent = currentPath.split("/").slice(0, -1).join("/") || "/";
            if (parent !== currentPath) {
              useNavigationStore.getState().navigateTo(parent);
              return;
            }
          }
          fileStore.setError(msg);
          fileStore.setEntries([]);
        })
        .finally(() => {
          if (!cancelled) fileStore.setLoading(false);
        });
    }

    return () => { cancelled = true; };
  }, [currentPath, refreshTrigger]);
}
