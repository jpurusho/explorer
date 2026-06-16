import { useState } from "react";
import { clsx } from "clsx";
import { FileIcon } from "./FileIcon";
import { useFileListStore } from "../../stores/fileListStore";
import { useTagStore } from "../../stores/tagStore";
import { formatSize, formatDate } from "../../lib/formatters";
import type { FileEntry, FileType } from "../../types";
import type { ColumnConfig } from "../../stores/fileListStore";

interface FileListItemProps {
  entry: FileEntry;
  selected: boolean;
  zebra?: boolean;
  renaming?: boolean;
  visibleColumns: ColumnConfig[];
  onRename?: (newName: string) => void;
  onCancelRename?: () => void;
  onStartRename?: () => void;
  onClick: (e: React.MouseEvent) => void;
  onDoubleClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onMouseDown?: (e: React.MouseEvent) => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onFileDrop?: (paths: string[]) => void;
}

function getTypeLabel(entry: FileEntry): string {
  if (entry.is_dir) return "Folder";
  const ext = entry.name.split(".").pop()?.toUpperCase();
  return ext || "File";
}

function getCellValue(colId: string, entry: FileEntry): string {
  switch (colId) {
    case "type":
      return getTypeLabel(entry);
    case "size":
      return entry.is_dir ? "—" : formatSize(entry.size);
    case "modified":
      return formatDate(entry.modified);
    default:
      return "";
  }
}

export function FileListItem({
  entry,
  selected,
  zebra,
  renaming,
  visibleColumns,
  onRename,
  onCancelRename,
  onStartRename,
  onClick,
  onDoubleClick,
  onContextMenu,
  onMouseDown,
  draggable,
  onDragStart,
  onFileDrop,
}: FileListItemProps) {
  const nameWidth = useFileListStore((s) => s.nameWidth);
  const showRowLines = useFileListStore((s) => s.showRowLines);
  const syncStatus = useFileListStore((s) => s.syncStatusMap.get(entry.path));
  const fileTagMap = useTagStore((s) => s.fileTagMap);
  const tags = fileTagMap.get(entry.path) || [];
  const [isDragTarget, setIsDragTarget] = useState(false);
  const [renameValue, setRenameValue] = useState(entry.name);

  const tableWidth = 24 + nameWidth + visibleColumns.reduce((s, c) => s + c.width, 0);

  return (
    <table
      className={clsx(
        "border-collapse cursor-default",
        "transition-colors duration-75",
        selected
          ? "bg-accent/15 text-text ring-1 ring-inset ring-accent/30"
          : clsx(
              "hover:bg-bg-hover text-text-secondary",
              zebra && "bg-bg-secondary/40"
            ),
        isDragTarget && "ring-2 ring-accent bg-accent/15",
        showRowLines && "border-b border-border/30"
      )}
      style={{ tableLayout: "fixed", width: "100%", minWidth: `${tableWidth}px`, fontSize: "var(--font-filelist-item)" }}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      onMouseDown={onMouseDown}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={entry.is_dir && onFileDrop ? (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setIsDragTarget(true); } : undefined}
      onDragLeave={entry.is_dir ? () => setIsDragTarget(false) : undefined}
      onDrop={entry.is_dir && onFileDrop ? (e) => {
        e.preventDefault();
        setIsDragTarget(false);
        // HTML5 in-app drag: custom mime type with JSON array of paths
        const htmlData = e.dataTransfer.getData("application/x-explorer-files");
        if (htmlData) {
          onFileDrop(JSON.parse(htmlData));
          return;
        }
        // Native macOS drag (long-press): Try text/uri-list (standard file URL format)
        const uriList = e.dataTransfer.getData("text/uri-list");
        if (uriList) {
          const paths = uriList.split("\n").filter(line => line && !line.startsWith("#")).map(uri => {
            // file:///path/to/file → /path/to/file
            return decodeURIComponent(uri.replace(/^file:\/\//, ""));
          });
          if (paths.length > 0) {
            onFileDrop(paths);
          }
        }
      } : undefined}
    >
      <colgroup>
        <col style={{ width: "24px" }} />
        <col style={{ width: `${nameWidth}px` }} />
        {visibleColumns.map((col) => (
          <col key={col.id} style={{ width: `${col.width}px` }} />
        ))}
      </colgroup>
      <tbody>
        <tr>
          {/* Icon cell */}
          <td className="py-[3px] px-1 text-center align-middle">
            <FileIcon fileType={entry.file_type as FileType} size={16} />
          </td>

          {/* Name cell — double-click anywhere here starts a rename */}
          <td
            className="py-[3px] px-2 align-middle overflow-hidden"
            onDoubleClick={!renaming && onStartRename ? (e) => { e.stopPropagation(); onStartRename(); } : undefined}
          >
            <div className="flex items-center gap-2 min-w-0 overflow-hidden">
              {renaming ? (
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === "Enter" && renameValue.trim() && renameValue !== entry.name) {
                      onRename?.(renameValue.trim());
                    } else if (e.key === "Enter" || e.key === "Escape") {
                      onCancelRename?.();
                    }
                  }}
                  onBlur={() => onCancelRename?.()}
                  onClick={(e) => e.stopPropagation()}
                  className="flex-1 min-w-0 bg-bg border border-accent rounded px-1.5 py-0 text-text outline-none"
                  style={{ fontSize: "inherit" }}
                />
              ) : (
                <>
                  {syncStatus && (
                    <div className={clsx(
                      "w-1.5 h-1.5 rounded-full shrink-0",
                      syncStatus === "pushed" ? "bg-emerald-500" : "bg-blue-500"
                    )} />
                  )}
                  <span
                    className={clsx(
                      "truncate",
                      selected ? "text-text font-semibold" : entry.is_dir ? "text-text-secondary font-medium" : "text-text-secondary"
                    )}
                  >
                    {entry.name}
                  </span>
                </>
              )}
              {tags.length > 0 && (
                <div className="flex items-center gap-1 shrink-0">
                  {tags.slice(0, 3).map((tag) => (
                    <div
                      key={tag.id}
                      className="h-[6px] w-[6px] rounded-full shrink-0"
                      style={{ backgroundColor: tag.color }}
                      title={tag.name}
                    />
                  ))}
                </div>
              )}
            </div>
          </td>

          {/* Data columns */}
          {visibleColumns.map((col) => (
            <td
              key={col.id}
              className="py-[3px] px-2 text-center text-text-muted tabular-nums truncate align-middle overflow-hidden"
              style={{ fontSize: "var(--font-filelist-meta)" }}
            >
              {getCellValue(col.id, entry)}
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  );
}
