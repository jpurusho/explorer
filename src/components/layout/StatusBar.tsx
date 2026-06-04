import { useMemo } from "react";
import { useFileListStore } from "../../stores/fileListStore";
import { useNavigationStore } from "../../stores/navigationStore";
import { Folder, File, Eye } from "lucide-react";

function formatTotalSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

export function StatusBar() {
  const visibleEntries = useFileListStore((s) => s.visibleEntries);
  const selectedIndex = useFileListStore((s) => s.selectedIndex);
  const currentPath = useNavigationStore((s) => s.currentPath);
  const showHiddenFiles = useFileListStore((s) => s.showHiddenFiles);

  const stats = useMemo(() => {
    const folders = visibleEntries.filter((e) => e.is_dir).length;
    const files = visibleEntries.filter((e) => !e.is_dir).length;
    const totalSize = visibleEntries.reduce((sum, e) => sum + (e.is_dir ? 0 : e.size), 0);
    return { folders, files, totalSize };
  }, [visibleEntries]);

  const selectedEntry = visibleEntries[selectedIndex];
  const currentFolder = currentPath.split("/").pop() || "/";

  return (
    <div className="h-[--statusbar-height] bg-bg-secondary border-t border-border flex items-center pl-5 pr-14 gap-4" style={{ fontSize: "var(--font-statusbar-text)" }}>
      {/* Current location */}
      <div className="flex items-center gap-1.5 text-text-secondary min-w-0 shrink">
        <Folder size={12} className="text-folder shrink-0" />
        <span className="truncate font-medium">{currentFolder}</span>
      </div>

      {/* Separator */}
      <div className="w-[1px] h-3.5 bg-border shrink-0" />

      {/* File stats */}
      <div className="flex items-center gap-3 text-text-muted">
        <span className="flex items-center gap-1">
          <Folder size={11} className="text-folder" />
          <span className="tabular-nums">{stats.folders}</span>
        </span>
        <span className="flex items-center gap-1">
          <File size={11} />
          <span className="tabular-nums">{stats.files}</span>
        </span>
        <span className="tabular-nums">{formatTotalSize(stats.totalSize)}</span>
      </div>

      {/* Hidden files indicator */}
      {showHiddenFiles && (
        <>
          <div className="w-[1px] h-3.5 bg-border shrink-0" />
          <span className="flex items-center gap-1 text-accent">
            <Eye size={11} />
            <span>Hidden</span>
          </span>
        </>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Selected file info */}
      {selectedEntry && (
        <div className="flex items-center gap-2 text-text-muted shrink min-w-0">
          <span className="truncate">{selectedEntry.name}</span>
          {!selectedEntry.is_dir && (
            <span className="text-text-muted/60 shrink-0 tabular-nums">
              {formatTotalSize(selectedEntry.size)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
