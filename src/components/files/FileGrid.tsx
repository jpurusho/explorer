import { useState, useEffect, useRef, useMemo, useLayoutEffect } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { invoke } from "@tauri-apps/api/core";
import { useFileListStore } from "../../stores/fileListStore";
import { useNavigationStore } from "../../stores/navigationStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { toast } from "../../stores/toastStore";
import { useLongPressDragOut } from "../../hooks/useLongPressDragOut";
import { FileCard } from "./FileCard";
import { ContextMenu } from "./ContextMenu";
import { handleFileDoubleClick } from "../../lib/fileActions";
import type { FileEntry } from "../../types";

const GRID_GAP = 16; // matches gap-4

export function FileGrid() {
  const entries = useFileListStore((s) => s.visibleEntries);
  const selectedIndices = useFileListStore((s) => s.selectedIndices);
  const selectIndex = useFileListStore((s) => s.selectIndex);
  const toggleIndex = useFileListStore((s) => s.toggleIndex);
  const selectRange = useFileListStore((s) => s.selectRange);
  const navigateTo = useNavigationStore((s) => s.navigateTo);
  const renameRequestPath = useFileListStore((s) => s.renameRequestPath);
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; entry: FileEntry | null } | null>(null);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);

  const [cardSize, setCardSize] = useState(settings.grid_card_size || 175);
  useEffect(() => {
    if (settings.grid_card_size && settings.grid_card_size !== cardSize) {
      setCardSize(settings.grid_card_size);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.grid_card_size]);

  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSizeChange = (n: number) => {
    setCardSize(n);
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => updateSettings({ grid_card_size: n }), 300);
  };

  const scrollRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  // Track inner-grid width so we can compute the column count for virtualization.
  useLayoutEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    const update = () => setContainerWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Cards have a fixed-height thumbnail (h-32 = 128px) plus name + meta line.
  // Total row height ≈ thumbnail + ~52px text block. Width is the slider value
  // (per the auto-fill grid we used to use, columns auto-flow at >= cardSize).
  const cardHeight = 128 + 52;
  const cols = Math.max(1, Math.floor((containerWidth + GRID_GAP) / (cardSize + GRID_GAP)));
  const rowCount = Math.ceil(entries.length / cols);
  const rowHeight = cardHeight + GRID_GAP;

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 4,
  });

  // Re-measure rows when card size or column count changes.
  useEffect(() => {
    virtualizer.measure();
  }, [cardSize, cols, virtualizer]);

  // Consume a pending rename request once the target entry appears.
  useEffect(() => {
    if (!renameRequestPath) return;
    const idx = entries.findIndex((e) => e.path === renameRequestPath);
    if (idx >= 0) {
      setRenamingPath(renameRequestPath);
      useFileListStore.getState().requestRename(null);
      virtualizer.scrollToIndex(Math.floor(idx / cols), { align: "center" });
    }
  }, [renameRequestPath, entries, cols, virtualizer]);

  const longPress = useLongPressDragOut();

  const handleClick = (index: number, e: React.MouseEvent) => {
    // A long-press just fired — the mouseup that triggered this click is the
    // release of the press, not a real click. Eat it so we don't open the file.
    if (longPress.shouldSuppressClick()) {
      e.preventDefault();
      e.stopPropagation();
      return;
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
    e.stopPropagation();
    if (!selectedIndices.has(index)) selectIndex(index);
    setContextMenu({ x: e.clientX, y: e.clientY, entry });
  };

  const handleBackgroundContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    useFileListStore.getState().clearSelection();
    setContextMenu({ x: e.clientX, y: e.clientY, entry: null });
  };

  const resolvePaths = (entry: FileEntry, index: number): string[] => {
    if (!selectedIndices.has(index)) selectIndex(index);
    const store = useFileListStore.getState();
    let paths = store.getSelectedPaths();
    if (paths.length === 0 || !paths.includes(entry.path)) paths = [entry.path];
    return paths;
  };

  const handleDragStart = (e: React.DragEvent, entry: FileEntry, index: number) => {
    // Long-press already escalated to a native drag — suppress the HTML5 one.
    if (longPress.handleDragStart(e)) return;
    const paths = resolvePaths(entry, index);

    e.dataTransfer.setData("application/x-explorer-files", JSON.stringify(paths));
    e.dataTransfer.effectAllowed = "copyMove";

    const ghost = document.createElement("div");
    ghost.className = "fixed -top-[100px] left-0 px-3 py-1.5 bg-accent/90 text-white text-[var(--font-sm)] rounded-md font-medium shadow-lg";
    ghost.textContent = paths.length > 1 ? `${paths.length} items` : entry.name;
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 0, 0);
    requestAnimationFrame(() => document.body.removeChild(ghost));
  };

  const gridTemplate = useMemo(
    () => `repeat(${cols}, minmax(0, 1fr))`,
    [cols]
  );

  return (
    <div ref={scrollRef} className="h-full overflow-auto file-list-font" onContextMenu={handleBackgroundContextMenu}>
      <div className="px-6 pt-4 pb-2 flex items-center justify-end gap-2 sticky top-0 z-10 bg-bg/95 backdrop-blur-sm">
        <span className="text-[var(--font-xs)] text-text-muted/80">Size</span>
        <input
          type="range"
          min="120"
          max="300"
          step="10"
          value={cardSize}
          onChange={(e) => handleSizeChange(parseInt(e.target.value))}
          className="w-20 h-1 bg-bg-tertiary rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent"
        />
      </div>
      <div ref={innerRef} className="px-6 pb-6">
        <div style={{ height: `${virtualizer.getTotalSize()}px`, position: "relative", width: "100%" }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const rowStart = virtualRow.index * cols;
            const rowEntries = entries.slice(rowStart, rowStart + cols);
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
                  display: "grid",
                  gridTemplateColumns: gridTemplate,
                  gap: `${GRID_GAP}px`,
                }}
              >
                {rowEntries.map((entry, colIdx) => {
                  const index = rowStart + colIdx;
                  return (
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
                        if (!longPress.shouldSuppressClick()) {
                          handleFileDoubleClick(entry).catch((err) => {
                            toast.error(`Failed to open: ${err instanceof Error ? err.message : String(err)}`);
                          });
                        }
                      }}
                      onContextMenu={(e) => handleContextMenu(e, entry, index)}
                      onMouseDown={(e) => longPress.onMouseDown(e, () => resolvePaths(entry, index))}
                      draggable
                      onDragStart={(e) => handleDragStart(e, entry, index)}
                      onFileDrop={(paths) => {
                        if (paths.includes(entry.path)) return;
                        invoke("move_items", { paths, destination: entry.path })
                          .then(() => useNavigationStore.getState().refreshCurrent())
                          .catch((err) => toast.error(`Move failed: ${err instanceof Error ? err.message : String(err)}`));
                      }}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
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
