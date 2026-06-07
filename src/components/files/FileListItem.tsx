import { useState } from "react";
import { clsx } from "clsx";
import { format } from "date-fns";
import { FileIcon } from "./FileIcon";
import { useFileListStore } from "../../stores/fileListStore";
import { useTagStore } from "../../stores/tagStore";
import type { FileEntry, FileType } from "../../types";
import type { ColumnConfig } from "../../stores/fileListStore";

interface FileListItemProps {
  entry: FileEntry;
  selected: boolean;
  renaming?: boolean;
  visibleColumns: ColumnConfig[];
  onRename?: (newName: string) => void;
  onCancelRename?: () => void;
  onClick: (e: React.MouseEvent) => void;
  onDoubleClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onFileDrop?: (paths: string[]) => void;
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

function formatDate(isoString: string): string {
  if (!isoString) return "—";
  try {
    return format(new Date(isoString), "MMM d, HH:mm");
  } catch {
    return "—";
  }
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
  renaming,
  visibleColumns,
  onRename,
  onCancelRename,
  onClick,
  onDoubleClick,
  onContextMenu,
  draggable,
  onDragStart,
  onFileDrop,
}: FileListItemProps) {
  const nameWidth = useFileListStore((s) => s.nameWidth);
  const showRowLines = useFileListStore((s) => s.showRowLines);
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
          ? "bg-accent/10 text-text"
          : "hover:bg-bg-hover text-text-secondary",
        isDragTarget && "ring-1 ring-accent/50 bg-accent/8",
        showRowLines && "border-b border-border/30"
      )}
      style={{ tableLayout: "fixed", width: `${tableWidth}px`, fontSize: "var(--font-filelist-item)" }}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={entry.is_dir && onFileDrop ? (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setIsDragTarget(true); } : undefined}
      onDragLeave={entry.is_dir ? () => setIsDragTarget(false) : undefined}
      onDrop={entry.is_dir && onFileDrop ? (e) => { e.preventDefault(); setIsDragTarget(false); const data = e.dataTransfer.getData("application/x-explorer-files"); if (data) onFileDrop(JSON.parse(data)); } : undefined}
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

          {/* Name cell */}
          <td className="py-[3px] px-2 align-middle border-r border-border/40 overflow-hidden">
            <div className="flex items-center gap-2 min-w-0 overflow-hidden">
              {renaming ? (
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && renameValue.trim() && renameValue !== entry.name) {
                      onRename?.(renameValue.trim());
                    }
                    if (e.key === "Escape") onCancelRename?.();
                  }}
                  onBlur={() => onCancelRename?.()}
                  onClick={(e) => e.stopPropagation()}
                  className="flex-1 min-w-0 bg-bg border border-accent rounded px-1.5 py-0 text-text outline-none"
                  style={{ fontSize: "inherit" }}
                />
              ) : (
                <span
                  className={clsx(
                    "truncate",
                    selected ? "text-text font-semibold" : entry.is_dir ? "text-text-secondary font-medium" : "text-text-secondary"
                  )}
                >
                  {entry.name}
                </span>
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
              className="py-[3px] px-2 text-center text-text-secondary tabular-nums truncate border-r border-border/40 align-middle overflow-hidden"
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
