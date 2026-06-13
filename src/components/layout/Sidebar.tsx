import { useState, useEffect, useRef } from "react";
import { Home, Download, FileText, Monitor, Folder, Plus, Pencil, Trash2, Clipboard } from "lucide-react";
import { clsx } from "clsx";
import { invoke } from "@tauri-apps/api/core";
import { useNavigationStore } from "../../stores/navigationStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { useTagStore } from "../../stores/tagStore";
import { SnippetsSection } from "../snippets/SnippetsSection";
import type { FileEntry } from "../../types";

/** List a directory's visible subdirectories, sorted by name. Shared by the
 *  tree's load/refresh/expand paths so the filter+sort logic lives in one place. */
async function loadChildDirs(path: string): Promise<FileEntry[]> {
  const entries = await invoke<FileEntry[]>("list_directory", { path });
  return entries
    .filter((e) => e.is_dir && !e.is_hidden)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

function FoldIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      className={clsx(
        "transition-transform duration-150 ease-out shrink-0 opacity-50",
        expanded ? "rotate-90" : "rotate-0"
      )}
    >
      <path
        d="M3 1.5L7 5L3 8.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TreeItem({
  entry,
  depth,
  isLast,
  parentLines,
  currentPath,
  onNavigate,
}: {
  entry: FileEntry;
  depth: number;
  isLast: boolean;
  parentLines: boolean[];
  currentPath: string;
  onNavigate: (path: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<FileEntry[] | null>(null);
  const refreshTrigger = useNavigationStore((s) => s.refreshTrigger);
  const isActive = currentPath === entry.path;
  const isParentOfCurrent = currentPath.startsWith(entry.path + "/");

  useEffect(() => {
    if (isParentOfCurrent && !expanded && children === null) {
      let cancelled = false;
      loadChildDirs(entry.path)
        .then((dirs) => { if (!cancelled) { setChildren(dirs); setExpanded(true); } })
        .catch(() => { if (!cancelled) setChildren([]); });
      return () => { cancelled = true; };
    }
  }, [isParentOfCurrent]);

  // Refresh children when directory contents change. Only re-list nodes on the
  // current path's branch — otherwise EVERY expanded node re-runs list_directory
  // on every refresh, and since the tree auto-expands and never collapses, each
  // move fires an ever-growing storm of concurrent IPC calls (the beachball).
  useEffect(() => {
    const relevant = isActive || isParentOfCurrent;
    if (expanded && children !== null && relevant) {
      let cancelled = false;
      loadChildDirs(entry.path)
        .then((dirs) => { if (!cancelled) setChildren(dirs); })
        .catch(() => {});
      return () => { cancelled = true; };
    }
  }, [refreshTrigger]);

  const toggleExpand = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!expanded && children === null) {
      try {
        setChildren(await loadChildDirs(entry.path));
      } catch {
        setChildren([]);
      }
    }
    setExpanded(!expanded);
  };

  const [dragOver, setDragOver] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const expandTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragCountRef = useRef(0);

  // Clear the pending drag-hover expand timer on unmount.
  useEffect(() => () => {
    if (expandTimerRef.current) clearTimeout(expandTimerRef.current);
  }, []);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("application/x-explorer-files", JSON.stringify([entry.path]));
    e.dataTransfer.effectAllowed = "copyMove";
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCountRef.current++;
    if (dragCountRef.current === 1) {
      setDragOver(true);
      expandTimerRef.current = setTimeout(async () => {
        if (!expanded) {
          try {
            setChildren(await loadChildDirs(entry.path));
            setExpanded(true);
          } catch {
            setChildren([]);
          }
        }
      }, 1500);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.stopPropagation();
    dragCountRef.current--;
    if (dragCountRef.current <= 0) {
      dragCountRef.current = 0;
      setDragOver(false);
      if (expandTimerRef.current) {
        clearTimeout(expandTimerRef.current);
        expandTimerRef.current = null;
      }
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCountRef.current = 0;
    setDragOver(false);
    if (expandTimerRef.current) {
      clearTimeout(expandTimerRef.current);
      expandTimerRef.current = null;
    }
    const data = e.dataTransfer.getData("application/x-explorer-files");
    if (data) {
      const paths = JSON.parse(data) as string[];
      if (paths.includes(entry.path)) return;
      await invoke("move_items", { paths, destination: entry.path });
      useNavigationStore.getState().refreshCurrent();
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY });
  };

  return (
    <div>
      <div
        className="flex items-center py-[2px] cursor-default relative"
        onClick={() => onNavigate(entry.path)}
        onContextMenu={handleContextMenu}
        draggable
        onDragStart={handleDragStart}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Tree connector lines */}
        <div className="flex items-center shrink-0" style={{ width: `${depth * 16 + 4}px` }}>
          {parentLines.map((hasLine, i) => (
            <div
              key={i}
              className="w-4 h-full flex items-center justify-center relative shrink-0"
            >
              {hasLine && (
                <div className="absolute top-0 bottom-0 left-[7px] w-[1px] bg-border" />
              )}
            </div>
          ))}
          {depth > 0 && (
            <div className="w-4 h-full flex items-center justify-center relative shrink-0">
              <div
                className={clsx(
                  "absolute left-[7px] w-[1px] bg-border",
                  isLast ? "top-0 h-[50%]" : "top-0 bottom-0"
                )}
              />
              <div className="absolute left-[7px] top-[50%] w-[8px] h-[1px] bg-border" />
            </div>
          )}
        </div>

        {/* Highlight pill — hugs the folder name (truncates if long) rather than
            spanning the whole row. */}
        <div
          className={clsx(
            "flex items-center min-w-0 pr-2 rounded-[var(--radius-md)] transition-colors duration-75",
            isActive
              ? "bg-accent/12 text-accent"
              : isParentOfCurrent
              ? "text-text-secondary"
              : "text-text-secondary hover:bg-bg-hover",
            dragOver && "ring-2 ring-accent bg-accent/15"
          )}
        >
          <button
            onClick={toggleExpand}
            className="flex items-center justify-center w-4 h-4 shrink-0"
          >
            <FoldIcon expanded={expanded} />
          </button>
          <Folder
            size={13}
            className={clsx("shrink-0 ml-0.5 mr-1.5", isActive ? "text-accent" : "text-folder")}
            strokeWidth={1.75}
          />
          <span
            className={clsx("leading-tight truncate", isActive ? "font-semibold text-text" : "text-text-secondary")}
            style={{ fontSize: "var(--font-sidebar-item)" }}
          >
            {entry.name}
          </span>
        </div>
      </div>

      {expanded && children && (
        <div>
          {children.map((child, idx) => (
            <TreeItem
              key={child.path}
              entry={child}
              depth={depth + 1}
              isLast={idx === children.length - 1}
              parentLines={[...parentLines, !isLast]}
              currentPath={currentPath}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}

      {/* Right-click menu */}
      {ctxMenu && (
        <TreeItemContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          entry={entry}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </div>
  );
}

function TreeItemContextMenu({ x, y, entry, onClose }: { x: number; y: number; entry: FileEntry; onClose: () => void }) {
  const menuRef = useRef<HTMLDivElement>(null);
  const tags = useTagStore((s) => s.tags);
  const tagFiles = useTagStore((s) => s.tagFiles);
  const untagFiles = useTagStore((s) => s.untagFiles);
  const fileTagMap = useTagStore((s) => s.fileTagMap);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", handler); document.removeEventListener("keydown", esc); };
  }, [onClose]);

  return (
    <div ref={menuRef} className="fixed z-50 min-w-[180px] py-1.5 bg-bg-secondary border border-border rounded-lg shadow-xl" style={{ left: x, top: y }}>
      <button
        onClick={() => { navigator.clipboard.writeText(entry.path); onClose(); }}
        className="w-full flex items-center gap-2.5 px-3 py-[5px] text-left text-[var(--font-base)] hover:bg-bg-hover text-text-secondary"
      >
        <Clipboard size={12} className="text-text-muted" /> Copy Path
      </button>
      <button
        onClick={async () => {
          await invoke("trash_items", { paths: [entry.path] });
          useNavigationStore.getState().refreshCurrent();
          onClose();
        }}
        className="w-full flex items-center gap-2.5 px-3 py-[5px] text-left text-[var(--font-base)] hover:bg-bg-hover text-red-400"
      >
        <Trash2 size={12} /> Move to Trash
      </button>

      {/* Tags */}
      {tags.length > 0 && (
        <>
          <div className="h-[1px] bg-border my-1 mx-2" />
          {tags.map((tag) => {
            const hasTag = fileTagMap.get(entry.path)?.some((t) => t.id === tag.id);
            return (
              <button
                key={tag.id}
                onClick={() => {
                  if (hasTag) {
                    untagFiles([entry.path], tag.id);
                  } else {
                    tagFiles([entry.path], tag.id);
                  }
                  onClose();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-[5px] text-left text-[var(--font-base)] hover:bg-bg-hover text-text-secondary"
              >
                <div className="w-[8px] h-[8px] rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                <span className="flex-1">{tag.name}</span>
                {hasTag && <span className="text-accent text-[var(--font-xs)]">✓</span>}
              </button>
            );
          })}
        </>
      )}

    </div>
  );
}

interface FavoriteItem {
  label: string;
  suffix: string;
  icon: typeof Home;
}

const defaultFavorites: FavoriteItem[] = [
  { label: "Home", suffix: "", icon: Home },
  { label: "Desktop", suffix: "/Desktop", icon: Monitor },
  { label: "Documents", suffix: "/Documents", icon: FileText },
  { label: "Downloads", suffix: "/Downloads", icon: Download },
];

function TagsSection() {
  const tags = useTagStore((s) => s.tags);
  const loadTags = useTagStore((s) => s.loadTags);
  const activeTagFilter = useTagStore((s) => s.activeTagFilter);
  const setTagFilter = useTagStore((s) => s.setTagFilter);
  const createTag = useTagStore((s) => s.createTag);
  const updateTag = useTagStore((s) => s.updateTag);
  const deleteTag = useTagStore((s) => s.deleteTag);
  const tagFiles = useTagStore((s) => s.tagFiles);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [tagCtxMenu, setTagCtxMenu] = useState<{ x: number; y: number; tagId: number } | null>(null);
  const [renamingTagId, setRenamingTagId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const tagCtxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadTags();
  }, []);

  useEffect(() => {
    if (!tagCtxMenu) return;
    const handler = (e: MouseEvent) => {
      if (tagCtxRef.current && !tagCtxRef.current.contains(e.target as Node)) setTagCtxMenu(null);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setTagCtxMenu(null); };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", handler); document.removeEventListener("keydown", esc); };
  }, [tagCtxMenu]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const colors = ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899", "#6366f1"];
    const color = colors[tags.length % colors.length];
    await createTag(newName.trim(), color);
    setNewName("");
    setCreating(false);
  };

  const handleDrop = (e: React.DragEvent, tagId: number) => {
    e.preventDefault();
    const data = e.dataTransfer.getData("application/x-explorer-files");
    if (data) {
      const paths = JSON.parse(data) as string[];
      tagFiles(paths, tagId);
    }
  };

  const tagColors = ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899", "#6366f1", "#14b8a6"];

  if (tags.length === 0 && !creating) {
    return (
      <div>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 text-text-muted hover:text-text-secondary py-1 text-left w-full"
          style={{ fontSize: "var(--font-sidebar-item)" }}
        >
          <Plus size={12} /> New tag
        </button>
      </div>
    );
  }

  return (
    <div>
          <nav className="flex flex-col gap-[2px]">
            {tags.map((tag) => (
              renamingTagId === tag.id ? (
                <div key={tag.id} className="px-2.5 py-[3px]">
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && renameValue.trim()) { updateTag(tag.id, renameValue.trim()); setRenamingTagId(null); }
                      if (e.key === "Escape") setRenamingTagId(null);
                    }}
                    onBlur={() => setRenamingTagId(null)}
                    className="w-full bg-bg border border-border rounded px-2 py-0.5 text-text outline-none focus:border-accent"
                    style={{ fontSize: "var(--font-sidebar-item)" }}
                  />
                </div>
              ) : (
                <button
                  key={tag.id}
                  onClick={() => setTagFilter(activeTagFilter === tag.id ? null : tag.id)}
                  onContextMenu={(e) => { e.preventDefault(); setTagCtxMenu({ x: e.clientX, y: e.clientY, tagId: tag.id }); }}
                  onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }}
                  onDrop={(e) => handleDrop(e, tag.id)}
                  className={clsx(
                    "flex items-center gap-2.5 px-2.5 py-[4px] rounded-[var(--radius-md)] text-left w-full",
                    "transition-colors duration-75",
                    activeTagFilter === tag.id
                      ? "bg-accent/12 text-accent font-medium"
                      : "text-text-secondary hover:bg-bg-hover"
                  )}
                >
                  <div
                    className="w-[10px] h-[10px] rounded-full shrink-0"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span className="truncate" style={{ fontSize: "var(--font-sidebar-item)" }}>{tag.name}</span>
                </button>
              )
            ))}
          </nav>

          {activeTagFilter !== null && (
            <button
              onClick={() => setTagFilter(null)}
              className="text-[var(--font-xs)] text-accent hover:text-accent/80 px-2.5 py-1.5 text-left font-medium mt-1"
            >
              ✕ Clear filter
            </button>
          )}

      {creating && (
        <div className="mt-1.5">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
              if (e.key === "Escape") { setCreating(false); setNewName(""); }
            }}
            onBlur={() => { if (!newName.trim()) setCreating(false); }}
            placeholder="Tag name..."
            className="w-full bg-bg border border-border rounded px-2 py-1 text-[var(--font-sm)] text-text outline-none focus:border-accent"
          />
        </div>
      )}

      {/* Tag right-click menu */}
      {tagCtxMenu && (() => {
        const tag = tags.find((t) => t.id === tagCtxMenu.tagId);
        if (!tag) return null;
        return (
          <div ref={tagCtxRef} className="fixed z-50 min-w-[160px] py-1.5 bg-bg-secondary border border-border rounded-lg shadow-xl" style={{ left: tagCtxMenu.x, top: tagCtxMenu.y }}>
            <button
              onClick={() => { setRenamingTagId(tag.id); setRenameValue(tag.name); setTagCtxMenu(null); }}
              className="w-full flex items-center gap-2.5 px-3 py-[5px] text-left text-[var(--font-base)] hover:bg-bg-hover text-text-secondary"
            >
              <Pencil size={12} className="text-text-muted" /> Rename
            </button>
            <div className="h-[1px] bg-border my-1 mx-2" />
            <div className="px-3 py-1.5">
              <span className="text-[var(--font-xs)] text-text-muted uppercase tracking-wider">Color</span>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {tagColors.map((c) => (
                  <button
                    key={c}
                    onClick={() => { updateTag(tag.id, undefined, c); setTagCtxMenu(null); }}
                    className={clsx("w-[14px] h-[14px] rounded-full border-2 hover:scale-125 transition-transform", tag.color === c ? "border-white" : "border-transparent")}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <div className="h-[1px] bg-border my-1 mx-2" />
            <button
              onClick={() => { deleteTag(tag.id); setTagCtxMenu(null); }}
              className="w-full flex items-center gap-2.5 px-3 py-[5px] text-left text-[var(--font-base)] hover:bg-bg-hover text-red-400"
            >
              <Trash2 size={12} /> Delete Tag
            </button>
          </div>
        );
      })()}
    </div>
  );
}


export function Sidebar() {
  const currentPath = useNavigationStore((s) => s.currentPath);
  const navigateTo = useNavigationStore((s) => s.navigateTo);
  const refreshTrigger = useNavigationStore((s) => s.refreshTrigger);
  const settings = useSettingsStore((s) => s.settings);

  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const [rootDirs, setRootDirs] = useState<FileEntry[]>([]);
  const showFavorites = settings.show_favorites_section;
  const showFolders = settings.show_folders_section;
  const showTags = settings.show_tags_section;
  const showSnippets = settings.show_snippets_section;

  const homeDir = settings.favorites[0] || "/Users";

  useEffect(() => {
    async function loadRoot() {
      try {
        const entries = await invoke<FileEntry[]>("list_directory", { path: homeDir });
        const dirs = entries
          .filter((e) => e.is_dir && !e.is_hidden)
          .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
        setRootDirs(dirs);
      } catch {
        setRootDirs([]);
      }
    }
    if (homeDir) loadRoot();
  }, [homeDir, refreshTrigger]);

  const [favHeight, setFavHeight] = useState(settings.favorites_height || 140);
  const [foldersHeight, setFoldersHeight] = useState(settings.folders_height || 300);
  const [tagsHeight, setTagsHeight] = useState(settings.tags_height || 200);

  // Re-seed heights if settings load after mount.
  useEffect(() => { setFavHeight(settings.favorites_height || 140); }, [settings.favorites_height]);
  useEffect(() => { setFoldersHeight(settings.folders_height || 300); }, [settings.folders_height]);
  useEffect(() => { setTagsHeight(settings.tags_height || 200); }, [settings.tags_height]);

  const handleDividerDrag = (which: "fav" | "folders" | "tags", min: number) => {
    const setter = which === "fav" ? setFavHeight : which === "folders" ? setFoldersHeight : setTagsHeight;
    return (e: React.MouseEvent) => {
      e.preventDefault();
      const startY = e.clientY;
      const startHeight = which === "fav" ? favHeight : which === "folders" ? foldersHeight : tagsHeight;
      document.body.style.cursor = "row-resize";
      document.body.style.userSelect = "none";

      let latest = startHeight;
      const onMove = (ev: MouseEvent) => {
        latest = Math.max(min, startHeight + (ev.clientY - startY));
        setter(latest);
      };
      const onUp = () => {
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        const key = which === "fav" ? "favorites_height" : which === "folders" ? "folders_height" : "tags_height";
        updateSettings({ [key]: latest });
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    };
  };

  return (
    <aside className="h-full bg-transparent flex flex-col overflow-hidden file-list-font" onContextMenu={(e) => e.preventDefault()}>
      <div className="flex-1 flex flex-col overflow-hidden pt-[46px]">

        {/* Favorites */}
        {showFavorites && (
          <div className="shrink-0 overflow-auto pr-3 pb-1" style={{ paddingLeft: "20px", height: `${favHeight}px` }}>
            <div className="flex items-center justify-between mb-2">
              <h3 style={{ fontSize: "var(--font-sidebar-heading)" }} className="font-medium text-text-muted/70 uppercase tracking-[0.12em]">
                Favorites
              </h3>
              <button onClick={() => updateSettings({ show_favorites_section: false })} className="p-0.5 rounded hover:bg-bg-hover text-text-muted text-[var(--font-xs)]">✕</button>
            </div>
            <nav className="flex flex-col gap-[2px]">
              {defaultFavorites.map((item) => {
                const fullPath = item.suffix ? homeDir + item.suffix : homeDir;
                const Icon = item.icon;
                const isActive = currentPath === fullPath;
                return (
                  <button
                    key={fullPath}
                    onClick={() => navigateTo(fullPath)}
                    className={clsx(
                      "flex items-center gap-2.5 px-2.5 py-[5px] rounded-[var(--radius-md)] text-left w-full",
                      "transition-colors duration-75",
                      isActive
                        ? "bg-accent/12 text-accent font-medium"
                        : "text-text-secondary hover:bg-bg-hover"
                    )}
                  >
                    <Icon size={15} strokeWidth={1.75} />
                    <span style={{ fontSize: "var(--font-sidebar-item)" }}>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        )}

        {/* Draggable divider between Favorites and Folders */}
        {showFavorites && showFolders && (
          <div
            className="shrink-0 h-[7px] cursor-row-resize flex items-center justify-center group"
            onMouseDown={handleDividerDrag("fav", 60)}
          >
            <div className="w-10 h-[3px] rounded-full bg-border/60 group-hover:bg-accent/50 group-active:bg-accent transition-colors" />
          </div>
        )}

        {/* Folders */}
        {showFolders && (
          <div className="overflow-auto pr-3 pb-1" style={{ paddingLeft: "20px", height: (showTags || showSnippets) ? `${foldersHeight}px` : undefined, flex: (showTags || showSnippets) ? "none" : "1" }}>
            <div className="flex items-center justify-between mb-2">
              <h3 style={{ fontSize: "var(--font-sidebar-heading)" }} className="font-medium text-text-muted/70 uppercase tracking-[0.12em]">
                Folders
              </h3>
              <button onClick={() => updateSettings({ show_folders_section: false })} className="p-0.5 rounded hover:bg-bg-hover text-text-muted text-[var(--font-xs)]">✕</button>
            </div>
            <div className="flex flex-col">
              {rootDirs.map((entry, idx) => (
                <TreeItem
                  key={entry.path}
                  entry={entry}
                  depth={0}
                  isLast={idx === rootDirs.length - 1}
                  parentLines={[]}
                  currentPath={currentPath}
                  onNavigate={navigateTo}
                />
              ))}
            </div>
          </div>
        )}

        {/* Draggable divider between Folders and next section */}
        {showFolders && (showTags || showSnippets) && (
          <div
            className="shrink-0 h-[7px] cursor-row-resize flex items-center justify-center group"
            onMouseDown={handleDividerDrag("folders", 80)}
          >
            <div className="w-10 h-[3px] rounded-full bg-border/60 group-hover:bg-accent/50 group-active:bg-accent transition-colors" />
          </div>
        )}

        {/* Tags */}
        {showTags && (
          <div className="overflow-auto pr-3 pb-1 min-h-[60px]" style={{ paddingLeft: "20px", height: showSnippets ? `${tagsHeight}px` : undefined, flex: showSnippets ? "none" : "1" }}>
            <div className="flex items-center justify-between mb-2">
              <h3 style={{ fontSize: "var(--font-sidebar-heading)" }} className="font-medium text-text-muted/70 uppercase tracking-[0.12em]">Tags</h3>
              <button onClick={() => updateSettings({ show_tags_section: false })} className="p-0.5 rounded hover:bg-bg-hover text-text-muted text-[var(--font-xs)]">✕</button>
            </div>
            <TagsSection />
          </div>
        )}

        {/* Draggable divider between Tags and Snippets */}
        {showTags && showSnippets && (
          <div
            className="shrink-0 h-[7px] cursor-row-resize flex items-center justify-center group"
            onMouseDown={handleDividerDrag("tags", 60)}
          >
            <div className="w-10 h-[3px] rounded-full bg-border/60 group-hover:bg-accent/50 group-active:bg-accent transition-colors" />
          </div>
        )}

        {/* Snippets */}
        {showSnippets && (
          <div className="flex-1 overflow-auto pr-3 pb-3 min-h-[60px]" style={{ paddingLeft: "20px" }}>
            <div className="flex items-center justify-between mb-2">
              <h3 style={{ fontSize: "var(--font-sidebar-heading)" }} className="font-medium text-text-muted/70 uppercase tracking-[0.12em]">Snippets</h3>
              <button onClick={() => updateSettings({ show_snippets_section: false })} className="p-0.5 rounded hover:bg-bg-hover text-text-muted text-[var(--font-xs)]">✕</button>
            </div>
            <SnippetsSection />
          </div>
        )}

      </div>

      {/* Show hidden panels */}
      {(!showFavorites || !showFolders || !showTags || !showSnippets) && (
        <div className="px-4 py-2 border-t border-border shrink-0">
          {!showFavorites && (
            <button onClick={() => updateSettings({ show_favorites_section: true })} className="text-[var(--font-xs)] text-text-muted hover:text-text-secondary block py-0.5">Show Favorites</button>
          )}
          {!showFolders && (
            <button onClick={() => updateSettings({ show_folders_section: true })} className="text-[var(--font-xs)] text-text-muted hover:text-text-secondary block py-0.5">Show Folders</button>
          )}
          {!showTags && (
            <button onClick={() => updateSettings({ show_tags_section: true })} className="text-[var(--font-xs)] text-text-muted hover:text-text-secondary block py-0.5">Show Tags</button>
          )}
          {!showSnippets && (
            <button onClick={() => updateSettings({ show_snippets_section: true })} className="text-[var(--font-xs)] text-text-muted hover:text-text-secondary block py-0.5">Show Snippets</button>
          )}
        </div>
      )}

    </aside>
  );
}
