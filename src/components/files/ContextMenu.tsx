import { useEffect, useRef, useCallback } from "react";
import {
  ExternalLink,
  Copy,
  CopyPlus,
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
  Undo2,
} from "lucide-react";
import { clsx } from "clsx";
import { detachPreview } from "../../lib/detachPreview";
import { useNavigationStore } from "../../stores/navigationStore";
import { useTagStore } from "../../stores/tagStore";
import { useClipboardStore } from "../../stores/clipboardStore";
import { useUndoStore } from "../../stores/undoStore";
import { fileActions } from "../../hooks/useFileActions";
import { previewableTypes } from "../preview/previewTypes";
import type { FileEntry, FileType } from "../../types";

interface ContextMenuProps {
  x: number;
  y: number;
  entries: FileEntry[];
  onClose: () => void;
  onOpen?: () => void;
  onRename?: () => void;
}

interface MenuItemProps {
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  onClick: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

function MenuItem({ icon, label, shortcut, onClick, destructive, disabled }: MenuItemProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      data-menu-item
      className={clsx(
        "w-full flex items-center gap-2.5 pl-3 pr-4 py-[6px] text-left rounded-md transition-colors outline-none",
        "text-[var(--font-sm)]",
        disabled && "opacity-40 cursor-not-allowed",
        !disabled && "hover:bg-accent/10 focus:bg-accent/10",
        destructive && !disabled && "hover:bg-red-500/10 focus:bg-red-500/10"
      )}
    >
      <span className={clsx("shrink-0", destructive ? "text-red-400" : "text-text-muted")}>{icon}</span>
      <span className={clsx("flex-1 min-w-0 truncate", destructive ? "text-red-400" : "text-text-secondary")}>{label}</span>
      {shortcut && (
        <span className="text-[var(--font-xs)] text-text-muted/40 font-mono shrink-0 whitespace-nowrap pl-2">{shortcut}</span>
      )}
    </button>
  );
}

function MenuSeparator() {
  return <div className="h-[1px] bg-border/40 my-1 mx-3" />;
}

function SubMenu({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const subRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (subRef.current) subRef.current.style.display = "block";
  };

  const hide = () => {
    timerRef.current = setTimeout(() => {
      if (subRef.current) subRef.current.style.display = "none";
    }, 150);
  };

  useEffect(() => {
    if (!subRef.current || !ref.current) return;
    const parentRect = ref.current.getBoundingClientRect();
    const sub = subRef.current;
    sub.style.display = "none";

    const reposition = () => {
      if (sub.style.display === "none") return;
      const rect = sub.getBoundingClientRect();
      const vw = window.innerWidth;
      if (parentRect.right + rect.width > vw - 8) {
        sub.style.left = "auto";
        sub.style.right = "100%";
        sub.style.marginLeft = "0";
        sub.style.marginRight = "4px";
      }
    };

    const observer = new MutationObserver(reposition);
    observer.observe(sub, { attributes: true, attributeFilter: ["style"] });
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="relative" onMouseEnter={show} onMouseLeave={hide}>
      <button
        data-menu-item
        className="w-full flex items-center gap-2.5 pl-3 pr-4 py-[6px] text-left text-[var(--font-sm)] rounded-md hover:bg-accent/10 focus:bg-accent/10 transition-colors outline-none"
        onFocus={show}
        onBlur={hide}
      >
        <span className="text-text-muted shrink-0">{icon}</span>
        <span className="text-text-secondary flex-1 min-w-0 truncate">{label}</span>
        <ChevronRight size={11} className="text-text-muted/50 shrink-0" />
      </button>
      <div
        ref={subRef}
        onMouseEnter={show}
        onMouseLeave={hide}
        className="absolute left-full top-0 ml-1 min-w-[160px] py-1.5 px-1 bg-bg-secondary/95 backdrop-blur-xl border border-border/60 rounded-xl shadow-2xl z-[60]"
      >
        {children}
      </div>
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

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") { onClose(); return; }

    const menu = menuRef.current;
    if (!menu) return;
    const items = Array.from(menu.querySelectorAll("[data-menu-item]:not(:disabled)")) as HTMLElement[];
    const active = document.activeElement as HTMLElement;
    const idx = items.indexOf(active);

    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = idx < items.length - 1 ? idx + 1 : 0;
      items[next]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev = idx > 0 ? idx - 1 : items.length - 1;
      items[prev]?.focus();
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (active && items.includes(active)) active.click();
    }
  }, [onClose]);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Position adjustment + focus first item
  useEffect(() => {
    if (!menuRef.current) return;
    const menu = menuRef.current;
    const rect = menu.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (rect.right > vw - 8) menu.style.left = `${Math.max(8, x - rect.width)}px`;
    if (rect.bottom > vh - 8) menu.style.top = `${Math.max(8, y - rect.height)}px`;

    // Focus first item after paint
    requestAnimationFrame(() => {
      const first = menu.querySelector("[data-menu-item]:not(:disabled)") as HTMLElement;
      first?.focus();
    });
  }, [x, y]);

  const handleTrash = () => {
    fileActions.trash(entries.map((e) => e.path));
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
  const hasItems = count > 0;

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[240px] max-w-[320px] py-1.5 px-1.5 bg-bg-secondary/95 backdrop-blur-xl border border-border/60 rounded-xl shadow-2xl"
      style={{ left: x, top: y }}
      role="menu"
    >
      {/* Remove tag (when in tag filter) */}
      {hasItems && activeTagFilter !== null && (() => {
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
          shortcut="↵"
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

      {/* Copy operations (item-specific) */}
      {hasItems && (
        <>
          <MenuSeparator />
          <MenuItem
            icon={<Clipboard size={13} />}
            label={count > 1 ? `Copy ${count} Paths` : "Copy Path"}
            shortcut="⌥⌘C"
            onClick={handleCopyPaths}
          />
          <MenuItem
            icon={<Copy size={13} />}
            label={count > 1 ? `Copy ${count} Names` : "Copy Name"}
            onClick={handleCopyNames}
          />
        </>
      )}

      <MenuSeparator />

      {/* File operations */}
      {hasItems && (
        <>
          <MenuItem
            icon={<Copy size={13} />}
            label="Copy"
            shortcut="⌘C"
            onClick={() => {
              fileActions.copy(entries.map((e) => e.path));
              onClose();
            }}
          />
          <MenuItem
            icon={<Scissors size={13} />}
            label="Cut"
            shortcut="⌘X"
            onClick={() => {
              fileActions.cut(entries.map((e) => e.path));
              onClose();
            }}
          />
        </>
      )}
      <MenuItem
        icon={<ClipboardPaste size={13} />}
        label="Paste"
        shortcut="⌘V"
        disabled={clipboard.paths.length === 0}
        onClick={() => {
          fileActions.paste(currentPath);
          onClose();
        }}
      />

      {hasItems && (
        <MenuItem
          icon={<CopyPlus size={13} />}
          label="Duplicate"
          shortcut="⌘D"
          onClick={() => {
            fileActions.duplicate(entries.map((e) => e.path));
            onClose();
          }}
        />
      )}

      <MenuItem
        icon={<FolderPlus size={13} />}
        label="New Folder"
        shortcut="⇧⌘N"
        onClick={() => {
          fileActions.newFolder(currentPath);
          onClose();
        }}
      />

      <MenuItem
        icon={<Undo2 size={13} />}
        label="Undo"
        shortcut="⌘Z"
        disabled={!useUndoStore.getState().canUndo()}
        onClick={() => {
          fileActions.undo();
          onClose();
        }}
      />

      <MenuSeparator />

      {/* Tags submenu */}
      {hasItems && allTags.length > 0 && (
        <SubMenu icon={<Tag size={13} />} label="Tags">
          {allTags.map((tag) => {
            const paths = entries.map((e) => e.path);
            const hasTag = paths.some((p) => fileTagMap.get(p)?.some((t) => t.id === tag.id));
            return (
              <button
                key={tag.id}
                data-menu-item
                onClick={() => {
                  if (hasTag) untagFiles(paths, tag.id);
                  else tagFiles(paths, tag.id);
                  onClose();
                }}
                className="w-full flex items-center gap-2.5 pl-3 pr-4 py-[5px] text-left text-[var(--font-sm)] rounded-md hover:bg-accent/10 focus:bg-accent/10 transition-colors outline-none"
              >
                <div className="w-2.5 h-2.5 rounded-full shrink-0 ring-1 ring-inset ring-white/10" style={{ backgroundColor: tag.color }} />
                <span className="text-text-secondary flex-1">{tag.name}</span>
                {hasTag && <span className="text-accent font-medium">✓</span>}
              </button>
            );
          })}
        </SubMenu>
      )}

      {/* Rename */}
      {single && (
        <>
          <MenuSeparator />
          <MenuItem
            icon={<Pencil size={13} />}
            label="Rename"
            shortcut="↵"
            onClick={() => { onRename?.(); onClose(); }}
          />
        </>
      )}

      {/* Trash */}
      {hasItems && (
        <MenuItem
          icon={<Trash2 size={13} />}
          label={count > 1 ? `Move ${count} Items to Trash` : "Move to Trash"}
          shortcut="⌘⌫"
          destructive
          onClick={handleTrash}
        />
      )}
    </div>
  );
}
