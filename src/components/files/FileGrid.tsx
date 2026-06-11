import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useFileListStore } from "../../stores/fileListStore";
import { useNavigationStore } from "../../stores/navigationStore";
import { toast } from "../../stores/toastStore";
import { FileCard } from "./FileCard";
import { ContextMenu } from "./ContextMenu";
import type { FileEntry } from "../../types";

export function FileGrid() {
  const entries = useFileListStore((s) => s.visibleEntries);
  const selectedIndices = useFileListStore((s) => s.selectedIndices);
  const selectIndex = useFileListStore((s) => s.selectIndex);
  const toggleIndex = useFileListStore((s) => s.toggleIndex);
  const selectRange = useFileListStore((s) => s.selectRange);
  const navigateTo = useNavigationStore((s) => s.navigateTo);
  const renameRequestPath = useFileListStore((s) => s.renameRequestPath);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; entry: FileEntry | null } | null>(null);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);

  // Consume a pending rename request once the target entry appears.
  useEffect(() => {
    if (!renameRequestPath) return;
    if (entries.some((e) => e.path === renameRequestPath)) {
      setRenamingPath(renameRequestPath);
      useFileListStore.getState().requestRename(null);
    }
  }, [renameRequestPath, entries]);

  const handleClick = (index: number, e: React.MouseEvent) => {
    if (e.metaKey) {
      toggleIndex(index);
    } else if (e.shiftKey) {
      selectRange(index);
    } else {
      selectIndex(index);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, entry: FileEntry, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (!selectedIndices.has(index)) {
      selectIndex(index);
    }
    setContextMenu({ x: e.clientX, y: e.clientY, entry });
  };

  // Right-click on empty space: background menu (Paste / New Folder / Undo).
  const handleBackgroundContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    useFileListStore.getState().clearSelection();
    setContextMenu({ x: e.clientX, y: e.clientY, entry: null });
  };

  const handleDragStart = (e: React.DragEvent, entry: FileEntry, index: number) => {
    if (!selectedIndices.has(index)) {
      selectIndex(index);
    }
    const store = useFileListStore.getState();
    let paths = store.getSelectedPaths();
    if (paths.length === 0 || !paths.includes(entry.path)) {
      paths = [entry.path];
    }
    e.dataTransfer.setData("application/x-explorer-files", JSON.stringify(paths));
    e.dataTransfer.effectAllowed = "copyMove";

    const ghost = document.createElement("div");
    ghost.className = "fixed -top-[100px] left-0 px-3 py-1.5 bg-accent/90 text-white text-[var(--font-sm)] rounded-md font-medium shadow-lg";
    ghost.textContent = paths.length > 1 ? `${paths.length} items` : entry.name;
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 0, 0);
    requestAnimationFrame(() => document.body.removeChild(ghost));
  };

  const [cardSize, setCardSize] = useState(175);

  return (
    <div className="h-full overflow-auto p-6 file-list-font" onContextMenu={handleBackgroundContextMenu}>
      {/* Card size slider */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-[var(--font-xs)] text-text-muted">Size</span>
        <input
          type="range"
          min="120"
          max="300"
          step="10"
          value={cardSize}
          onChange={(e) => setCardSize(parseInt(e.target.value))}
          className="w-24 h-1.5 bg-bg-tertiary rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent"
        />
      </div>
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${cardSize}px, 1fr))` }}>
        {entries.map((entry, index) => (
          <FileCard
            key={entry.path}
            entry={entry}
            selected={selectedIndices.has(index)}
            renaming={renamingPath === entry.path}
            onRename={async (newName) => {
              try {
                await invoke("rename_item", { path: entry.path, newName });
                useNavigationStore.getState().refreshCurrent();
              } catch (err) {
                toast.error(`Rename failed: ${err instanceof Error ? err.message : String(err)}`);
              } finally {
                setRenamingPath(null);
              }
            }}
            onCancelRename={() => setRenamingPath(null)}
            onStartRename={() => setRenamingPath(entry.path)}
            onClick={(e) => handleClick(index, e)}
            onDoubleClick={() => {
              if (entry.is_dir) navigateTo(entry.path);
            }}
            onContextMenu={(e) => handleContextMenu(e, entry, index)}
            draggable
            onDragStart={(e) => handleDragStart(e, entry, index)}
            onFileDrop={(paths) => {
              if (paths.includes(entry.path)) return;
              invoke("move_items", { paths, destination: entry.path })
                .then(() => useNavigationStore.getState().refreshCurrent())
                .catch((err) => toast.error(`Move failed: ${err instanceof Error ? err.message : String(err)}`));
            }}
          />
        ))}
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          entries={contextMenu.entry ? useFileListStore.getState().getSelectedEntries() : []}
          onClose={() => setContextMenu(null)}
          onOpen={() => {
            if (contextMenu.entry?.is_dir) navigateTo(contextMenu.entry.path);
          }}
          onRename={() => { if (contextMenu.entry) setRenamingPath(contextMenu.entry.path); }}
        />
      )}
    </div>
  );
}
