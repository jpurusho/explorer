import { useMemo, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getVersion } from "@tauri-apps/api/app";
import { check, type Update, type DownloadEvent } from "@tauri-apps/plugin-updater";
import { useFileListStore } from "../../stores/fileListStore";
import { useNavigationStore } from "../../stores/navigationStore";
import { Folder, File, Eye, GitBranch, Download } from "lucide-react";

interface GitStatus {
  is_repo: boolean;
  branch: string;
  changed: number;
  staged: number;
  untracked: number;
  ahead: number;
  behind: number;
}

function formatTotalSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

export function StatusBar() {
  const visibleEntries = useFileListStore((s) => s.visibleEntries);
  const selectedIndex = useFileListStore((s) => s.selectedIndex);
  const selectedIndices = useFileListStore((s) => s.selectedIndices);
  const currentPath = useNavigationStore((s) => s.currentPath);
  const showHiddenFiles = useFileListStore((s) => s.showHiddenFiles);
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);
  const [indexing, setIndexing] = useState(false);
  const [indexedCount, setIndexedCount] = useState(0);
  const [appVersion, setAppVersion] = useState("");
  const [updateAvailable, setUpdateAvailable] = useState<Update | null>(null);
  const [updateProgress, setUpdateProgress] = useState<number | null>(null);

  useEffect(() => {
    getVersion().then(setAppVersion).catch(() => setAppVersion("0.0.0"));
    const timer = setTimeout(() => {
      check().then((update) => {
        if (update) setUpdateAvailable(update);
      }).catch(() => {});
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!currentPath) return;
    invoke<GitStatus>("get_git_status", { path: currentPath })
      .then(setGitStatus)
      .catch(() => setGitStatus(null));
  }, [currentPath]);

  // Poll indexing status + file count
  useEffect(() => {
    const check = () => {
      invoke<boolean>("is_indexing").then(setIndexing).catch(() => {});
      invoke<any>("get_index_stats").then((s) => {
        if (s) setIndexedCount(s.file_count + s.dir_count);
      }).catch(() => {});
    };
    check();
    const interval = setInterval(check, 2000);
    return () => clearInterval(interval);
  }, []);

  const stats = useMemo(() => {
    const folders = visibleEntries.filter((e) => e.is_dir).length;
    const files = visibleEntries.filter((e) => !e.is_dir).length;
    const totalSize = visibleEntries.reduce((sum, e) => sum + (e.is_dir ? 0 : e.size), 0);
    return { folders, files, totalSize };
  }, [visibleEntries]);

  const selectedEntry = visibleEntries[selectedIndex];
  const currentFolder = currentPath.split("/").pop() || "/";

  return (
    <div className="h-[var(--statusbar-height)] bg-bg-secondary/80 backdrop-blur-xl border-t border-border flex items-center gap-3 overflow-hidden" style={{ fontSize: "var(--font-statusbar-text)", padding: "0 var(--panel-px)" }}>
      {/* Current location */}
      <div className="flex items-center gap-1.5 text-text-secondary min-w-0 shrink">
        <Folder size={12} className="text-folder shrink-0" />
        <span className="truncate font-medium">{currentFolder}</span>
      </div>

      {/* Separator */}
      <div className="w-[1px] h-3.5 bg-border shrink-0" />

      {/* File stats */}
      <div className="flex items-center gap-3 text-text-muted shrink-0">
        <span className="flex items-center gap-1">
          <Folder size={11} className="text-folder" />
          <span className="tabular-nums">{stats.folders}</span>
        </span>
        <span className="flex items-center gap-1">
          <File size={11} />
          <span className="tabular-nums">{stats.files}</span>
        </span>
        <span className="tabular-nums">{formatTotalSize(stats.totalSize)}</span>
      </div>

      {/* Hidden files indicator */}
      {showHiddenFiles && (
        <>
          <div className="w-[1px] h-3.5 bg-border shrink-0" />
          <span className="flex items-center gap-1 text-accent shrink-0">
            <Eye size={11} />
            <span>Hidden</span>
          </span>
        </>
      )}

      {/* Git status */}
      {gitStatus?.is_repo && (
        <>
          <div className="w-[1px] h-3.5 bg-border shrink-0" />
          <div className="flex items-center gap-2 shrink-0">
            <span className="flex items-center gap-1 text-accent">
              <GitBranch size={11} />
              <span className="font-medium">{gitStatus.branch}</span>
            </span>
            {gitStatus.changed > 0 && (
              <span className="text-amber-400 tabular-nums">~{gitStatus.changed}</span>
            )}
            {gitStatus.staged > 0 && (
              <span className="text-green-400 tabular-nums">+{gitStatus.staged}</span>
            )}
            {gitStatus.untracked > 0 && (
              <span className="text-text-muted tabular-nums">?{gitStatus.untracked}</span>
            )}
          </div>
        </>
      )}

      {/* Indexing indicator */}
      {indexing && (
        <>
          <div className="w-[1px] h-3.5 bg-border shrink-0" />
          <span className="flex items-center gap-1.5 text-accent shrink-0 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-accent" />
            <span>Indexing... {indexedCount > 0 ? indexedCount.toLocaleString() + " files" : ""}</span>
          </span>
        </>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Selected file info */}
      {selectedIndices.size > 1 ? (
        <div className="flex items-center gap-2 text-accent min-w-0">
          <span className="tabular-nums font-medium">{selectedIndices.size} items selected</span>
          <span className="text-text-muted/60 shrink-0 tabular-nums whitespace-nowrap">
            {formatTotalSize(
              [...selectedIndices].reduce((sum, i) => sum + (visibleEntries[i]?.is_dir ? 0 : visibleEntries[i]?.size ?? 0), 0)
            )}
          </span>
        </div>
      ) : selectedEntry ? (
        <div className="flex items-center gap-2 text-text-muted min-w-0 overflow-hidden">
          <span className="truncate">{selectedEntry.name}</span>
          {!selectedEntry.is_dir && (
            <span className="text-text-muted/60 shrink-0 tabular-nums whitespace-nowrap">
              {formatTotalSize(selectedEntry.size)}
            </span>
          )}
        </div>
      ) : null}

      {/* Version badge */}
      {appVersion && (
        <>
          <div className="w-[1px] h-3.5 bg-border shrink-0" />
          {updateAvailable ? (
            <button
              onClick={async () => {
                if (updateProgress !== null) return;
                setUpdateProgress(0);
                let total = 0, downloaded = 0;
                await updateAvailable.downloadAndInstall((event: DownloadEvent) => {
                  if (event.event === "Started") total = event.data.contentLength ?? 0;
                  else if (event.event === "Progress") {
                    downloaded += event.data.chunkLength;
                    if (total > 0) setUpdateProgress(Math.round((downloaded / total) * 100));
                  }
                });
                import("@tauri-apps/plugin-process").then(({ relaunch }) => relaunch()).catch(() => {});
              }}
              className="flex items-center gap-1.5 shrink-0 px-2 py-0.5 rounded-md text-amber-400 animate-pulse hover:bg-amber-400/10 transition-colors"
              title={`Current: v${appVersion} — Click to update`}
            >
              {updateProgress !== null ? (
                <span className="tabular-nums">{updateProgress}%</span>
              ) : (
                <>
                  <Download size={10} />
                  <span className="font-medium">v{updateAvailable.version}</span>
                </>
              )}
            </button>
          ) : (
            <span className="text-text-muted/60 shrink-0 tabular-nums">v{appVersion}</span>
          )}
        </>
      )}
    </div>
  );
}
