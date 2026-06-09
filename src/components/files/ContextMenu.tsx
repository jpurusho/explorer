import { useEffect, useRef, useState } from "react";
import {
  ExternalLink,
  Copy,
  FolderOpen,
  FolderPlus,
  Trash2,
  Pencil,
  Eye,
  Clipboard,
  ClipboardPaste,
  Scissors,
  Tag,
  ChevronRight,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { detachPreview } from "../../lib/detachPreview";
import { useNavigationStore } from "../../stores/navigationStore";
import { useTagStore } from "../../stores/tagStore";
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

function MenuItem({ icon, label, onClick, destructive, disabled }: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  destructive?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-center gap-2.5 px-3 py-[6px] text-left text-[var(--font-sm)] rounded-md hover:bg-bg-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed group outline-none focus:bg-bg-hover"
    >
      <span className={destructive ? "text-red-400 shrink-0" : "text-text-muted shrink-0 group-hover:text-text-secondary"}>{icon}</span>
      <span className={destructive ? "text-red-400" : "text-text-secondary group-hover:text-text"}>{label}</span>
    </button>
  );
}

function MenuSeparator() {
  return <div className="h-[1px] bg-border/50 my-1 mx-2" />;
}

function SubMenu({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div ref={ref} className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button className="w-full flex items-center gap-2.5 px-3 py-[6px] text-left text-[var(--font-sm)] rounded-md hover:bg-bg-hover transition-colors group outline-none focus:bg-bg-hover">
        <span className="text-text-muted shrink-0 group-hover:text-text-secondary">{icon}</span>
        <span className="text-text-secondary group-hover:text-text flex-1">{label}</span>
        <ChevronRight size={11} className="text-text-muted" />
      </button>
      {open && (
        <div className="absolute left-full top-0 ml-1 min-w-[160px] py-1.5 bg-bg-secondary border border-border rounded-lg shadow-xl z-50">
          {children}
        </div>
      )}
    </div>
  );
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
  const currentPath = useNavigationStore((s) => s.currentPath);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  // Position adjustment to keep menu in viewport
  useEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (rect.right > vw - 8) menuRef.current.style.left = `${Math.max(8, x - rect.width)}px`;
    if (rect.bottom > vh - 8) menuRef.current.style.top = `${Math.max(8, y - rect.height)}px`;
  }, [x, y]);

  const previewableTypes: FileType[] = ["image", "video", "audio", "markdown", "json", "yaml", "text", "code", "unknown"];

  const handleTrash = async () => {
    const paths = entries.map((e) => e.path);
    await invoke("trash_items", { paths }).catch(() => {});
    refreshDirectory?.();
    onClose();
  };

  const handleCopyPaths = () => {
    navigator.clipboard.writeText(entries.map((e) => e.path).join("\n"));
    onClose();
  };

  const handleCopyNames = () => {
    navigator.clipboard.writeText(entries.map((e) => e.name).join("\n"));
    onClose();
  };

  const clipboard = useClipboardStore.getState();

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[200px] max-w-[280px] py-1.5 px-1 bg-bg-secondary/95 backdrop-blur-md border border-border rounded-xl shadow-2xl"
      style={{ left: x, top: y }}
    >
      {/* Remove tag (when in tag filter) */}
      {activeTagFilter !== null && (() => {
        const activeTag = allTags.find((t) => t.id === activeTagFilter);
        if (!activeTag) return null;
        return (
          <>
            <MenuItem
              icon={<Tag size={13} />}
              label={`Remove "${activeTag.name}" tag`}
              destructive
              onClick={() => {
                untagFiles(entries.map((e) => e.path), activeTagFilter).then(() => refreshDirectory?.());
                onClose();
              }}
            />
            <MenuSeparator />
          </>
        );
      })()}

      {/* Open / Preview */}
      {single && (
        <MenuItem
          icon={single.is_dir ? <FolderOpen size={13} /> : <Eye size={13} />}
          label={single.is_dir ? "Open" : "Preview"}
          onClick={() => { onOpen?.(); onClose(); }}
        />
      )}

      {/* Open in new window */}
      {single && !single.is_dir && previewableTypes.includes(fileType!) && (
        <MenuItem
          icon={<ExternalLink size={13} />}
          label="Open in New Window"
          onClick={() => { detachPreview(single.path, single.name, single.file_type); onClose(); }}
        />
      )}

      <MenuSeparator />

      {/* Copy operations */}
      <MenuItem
        icon={<Clipboard size={13} />}
        label={count > 1 ? `Copy ${count} Paths` : "Copy Path"}
        onClick={handleCopyPaths}
      />
      <MenuItem
        icon={<Copy size={13} />}
        label={count > 1 ? `Copy ${count} Names` : "Copy Name"}
        onClick={handleCopyNames}
      />

      <MenuSeparator />

      {/* File operations */}
      <MenuItem
        icon={<Copy size={13} />}
        label="Copy Files"
        onClick={() => {
          useClipboardStore.getState().setPaths(entries.map((e) => e.path), "copy");
          onClose();
        }}
      />
      <MenuItem
        icon={<Scissors size={13} />}
        label="Cut Files"
        onClick={() => {
          useClipboardStore.getState().setPaths(entries.map((e) => e.path), "cut");
          onClose();
        }}
      />
      {clipboard.paths.length > 0 && (
        <MenuItem
          icon={<ClipboardPaste size={13} />}
          label="Paste"
          onClick={async () => {
            const { paths, operation } = useClipboardStore.getState();
            const dest = currentPath;
            if (operation === "copy") await invoke("copy_items", { paths, destination: dest });
            else { await invoke("move_items", { paths, destination: dest }); useClipboardStore.getState().clear(); }
            refreshDirectory?.();
            onClose();
          }}
        />
      )}

      <MenuItem
        icon={<FolderPlus size={13} />}
        label="New Folder"
        onClick={async () => {
          const dest = currentPath;
          try { await invoke("create_folder", { path: `${dest}/untitled folder` }); }
          catch { for (let i = 2; i < 100; i++) { try { await invoke("create_folder", { path: `${dest}/untitled folder ${i}` }); break; } catch { continue; } } }
          refreshDirectory?.();
          onClose();
        }}
      />

      <MenuSeparator />

      {/* Tags submenu */}
      {allTags.length > 0 && (
        <SubMenu icon={<Tag size={13} />} label="Tags">
          {allTags.map((tag) => {
            const paths = entries.map((e) => e.path);
            const hasTag = paths.some((p) => fileTagMap.get(p)?.some((t) => t.id === tag.id));
            return (
              <button
                key={tag.id}
                onClick={() => {
                  if (hasTag) untagFiles(paths, tag.id);
                  else tagFiles(paths, tag.id);
                  onClose();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-[5px] text-left text-[var(--font-sm)] rounded-md hover:bg-bg-hover transition-colors"
              >
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                <span className="text-text-secondary flex-1">{tag.name}</span>
                {hasTag && <span className="text-accent text-[var(--font-xs)]">✓</span>}
              </button>
            );
          })}
        </SubMenu>
      )}

      <MenuSeparator />

      {/* Rename */}
      {single && (
        <MenuItem icon={<Pencil size={13} />} label="Rename" onClick={() => { onRename?.(); onClose(); }} />
      )}

      {/* Trash */}
      <MenuItem
        icon={<Trash2 size={13} />}
        label={count > 1 ? `Move ${count} Items to Trash` : "Move to Trash"}
        destructive
        onClick={handleTrash}
      />
    </div>
  );
}
