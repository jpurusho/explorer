import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { clsx } from "clsx";
import { ChevronRight } from "lucide-react";
import { useNavigationStore } from "../../stores/navigationStore";
import { useFileListStore } from "../../stores/fileListStore";
import { FileIcon } from "./FileIcon";
import type { FileEntry, FileType } from "../../types";

interface Column {
  path: string;
  entries: FileEntry[];
  selectedIndex: number | null;
}

export function ColumnView() {
  const currentPath = useNavigationStore((s) => s.currentPath);
  const navigateTo = useNavigationStore((s) => s.navigateTo);
  const showHiddenFiles = useFileListStore((s) => s.showHiddenFiles);
  const setSelectedPath = useFileListStore((s) => s.setSelectedPath);

  const [columns, setColumns] = useState<Column[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadColumn(currentPath, 0);
  }, [currentPath, showHiddenFiles]);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollLeft = containerRef.current.scrollWidth;
    }
  }, [columns.length]);

  const loadColumn = async (path: string, columnIndex: number) => {
    try {
      const entries = await invoke<FileEntry[]>("list_directory", { path });
      const filtered = showHiddenFiles ? entries : entries.filter((e) => !e.is_hidden);
      const sorted = filtered.sort((a, b) => {
        if (a.is_dir && !b.is_dir) return -1;
        if (!a.is_dir && b.is_dir) return 1;
        return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      });

      setColumns((prev) => {
        const newCols = prev.slice(0, columnIndex);
        newCols.push({ path, entries: sorted, selectedIndex: null });
        return newCols;
      });
    } catch {
      setColumns((prev) => prev.slice(0, columnIndex));
    }
  };

  const handleSelect = (columnIndex: number, entryIndex: number, entry: FileEntry) => {
    setColumns((prev) => {
      const updated = prev.slice(0, columnIndex + 1);
      updated[columnIndex] = { ...updated[columnIndex], selectedIndex: entryIndex };
      return updated;
    });

    if (entry.is_dir) {
      loadColumn(entry.path, columnIndex + 1);
    } else {
      setSelectedPath(entry.path);
    }
  };

  const handleDoubleClick = (entry: FileEntry) => {
    if (entry.is_dir) {
      navigateTo(entry.path);
    }
  };

  return (
    <div ref={containerRef} className="h-full flex overflow-x-auto overflow-y-hidden file-list-font" style={{ minHeight: 0 }}>
      {columns.map((col, colIdx) => (
        <div
          key={col.path}
          className="shrink-0 border-r border-border overflow-y-auto self-stretch"
          style={{ width: "220px" }}
        >
          {col.entries.map((entry, entryIdx) => (
            <div
              key={entry.path}
              className={clsx(
                "flex items-center gap-1.5 px-2.5 py-[3px] cursor-default",
                col.selectedIndex === entryIdx
                  ? "bg-accent/12 text-text"
                  : "text-text-secondary hover:bg-bg-hover"
              )}
              onClick={() => handleSelect(colIdx, entryIdx, entry)}
              onDoubleClick={() => handleDoubleClick(entry)}
            >
              <FileIcon fileType={entry.file_type as FileType} size={13} />
              <span className="flex-1 truncate" style={{ fontSize: "var(--font-sidebar-item)" }}>{entry.name}</span>
              {entry.is_dir && (
                <ChevronRight size={10} className="text-text-muted/60 shrink-0" />
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
