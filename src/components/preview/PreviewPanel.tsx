import { useEffect, useRef, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useFileListStore } from "../../stores/fileListStore";
import { usePreviewNavStore } from "../../stores/previewNavStore";
import { ImagePreview } from "./ImagePreview";
import { VideoPreview } from "./VideoPreview";
import { AudioPreview } from "./AudioPreview";
import { MarkdownPreview } from "./MarkdownPreview";
import { JsonPreview } from "./JsonPreview";
import { YamlPreview } from "./YamlPreview";
import { PdfPreview } from "./PdfPreview";
import { Editor } from "../editor/Editor";
import { FileText, Eye, Pencil, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";
import { clsx } from "clsx";
import { format } from "date-fns";
import { detachPreview } from "../../lib/detachPreview";
import { fetchFileContent, prefetchFileContent } from "../../lib/previewCache";
import type { FileContent, FileEntry, FileType } from "../../types";

function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

const editableTypes: FileType[] = ["text", "code", "markdown", "json", "yaml", "unknown"];
const renderableTypes: FileType[] = ["markdown", "json", "yaml"];

const DEBOUNCE_MS = 80;

export function PreviewPanel() {
  const selectedPath = useFileListStore((s) => s.selectedPath);
  const visibleEntries = useFileListStore((s) => s.visibleEntries);
  const selectedIndex = useFileListStore((s) => s.selectedIndex);
  const [content, setContent] = useState<FileContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);

  // Preview navigation for following links within documents
  const previewNav = usePreviewNavStore();
  const [navContent, setNavContent] = useState<string | null>(null);
  const [navPath, setNavPath] = useState<string | null>(null);

  // Ref to track the latest request and cancel stale ones
  const requestIdRef = useRef(0);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [resolvedEntry, setResolvedEntry] = useState<FileEntry | null>(null);
  const listEntry = visibleEntries[selectedIndex];
  const entry = listEntry || resolvedEntry;
  const fileType = entry?.file_type as FileType | undefined;
  const hasRenderedView = fileType ? renderableTypes.includes(fileType) : false;

  // When selectedPath doesn't match a visibleEntries item (e.g. column view),
  // fetch metadata directly
  useEffect(() => {
    if (listEntry || !selectedPath) {
      setResolvedEntry(null);
      return;
    }
    invoke<FileEntry[]>("get_file_entries", { paths: [selectedPath] })
      .then((entries) => { if (entries[0]) setResolvedEntry(entries[0]); })
      .catch(() => setResolvedEntry(null));
  }, [selectedPath, listEntry]);

  // Reset preview nav when a different file is selected from the file list
  useEffect(() => {
    if (selectedPath) {
      previewNav.reset(selectedPath);
      setNavContent(null);
      setNavPath(null);
    }
  }, [selectedPath]);

  const handleLinkNavigate = useCallback(async (targetPath: string) => {
    console.log("[PreviewNav] Navigating to:", targetPath);
    try {
      const result = await fetchFileContent(targetPath);
      console.log("[PreviewNav] Loaded content, length:", result.content.length);
      usePreviewNavStore.getState().pushPath(targetPath);
      setNavContent(result.content);
      setNavPath(targetPath);
    } catch (err) {
      console.warn("[PreviewNav] Failed to load:", targetPath, err);
    }
  }, []);

  const handleGoBack = useCallback(async () => {
    const path = previewNav.goBack();
    if (!path) return;
    if (path === selectedPath) {
      setNavContent(null);
      setNavPath(null);
      return;
    }
    try {
      const result = await fetchFileContent(path);
      if (result) {
        setNavContent(result.content);
        setNavPath(path);
      }
    } catch {}
  }, [previewNav, selectedPath]);

  const handleGoForward = useCallback(async () => {
    const path = previewNav.goForward();
    if (!path) return;
    if (path === selectedPath) {
      setNavContent(null);
      setNavPath(null);
      return;
    }
    try {
      const result = await fetchFileContent(path);
      if (result) {
        setNavContent(result.content);
        setNavPath(path);
      }
    } catch {}
  }, [previewNav, selectedPath]);

  useEffect(() => {
    // Cancel any pending debounce timer
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    if (!selectedPath || !entry || entry.is_dir) {
      setContent(null);
      return;
    }

    // Default to rendered view for markdown/json/yaml
    if (fileType && renderableTypes.includes(fileType)) {
      setEditMode(false);
    } else {
      setEditMode(true);
    }

    if (!fileType || !editableTypes.includes(fileType)) {
      setContent(null);
      return;
    }

    // Increment request ID to invalidate any in-flight request
    const currentRequestId = ++requestIdRef.current;
    const pathToLoad = selectedPath;
    const currentIndex = selectedIndex;

    // Debounce the actual fetch to avoid loading every intermediate file
    // when arrowing quickly through the list
    debounceTimerRef.current = setTimeout(() => {
      setLoading(true);

      fetchFileContent(pathToLoad)
        .then((result) => {
          // Only apply if this is still the latest request
          if (requestIdRef.current === currentRequestId) {
            setContent(result);
          }
        })
        .catch(() => {
          if (requestIdRef.current === currentRequestId) {
            setContent(null);
          }
        })
        .finally(() => {
          if (requestIdRef.current === currentRequestId) {
            setLoading(false);
          }
        });

      // Prefetch adjacent files after the primary content loads
      const prevEntry = visibleEntries[currentIndex - 1];
      const nextEntry = visibleEntries[currentIndex + 1];

      if (prevEntry && !prevEntry.is_dir && editableTypes.includes(prevEntry.file_type as FileType)) {
        prefetchFileContent(prevEntry.path);
      }
      if (nextEntry && !nextEntry.is_dir && editableTypes.includes(nextEntry.file_type as FileType)) {
        prefetchFileContent(nextEntry.path);
      }
    }, DEBOUNCE_MS);

    return () => {
      // Cleanup: cancel debounce timer on unmount or dependency change
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [selectedPath, selectedIndex, entry, fileType, visibleEntries]);

  if (!entry || entry.is_dir) {
    return (
      <div className="h-full bg-bg flex items-center justify-center">
        <div className="text-center text-text-muted px-6">
          <FileText size={28} className="mx-auto mb-2 opacity-30" strokeWidth={1.5} />
          <p className="text-[var(--font-sm)]">Select a file to preview</p>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    // If following a linked document, show that regardless of original file type
    if (isFollowingLink && navContent) {
      return <MarkdownPreview content={navContent} basePath={navPath!} onNavigate={handleLinkNavigate} />;
    }

    if (fileType === "image") {
      return <ImagePreview path={entry.path} name={entry.name} />;
    }

    if (fileType === "video") {
      return <VideoPreview path={entry.path} name={entry.name} />;
    }

    if (fileType === "audio") {
      return <AudioPreview path={entry.path} name={entry.name} />;
    }

    if (fileType === "document" && entry.name.toLowerCase().endsWith(".pdf")) {
      return <PdfPreview path={entry.path} />;
    }

    if (loading) {
      return (
        <div className="flex items-center justify-center h-full">
          <span className="text-[var(--font-sm)] text-text-muted">Loading...</span>
        </div>
      );
    }

    if (!content) {
      return (
        <div className="flex items-center justify-center h-full px-4">
          <span className="text-[var(--font-sm)] text-text-muted">No preview available</span>
        </div>
      );
    }

    // Rendered view for markdown/json/yaml
    if (!editMode && hasRenderedView) {
      if (fileType === "markdown") {
        return <MarkdownPreview content={content.content} basePath={entry.path} onNavigate={handleLinkNavigate} />;
      }
      if (fileType === "json") {
        return <JsonPreview content={content.content} />;
      }
      if (fileType === "yaml") {
        return <YamlPreview content={content.content} />;
      }
    }

    // Editor for all editable types
    if (fileType && editableTypes.includes(fileType)) {
      return (
        <Editor
          path={entry.path}
          content={content.content}
          fileType={entry.file_type}
          fileName={entry.name}
        />
      );
    }

    return null;
  };

  const isFollowingLink = navContent !== null && navPath !== null && navPath !== selectedPath;
  const displayName = isFollowingLink ? navPath!.split("/").pop() || "" : entry.name;

  return (
    <div className="h-full bg-bg flex flex-col overflow-hidden">
      {/* File info header */}
      <div className="border-b border-border shrink-0 bg-bg-secondary/60" style={{ padding: "10px var(--panel-px)" }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 flex-1 min-w-0 mr-4">
            {/* Back/Forward buttons for preview navigation */}
            {previewNav.canGoBack() && (
              <button
                onClick={handleGoBack}
                className="p-1 rounded-[4px] transition-colors text-text-muted hover:bg-bg-hover hover:text-text-secondary shrink-0"
                title="Back"
              >
                <ChevronLeft size={14} />
              </button>
            )}
            {previewNav.canGoForward() && (
              <button
                onClick={handleGoForward}
                className="p-1 rounded-[4px] transition-colors text-text-muted hover:bg-bg-hover hover:text-text-secondary shrink-0"
                title="Forward"
              >
                <ChevronRight size={14} />
              </button>
            )}
            <p className="font-medium text-text truncate" style={{ fontSize: "var(--font-preview-title)" }}>{displayName}</p>
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            {/* View/Edit toggle for renderable files */}
            {hasRenderedView && content && !isFollowingLink && (
              <>
                <button
                  onClick={() => setEditMode(false)}
                  className={clsx(
                    "p-1.5 rounded-[4px] transition-colors",
                    !editMode
                      ? "bg-accent/12 text-accent"
                      : "text-text-muted hover:bg-bg-hover hover:text-text-secondary"
                  )}
                  title="Rendered view"
                >
                  <Eye size={13} />
                </button>
                <button
                  onClick={() => setEditMode(true)}
                  className={clsx(
                    "p-1.5 rounded-[4px] transition-colors",
                    editMode
                      ? "bg-accent/12 text-accent"
                      : "text-text-muted hover:bg-bg-hover hover:text-text-secondary"
                  )}
                  title="Edit"
                >
                  <Pencil size={13} />
                </button>
              </>
            )}
            {/* Detach to floating window */}
            <button
              onClick={() => detachPreview(entry.path, entry.name, entry.file_type)}
              className="p-1.5 rounded-[4px] transition-colors text-text-muted hover:bg-bg-hover hover:text-text-secondary ml-1"
              title="Open in new window"
            >
              <ExternalLink size={13} />
            </button>
          </div>
        </div>
        {isFollowingLink ? (
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-[var(--font-xs)] text-text-muted truncate">{navPath}</span>
          </div>
        ) : (
          <div className="flex items-center gap-3 mt-1.5">
            <span className="text-[var(--font-sm)] text-text-muted tabular-nums">
              {formatSize(entry.size)}
            </span>
            {entry.modified && (
              <span className="text-[var(--font-sm)] text-text-muted">
                {(() => { try { return format(new Date(entry.modified), "MMM d, yyyy"); } catch { return ""; } })()}
              </span>
            )}
            <span className={clsx(
              "text-[var(--font-xs)] px-2 py-[2px] rounded-full uppercase tracking-wide font-medium",
              "bg-bg-tertiary text-text-muted"
            )}>
              {entry.file_type}
            </span>
          </div>
        )}
      </div>

      {/* Preview/editor content */}
      <div className="flex-1 min-h-0 select-text">
        {renderContent()}
      </div>
    </div>
  );
}
