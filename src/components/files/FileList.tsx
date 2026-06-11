import { useRef, useState, useCallback, useMemo, useEffect } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowUp, ArrowDown, Eye, EyeOff } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { useFileListStore } from "../../stores/fileListStore";
import { useNavigationStore } from "../../stores/navigationStore";
import { toast } from "../../stores/toastStore";
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
      <div className="fixed left-1/3 top-12 bg-bg-secondary border border-border rounded-lg shadow-xl z-50 py-1.5 min-w-[160px]">
        <div className="px-3 py-1 text-[var(--font-xs)] text-text-muted uppercase tracking-wider">Columns</div>
        {columns.map((col) => (
          <button
            key={col.id}
            className="flex items-center gap-2.5 w-full px-3 py-2 text-[var(--font-sm)] text-text hover:bg-bg-hover transition-colors"
            onClick={() => onToggle(col.id)}
          >
            {col.visible ? (
              <Eye size={12} className="text-accent" />
            ) : (
              <EyeOff size={12} className="text-text-muted" />
            )}
            <span>{col.label}</span>
          </button>
        ))}
      </div>
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
  const sortBy = useFileListStore((s) => s.sortBy);
  const sortDirection = useFileListStore((s) => s.sortDirection);
  const setSortBy = useFileListStore((s) => s.setSortBy);
  const toggleSortDirection = useFileListStore((s) => s.toggleSortDirection);
  const columns = useFileListStore((s) => s.columns);
  const nameWidth = useFileListStore((s) => s.nameWidth);
  const setNameWidth = useFileListStore((s) => s.setNameWidth);
  const setColumnWidth = useFileListStore((s) => s.setColumnWidth);
  const toggleColumnVisibility = useFileListStore((s) => s.toggleColumnVisibility);

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; entry: FileEntry | null } | null>(null);
  const [renamingIndex, setRenamingIndex] = useState<number | null>(null);
  const [showVisibilityMenu, setShowVisibilityMenu] = useState(false);
  const renameRequestPath = useFileListStore((s) => s.renameRequestPath);

  const visibleColumns = useMemo(() => columns.filter((c) => c.visible), [columns]);

  const virtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 26,
    overscan: 10,
  });

  // Consume a pending rename request once the target entry appears (e.g. after
  // New Folder / Duplicate refreshes the listing). Scroll it into view so the
  // virtualized row (and its autofocus input) actually mounts.
  useEffect(() => {
    if (!renameRequestPath) return;
    const idx = entries.findIndex((e) => e.path === renameRequestPath);
    if (idx >= 0) {
      setRenamingIndex(idx);
      useFileListStore.getState().requestRename(null);
      virtualizer.scrollToIndex(idx, { align: "center" });
    }
  }, [renameRequestPath, entries]);


  const handleClick = useCallback((index: number, e: React.MouseEvent) => {
    // Multi-select takes priority
    if (e.metaKey) {
      toggleIndex(index);
      return;
    }
    if (e.shiftKey) {
      selectRange(index);
      return;
    }
    // Single click selects. Opening (folders) is handled by the row's native
    // onDoubleClick, and renaming by the name cell's onDoubleClick — keeping a
    // manual double-click detector here would race with (and beat) rename.
    selectIndex(index);
  }, [toggleIndex, selectRange, selectIndex]);

  const handleContextMenu = useCallback((e: React.MouseEvent, entry: FileEntry, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (!selectedIndices.has(index)) {
      selectIndex(index);
    }
    setContextMenu({ x: e.clientX, y: e.clientY, entry });
  }, [selectedIndices, selectIndex]);

  // Right-click on empty space: show a background menu (Paste / New Folder / Undo).
  const handleBackgroundContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    useFileListStore.getState().clearSelection();
    setContextMenu({ x: e.clientX, y: e.clientY, entry: null });
  }, []);

  const handleDragStart = useCallback((e: React.DragEvent, entry: FileEntry, index: number) => {
    if (!selectedIndices.has(index)) {
      selectIndex(index);
    }
    const store = useFileListStore.getState();
    // If item wasn't selected, getSelectedPaths might not include it yet
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
  }, [selectedIndices, selectIndex]);

  const handleSort = useCallback((field: SortField) => {
    if (sortBy === field) {
      toggleSortDirection();
    } else {
      setSortBy(field);
    }
  }, [sortBy, toggleSortDirection, setSortBy]);

  const handleResizeStart = useCallback((colId: ColumnId, currentWidth: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = currentWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      setColumnWidth(colId, Math.max(40, startWidth + delta));
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
  }, [setColumnWidth]);

  const SortIndicator = ({ field }: { field: SortField }) => {
    if (sortBy !== field) return null;
    return sortDirection === "asc" ? (
      <ArrowUp size={10} className="text-accent shrink-0" />
    ) : (
      <ArrowDown size={10} className="text-accent shrink-0" />
    );
  };

  const tableWidth = 24 + nameWidth + visibleColumns.reduce((s, c) => s + c.width, 0);

  return (
    <div ref={parentRef} className="h-full overflow-auto file-list-font px-2" style={{ minWidth: 0 }} onContextMenu={handleBackgroundContextMenu}>
      {/* Sticky header table */}
      <div className="sticky top-0 z-10 bg-bg">
        <table
          className="border-collapse"
          style={{ tableLayout: "fixed", width: "100%", minWidth: `${tableWidth}px`, fontSize: "var(--font-filelist-item)" }}
          onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setShowVisibilityMenu(!showVisibilityMenu); }}
        >
          <colgroup>
            <col style={{ width: "24px" }} />
            <col style={{ width: `${nameWidth}px` }} />
            {visibleColumns.map((col) => (
              <col key={col.id} style={{ width: `${col.width}px` }} />
            ))}
          </colgroup>
          <thead>
            <tr style={{ fontSize: "var(--font-filelist-header)" }}>
              <th className="border-b border-border py-1.5 px-1" />
              <th
                className="relative border-b border-border py-1.5 px-2 text-left cursor-pointer hover:text-text transition-colors text-text-secondary font-semibold uppercase tracking-wider"
                onClick={() => handleSort("name")}
              >
                <div className="flex items-center gap-1">
                  <span className="truncate">Name</span>
                  <SortIndicator field="name" />
                </div>
                <div
                  className="absolute top-0 -right-[5px] w-[11px] cursor-col-resize z-30 group/handle"
                  style={{ height: "2000px" }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const startX = e.clientX;
                    const startWidth = nameWidth;
                    const onMove = (ev: MouseEvent) => setNameWidth(Math.max(100, startWidth + ev.clientX - startX));
                    const onUp = () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); document.body.style.cursor = ""; document.body.style.userSelect = ""; };
                    document.body.style.cursor = "col-resize";
                    document.body.style.userSelect = "none";
                    document.addEventListener("mousemove", onMove);
                    document.addEventListener("mouseup", onUp);
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="absolute top-0 bottom-0 left-[5px] w-[1px] bg-border group-hover/handle:bg-accent group-hover/handle:w-[3px] group-hover/handle:-ml-[1px] transition-all" />
                </div>
              </th>
              {visibleColumns.map((col) => (
                <th
                  key={col.id}
                  className="relative border-b border-border py-1.5 px-2 text-center cursor-pointer hover:text-text transition-colors text-text-secondary font-semibold uppercase tracking-wider"
                  onClick={() => handleSort(columnSortField[col.id])}
                >
                  <div className="flex items-center justify-center gap-1">
                    <SortIndicator field={columnSortField[col.id]} />
                    <span className="truncate">{col.label}</span>
                  </div>
                  <div
                    className="absolute top-0 -right-[5px] w-[11px] cursor-col-resize z-30 group/handle"
                    style={{ height: "2000px" }}
                    onMouseDown={(e) => handleResizeStart(col.id, col.width, e)}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="absolute top-0 bottom-0 left-[5px] w-[1px] bg-border group-hover/handle:bg-accent group-hover/handle:w-[3px] group-hover/handle:-ml-[1px] transition-all" />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
        </table>
      </div>

      {/* Virtualized rows */}
      <div style={{ height: `${virtualizer.getTotalSize()}px`, position: "relative", width: "100%", minWidth: `${tableWidth}px` }}>
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
                visibleColumns={visibleColumns}
                onRename={async (newName) => {
                  try {
                    await invoke("rename_item", { path: entry.path, newName });
                    useNavigationStore.getState().refreshCurrent();
                  } catch (err) {
                    toast.error(`Rename failed: ${err instanceof Error ? err.message : String(err)}`);
                  } finally {
                    setRenamingIndex(null);
                  }
                }}
                onCancelRename={() => setRenamingIndex(null)}
                onStartRename={() => setRenamingIndex(virtualRow.index)}
                onClick={(e) => handleClick(virtualRow.index, e)}
                onDoubleClick={() => {
                  if (entry.is_dir) navigateTo(entry.path);
                }}
                onContextMenu={(e) => handleContextMenu(e, entry, virtualRow.index)}
                draggable={renamingIndex !== virtualRow.index}
                onDragStart={(e) => handleDragStart(e, entry, virtualRow.index)}
                onFileDrop={entry.is_dir ? async (paths) => {
                  try {
                    await invoke("move_items", { paths, destination: entry.path });
                    useNavigationStore.getState().refreshCurrent();
                  } catch (err) {
                    toast.error(`Move failed: ${err instanceof Error ? err.message : String(err)}`);
                  }
                } : undefined}
              />
            </div>
          );
        })}
      </div>

      {/* Column visibility menu */}
      {showVisibilityMenu && (
        <ColumnVisibilityMenu
          columns={columns}
          onToggle={toggleColumnVisibility}
          onClose={() => setShowVisibilityMenu(false)}
        />
      )}

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          entries={contextMenu.entry ? useFileListStore.getState().getSelectedEntries() : []}
          onClose={() => setContextMenu(null)}
          onOpen={() => {
            if (contextMenu.entry?.is_dir) navigateTo(contextMenu.entry.path);
          }}
          onRename={() => {
            if (!contextMenu.entry) return;
            const idx = entries.findIndex((e) => e.path === contextMenu.entry!.path);
            if (idx >= 0) setRenamingIndex(idx);
          }}
        />
      )}
    </div>
  );
}
