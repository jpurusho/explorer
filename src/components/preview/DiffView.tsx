import { useState, useRef, useCallback, useEffect } from "react";
import { diffLines as computeDiff } from "diff";
import { clsx } from "clsx";
import { X, FileText } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { useFileListStore } from "../../stores/fileListStore";

interface DiffViewProps {
  onClose: () => void;
}

interface DiffLine {
  type: "added" | "removed" | "unchanged";
  content: string;
  leftLineNo: number | null;
  rightLineNo: number | null;
}

function computeDiffLines(left: string, right: string): DiffLine[] {
  const changes = computeDiff(left, right);
  const lines: DiffLine[] = [];
  let leftLine = 1;
  let rightLine = 1;

  for (const change of changes) {
    const content = change.value.endsWith("\n")
      ? change.value.slice(0, -1)
      : change.value;
    const subLines = content.split("\n");

    for (const sub of subLines) {
      if (change.added) {
        lines.push({ type: "added", content: sub, leftLineNo: null, rightLineNo: rightLine++ });
      } else if (change.removed) {
        lines.push({ type: "removed", content: sub, leftLineNo: leftLine++, rightLineNo: null });
      } else {
        lines.push({ type: "unchanged", content: sub, leftLineNo: leftLine++, rightLineNo: rightLine++ });
      }
    }
  }

  return lines;
}

export function DiffView({ onClose }: DiffViewProps) {
  const [leftPath, setLeftPath] = useState<string | null>(null);
  const [rightPath, setRightPath] = useState<string | null>(null);
  const [lines, setDiffLines] = useState<DiffLine[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const entries = useFileListStore.getState().getSelectedEntries();
    if (entries.length >= 2) {
      const [first, second] = entries;
      if (!first.is_dir && !second.is_dir) {
        setLeftPath(first.path);
        setRightPath(second.path);
      }
    }
  }, []);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!leftPath || !rightPath) return;
    let cancelled = false;
    setError(null);

    Promise.all([
      invoke<{ content: string }>("read_file_content", { path: leftPath }),
      invoke<{ content: string }>("read_file_content", { path: rightPath }),
    ]).then(([left, right]) => {
      if (cancelled) return;
      try {
        setDiffLines(computeDiffLines(left.content, right.content));
      } catch (e) {
        setError(`Diff failed: ${e}`);
      }
    }).catch((e) => {
      if (!cancelled) setError(`Failed to read files: ${e}`);
    });

    return () => { cancelled = true; };
  }, [leftPath, rightPath]);

  const [dragOverLeft, setDragOverLeft] = useState(false);
  const [dragOverRight, setDragOverRight] = useState(false);

  const extractPath = (e: React.DragEvent): string | null => {
    const data = e.dataTransfer.getData("application/x-explorer-files");
    if (data) {
      const paths = JSON.parse(data) as string[];
      return paths[0] || null;
    }
    const text = e.dataTransfer.getData("text/plain");
    return text && text.startsWith("/") ? text : null;
  };

  const handleDropLeft = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOverLeft(false);
    const path = extractPath(e);
    if (path) setLeftPath(path);
  }, []);

  const handleDropRight = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOverRight(false);
    const path = extractPath(e);
    if (path) setRightPath(path);
  }, []);

  const stats = lines.reduce((acc, line) => {
    if (line.type === "added") acc.added++;
    if (line.type === "removed") acc.removed++;
    return acc;
  }, { added: 0, removed: 0 });

  return (
    <div className="h-full flex flex-col bg-bg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-bg-secondary shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-[var(--font-sm)] font-medium text-text">Diff View</span>
          {lines.length > 0 && (
            <span className="text-[var(--font-xs)] text-text-muted">
              <span className="text-green-400">+{stats.added}</span>
              {" / "}
              <span className="text-red-400">-{stats.removed}</span>
            </span>
          )}
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-bg-hover text-text-muted hover:text-text">
          <X size={14} />
        </button>
      </div>

      {/* File labels — drop zones */}
      <div className="flex border-b border-border shrink-0">
        <div
          className={clsx(
            "flex-1 px-3 py-3 text-[var(--font-sm)] truncate border-r border-border text-center cursor-default transition-colors",
            dragOverLeft ? "bg-accent/10 text-accent border-accent/30" : "bg-bg-tertiary text-text-muted hover:bg-bg-hover"
          )}
          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }}
          onDragEnter={(e) => { e.preventDefault(); setDragOverLeft(true); }}
          onDragLeave={() => setDragOverLeft(false)}
          onDrop={handleDropLeft}
        >
          {leftPath ? leftPath.split("/").pop() : "← Drop left file here"}
        </div>
        <div
          className={clsx(
            "flex-1 px-3 py-3 text-[var(--font-sm)] truncate text-center cursor-default transition-colors",
            dragOverRight ? "bg-accent/10 text-accent border-accent/30" : "bg-bg-tertiary text-text-muted hover:bg-bg-hover"
          )}
          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }}
          onDragEnter={(e) => { e.preventDefault(); setDragOverRight(true); }}
          onDragLeave={() => setDragOverRight(false)}
          onDrop={handleDropRight}
        >
          {rightPath ? rightPath.split("/").pop() : "Drop right file here →"}
        </div>
      </div>

      {/* Diff content */}
      {!leftPath || !rightPath ? (
        <div className="flex-1 flex items-center justify-center text-text-muted">
          <div className="text-center">
            <FileText size={24} className="mx-auto mb-2 opacity-30" />
            <p className="text-[var(--font-sm)]">Select two files to compare</p>
            <p className="text-[var(--font-xs)] mt-1">Select two files in the list, then open diff</p>
          </div>
        </div>
      ) : (
        <div ref={scrollRef} className="flex-1 overflow-auto font-mono text-[var(--font-sm)]">
          {lines.map((line, i) => (
            <div
              key={i}
              className={clsx(
                "flex min-h-[22px] leading-[22px]",
                line.type === "added" && "bg-green-500/8",
                line.type === "removed" && "bg-red-500/8"
              )}
            >
              {/* Left line number */}
              <span className="w-10 shrink-0 text-right pr-2 text-text-muted/50 select-none text-[var(--font-xs)]">
                {line.leftLineNo ?? ""}
              </span>
              {/* Right line number */}
              <span className="w-10 shrink-0 text-right pr-2 text-text-muted/50 select-none text-[var(--font-xs)]">
                {line.rightLineNo ?? ""}
              </span>
              {/* Change indicator */}
              <span className={clsx(
                "w-5 shrink-0 text-center select-none",
                line.type === "added" && "text-green-400",
                line.type === "removed" && "text-red-400"
              )}>
                {line.type === "added" ? "+" : line.type === "removed" ? "-" : " "}
              </span>
              {/* Content */}
              <span className={clsx(
                "flex-1 whitespace-pre px-2",
                line.type === "added" && "text-green-300",
                line.type === "removed" && "text-red-300",
                line.type === "unchanged" && "text-text-secondary"
              )}>
                {line.content}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
