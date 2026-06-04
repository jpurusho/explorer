import { useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useNavigationStore } from "../stores/navigationStore";
import { useFileListStore } from "../stores/fileListStore";
import type { FileEntry } from "../types";

export function useDirectory() {
  const currentPath = useNavigationStore((s) => s.currentPath);
  const refreshTrigger = useNavigationStore((s) => s.refreshTrigger);
  const setEntries = useFileListStore((s) => s.setEntries);
  const setLoading = useFileListStore((s) => s.setLoading);
  const setError = useFileListStore((s) => s.setError);

  const loadDirectory = useCallback(
    async (path: string) => {
      setLoading(true);
      setError(null);
      try {
        const entries = await invoke<FileEntry[]>("list_directory", { path });
        setEntries(entries);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setEntries([]);
      } finally {
        setLoading(false);
      }
    },
    [setEntries, setLoading, setError]
  );

  useEffect(() => {
    if (currentPath) {
      loadDirectory(currentPath);
    }
  }, [currentPath, refreshTrigger, loadDirectory]);

  return { loadDirectory };
}
