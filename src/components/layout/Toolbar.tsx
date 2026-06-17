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
  NotepadText,
} from "lucide-react";
import { clsx } from "clsx";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useNavigationStore } from "../../stores/navigationStore";
import { useFileListStore } from "../../stores/fileListStore";

interface ToolbarProps {
  onOpenSettings: () => void;
  onOpenSearch?: () => void;
  onOpenScratch?: () => void;
}

export function Toolbar({ onOpenSettings, onOpenSearch, onOpenScratch }: ToolbarProps) {
  const currentPath = useNavigationStore((s) => s.currentPath);
  const canGoBack = useNavigationStore((s) => s.canGoBack);
  const canGoForward = useNavigationStore((s) => s.canGoForward);
  const goBack = useNavigationStore((s) => s.goBack);
  const goForward = useNavigationStore((s) => s.goForward);
  const navigateTo = useNavigationStore((s) => s.navigateTo);
  const viewMode = useFileListStore((s) => s.viewMode);
  const setViewMode = useFileListStore((s) => s.setViewMode);
  const filterPattern = useFileListStore((s) => s.filterPattern);
  const setFilterPattern = useFileListStore((s) => s.setFilterPattern);
  const [filterInput, setFilterInput] = useState("");
  const filterInputRef = useRef<HTMLInputElement>(null);
  const [isEditingPath, setIsEditingPath] = useState(false);
  const [pathInput, setPathInput] = useState("");
  const pathInputRef = useRef<HTMLInputElement>(null);

  const pathParts = currentPath.split("/").filter(Boolean);

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button, input")) return;
    e.preventDefault();
    getCurrentWebviewWindow().startDragging().catch(() => {});
  };

  const startEditingPath = () => {
    setPathInput(currentPath);
    setIsEditingPath(true);
    setTimeout(() => pathInputRef.current?.select(), 0);
  };

  const commitPathEdit = async () => {
    const trimmed = pathInput.trim();
    if (!trimmed || trimmed === currentPath) {
      setIsEditingPath(false);
      return;
    }

    // Expand ~ to home directory
    const { invoke } = await import("@tauri-apps/api/core");
    let expandedPath = trimmed;
    if (trimmed.startsWith("~")) {
      const home = await invoke<string>("get_home_directory");
      expandedPath = trimmed.replace(/^~/, home);
    }

    try {
      // Check if it's a file or directory
      const metadata = await invoke<{ is_dir: boolean }>("get_file_metadata", { path: expandedPath });

      if (metadata.is_dir) {
        navigateTo(expandedPath);
      } else {
        // It's a file - navigate to parent and select the file
        const parentPath = expandedPath.split("/").slice(0, -1).join("/") || "/";
        navigateTo(parentPath);
        // Let the file list load, then select the file
        setTimeout(() => {
          const { setSelectedPath } = useFileListStore.getState();
          setSelectedPath(expandedPath);
        }, 100);
      }
    } catch {
      // Path doesn't exist or error - try navigating anyway
      navigateTo(expandedPath);
    }
    setIsEditingPath(false);
  };

  const cancelPathEdit = () => {
    setIsEditingPath(false);
    setPathInput("");
  };

  // Cmd+L to edit path
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "l") {
        e.preventDefault();
        startEditingPath();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [currentPath]);

  return (
    <div className="border-b border-border/60 bg-bg-secondary/70 backdrop-blur-xl">
      <div
        data-tauri-drag-region
        onMouseDown={handleMouseDown}
        className="h-[var(--toolbar-height)] flex items-center gap-2"
        style={{ fontSize: "var(--font-toolbar-breadcrumb)", paddingLeft: "78px", paddingRight: "var(--panel-px)" }}
      >
        {/* Nav buttons */}
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={goBack}
            disabled={!canGoBack}
            title="Back (⌘[)"
            className={clsx(
              "p-1.5 rounded-[var(--radius-md)] transition-colors",
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
              "p-1.5 rounded-[var(--radius-md)] transition-colors",
              canGoForward
                ? "hover:bg-bg-hover text-text-secondary active:bg-bg-tertiary"
                : "text-text-muted/30 cursor-not-allowed"
            )}
          >
            <ChevronRight size={16} strokeWidth={2} />
          </button>
        </div>

        {/* Breadcrumb or Path Input */}
        {isEditingPath ? (
          <input
            ref={pathInputRef}
            type="text"
            value={pathInput}
            onChange={(e) => setPathInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitPathEdit();
              if (e.key === "Escape") cancelPathEdit();
            }}
            onBlur={cancelPathEdit}
            className="flex-1 min-w-0 max-w-[500px] px-2 h-7 mx-1 rounded-md bg-bg-tertiary border border-accent/50 text-[var(--font-base)] text-text focus:outline-none focus:ring-1 focus:ring-accent/50"
            placeholder="Enter path (e.g., /tmp)"
          />
        ) : (
          <div
            data-tauri-drag-region
            onClick={startEditingPath}
            className="flex items-center gap-0 overflow-hidden shrink min-w-0 mx-1 cursor-text hover:bg-bg-hover/50 rounded-md px-1"
            title="Click to edit path (⌘L)"
          >
            <button
              onClick={(e) => { e.stopPropagation(); navigateTo("/"); }}
              className="text-text-muted hover:text-text shrink-0 px-1 py-0.5 rounded-[var(--radius-md)] hover:bg-bg-hover"
            >
              /
            </button>
            {pathParts.map((part, i) => {
              const fullPath = "/" + pathParts.slice(0, i + 1).join("/");
              const isLast = i === pathParts.length - 1;
              return (
                <span key={fullPath} className="flex items-center shrink-0" data-tauri-drag-region>
                  <span data-tauri-drag-region className="text-text-muted/50 text-[var(--font-xs)] mx-0.5">/</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); navigateTo(fullPath); }}
                    className={clsx(
                      "text-[var(--font-base)] px-1 py-0.5 rounded-[var(--radius-md)] hover:bg-bg-hover truncate max-w-[140px]",
                      isLast ? "text-text font-medium" : "text-text-muted"
                    )}
                  >
                    {part}
                  </button>
                </span>
              );
            })}
          </div>
        )}

        {/* Search trigger — flexible filler */}
        <button
          onClick={onOpenSearch}
          className="flex-1 min-w-0 max-w-[420px] flex items-center gap-2 px-2.5 h-7 rounded-md bg-bg-tertiary/40 border border-border/30 hover:border-border/60 hover:bg-bg-tertiary/70 transition-colors text-left"
        >
          <Search size={12} className="text-text-muted/80 shrink-0" />
          <span className="text-[var(--font-xs)] text-text-muted/70 flex-1 min-w-0 truncate">Search…</span>
          <kbd className="text-[var(--font-xs)] text-text-muted/40 font-mono shrink-0">⌘P</kbd>
        </button>

        {/* Filter pill / input */}
        <div className="shrink-0">
          {filterPattern ? (
            <button
              onClick={() => { setFilterPattern(null); setFilterInput(""); }}
              className="flex items-center gap-1.5 px-2 h-7 rounded-md bg-accent/12 border border-accent/25 text-accent text-[var(--font-xs)] hover:bg-accent/20 transition-colors"
              title="Clear filter"
            >
              <Filter size={11} />
              <span className="font-medium">{filterPattern}</span>
              <X size={10} className="opacity-60" />
            </button>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const val = filterInput.trim();
                if (val) setFilterPattern(val);
                setFilterInput("");
              }}
            >
              <div className="flex items-center gap-1.5 px-2 h-7 rounded-md bg-bg-tertiary/40 border border-border/30 focus-within:border-accent/50 transition-colors">
                <Filter size={11} className="text-text-muted/80 shrink-0" />
                <input
                  ref={filterInputRef}
                  type="text"
                  value={filterInput}
                  onChange={(e) => setFilterInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Escape") { setFilterInput(""); filterInputRef.current?.blur(); } }}
                  placeholder="Filter"
                  className="w-16 bg-transparent text-[var(--font-xs)] text-text outline-none placeholder:text-text-muted/50"
                />
              </div>
            </form>
          )}
        </div>

        {/* View + tools */}
        <div className="flex items-center gap-0.5 shrink-0 pl-1">
          <button
            onClick={() => setViewMode("list")}
            className={clsx(
              "p-1 rounded-[var(--radius-md)]",
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
              "p-1 rounded-[var(--radius-md)]",
              viewMode === "grid"
                ? "bg-bg-tertiary text-text"
                : "text-text-muted hover:bg-bg-hover hover:text-text-secondary"
            )}
            title="Grid view (⌘2)"
          >
            <LayoutGrid size={14} strokeWidth={1.75} />
          </button>
          <div className="w-px h-3.5 bg-border/40 mx-1" />
          <button
            onClick={onOpenScratch}
            className="p-1 rounded-[var(--radius-md)] text-text-muted hover:bg-bg-hover hover:text-text-secondary"
            title="Scratch Pad (⌘E)"
          >
            <NotepadText size={14} strokeWidth={1.75} />
          </button>
          <button
            onClick={onOpenSettings}
            className="p-1 rounded-[var(--radius-md)] text-text-muted hover:bg-bg-hover hover:text-text-secondary"
            title="Settings (⌘,)"
          >
            <Settings size={14} strokeWidth={1.75} />
          </button>
        </div>
      </div>
    </div>
  );
}
