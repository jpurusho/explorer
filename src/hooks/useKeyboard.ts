import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useNavigationStore } from "../stores/navigationStore";
import { useFileListStore } from "../stores/fileListStore";

let clipboard: string[] = [];
let clipboardOp: "copy" | "cut" | null = null;

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
            if (!isEditing && !window.getSelection()?.toString()) {
              e.preventDefault();
              fileStore.selectAll();
            }
            return;
          case "c":
            if (!isEditing && !window.getSelection()?.toString()) {
              e.preventDefault();
              clipboard = fileStore.getSelectedPaths();
              clipboardOp = "copy";
            }
            return;
          case "x":
            if (!isEditing) {
              e.preventDefault();
              clipboard = fileStore.getSelectedPaths();
              clipboardOp = "cut";
            }
            return;
          case "v":
            if (!isEditing && clipboard.length > 0) {
              e.preventDefault();
              const dest = navStore.currentPath;
              if (clipboardOp === "copy") {
                invoke("copy_items", { paths: clipboard, destination: dest }).then(() => {
                  navStore.refreshCurrent();
                });
              } else if (clipboardOp === "cut") {
                invoke("move_items", { paths: clipboard, destination: dest }).then(() => {
                  clipboard = [];
                  clipboardOp = null;
                  navStore.refreshCurrent();
                });
              }
            }
            return;
          case "d":
            if (!isEditing) {
              e.preventDefault();
              const paths = fileStore.getSelectedPaths();
              const dest = navStore.currentPath;
              if (paths.length > 0) {
                invoke("copy_items", { paths, destination: dest }).then(() => {
                  navStore.refreshCurrent();
                });
              }
            }
            return;
          case "N":
            if (e.shiftKey && !isEditing) {
              e.preventDefault();
              const dest = navStore.currentPath;
              invoke("create_folder", { path: `${dest}/untitled folder` }).then(() => {
                navStore.refreshCurrent();
              }).catch(() => {
                let i = 2;
                const tryCreate = (): Promise<void> =>
                  invoke("create_folder", { path: `${dest}/untitled folder ${i}` })
                    .then(() => navStore.refreshCurrent())
                    .catch(() => { i++; if (i < 100) return tryCreate(); });
                tryCreate();
              });
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
