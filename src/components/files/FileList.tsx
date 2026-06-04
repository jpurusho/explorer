import { useRef, useState, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowUp, ArrowDown, Eye, EyeOff } from "lucide-react";
import { useFileListStore } from "../../stores/fileListStore";
import { useNavigationStore } from "../../stores/navigationStore";
import { FileListItem } from "./FileListItem";
import { ContextMenu } from "./ContextMenu";
import type { FileEntry, SortField } from "../../types";
import type { ColumnId, ColumnConfig } from "../../stores/fileListStore";

// Maps column IDs to sortBy fields
const columnSortField: Record<ColumnId, SortField> = {
  type: "type",
  size: "size",
  modified: "modified",
};

function ResizeHandle({
  currentWidth,
  onWidthChange,
}: {
  currentWidth: number;
  onWidthChange: (newWidth: number) => void;
}) {
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startWidth = currentWidth;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const delta = moveEvent.clientX - startX;
        onWidthChange(startWidth + delta);
      };

      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [currentWidth, onWidthChange]
  );

  return (
    <div
      className="absolute right-0 top-0 bottom-0 w-[5px] cursor-col-resize z-20 group/handle"
      onMouseDown={handleMouseDown}
    >
      <div className="absolute right-[2px] top-[4px] bottom-[4px] w-[1px] bg-border opacity-0 group-hover/handle:opacity-100 transition-opacity" />
    </div>
  );
}

function ColumnVisibilityMenu({
  columns,
  onToggle,
  onClose,
}: {
  columns: ColumnConfig[];
  onToggle: (id: ColumnId) => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute right-0 top-full mt-1 bg-bg border border-border rounded-md shadow-lg z-50 py-1 min-w-[120px]">
        {columns.map((col) => (
          <button
            key={col.id}
            className="flex items-center gap-2 w-full px-3 py-1.5 text-[var(--font-sm)] text-text hover:bg-bg-hover transition-colors"
            onClick={() => onToggle(col.id)}
          >
            {col.visible ? (
              <Eye size={12} className="text-accent" />
            ) : (
              <EyeOff size={12} className="text-text-secondary" />
            )}
            <span>{col.label}</span>
          </button>
        ))}
      </div>
    </>
  );
}

function ColumnHeader() {
  const sortBy = useFileListStore((s) => s.sortBy);
  const sortDirection = useFileListStore((s) => s.sortDirection);
  const setSortBy = useFileListStore((s) => s.setSortBy);
  const toggleSortDirection = useFileListStore((s) => s.toggleSortDirection);
  const columns = useFileListStore((s) => s.columns);
  const setColumnWidth = useFileListStore((s) => s.setColumnWidth);
  const toggleColumnVisibility = useFileListStore((s) => s.toggleColumnVisibility);
  const [showVisibilityMenu, setShowVisibilityMenu] = useState(false);

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      toggleSortDirection();
    } else {
      setSortBy(field);
    }
  };

  const handleNameSort = () => handleSort("name");

  const SortIndicator = ({ field }: { field: SortField }) => {
    if (sortBy !== field) return null;
    return sortDirection === "asc" ? (
      <ArrowUp size={10} className="text-accent shrink-0" />
    ) : (
      <ArrowDown size={10} className="text-accent shrink-0" />
    );
  };

  const visibleColumns = columns.filter((c) => c.visible);

  return (
  <>
    <div
      className="flex items-center gap-3 py-1.5 ml-4 mr-4 px-3 border-b border-border mb-1 sticky top-0 bg-bg z-10 overflow-hidden"
      style={{ fontSize: "var(--font-filelist-header)" }}
      onContextMenu={(e) => { e.preventDefault(); setShowVisibilityMenu(!showVisibilityMenu); }}
    >
      <div className="w-4 shrink-0" /> {/* icon space */}

      {/* Name column - always visible, flexible */}
      <button
        className="flex-1 flex items-center gap-1 text-text-secondary font-semibold uppercase tracking-wider min-w-0 cursor-pointer hover:text-text transition-colors text-left"
        onClick={handleNameSort}
      >
        <span className="truncate">Name</span>
        <SortIndicator field="name" />
      </button>

      {/* Data columns - sortable + resizable */}
      {visibleColumns.map((col) => (
        <div
          key={col.id}
          className="relative shrink-0"
          style={{ width: `${col.width}px` }}
        >
          <button
            className="w-full flex items-center justify-end gap-1 text-text-secondary font-semibold uppercase tracking-wider cursor-pointer hover:text-text transition-colors"
            onClick={() => handleSort(columnSortField[col.id])}
          >
            <SortIndicator field={columnSortField[col.id]} />
            <span className="truncate">{col.label}</span>
          </button>
          <ResizeHandle
            currentWidth={col.width}
            onWidthChange={(newWidth) => setColumnWidth(col.id, newWidth)}
          />
        </div>
      ))}

    </div>

    {/* Column visibility menu (triggered by right-click on header) */}
    {showVisibilityMenu && (
      <ColumnVisibilityMenu
        columns={columns}
        onToggle={toggleColumnVisibility}
        onClose={() => setShowVisibilityMenu(false)}
      />
    )}
  </>
  );
}

export function FileList() {
  const parentRef = useRef<HTMLDivElement>(null);
  const entries = useFileListStore((s) => s.visibleEntries);
  const selectedIndices = useFileListStore((s) => s.selectedIndices);
  const selectIndex = useFileListStore((s) => s.selectIndex);
  const toggleIndex = useFileListStore((s) => s.toggleIndex);
  const selectRange = useFileListStore((s) => s.selectRange);
  const navigateTo = useNavigationStore((s) => s.navigateTo);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; entry: FileEntry } | null>(null);
  const [renamingIndex, setRenamingIndex] = useState<number | null>(null);

  const virtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 30,
    overscan: 10,
  });

  const lastClickRef = useRef<{ index: number; time: number }>({ index: -1, time: 0 });

  const handleClick = (index: number, e: React.MouseEvent) => {
    const now = Date.now();
    const last = lastClickRef.current;

    // Detect double-click manually (works with virtualized lists)
    if (last.index === index && now - last.time < 400) {
      lastClickRef.current = { index: -1, time: 0 };
      const entry = entries[index];
      if (entry?.is_dir) {
        navigateTo(entry.path);
        return;
      }
    } else {
      lastClickRef.current = { index, time: now };
    }

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
    <div ref={parentRef} className="h-full overflow-y-auto overflow-x-hidden pt-2 file-list-font">
      <ColumnHeader />
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const entry = entries[virtualRow.index];
          return (
            <div
              key={virtualRow.key}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <FileListItem
                entry={entry}
                selected={selectedIndices.has(virtualRow.index)}
                renaming={renamingIndex === virtualRow.index}
                onRename={async (newName) => {
                  const { invoke } = await import("@tauri-apps/api/core");
                  await invoke("rename_item", { path: entry.path, newName });
                  setRenamingIndex(null);
                  useNavigationStore.getState().refreshCurrent();
                }}
                onCancelRename={() => setRenamingIndex(null)}
                onClick={(e) => handleClick(virtualRow.index, e)}
                onDoubleClick={() => {
                  if (entry.is_dir) navigateTo(entry.path);
                }}
                onContextMenu={(e) => handleContextMenu(e, entry, virtualRow.index)}
                draggable={renamingIndex !== virtualRow.index}
                onDragStart={(e) => handleDragStart(e, entry, virtualRow.index)}
                onFileDrop={entry.is_dir ? async (paths) => {
                  const { invoke } = await import("@tauri-apps/api/core");
                  await invoke("move_items", { paths, destination: entry.path });
                  useNavigationStore.getState().refreshCurrent();
                } : undefined}
              />
            </div>
          );
        })}
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
          onRename={() => {
            const idx = entries.findIndex((e) => e.path === contextMenu.entry.path);
            if (idx >= 0) setRenamingIndex(idx);
          }}
        />
      )}
    </div>
  );
}
