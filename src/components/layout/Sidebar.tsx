import { useState, useEffect } from "react";
import { Home, Download, FileText, Monitor, Folder } from "lucide-react";
import { clsx } from "clsx";
import { invoke } from "@tauri-apps/api/core";
import { useNavigationStore } from "../../stores/navigationStore";
import { useSettingsStore } from "../../stores/settingsStore";
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
            : "text-text hover:bg-bg-hover"
        )}
        style={{ paddingRight: "6px" }}
        onClick={() => onNavigate(entry.path)}
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
        <span className={clsx(
          "text-[12.5px] leading-tight truncate",
          isActive ? "font-semibold" : "text-text"
        )}>
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

export function Sidebar() {
  const currentPath = useNavigationStore((s) => s.currentPath);
  const navigateTo = useNavigationStore((s) => s.navigateTo);
  const settings = useSettingsStore((s) => s.settings);
  const [rootDirs, setRootDirs] = useState<FileEntry[]>([]);

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
    <aside className="h-full bg-bg-secondary flex flex-col overflow-hidden file-list-font">
      <div className="pt-4 px-4 pb-2">
        <h3 className="text-[10px] font-semibold text-text-muted uppercase tracking-widest mb-2">
          Favorites
        </h3>
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
                    : "text-text-secondary hover:bg-bg-hover"
                )}
              >
                <Icon size={15} strokeWidth={1.75} />
                <span className="text-[13px]">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="flex-1 overflow-auto px-4 pb-4">
        <h3 className="text-[10px] font-semibold text-text-muted uppercase tracking-widest mb-2 mt-3">
          Folders
        </h3>
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
    </aside>
  );
}
