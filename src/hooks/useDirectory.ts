import { useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useNavigationStore } from "../stores/navigationStore";
import { useFileListStore } from "../stores/fileListStore";
import { useTagStore } from "../stores/tagStore";
import { useSectionStore } from "../stores/sectionStore";
import type { FileEntry } from "../types";

export function useDirectory() {
  const currentPath = useNavigationStore((s) => s.currentPath);
  const refreshTrigger = useNavigationStore((s) => s.refreshTrigger);
  const setEntries = useFileListStore((s) => s.setEntries);
  const setLoading = useFileListStore((s) => s.setLoading);
  const setError = useFileListStore((s) => s.setError);
  const loadTagsForFiles = useTagStore((s) => s.loadTagsForFiles);
  const loadSections = useSectionStore((s) => s.loadSections);

  const loadDirectory = useCallback(
    async (path: string) => {
      setLoading(true);
      setError(null);
      try {
        const entries = await invoke<FileEntry[]>("list_directory", { path });
        setEntries(entries);

        // Load tags and sections in parallel (non-blocking)
        const paths = entries.map((e) => e.path);
        loadTagsForFiles(paths).catch(() => {});
        loadSections(path).catch(() => {});
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setEntries([]);
      } finally {
        setLoading(false);
      }
    },
    [setEntries, setLoading, setError, loadTagsForFiles, loadSections]
  );

  useEffect(() => {
    if (currentPath) {
      loadDirectory(currentPath);
    }
  }, [currentPath, refreshTrigger, loadDirectory]);

  return { loadDirectory };
}
