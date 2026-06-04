import { useState } from "react";
import { useFileListStore } from "../../stores/fileListStore";
import { useNavigationStore } from "../../stores/navigationStore";
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
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; entry: FileEntry } | null>(null);

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
    if (!selectedIndices.has(index)) {
      selectIndex(index);
    }
    setContextMenu({ x: e.clientX, y: e.clientY, entry });
  };

  const handleDragStart = (e: React.DragEvent, entry: FileEntry, index: number) => {
    if (!selectedIndices.has(index)) {
      selectIndex(index);
    }
    const store = useFileListStore.getState();
    const paths = store.getSelectedPaths();
    e.dataTransfer.setData("application/x-explorer-files", JSON.stringify(paths));
    e.dataTransfer.effectAllowed = "copyMove";

    const ghost = document.createElement("div");
    ghost.className = "fixed -top-[100px] left-0 px-3 py-1.5 bg-accent/90 text-white text-[var(--font-sm)] rounded-md font-medium shadow-lg";
    ghost.textContent = paths.length > 1 ? `${paths.length} items` : entry.name;
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 0, 0);
    requestAnimationFrame(() => document.body.removeChild(ghost));
  };

  return (
    <div className="h-full overflow-auto p-6 file-list-font">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(175px,1fr))] gap-4">
        {entries.map((entry, index) => (
          <FileCard
            key={entry.path}
            entry={entry}
            selected={selectedIndices.has(index)}
            onClick={(e) => handleClick(index, e)}
            onDoubleClick={() => {
              if (entry.is_dir) navigateTo(entry.path);
            }}
            onContextMenu={(e) => handleContextMenu(e, entry, index)}
            draggable
            onDragStart={(e) => handleDragStart(e, entry, index)}
          />
        ))}
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          entries={useFileListStore.getState().getSelectedEntries()}
          onClose={() => setContextMenu(null)}
          onOpen={() => {
            if (contextMenu.entry.is_dir) navigateTo(contextMenu.entry.path);
          }}
        />
      )}
    </div>
  );
}
