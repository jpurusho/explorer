import { useState, useEffect, useRef, useCallback } from "react";
import { clsx } from "clsx";
import { invoke } from "@tauri-apps/api/core";
import { FileIcon } from "./FileIcon";
import { Folder, Play, ExternalLink } from "lucide-react";
import { detachPreview } from "../../lib/detachPreview";
import { formatSize, formatDuration } from "../../lib/formatters";
import { getThumbnail, setThumbnail } from "../../lib/thumbnailCache";
import type { FileEntry, FileType, FileContent } from "../../types";

interface FileCardProps {
  entry: FileEntry;
  selected: boolean;
  onClick: (e: React.MouseEvent) => void;
  onDoubleClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onFileDrop?: (paths: string[]) => void;
}

function ImageThumbnail({ path }: { path: string }) {
  const [src, setSrc] = useState<string | null>(() => getThumbnail(path) ?? null);

  useEffect(() => {
    if (getThumbnail(path)) {
      setSrc(getThumbnail(path)!);
      return;
    }
    let cancelled = false;
    invoke<string>("generate_thumbnail", { path, size: 300 }).then((base64) => {
      if (cancelled) return;
      const dataUrl = `data:image/jpeg;base64,${base64}`;
      setThumbnail(path, dataUrl);
      setSrc(dataUrl);
    }).catch(() => {
      invoke<string>("read_image_base64", { path }).then((base64) => {
        if (cancelled) return;
        const ext = path.split(".").pop()?.toLowerCase() || "png";
        const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg"
          : ext === "gif" ? "image/gif"
          : ext === "webp" ? "image/webp"
          : ext === "svg" ? "image/svg+xml"
          : "image/png";
        const dataUrl = `data:${mime};base64,${base64}`;
        setThumbnail(path, dataUrl);
        setSrc(dataUrl);
      }).catch(() => {});
    });
    return () => { cancelled = true; };
  }, [path]);

  if (!src) {
    return (
      <div className="w-full h-32 bg-bg-tertiary flex items-center justify-center">
        <span className="text-text-muted text-[var(--font-xs)]">Loading...</span>
      </div>
    );
  }

  return (
    <div className="w-full h-32 bg-bg-tertiary overflow-hidden flex items-center justify-center">
      <img src={src} alt="" className="w-full h-full object-cover" />
    </div>
  );
}

function isFrameBlack(ctx: CanvasRenderingContext2D, width: number, height: number): boolean {
  const data = ctx.getImageData(0, 0, width, height).data;
  const sampleSize = Math.min(1000, (width * height));
  const step = Math.floor((width * height) / sampleSize) * 4;
  let totalBrightness = 0;
  let samples = 0;
  for (let i = 0; i < data.length; i += step) {
    totalBrightness += (data[i] + data[i + 1] + data[i + 2]) / 3;
    samples++;
  }
  return samples > 0 && (totalBrightness / samples) < 15;
}

const videoThumbnailCache = new Map<string, { poster: string; duration: number }>();
const VIDEO_CACHE_MAX = 200;

function evictOldestFromCache() {
  if (videoThumbnailCache.size > VIDEO_CACHE_MAX) {
    const firstKey = videoThumbnailCache.keys().next().value;
    if (firstKey) videoThumbnailCache.delete(firstKey);
  }
}

function VideoThumbnail({ path, onDuration }: { path: string; onDuration: (d: number) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [posterSrc, setPosterSrc] = useState<string | null>(() => {
    const cached = videoThumbnailCache.get(path);
    if (cached) {
      onDuration(cached.duration);
      return cached.poster;
    }
    return null;
  });

  useEffect(() => {
    if (videoThumbnailCache.has(path)) return;

    const video = videoRef.current;
    if (!video) return;
    let done = false;
    let seekAttempt = 0;
    const seekPositions = [0.1, 0.25, 0.4, 0.6, 0.75];

    const handleLoaded = () => {
      if (video.duration) {
        onDuration(video.duration);
        seekToNext();
      }
    };

    const seekToNext = () => {
      if (done || seekAttempt >= seekPositions.length) {
        if (!done) captureFrame(true);
        return;
      }
      const pos = seekPositions[seekAttempt];
      video.currentTime = Math.max(pos * video.duration, 0.5);
    };

    const captureFrame = (force: boolean) => {
      const canvas = canvasRef.current;
      if (!canvas || !video || done) return;
      canvas.width = video.videoWidth || 320;
      canvas.height = video.videoHeight || 180;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      if (!force && isFrameBlack(ctx, canvas.width, canvas.height)) {
        seekAttempt++;
        seekToNext();
        return;
      }

      done = true;
      const dataUrl = canvas.toDataURL("image/jpeg", 0.75);
      setPosterSrc(dataUrl);
      evictOldestFromCache();
      videoThumbnailCache.set(path, { poster: dataUrl, duration: video.duration });
    };

    const handleSeeked = () => {
      captureFrame(false);
    };

    video.addEventListener("loadedmetadata", handleLoaded);
    video.addEventListener("seeked", handleSeeked);

    return () => {
      done = true;
      video.removeEventListener("loadedmetadata", handleLoaded);
      video.removeEventListener("seeked", handleSeeked);
    };
  }, [path]);

  const mediaUrl = `media://localhost/${encodeURIComponent(path)}`;

  return (
    <div className="w-full h-32 bg-black/60 overflow-hidden flex items-center justify-center relative">
      {posterSrc ? (
        <img src={posterSrc} alt="" className="w-full h-full object-cover" />
      ) : (
        <div className="text-text-muted text-[var(--font-xs)]">Loading...</div>
      )}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center">
          <Play size={14} className="text-white ml-0.5" fill="white" />
        </div>
      </div>
      {!videoThumbnailCache.has(path) && (
        <>
          <video
            ref={videoRef}
            src={mediaUrl}
            preload="metadata"
            muted
            className="hidden"
          />
          <canvas ref={canvasRef} className="hidden" />
        </>
      )}
    </div>
  );
}

const TEXT_PREVIEWABLE: Set<FileType> = new Set(["code", "text", "markdown", "json", "yaml"]);

function TextSnippetPreview({ path }: { path: string }) {
  const [snippet, setSnippet] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const loadedRef = useRef(false);

  const loadSnippet = useCallback(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    invoke<FileContent>("read_file_content", { path, maxBytes: 500 })
      .then((result) => {
        setSnippet(result.content);
      })
      .catch(() => {
        // Silently fail — card will show nothing in the snippet area
      });
  }, [path]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadSnippet();
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadSnippet]);

  return (
    <div
      ref={containerRef}
      className="w-full h-32 bg-bg-tertiary overflow-hidden relative px-2 py-1.5"
    >
      {snippet !== null ? (
        <pre className="text-[var(--font-xs)] leading-[1.4] font-mono text-text-muted whitespace-pre-wrap break-all overflow-hidden h-full pointer-events-none select-none">
          {snippet}
        </pre>
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <span className="text-text-muted text-[var(--font-xs)]">...</span>
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-bg-tertiary to-transparent pointer-events-none" />
    </div>
  );
}

export function FileCard({ entry, selected, onClick, onDoubleClick, onContextMenu, draggable, onDragStart, onFileDrop }: FileCardProps) {
  const fileType = entry.file_type as FileType;
  const isImage = fileType === "image";
  const isVideo = fileType === "video";
  const isDir = entry.is_dir;
  const [duration, setDuration] = useState<number | null>(null);
  const [isDragTarget, setIsDragTarget] = useState(false);

  const ext = entry.name.split(".").pop()?.toUpperCase() || "";

  return (
    <div
      className={clsx(
        "rounded-[8px] border cursor-default overflow-hidden",
        "transition-all duration-100",
        selected
          ? "border-accent/50 bg-accent/8 shadow-sm"
          : "border-border bg-bg-secondary hover:border-border hover:bg-bg-hover",
        isDragTarget && "ring-2 ring-accent/50 border-accent/40 scale-[1.02]"
      )}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={isDir && onFileDrop ? (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setIsDragTarget(true); } : undefined}
      onDragLeave={isDir ? () => setIsDragTarget(false) : undefined}
      onDrop={isDir && onFileDrop ? (e) => { e.preventDefault(); setIsDragTarget(false); const data = e.dataTransfer.getData("application/x-explorer-files"); if (data) onFileDrop(JSON.parse(data)); } : undefined}
    >
      <div className="relative group">
        {isImage ? (
          <ImageThumbnail path={entry.path} />
        ) : isVideo ? (
          <VideoThumbnail path={entry.path} onDuration={setDuration} />
        ) : !isDir && TEXT_PREVIEWABLE.has(fileType) ? (
          <TextSnippetPreview path={entry.path} />
        ) : (
          <div className="w-full h-32 bg-bg-tertiary flex items-center justify-center">
            {isDir ? (
              <Folder size={36} className="text-folder" strokeWidth={1.25} />
            ) : (
              <FileIcon fileType={fileType} size={32} />
            )}
          </div>
        )}
        {(isImage || isVideo) && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              detachPreview(entry.path, entry.name, entry.file_type);
            }}
            className="absolute top-1.5 right-1.5 p-1 rounded bg-black/50 backdrop-blur-sm text-white/80 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
            title="Open in new window"
          >
            <ExternalLink size={11} />
          </button>
        )}
      </div>

      <div className="px-2.5 py-2">
        <p className={clsx(
          "text-[var(--font-sm)] truncate leading-tight",
          selected ? "text-text font-medium" : "text-text"
        )}>
          {entry.name}
        </p>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[var(--font-xs)] text-text-muted">
            {isDir ? "Folder" : formatSize(entry.size)}
          </span>
          <div className="flex items-center gap-1.5">
            {isVideo && duration !== null && (
              <span className="text-[var(--font-xs)] text-text-muted tabular-nums">
                {formatDuration(duration)}
              </span>
            )}
            {!isDir && ext && (
              <span className="text-[var(--font-xs)] text-text-muted/70 uppercase">
                {ext}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
