import { useEffect, useRef, useState } from "react";
import {
  ExternalLink,
  Copy,
  FolderOpen,
  FolderPlus,
  Trash2,
  Pencil,
  Info,
  FileText,
  Eye,
  Clipboard,
  ClipboardPaste,
  Scissors,
  Tag,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { detachPreview } from "../../lib/detachPreview";
import { useNavigationStore } from "../../stores/navigationStore";
import { useTagStore } from "../../stores/tagStore";
import { useSectionStore } from "../../stores/sectionStore";
import { useClipboardStore } from "../../stores/clipboardStore";
import type { FileEntry, FileType } from "../../types";

interface ContextMenuProps {
  x: number;
  y: number;
  entries: FileEntry[];
  onClose: () => void;
  onOpen?: () => void;
  onRename?: () => void;
}

interface MenuItem {
  label: string;
  icon: React.ReactNode;
  action: () => void;
  separator?: boolean;
  disabled?: boolean;
  destructive?: boolean;
}

export function ContextMenu({ x, y, entries, onClose, onOpen, onRename }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const count = entries.length;
  const single = count === 1 ? entries[0] : null;
  const fileType = single?.file_type as FileType | undefined;
  const refreshDirectory = useNavigationStore((s) => s.refreshCurrent);
  const allTags = useTagStore((s) => s.tags);
  const activeTagFilter = useTagStore((s) => s.activeTagFilter);
  const tagFiles = useTagStore((s) => s.tagFiles);
  const untagFiles = useTagStore((s) => s.untagFiles);
  const fileTagMap = useTagStore((s) => s.fileTagMap);
  const sections = useSectionStore((s) => s.sections);
  const assignFiles = useSectionStore((s) => s.assignFiles);
  const removeFiles = useSectionStore((s) => s.removeFiles);
  const currentPath = useNavigationStore((s) => s.currentPath);
  const createSection = useSectionStore((s) => s.createSection);
  const [showTagSubmenu, setShowTagSubmenu] = useState(false);
  const [showSectionSubmenu, setShowSectionSubmenu] = useState(false);
  const [creatingSection, setCreatingSection] = useState(false);
  const [newSectionName, setNewSectionName] = useState("");

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [onClose]);

  useEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (rect.right > vw) {
      menuRef.current.style.left = `${x - rect.width}px`;
    }
    if (rect.bottom > vh) {
      menuRef.current.style.top = `${y - rect.height}px`;
    }
  }, [x, y]);

  const previewableTypes: FileType[] = ["image", "video", "audio", "markdown", "json", "yaml", "text", "code", "unknown"];

  const handleTrash = async () => {
    const paths = entries.map((e) => e.path);
    try {
      await invoke("trash_items", { paths });
      refreshDirectory?.();
    } catch {
      // Trash operation failed
    }
    onClose();
  };

  const handleCopyPaths = () => {
    const paths = entries.map((e) => e.path).join("\n");
    navigator.clipboard.writeText(paths);
    onClose();
  };

  const handleCopyNames = () => {
    const names = entries.map((e) => e.name).join("\n");
    navigator.clipboard.writeText(names);
    onClose();
  };

  const items: MenuItem[] = [];

  // Remove from active tag (when in tag filter view)
  if (activeTagFilter !== null) {
    const activeTag = allTags.find((t) => t.id === activeTagFilter);
    if (activeTag) {
      items.push({
        label: `Remove "${activeTag.name}" tag`,
        icon: <Tag size={13} />,
        action: () => {
          const paths = entries.map((e) => e.path);
          untagFiles(paths, activeTagFilter).then(() => refreshDirectory?.());
          onClose();
        },
        destructive: true,
      });
      items.push({ label: "", icon: null, action: () => {}, separator: true });
    }
  }

  // Open
  if (single) {
    items.push({
      label: single.is_dir ? "Open" : "Preview",
      icon: single.is_dir ? <FolderOpen size={13} /> : <Eye size={13} />,
      action: () => { onOpen?.(); onClose(); },
    });
  }

  // Detach preview
  if (single && !single.is_dir && previewableTypes.includes(fileType!)) {
    items.push({
      label: "Open in New Window",
      icon: <ExternalLink size={13} />,
      action: () => { detachPreview(single.path, single.name, single.file_type); onClose(); },
    });
  }

  items.push({ label: "", icon: null, action: () => {}, separator: true });

  // Copy path/name
  items.push({
    label: count > 1 ? `Copy ${count} Paths` : "Copy Path",
    icon: <Clipboard size={13} />,
    action: handleCopyPaths,
  });

  items.push({
    label: count > 1 ? `Copy ${count} Names` : "Copy Name",
    icon: <Copy size={13} />,
    action: handleCopyNames,
  });

  // File operations
  const clipboard = useClipboardStore.getState();

  items.push({
    label: "Copy Files",
    icon: <Copy size={13} />,
    action: () => {
      useClipboardStore.getState().setPaths(entries.map((e) => e.path), "copy");
      onClose();
    },
  });

  items.push({
    label: "Cut Files",
    icon: <Scissors size={13} />,
    action: () => {
      useClipboardStore.getState().setPaths(entries.map((e) => e.path), "cut");
      onClose();
    },
  });

  if (clipboard.paths.length > 0) {
    items.push({
      label: "Paste",
      icon: <ClipboardPaste size={13} />,
      action: async () => {
        const { paths, operation } = useClipboardStore.getState();
        const dest = currentPath;
        if (operation === "copy") {
          await invoke("copy_items", { paths, destination: dest });
        } else {
          await invoke("move_items", { paths, destination: dest });
          useClipboardStore.getState().clear();
        }
        refreshDirectory?.();
        onClose();
      },
    });
  }

  items.push({
    label: "New Folder",
    icon: <FolderPlus size={13} />,
    action: async () => {
      const dest = currentPath;
      try {
        await invoke("create_folder", { path: `${dest}/untitled folder` });
      } catch {
        for (let i = 2; i < 100; i++) {
          try {
            await invoke("create_folder", { path: `${dest}/untitled folder ${i}` });
            break;
          } catch { continue; }
        }
      }
      refreshDirectory?.();
      onClose();
    },
  });

  items.push({ label: "", icon: null, action: () => {}, separator: true });

  // Tags submenu trigger
  items.push({
    label: "Tags",
    icon: <Tag size={13} />,
    action: () => { setShowTagSubmenu(!showTagSubmenu); setShowSectionSubmenu(false); },
  });

  // Sections submenu trigger
  items.push({
    label: "Move to Section",
    icon: <FolderOpen size={13} />,
    action: () => { setShowSectionSubmenu(!showSectionSubmenu); setShowTagSubmenu(false); },
  });

  items.push({ label: "", icon: null, action: () => {}, separator: true });

  // Rename (single only)
  if (single) {
    items.push({
      label: "Rename",
      icon: <Pencil size={13} />,
      action: () => { onRename?.(); onClose(); },
    });
  }

  // Trash
  items.push({
    label: count > 1 ? `Move ${count} Items to Trash` : "Move to Trash",
    icon: <Trash2 size={13} />,
    action: handleTrash,
    destructive: true,
  });

  items.push({ label: "", icon: null, action: () => {}, separator: true });

  // Info
  items.push({
    label: "Get Info",
    icon: <Info size={13} />,
    action: () => { onClose(); },
    disabled: true,
  });

  if (single && !single.is_dir) {
    items.push({
      label: "Open in Editor",
      icon: <FileText size={13} />,
      action: () => { onOpen?.(); onClose(); },
    });
  }

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[200px] py-1.5 bg-bg-secondary border border-border rounded-lg shadow-xl backdrop-blur-sm"
      style={{ left: x, top: y }}
    >
      {items.map((item, idx) => {
        if (item.separator) {
          return <div key={idx} className="h-[1px] bg-border my-1.5 mx-2" />;
        }
        return (
          <button
            key={idx}
            onClick={item.action}
            disabled={item.disabled}
            className="w-full flex items-center gap-2.5 px-3 py-[5px] text-left text-[var(--font-base)] hover:bg-bg-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span className={item.destructive ? "text-red-400 shrink-0" : "text-text-muted shrink-0"}>{item.icon}</span>
            <span className={item.destructive ? "text-red-400" : "text-text-secondary"}>{item.label}</span>
          </button>
        );
      })}

      {showTagSubmenu && allTags.length > 0 && (
        <div className="border-t border-border mt-1 pt-1">
          {allTags.map((tag) => {
            const paths = entries.map((e) => e.path);
            const hasTag = paths.some((p) => fileTagMap.get(p)?.some((t) => t.id === tag.id));
            return (
              <button
                key={tag.id}
                onClick={() => {
                  const paths = entries.map((e) => e.path);
                  if (hasTag) {
                    untagFiles(paths, tag.id);
                  } else {
                    tagFiles(paths, tag.id);
                  }
                }}
                className="w-full flex items-center gap-2.5 px-3 py-[4px] text-left text-[var(--font-sm)] hover:bg-bg-hover transition-colors"
              >
                <div
                  className="w-[8px] h-[8px] rounded-full shrink-0"
                  style={{ backgroundColor: tag.color }}
                />
                <span className="text-text-secondary flex-1">{tag.name}</span>
                {hasTag && <span className="text-accent text-[var(--font-xs)]">✓</span>}
              </button>
            );
          })}
        </div>
      )}

      {showSectionSubmenu && (
        <div className="border-t border-border mt-1 pt-1">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => {
                const paths = entries.map((e) => e.path);
                assignFiles(section.id, paths);
                onClose();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-[4px] text-left text-[var(--font-sm)] hover:bg-bg-hover transition-colors"
            >
              <div
                className="w-[8px] h-[8px] rounded shrink-0"
                style={{ backgroundColor: section.color }}
              />
              <span className="text-text-secondary flex-1">{section.name}</span>
            </button>
          ))}

          <button
            onClick={() => {
              const paths = entries.map((e) => e.path);
              const sectionForFile = useSectionStore.getState().getSectionForPath(paths[0]);
              if (sectionForFile) {
                removeFiles(sectionForFile.id, paths);
              }
              onClose();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-[4px] text-left text-[var(--font-sm)] hover:bg-bg-hover transition-colors text-text-muted"
          >
            <span className="w-[8px] shrink-0">—</span>
            <span className="flex-1">Unsorted</span>
          </button>

          <div className="h-[1px] bg-border my-1 mx-2" />

          {!creatingSection ? (
            <button
              onClick={() => setCreatingSection(true)}
              className="w-full flex items-center gap-2.5 px-3 py-[4px] text-left text-[var(--font-sm)] hover:bg-bg-hover transition-colors text-accent"
            >
              <span className="text-[var(--font-md)]">+</span>
              <span>New Section</span>
            </button>
          ) : (
            <div className="px-3 py-1">
              <input
                autoFocus
                value={newSectionName}
                onChange={(e) => setNewSectionName(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key === "Enter" && newSectionName.trim()) {
                    const colors = ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899"];
                    const color = colors[sections.length % colors.length];
                    const section = await createSection(currentPath, newSectionName.trim(), color);
                    const paths = entries.map((en) => en.path);
                    await assignFiles(section.id, paths);
                    onClose();
                  }
                  if (e.key === "Escape") setCreatingSection(false);
                }}
                placeholder="Section name..."
                className="w-full bg-bg border border-border rounded px-2 py-1 text-[var(--font-sm)] text-text outline-none focus:border-accent"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
