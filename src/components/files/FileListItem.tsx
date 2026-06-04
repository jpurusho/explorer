import { clsx } from "clsx";
import { format } from "date-fns";
import { FileIcon } from "./FileIcon";
import { useFileListStore } from "../../stores/fileListStore";
import { useTagStore } from "../../stores/tagStore";
import type { FileEntry, FileType } from "../../types";

interface FileListItemProps {
  entry: FileEntry;
  selected: boolean;
  onClick: (e: React.MouseEvent) => void;
  onDoubleClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
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

export function FileListItem({
  entry,
  selected,
  onClick,
  onDoubleClick,
  onContextMenu,
  draggable,
  onDragStart,
}: FileListItemProps) {
  const columns = useFileListStore((s) => s.columns);
  const fileTagMap = useTagStore((s) => s.fileTagMap);
  const tags = fileTagMap.get(entry.path) || [];

  const typeCol = columns.find((c) => c.id === "type");
  const sizeCol = columns.find((c) => c.id === "size");
  const modifiedCol = columns.find((c) => c.id === "modified");

  return (
    <div
      className={clsx(
        "flex items-center gap-3 py-[5px] cursor-default rounded-[5px] ml-3 mr-3 px-3 overflow-hidden",
        "transition-colors duration-75",
        selected
          ? "bg-accent/10 text-text"
          : "hover:bg-bg-hover text-text-secondary"
      )}
      style={{ fontSize: "var(--font-filelist-item)" }}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      draggable={draggable}
      onDragStart={onDragStart}
    >
      <FileIcon fileType={entry.file_type as FileType} size={16} />

      {/* Name - flexible */}
      <span
        className={clsx(
          "flex-1 truncate min-w-0",
          selected ? "text-text font-semibold" : entry.is_dir ? "text-text font-medium" : "text-text"
        )}
      >
        {entry.name}
      </span>

      {/* Tag pills */}
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
          {tags.length > 3 && (
            <span className="text-[--font-xs] text-text-muted">+{tags.length - 3}</span>
          )}
        </div>
      )}

      {/* Type */}
      {typeCol?.visible && (
        <span
          className="text-right text-text-secondary shrink-0 truncate"
          style={{ width: `${typeCol.width}px`, fontSize: "var(--font-filelist-meta)" }}
        >
          {getTypeLabel(entry)}
        </span>
      )}

      {/* Size */}
      {sizeCol?.visible && (
        <span
          className="text-right text-text-secondary tabular-nums shrink-0"
          style={{ width: `${sizeCol.width}px`, fontSize: "var(--font-filelist-meta)" }}
        >
          {entry.is_dir ? "—" : formatSize(entry.size)}
        </span>
      )}

      {/* Date */}
      {modifiedCol?.visible && (
        <span
          className="text-right text-text-secondary tabular-nums shrink-0 truncate"
          style={{ width: `${modifiedCol.width}px`, fontSize: "var(--font-filelist-meta)" }}
        >
          {formatDate(entry.modified)}
        </span>
      )}

      {/* Spacer to match the visibility toggle button in the header */}
      <div className="w-[18px] shrink-0" />
    </div>
  );
}
