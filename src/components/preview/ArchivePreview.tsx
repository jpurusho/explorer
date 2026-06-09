import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { File, Folder, Package } from "lucide-react";
import { clsx } from "clsx";

interface ArchiveEntry {
  name: string;
  size: number;
  compressed_size: number;
  is_dir: boolean;
}

interface ArchivePreviewProps {
  path: string;
  name: string;
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

export function ArchivePreview({ path }: ArchivePreviewProps) {
  const [entries, setEntries] = useState<ArchiveEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    invoke<ArchiveEntry[]>("list_archive_contents", { path })
      .then(setEntries)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [path]);

  const handleExtract = async () => {
    const dest = path.substring(0, path.lastIndexOf("/"));
    setExtracting(true);
    try {
      await invoke("extract_archive", { path, destination: dest });
    } catch (e) {
      setError(`Extract failed: ${e}`);
    }
    setExtracting(false);
  };

  const totalSize = entries.reduce((s, e) => s + e.size, 0);
  const fileCount = entries.filter((e) => !e.is_dir).length;
  const dirCount = entries.filter((e) => e.is_dir).length;

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <span className="text-[var(--font-sm)] text-text-muted">Reading archive...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center px-4">
        <span className="text-[var(--font-sm)] text-red-400">{error}</span>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-border/40 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Package size={16} className="text-amber-400" />
          <div>
            <p className="text-[var(--font-sm)] text-text-muted">
              {fileCount} files{dirCount > 0 ? `, ${dirCount} folders` : ""} — {formatSize(totalSize)}
            </p>
          </div>
        </div>
        <button
          onClick={handleExtract}
          disabled={extracting}
          className="px-3 py-1.5 rounded-lg text-[var(--font-xs)] font-medium bg-accent/12 text-accent hover:bg-accent/20 transition-colors disabled:opacity-50"
        >
          {extracting ? "Extracting..." : "Extract Here"}
        </button>
      </div>

      {/* File list */}
      <div className="flex-1 overflow-auto px-2 py-1">
        {entries.map((entry, i) => (
          <div
            key={i}
            className={clsx(
              "flex items-center gap-2.5 px-3 py-[5px] rounded-md text-[var(--font-sm)]",
              entry.is_dir ? "text-text-secondary" : "text-text-muted"
            )}
          >
            {entry.is_dir ? (
              <Folder size={13} className="text-folder shrink-0" />
            ) : (
              <File size={13} className="text-text-muted/60 shrink-0" />
            )}
            <span className="flex-1 truncate">{entry.name}</span>
            {!entry.is_dir && (
              <span className="text-[var(--font-xs)] text-text-muted/50 tabular-nums shrink-0">
                {formatSize(entry.size)}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
