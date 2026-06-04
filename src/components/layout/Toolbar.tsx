import {
  ChevronLeft,
  ChevronRight,
  List,
  LayoutGrid,
  Settings,
} from "lucide-react";
import { clsx } from "clsx";
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

  return (
    <div className="h-[--toolbar-height] bg-bg-secondary border-b border-border flex items-center gap-3 pl-5 pr-14" style={{ fontSize: "var(--font-toolbar-breadcrumb)" }}>
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
      <div className="flex-1 flex items-center gap-0.5 overflow-hidden mx-2">
        <button
          onClick={() => navigateTo("/")}
          className="text-text-muted hover:text-text shrink-0 px-1.5 py-1 rounded-[4px] hover:bg-bg-hover transition-colors"
        >
          /
        </button>
        {pathParts.map((part, i) => {
          const fullPath = "/" + pathParts.slice(0, i + 1).join("/");
          const isLast = i === pathParts.length - 1;
          return (
            <span key={fullPath} className="flex items-center gap-0.5 shrink-0">
              <span className="text-text-muted/40 text-[--font-sm] mx-0.5">/</span>
              <button
                onClick={() => navigateTo(fullPath)}
                className={clsx(
                  "text-[--font-base] px-1.5 py-1 rounded-[4px] hover:bg-bg-hover truncate max-w-[140px] transition-colors",
                  isLast ? "text-text font-medium" : "text-text-secondary"
                )}
              >
                {part}
              </button>
            </span>
          );
        })}
      </div>

      {/* View mode + settings */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => setViewMode("list")}
          className={clsx(
            "p-1.5 rounded-[5px] transition-colors",
            viewMode === "list"
              ? "bg-bg-tertiary text-text"
              : "text-text-muted hover:bg-bg-hover hover:text-text-secondary"
          )}
          title="List view (⌘1)"
        >
          <List size={15} strokeWidth={1.75} />
        </button>
        <button
          onClick={() => setViewMode("grid")}
          className={clsx(
            "p-1.5 rounded-[5px] transition-colors",
            viewMode === "grid"
              ? "bg-bg-tertiary text-text"
              : "text-text-muted hover:bg-bg-hover hover:text-text-secondary"
          )}
          title="Grid view (⌘2)"
        >
          <LayoutGrid size={15} strokeWidth={1.75} />
        </button>

        <button
          onClick={onOpenSettings}
          className="p-1.5 rounded-[5px] text-text-muted hover:bg-bg-hover hover:text-text-secondary transition-colors ml-2"
          title="Settings"
        >
          <Settings size={15} strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}
