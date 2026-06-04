import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useNavigationStore } from "../stores/navigationStore";
import { useFileListStore } from "../stores/fileListStore";

export function useKeyboard() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isEditing = target.closest(".cm-editor")
        || target.tagName === "INPUT"
        || target.tagName === "TEXTAREA"
        || target.isContentEditable;

      if (e.metaKey) {
        const fileStore = useFileListStore.getState();
        const navStore = useNavigationStore.getState();

        switch (e.key) {
          case "[":
            e.preventDefault();
            navStore.goBack();
            return;
          case "]":
            e.preventDefault();
            navStore.goForward();
            return;
          case "1":
            if (!isEditing) {
              e.preventDefault();
              fileStore.setViewMode("list");
            }
            return;
          case "2":
            if (!isEditing) {
              e.preventDefault();
              fileStore.setViewMode("grid");
            }
            return;
          case ".":
            if (e.shiftKey) {
              e.preventDefault();
              fileStore.toggleHiddenFiles();
            }
            return;
          case "Backspace":
            if (e.shiftKey) {
              // Cmd+Shift+Delete = trash selected items
              e.preventDefault();
              const paths = fileStore.getSelectedPaths();
              if (paths.length > 0) {
                invoke("trash_items", { paths }).then(() => {
                  navStore.refreshCurrent();
                });
              }
            } else {
              e.preventDefault();
              navStore.goUp();
            }
            return;
          case "a":
            if (!isEditing) {
              e.preventDefault();
              fileStore.selectAll();
            }
            return;
        }
      }

      if (isEditing) return;

      const navStore = useNavigationStore.getState();
      const fileStore = useFileListStore.getState();
      const { visibleEntries, selectedIndex } = fileStore;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          if (e.shiftKey) {
            const next = Math.min(selectedIndex + 1, visibleEntries.length - 1);
            fileStore.selectRange(next);
          } else {
            fileStore.selectIndex(Math.min(selectedIndex + 1, visibleEntries.length - 1));
          }
          break;

        case "ArrowUp":
          e.preventDefault();
          if (e.shiftKey) {
            const prev = Math.max(selectedIndex - 1, 0);
            fileStore.selectRange(prev);
          } else {
            fileStore.selectIndex(Math.max(selectedIndex - 1, 0));
          }
          break;

        case "Enter": {
          const entry = visibleEntries[selectedIndex];
          if (entry?.is_dir) {
            navStore.navigateTo(entry.path);
          }
          break;
        }

        case "Escape":
          fileStore.clearSelection();
          break;

        case "Delete":
        case "Backspace": {
          const paths = fileStore.getSelectedPaths();
          if (paths.length > 0) {
            invoke("trash_items", { paths }).then(() => {
              navStore.refreshCurrent();
            });
          }
          break;
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
}
