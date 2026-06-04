import { useEffect, useRef, useState } from "react";
import {
  ExternalLink,
  Copy,
  FolderOpen,
  Trash2,
  Pencil,
  Info,
  FileText,
  Eye,
  Clipboard,
  Tag,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { detachPreview } from "../../lib/detachPreview";
import { useNavigationStore } from "../../stores/navigationStore";
import { useTagStore } from "../../stores/tagStore";
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
  const tagFiles = useTagStore((s) => s.tagFiles);
  const untagFiles = useTagStore((s) => s.untagFiles);
  const fileTagMap = useTagStore((s) => s.fileTagMap);
  const [showTagSubmenu, setShowTagSubmenu] = useState(false);

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
    } catch (err) {
      console.error("Trash failed:", err);
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

  // Tags submenu trigger
  items.push({
    label: "Tags",
    icon: <Tag size={13} />,
    action: () => setShowTagSubmenu(!showTagSubmenu),
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
            className="w-full flex items-center gap-2.5 px-3 py-[5px] text-left text-[12px] hover:bg-bg-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
                className="w-full flex items-center gap-2.5 px-3 py-[4px] text-left text-[11px] hover:bg-bg-hover transition-colors"
              >
                <div
                  className="w-[8px] h-[8px] rounded-full shrink-0"
                  style={{ backgroundColor: tag.color }}
                />
                <span className="text-text-secondary flex-1">{tag.name}</span>
                {hasTag && <span className="text-accent text-[10px]">✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
