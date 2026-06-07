import {
  ChevronLeft,
  ChevronRight,
  List,
  LayoutGrid,
  Columns,
  Settings,
} from "lucide-react";
import { clsx } from "clsx";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useNavigationStore } from "../../stores/navigationStore";
import { useFileListStore } from "../../stores/fileListStore";

interface ToolbarProps {
  onOpenSettings: () => void;
}

export function Toolbar({ onOpenSettings }: ToolbarProps) {
  const currentPath = useNavigationStore((s) => s.currentPath);
  const canGoBack = useNavigationStore((s) => s.canGoBack);
  const canGoForward = useNavigationStore((s) => s.canGoForward);
  const goBack = useNavigationStore((s) => s.goBack);
  const goForward = useNavigationStore((s) => s.goForward);
  const navigateTo = useNavigationStore((s) => s.navigateTo);
  const viewMode = useFileListStore((s) => s.viewMode);
  const setViewMode = useFileListStore((s) => s.setViewMode);

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
        <button
          onClick={() => setViewMode("columns")}
          className={clsx(
            "p-1 rounded-[3px]",
            viewMode === "columns"
              ? "bg-bg-tertiary text-text"
              : "text-text-muted hover:bg-bg-hover hover:text-text-secondary"
          )}
          title="Column view (⌘3)"
        >
          <Columns size={14} strokeWidth={1.75} />
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
