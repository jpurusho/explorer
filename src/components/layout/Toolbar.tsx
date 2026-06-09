import { useState, useRef, useEffect } from "react";
import {
  ChevronLeft,
  ChevronRight,
  List,
  LayoutGrid,
  Settings,
  Search,
  Filter,
  X,
} from "lucide-react";
import { clsx } from "clsx";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useNavigationStore } from "../../stores/navigationStore";
import { useFileListStore } from "../../stores/fileListStore";
import type { FileType } from "../../types";

interface ToolbarProps {
  onOpenSettings: () => void;
  onOpenSearch?: () => void;
}

const TYPE_LABELS: Record<FileType, string> = {
  directory: "Folders",
  image: "Images",
  video: "Videos",
  audio: "Audio",
  document: "Documents",
  code: "Code",
  markdown: "Markdown",
  json: "JSON",
  yaml: "YAML",
  text: "Text",
  archive: "Archives",
  unknown: "Other",
};

export function Toolbar({ onOpenSettings, onOpenSearch }: ToolbarProps) {
  const currentPath = useNavigationStore((s) => s.currentPath);
  const canGoBack = useNavigationStore((s) => s.canGoBack);
  const canGoForward = useNavigationStore((s) => s.canGoForward);
  const goBack = useNavigationStore((s) => s.goBack);
  const goForward = useNavigationStore((s) => s.goForward);
  const navigateTo = useNavigationStore((s) => s.navigateTo);
  const viewMode = useFileListStore((s) => s.viewMode);
  const setViewMode = useFileListStore((s) => s.setViewMode);
  const typeFilter = useFileListStore((s) => s.typeFilter);
  const setTypeFilter = useFileListStore((s) => s.setTypeFilter);
  const availableTypes = useFileListStore((s) => s.availableTypes);
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!filterOpen) return;
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [filterOpen]);

  const pathParts = currentPath.split("/").filter(Boolean);

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    getCurrentWebviewWindow().startDragging().catch(() => {});
  };

  return (
    <div
      data-tauri-drag-region
      onMouseDown={handleMouseDown}
      className="h-[var(--toolbar-height)] bg-bg-secondary/80 backdrop-blur-xl border-b border-border flex items-center gap-2"
      style={{ fontSize: "var(--font-toolbar-breadcrumb)", paddingLeft: "78px", paddingRight: "var(--panel-px)" }}
    >
      {/* Nav buttons */}
      <div className="flex items-center gap-0.5">
        <button
          onClick={goBack}
          disabled={!canGoBack}
          title="Back (⌘[)"
          className={clsx(
            "p-1.5 rounded-[5px] transition-colors",
            canGoBack
              ? "hover:bg-bg-hover text-text-secondary active:bg-bg-tertiary"
              : "text-text-muted/30 cursor-not-allowed"
          )}
        >
          <ChevronLeft size={16} strokeWidth={2} />
        </button>
        <button
          onClick={goForward}
          disabled={!canGoForward}
          title="Forward (⌘])"
          className={clsx(
            "p-1.5 rounded-[5px] transition-colors",
            canGoForward
              ? "hover:bg-bg-hover text-text-secondary active:bg-bg-tertiary"
              : "text-text-muted/30 cursor-not-allowed"
          )}
        >
          <ChevronRight size={16} strokeWidth={2} />
        </button>
      </div>

      {/* Breadcrumb */}
      <div data-tauri-drag-region className="flex-1 flex items-center gap-0 overflow-hidden mx-1">
        <button
          onClick={() => navigateTo("/")}
          className="text-text-muted hover:text-text shrink-0 px-1 py-0.5 rounded-[3px] hover:bg-bg-hover"
        >
          /
        </button>
        {pathParts.map((part, i) => {
          const fullPath = "/" + pathParts.slice(0, i + 1).join("/");
          const isLast = i === pathParts.length - 1;
          return (
            <span key={fullPath} className="flex items-center shrink-0" data-tauri-drag-region>
              <span data-tauri-drag-region className="text-text-muted/30 text-[10px] mx-0.5">/</span>
              <button
                onClick={() => navigateTo(fullPath)}
                className={clsx(
                  "text-[var(--font-base)] px-1 py-0.5 rounded-[3px] hover:bg-bg-hover truncate max-w-[140px]",
                  isLast ? "text-text font-medium" : "text-text-muted"
                )}
              >
                {part}
              </button>
            </span>
          );
        })}
      </div>

      {/* Search trigger */}
      <button
        onClick={onOpenSearch}
        className="flex items-center gap-2 px-3 py-1 rounded-lg bg-bg-tertiary/60 border border-border/40 hover:border-border hover:bg-bg-tertiary transition-colors mr-2"
      >
        <Search size={12} className="text-text-muted" />
        <span className="text-[var(--font-xs)] text-text-muted/60">Search files...</span>
        <kbd className="text-[10px] text-text-muted/40 font-mono ml-2">⌘P</kbd>
      </button>

      {/* Type filter */}
      <div ref={filterRef} className="relative">
        {typeFilter ? (
          <button
            onClick={() => setTypeFilter(null)}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-accent/15 border border-accent/30 text-accent text-[var(--font-xs)] hover:bg-accent/25 transition-colors"
          >
            <Filter size={11} />
            <span>{TYPE_LABELS[typeFilter]}</span>
            <X size={10} className="opacity-60" />
          </button>
        ) : (
          <button
            onClick={() => setFilterOpen(!filterOpen)}
            className={clsx(
              "p-1.5 rounded-[5px] transition-colors",
              filterOpen
                ? "bg-bg-tertiary text-text"
                : "text-text-muted hover:bg-bg-hover hover:text-text-secondary"
            )}
            title="Filter by type"
          >
            <Filter size={14} strokeWidth={1.75} />
          </button>
        )}
        {filterOpen && (
          <div className="absolute top-full right-0 mt-1 py-1 min-w-[140px] bg-bg-secondary/95 backdrop-blur-md border border-border rounded-lg shadow-xl z-50">
            {availableTypes().map((type) => (
              <button
                key={type}
                onClick={() => { setTypeFilter(type); setFilterOpen(false); }}
                className="w-full text-left px-3 py-1.5 text-[var(--font-xs)] text-text-secondary hover:bg-bg-hover hover:text-text transition-colors"
              >
                {TYPE_LABELS[type]}
              </button>
            ))}
            {availableTypes().length === 0 && (
              <span className="px-3 py-1.5 text-[var(--font-xs)] text-text-muted">No files</span>
            )}
          </div>
        )}
      </div>

      {/* View mode + settings */}
      <div className="flex items-center gap-0.5">
        <button
          onClick={() => setViewMode("list")}
          className={clsx(
            "p-1 rounded-[3px]",
            viewMode === "list"
              ? "bg-bg-tertiary text-text"
              : "text-text-muted hover:bg-bg-hover hover:text-text-secondary"
          )}
          title="List view (⌘1)"
        >
          <List size={14} strokeWidth={1.75} />
        </button>
        <button
          onClick={() => setViewMode("grid")}
          className={clsx(
            "p-1 rounded-[3px]",
            viewMode === "grid"
              ? "bg-bg-tertiary text-text"
              : "text-text-muted hover:bg-bg-hover hover:text-text-secondary"
          )}
          title="Grid view (⌘2)"
        >
          <LayoutGrid size={14} strokeWidth={1.75} />
        </button>
        <div className="w-px h-3.5 bg-border/50 mx-1.5" />

        <button
          onClick={onOpenSettings}
          className="p-1 rounded-[3px] text-text-muted hover:bg-bg-hover hover:text-text-secondary"
          title="Settings (⌘,)"
        >
          <Settings size={14} strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}
