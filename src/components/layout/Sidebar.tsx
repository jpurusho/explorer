import { useState, useEffect, useRef } from "react";
import { Home, Download, FileText, Monitor, Folder, Plus, Pencil, Trash2 } from "lucide-react";
import { clsx } from "clsx";
import { invoke } from "@tauri-apps/api/core";
import { useNavigationStore } from "../../stores/navigationStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { useTagStore } from "../../stores/tagStore";
import { useSectionStore } from "../../stores/sectionStore";
import type { FileEntry } from "../../types";

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
  const isActive = currentPath === entry.path;
  const isParentOfCurrent = currentPath.startsWith(entry.path + "/");

  useEffect(() => {
    if (isParentOfCurrent && !expanded && children === null) {
      invoke<FileEntry[]>("list_directory", { path: entry.path }).then((entries) => {
        const dirs = entries
          .filter((e) => e.is_dir && !e.is_hidden)
          .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
        setChildren(dirs);
        setExpanded(true);
      }).catch(() => setChildren([]));
    }
  }, [isParentOfCurrent]);

  const toggleExpand = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!expanded && children === null) {
      try {
        const entries = await invoke<FileEntry[]>("list_directory", { path: entry.path });
        const dirs = entries
          .filter((e) => e.is_dir && !e.is_hidden)
          .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
        setChildren(dirs);
      } catch {
        setChildren([]);
      }
    }
    setExpanded(!expanded);
  };

  const [dragOver, setDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.stopPropagation();
    setDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const data = e.dataTransfer.getData("application/x-explorer-files");
    if (data) {
      const paths = JSON.parse(data) as string[];
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("move_items", { paths, destination: entry.path });
      const { useNavigationStore } = await import("../../stores/navigationStore");
      useNavigationStore.getState().refreshCurrent();
    }
  };

  return (
    <div>
      <div
        className={clsx(
          "flex items-center py-[2px] cursor-default relative",
          "transition-colors duration-75 rounded-[3px]",
          isActive
            ? "bg-accent/12 text-accent"
            : isParentOfCurrent
            ? "text-text"
            : "text-text hover:bg-bg-hover",
          dragOver && "ring-1 ring-accent/50 bg-accent/8"
        )}
        style={{ paddingRight: "6px" }}
        onClick={() => onNavigate(entry.path)}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Tree connector lines */}
        <div className="flex items-center" style={{ width: `${depth * 16 + 4}px` }}>
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
          className={clsx("leading-tight truncate", isActive ? "font-semibold" : "text-text")}
          style={{ fontSize: "var(--font-sidebar-item)" }}
        >
          {entry.name}
        </span>
      </div>

      {expanded && children && (
        <div>
          {children.map((child, idx) => (
            <TreeItem
              key={child.path}
              entry={child}
              depth={depth + 1}
              isLast={idx === children.length - 1}
              parentLines={[...parentLines, ...(depth > 0 ? [!isLast] : []), idx < children.length - 1 ? false : false].slice(0, depth)}
              currentPath={currentPath}
              onNavigate={onNavigate}
            />
          ))}
        </div>
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
  const tagFiles = useTagStore((s) => s.tagFiles);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    loadTags();
  }, []);

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

  if (tags.length === 0 && !creating) {
    return (
      <div className="px-4 pb-2">
        <div className="flex items-center justify-between">
          <h3 style={{ fontSize: "var(--font-sidebar-heading)" }} className="font-semibold text-text-muted uppercase tracking-widest">Tags</h3>
          <button
            onClick={() => setCreating(true)}
            className="p-0.5 rounded hover:bg-bg-hover text-text-muted hover:text-text-secondary"
          >
            <Plus size={11} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pb-2">
      <div className="flex items-center justify-between mb-2">
        <h3 style={{ fontSize: "var(--font-sidebar-heading)" }} className="font-semibold text-text-muted uppercase tracking-widest">Tags</h3>
        <button
          onClick={() => setCreating(true)}
          className="p-0.5 rounded hover:bg-bg-hover text-text-muted hover:text-text-secondary"
        >
          <Plus size={11} />
        </button>
      </div>

      <nav className="flex flex-col gap-[2px]">
        {tags.map((tag) => (
          <button
            key={tag.id}
            onClick={() => setTagFilter(activeTagFilter === tag.id ? null : tag.id)}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }}
            onDrop={(e) => handleDrop(e, tag.id)}
            className={clsx(
              "flex items-center gap-2.5 px-2.5 py-[4px] rounded-[5px] text-left w-full",
              "transition-colors duration-75",
              activeTagFilter === tag.id
                ? "bg-accent/12 text-accent font-medium"
                : "text-text hover:bg-bg-hover"
            )}
          >
            <div
              className="w-[10px] h-[10px] rounded-full shrink-0"
              style={{ backgroundColor: tag.color }}
            />
            <span className="truncate" style={{ fontSize: "var(--font-sidebar-item)" }}>{tag.name}</span>
          </button>
        ))}

        {activeTagFilter !== null && (
          <button
            onClick={() => setTagFilter(null)}
            className="text-[--font-xs] text-text-muted hover:text-text-secondary px-2.5 py-1 text-left"
          >
            Clear filter
          </button>
        )}
      </nav>

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
            className="w-full bg-bg border border-border rounded px-2 py-1 text-[--font-sm] text-text outline-none focus:border-accent"
          />
        </div>
      )}
    </div>
  );
}

function SectionsPanel() {
  const sections = useSectionStore((s) => s.sections);
  const sectionsEnabled = useSectionStore((s) => s.sectionsEnabled);
  const loadAllSections = useSectionStore((s) => s.loadAllSections);
  const createSection = useSectionStore((s) => s.createSection);
  const updateSection = useSectionStore((s) => s.updateSection);
  const assignFiles = useSectionStore((s) => s.assignFiles);
  const toggleHidden = useSectionStore((s) => s.toggleHidden);
  const currentPath = useNavigationStore((s) => s.currentPath);
  const navigateTo = useNavigationStore((s) => s.navigateTo);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; id: number } | null>(null);
  const [showHiddenSections, setShowHiddenSections] = useState(false);

  useEffect(() => {
    loadAllSections();
  }, []);

  const toggleExpanded = (id: number) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreate = async () => {
    if (!newName.trim() || !currentPath) return;
    const colors = ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899"];
    const color = colors[sections.length % colors.length];
    await createSection(currentPath, newName.trim(), color);
    setNewName("");
    setCreating(false);
  };

  const handleRename = async (id: number) => {
    if (!renameValue.trim()) { setRenamingId(null); return; }
    await updateSection(id, { name: renameValue.trim() });
    setRenamingId(null);
  };

  const handleDrop = (e: React.DragEvent, sectionId: number) => {
    e.preventDefault();
    const data = e.dataTransfer.getData("application/x-explorer-files");
    if (data) {
      const paths = JSON.parse(data) as string[];
      assignFiles(sectionId, paths);
    }
  };

  if (!sectionsEnabled && !creating) {
    return (
      <div className="px-4 pb-2">
        <div className="flex items-center justify-between">
          <h3 style={{ fontSize: "var(--font-sidebar-heading)" }} className="font-semibold text-text-muted uppercase tracking-widest">Sections</h3>
          <button
            onClick={() => setCreating(true)}
            className="p-0.5 rounded hover:bg-bg-hover text-text-muted hover:text-text-secondary"
            title="New section for current folder"
          >
            <Plus size={12} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pb-2">
      <div className="flex items-center justify-between mb-2">
        <h3 style={{ fontSize: "var(--font-sidebar-heading)" }} className="font-semibold text-text-muted uppercase tracking-widest">Sections</h3>
        <button
          onClick={() => setCreating(true)}
          className="p-0.5 rounded hover:bg-bg-hover text-text-muted hover:text-text-secondary"
          title="New section for current folder"
        >
          <Plus size={12} />
        </button>
      </div>

      <nav className="flex flex-col">
        {sections.filter((s) => !s.hidden).map((section, idx) => (
          <div key={section.id}>
            {/* Horizontal divider between sections */}
            {idx > 0 && <div className="mx-1 my-1" style={{ height: "1px", backgroundColor: "var(--section-border)" }} />}

            {/* Section header — rectangular label with background */}
            <div
              className="group/item cursor-default transition-all [&.drag-over]:ring-1 [&.drag-over]:ring-accent/50"
              onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, id: section.id }); }}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; e.currentTarget.classList.add("drag-over"); }}
              onDragLeave={(e) => { e.currentTarget.classList.remove("drag-over"); }}
              onDrop={(e) => { e.currentTarget.classList.remove("drag-over"); handleDrop(e, section.id); }}
            >
              {renamingId === section.id ? (
                <div className="px-1 py-1">
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRename(section.id);
                      if (e.key === "Escape") setRenamingId(null);
                    }}
                    onBlur={() => handleRename(section.id)}
                    style={{ fontSize: "var(--font-sidebar-section)" }}
                    className="w-full bg-bg border border-border rounded px-2 py-0.5 text-text outline-none focus:border-accent"
                  />
                </div>
              ) : (
                <div
                  className="flex items-center gap-3"
                  style={{
                    backgroundColor: "var(--section-bg)",
                    color: "var(--section-text)",
                    borderRadius: "var(--section-radius)",
                    padding: "var(--section-padding-v) var(--section-padding-h)",
                  }}
                >
                  {/* Color accent icon */}
                  <div
                    className="w-[28px] h-[28px] rounded-[6px] flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${section.color}25` }}
                  >
                    <Folder size={15} style={{ color: section.color }} strokeWidth={2} />
                  </div>

                  {/* Section name */}
                  <button
                    onClick={() => toggleExpanded(section.id)}
                    style={{ fontSize: "var(--font-sidebar-section)" }}
                    className="flex-1 text-left font-semibold truncate"
                  >
                    {section.name}
                  </button>

                  {/* Action buttons */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => { setRenamingId(section.id); setRenameValue(section.name); }}
                      className="p-1 rounded hover:bg-white/10 text-text-muted hover:text-text transition-colors"
                      title="Rename"
                    >
                      <Plus size={13} />
                    </button>
                    <button
                      onClick={() => toggleExpanded(section.id)}
                      className="p-1 rounded hover:bg-white/10 text-text-muted hover:text-text transition-colors"
                      title={expandedSections.has(section.id) ? "Collapse" : "Expand"}
                    >
                      <FoldIcon expanded={expandedSections.has(section.id)} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Folders under section */}
            {expandedSections.has(section.id) && (
              <div className="pl-3 mt-1">
                {section.files.map((f) => {
                  const name = f.file_path.split("/").pop() || f.file_path;
                  return (
                    <button
                      key={f.file_path}
                      onClick={() => navigateTo(f.file_path)}
                      style={{ fontSize: "var(--font-sidebar-item)" }}
                      className="flex items-center gap-2 w-full px-2 py-[4px] rounded-[4px] text-left text-text hover:bg-bg-hover truncate transition-colors"
                    >
                      <Folder size={13} className="text-folder shrink-0" strokeWidth={1.75} />
                      <span className="truncate">{name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </nav>

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
            placeholder="Section name..."
            className="w-full bg-bg border border-border rounded px-2 py-1 text-[--font-sm] text-text outline-none focus:border-accent"
          />
        </div>
      )}

      {/* Hidden sections — show/unhide */}
      {sections.some((s) => s.hidden) && (
        <div className="mt-2">
          <button
            onClick={() => setShowHiddenSections(!showHiddenSections)}
            className="text-[--font-xs] text-text-muted hover:text-text-secondary px-2"
          >
            {showHiddenSections ? "Hide hidden sections" : `${sections.filter((s) => s.hidden).length} hidden section(s)`}
          </button>
          {showHiddenSections && (
            <div className="mt-1 flex flex-col gap-[1px]">
              {sections.filter((s) => s.hidden).map((section) => (
                <div key={section.id} className="flex items-center gap-2 px-2 py-[3px] opacity-50">
                  <div className="w-[8px] h-[8px] rounded-[3px] shrink-0" style={{ backgroundColor: section.color }} />
                  <span style={{ fontSize: "var(--font-sidebar-item)" }} className="flex-1 text-text-muted truncate">{section.name}</span>
                  <button
                    onClick={() => toggleHidden(section.id)}
                    className="text-[--font-xs] text-accent hover:underline"
                  >
                    Show
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Context menu for sections */}
      {ctxMenu && (
        <SidebarContextMenu x={ctxMenu.x} y={ctxMenu.y} sectionId={ctxMenu.id} onClose={() => setCtxMenu(null)} />
      )}
    </div>
  );
}

function SidebarContextMenu({ x, y, sectionId, onClose }: { x: number; y: number; sectionId: number; onClose: () => void }) {
  const updateSection = useSectionStore((s) => s.updateSection);
  const deleteSection = useSectionStore((s) => s.deleteSection);
  const toggleHidden = useSectionStore((s) => s.toggleHidden);
  const sections = useSectionStore((s) => s.sections);
  const section = sections.find((s) => s.id === sectionId);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(section?.name || "");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", handler); document.removeEventListener("keydown", esc); };
  }, [onClose]);

  if (!section) return null;

  const colors = ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899", "#6366f1", "#14b8a6"];

  if (renaming) {
    return (
      <div ref={menuRef} className="fixed z-50 min-w-[180px] p-2 bg-bg-secondary border border-border rounded-lg shadow-xl" style={{ left: x, top: y }}>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && name.trim()) { updateSection(sectionId, { name: name.trim() }); onClose(); }
            if (e.key === "Escape") onClose();
          }}
          className="w-full bg-bg border border-border rounded px-2 py-1 text-[--font-base] text-text outline-none focus:border-accent"
        />
      </div>
    );
  }

  return (
    <div ref={menuRef} className="fixed z-50 min-w-[180px] py-1.5 bg-bg-secondary border border-border rounded-lg shadow-xl" style={{ left: x, top: y }}>
      <button onClick={() => setRenaming(true)} className="w-full flex items-center gap-2.5 px-3 py-[5px] text-left text-[--font-base] hover:bg-bg-hover text-text-secondary">
        <Pencil size={12} className="text-text-muted" /> Rename
      </button>
      <button onClick={() => { toggleHidden(sectionId); onClose(); }} className="w-full flex items-center gap-2.5 px-3 py-[5px] text-left text-[--font-base] hover:bg-bg-hover text-text-secondary">
        <Folder size={12} className="text-text-muted" /> {section.hidden ? "Show" : "Hide"}
      </button>
      <div className="h-[1px] bg-border my-1.5 mx-2" />
      <div className="px-3 py-1">
        <span className="text-[--font-xs] text-text-muted uppercase tracking-wider">Color</span>
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {colors.map((c) => (
            <button
              key={c}
              onClick={() => { updateSection(sectionId, { color: c }); onClose(); }}
              className={clsx("w-[16px] h-[16px] rounded-full border-2 transition-transform hover:scale-110", section.color === c ? "border-white" : "border-transparent")}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>
      <div className="h-[1px] bg-border my-1.5 mx-2" />
      <button onClick={() => { deleteSection(sectionId); onClose(); }} className="w-full flex items-center gap-2.5 px-3 py-[5px] text-left text-[--font-base] hover:bg-bg-hover text-red-400">
        <Trash2 size={12} /> Delete Section
      </button>
    </div>
  );
}

export function Sidebar() {
  const currentPath = useNavigationStore((s) => s.currentPath);
  const navigateTo = useNavigationStore((s) => s.navigateTo);
  const settings = useSettingsStore((s) => s.settings);

  const [rootDirs, setRootDirs] = useState<FileEntry[]>([]);
  const [showFavorites, setShowFavorites] = useState(true);
  const [showFolders, setShowFolders] = useState(true);

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
  }, [homeDir]);

  return (
    <aside className="h-full bg-bg-secondary flex flex-col overflow-hidden file-list-font" onContextMenu={(e) => e.preventDefault()}>
      {/* Favorites — collapsible */}
      {showFavorites && (
        <div className="pt-4 px-4 pb-2">
          <div className="flex items-center justify-between mb-2">
            <h3 style={{ fontSize: "var(--font-sidebar-heading)" }} className="font-semibold text-text-muted uppercase tracking-widest">
              Favorites
            </h3>
            <button onClick={() => setShowFavorites(false)} className="p-0.5 rounded hover:bg-bg-hover text-text-muted text-[--font-xs]">✕</button>
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
                    "flex items-center gap-2.5 px-2.5 py-[5px] rounded-[5px] text-left w-full",
                    "transition-colors duration-75",
                    isActive
                      ? "bg-accent/12 text-accent font-medium"
                      : "text-text hover:bg-bg-hover"
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

      {/* Tags */}
      <TagsSection />

      {/* Sections */}
      <SectionsPanel />

      {/* Folders — collapsible */}
      {showFolders && (
        <div className="flex-1 overflow-auto px-4 pb-4">
          <div className="flex items-center justify-between mb-2 mt-3">
            <h3 style={{ fontSize: "var(--font-sidebar-heading)" }} className="font-semibold text-text-muted uppercase tracking-widest">
              Folders
            </h3>
            <button onClick={() => setShowFolders(false)} className="p-0.5 rounded hover:bg-bg-hover text-text-muted text-[--font-xs]">✕</button>
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

      {/* Show hidden panels */}
      {(!showFavorites || !showFolders) && (
        <div className="px-4 py-2 border-t border-border">
          {!showFavorites && (
            <button onClick={() => setShowFavorites(true)} className="text-[--font-xs] text-text-muted hover:text-text-secondary block py-0.5">Show Favorites</button>
          )}
          {!showFolders && (
            <button onClick={() => setShowFolders(true)} className="text-[--font-xs] text-text-muted hover:text-text-secondary block py-0.5">Show Folders</button>
          )}
        </div>
      )}

    </aside>
  );
}
