import { useEffect } from "react";
import { useNavigationStore } from "../stores/navigationStore";
import { useFileListStore } from "../stores/fileListStore";
import { fileActions } from "./useFileActions";

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
          case "r":
            if (!isEditing) {
              e.preventDefault();
              navStore.refreshCurrent();
            }
            return;
          case "ArrowDown": {
            e.preventDefault();
            const entry = fileStore.visibleEntries[fileStore.selectedIndex];
            if (entry?.is_dir) navStore.navigateTo(entry.path);
            return;
          }
          case "ArrowUp":
            e.preventDefault();
            navStore.goUp();
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
              e.preventDefault();
              fileActions.trash(fileStore.getSelectedPaths());
            } else {
              e.preventDefault();
              navStore.goUp();
            }
            return;
          case "a":
            if (!isEditing && !window.getSelection()?.toString()) {
              e.preventDefault();
              fileStore.selectAll();
            }
            return;
          case "c":
            if (!isEditing && !window.getSelection()?.toString()) {
              e.preventDefault();
              fileActions.copy(fileStore.getSelectedPaths());
            }
            return;
          case "x":
            if (!isEditing) {
              e.preventDefault();
              fileActions.cut(fileStore.getSelectedPaths());
            }
            return;
          case "v":
            if (!isEditing) {
              e.preventDefault();
              fileActions.paste(navStore.currentPath);
            }
            return;
          case "z":
            if (!isEditing) {
              e.preventDefault();
              fileActions.undo();
            }
            return;
          case "d":
            if (!isEditing) {
              e.preventDefault();
              fileActions.duplicate(fileStore.getSelectedPaths());
            }
            return;
          case "N":
            if (e.shiftKey && !isEditing) {
              e.preventDefault();
              fileActions.newFolder(navStore.currentPath);
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

        case "ArrowRight": {
          const entry = visibleEntries[selectedIndex];
          if (entry?.is_dir) {
            navStore.navigateTo(entry.path);
          }
          break;
        }

        case "ArrowLeft":
          navStore.goUp();
          break;

        case "Enter": {
          const entry = visibleEntries[selectedIndex];
          if (entry?.is_dir) {
            navStore.navigateTo(entry.path);
          }
          break;
        }

        case " ":
          e.preventDefault();
          // Space selects without navigating (like Finder Quick Look trigger)
          if (selectedIndex >= 0) {
            const entry = visibleEntries[selectedIndex];
            if (entry) fileStore.setSelectedPath(entry.path);
          }
          break;

        case "Home":
          e.preventDefault();
          if (visibleEntries.length > 0) {
            if (e.shiftKey) fileStore.selectRange(0);
            else fileStore.selectIndex(0);
          }
          break;

        case "End":
          e.preventDefault();
          if (visibleEntries.length > 0) {
            const last = visibleEntries.length - 1;
            if (e.shiftKey) fileStore.selectRange(last);
            else fileStore.selectIndex(last);
          }
          break;

        case "PageDown":
          e.preventDefault();
          fileStore.selectIndex(Math.min(selectedIndex + 20, visibleEntries.length - 1));
          break;

        case "PageUp":
          e.preventDefault();
          fileStore.selectIndex(Math.max(selectedIndex - 20, 0));
          break;

        case "Escape":
          fileStore.clearSelection();
          break;

        case "Delete":
        case "Backspace": {
          fileActions.trash(fileStore.getSelectedPaths());
          break;
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
}
