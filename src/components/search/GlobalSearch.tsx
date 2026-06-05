import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Search, Folder, File, X } from "lucide-react";
import { clsx } from "clsx";
import { useNavigationStore } from "../../stores/navigationStore";
import { useFileListStore } from "../../stores/fileListStore";

interface FileResult {
  path: string;
  name: string;
  size_bytes: number;
  modified_at: number;
  is_dir: boolean;
}

interface GlobalSearchProps {
  visible: boolean;
  onClose: () => void;
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

function getParentPath(path: string): string {
  const parts = path.split("/");
  parts.pop();
  const parent = parts.slice(-2).join("/");
  return parent || "/";
}

export function GlobalSearch({ visible, onClose }: GlobalSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FileResult[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigateTo = useNavigationStore((s) => s.navigateTo);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      inputRef.current?.focus();
      setQuery("");
      setResults([]);
      setSelectedIdx(0);
    }
  }, [visible]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await invoke<FileResult[]>("search_files", { query: query.trim(), limit: 50 });
        setResults(res);
        setSelectedIdx(0);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 200);
  }, [query]);

  const handleSelect = (result: FileResult) => {
    if (result.is_dir) {
      navigateTo(result.path);
    } else {
      const parent = result.path.split("/").slice(0, -1).join("/");
      navigateTo(parent);
      // Select the file after directory loads
      setTimeout(() => {
        const store = useFileListStore.getState();
        const idx = store.visibleEntries.findIndex((e) => e.path === result.path);
        if (idx >= 0) store.selectIndex(idx);
      }, 300);
    }
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[selectedIdx]) {
        handleSelect(results[selectedIdx]);
      }
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-[600px] max-h-[60vh] bg-bg border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
          <Search size={18} className="text-text-muted shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search files and folders..."
            className="flex-1 bg-transparent outline-none text-text text-[16px] placeholder:text-text-muted/50"
          />
          {query && (
            <button onClick={() => setQuery("")} className="text-text-muted hover:text-text">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Results */}
        <div className="flex-1 overflow-auto">
          {loading && results.length === 0 && (
            <div className="px-5 py-8 text-center text-text-muted text-[13px]">Searching...</div>
          )}

          {!loading && query && results.length === 0 && (
            <div className="px-5 py-8 text-center text-text-muted text-[13px]">No results found</div>
          )}

          {!query && (
            <div className="px-5 py-8 text-center text-text-muted text-[13px]">
              Type to search across all indexed files
            </div>
          )}

          {results.map((result, idx) => (
            <button
              key={result.path}
              onClick={() => handleSelect(result)}
              onMouseEnter={() => setSelectedIdx(idx)}
              className={clsx(
                "w-full flex items-center gap-3 px-5 py-2.5 text-left transition-colors",
                idx === selectedIdx ? "bg-accent/10" : "hover:bg-bg-hover"
              )}
            >
              {result.is_dir ? (
                <Folder size={16} className="text-folder shrink-0" />
              ) : (
                <File size={16} className="text-text-muted shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-[14px] text-text truncate font-medium">
                  {result.name}
                </div>
                <div className="text-[11px] text-text-muted truncate">
                  {getParentPath(result.path)}
                </div>
              </div>
              {!result.is_dir && result.size_bytes > 0 && (
                <span className="text-[11px] text-text-muted tabular-nums shrink-0">
                  {formatSize(result.size_bytes)}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-2 border-t border-border flex items-center gap-4 text-[11px] text-text-muted">
          <span>↑↓ Navigate</span>
          <span>↵ Open</span>
          <span>Esc Close</span>
        </div>
      </div>
    </div>
  );
}
