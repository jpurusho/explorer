import { useState, useEffect, useRef, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Search, FolderOpen, Settings, Eye, EyeOff, Grid, List,
  RotateCcw, FolderPlus, ArrowUp
} from "lucide-react";
import { clsx } from "clsx";
import { useNavigationStore } from "../stores/navigationStore";
import { useFileListStore } from "../stores/fileListStore";
import { useSettingsStore } from "../stores/settingsStore";

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  action: () => void;
  category: "navigation" | "action" | "settings";
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
}

export function CommandPalette({ open, onClose, onOpenSettings }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const navigateTo = useNavigationStore((s) => s.navigateTo);
  const currentPath = useNavigationStore((s) => s.currentPath);
  const goUp = useNavigationStore((s) => s.goUp);
  const refreshCurrent = useNavigationStore((s) => s.refreshCurrent);
  const setViewMode = useFileListStore((s) => s.setViewMode);
  const showHiddenFiles = useFileListStore((s) => s.showHiddenFiles);
  const toggleHiddenFiles = useFileListStore((s) => s.toggleHiddenFiles);
  const settings = useSettingsStore((s) => s.settings);

  const commands: CommandItem[] = useMemo(() => {
    const home = "/Users/" + (settings.favorites[0]?.split("/")[2] || "");
    return [
      { id: "go-home", label: "Go to Home", description: "~", icon: <FolderOpen size={14} />, action: () => navigateTo(home), category: "navigation" },
      { id: "go-desktop", label: "Go to Desktop", description: "~/Desktop", icon: <FolderOpen size={14} />, action: () => navigateTo(`${home}/Desktop`), category: "navigation" },
      { id: "go-documents", label: "Go to Documents", description: "~/Documents", icon: <FolderOpen size={14} />, action: () => navigateTo(`${home}/Documents`), category: "navigation" },
      { id: "go-downloads", label: "Go to Downloads", description: "~/Downloads", icon: <FolderOpen size={14} />, action: () => navigateTo(`${home}/Downloads`), category: "navigation" },
      { id: "go-dev", label: "Go to Dev", description: "~/dev", icon: <FolderOpen size={14} />, action: () => navigateTo(`${home}/dev`), category: "navigation" },
      { id: "go-up", label: "Go to Parent", description: "Navigate up one level", icon: <ArrowUp size={14} />, action: goUp, category: "navigation" },
      { id: "view-list", label: "Switch to List View", icon: <List size={14} />, action: () => setViewMode("list"), category: "settings" },
      { id: "view-grid", label: "Switch to Grid View", icon: <Grid size={14} />, action: () => setViewMode("grid"), category: "settings" },
      { id: "toggle-hidden", label: showHiddenFiles ? "Hide Hidden Files" : "Show Hidden Files", icon: showHiddenFiles ? <EyeOff size={14} /> : <Eye size={14} />, action: toggleHiddenFiles, category: "settings" },
      { id: "open-settings", label: "Open Settings", icon: <Settings size={14} />, action: onOpenSettings, category: "settings" },
      { id: "refresh", label: "Refresh Directory", description: "Reload current folder", icon: <RotateCcw size={14} />, action: refreshCurrent, category: "action" },
      { id: "new-folder", label: "New Folder", description: "Create folder in current directory", icon: <FolderPlus size={14} />, action: async () => {
        const name = "untitled folder";
        await invoke("create_folder", { parentPath: currentPath, name });
        refreshCurrent();
      }, category: "action" },
      { id: "reindex", label: "Rebuild Search Index", description: "Full reindex of all files", icon: <Search size={14} />, action: () => invoke("reindex"), category: "action" },
    ];
  }, [showHiddenFiles, navigateTo, goUp, setViewMode, toggleHiddenFiles, refreshCurrent, currentPath, onOpenSettings, settings]);

  const filtered = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase();
    return commands.filter((cmd) =>
      cmd.label.toLowerCase().includes(q) ||
      cmd.description?.toLowerCase().includes(q)
    );
  }, [query, commands]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    setSelectedIdx(0);
  }, [query]);

  useEffect(() => {
    const el = listRef.current?.children[selectedIdx] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIdx]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[selectedIdx]) {
        filtered[selectedIdx].action();
        onClose();
      }
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />
      <div className="fixed top-[15%] left-1/2 -translate-x-1/2 w-[520px] max-h-[420px] bg-bg-secondary border border-border rounded-xl shadow-2xl z-50 flex flex-col overflow-hidden">
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border">
          <Search size={15} className="text-text-muted shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command..."
            className="flex-1 bg-transparent text-[var(--font-base)] text-text outline-none placeholder:text-text-muted/50"
          />
          <kbd className="text-[var(--font-xs)] text-text-muted/60 bg-bg-tertiary px-1.5 py-0.5 rounded border border-border/50">esc</kbd>
        </div>

        <div ref={listRef} className="flex-1 overflow-y-auto py-1.5">
          {filtered.length === 0 && (
            <div className="px-4 py-6 text-center text-[var(--font-sm)] text-text-muted">
              No commands match "{query}"
            </div>
          )}
          {filtered.map((cmd, i) => (
            <button
              key={cmd.id}
              className={clsx(
                "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
                i === selectedIdx ? "bg-accent/10 text-text" : "text-text-secondary hover:bg-bg-hover"
              )}
              onClick={() => { cmd.action(); onClose(); }}
              onMouseEnter={() => setSelectedIdx(i)}
            >
              <span className={clsx("shrink-0", i === selectedIdx ? "text-accent" : "text-text-muted")}>{cmd.icon}</span>
              <span className="flex-1 min-w-0">
                <span className="text-[var(--font-sm)] font-medium block truncate">{cmd.label}</span>
                {cmd.description && (
                  <span className="text-[var(--font-xs)] text-text-muted block truncate">{cmd.description}</span>
                )}
              </span>
              <span className="text-[var(--font-xs)] text-text-muted/50 shrink-0 capitalize">{cmd.category}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
