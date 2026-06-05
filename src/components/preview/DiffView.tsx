import { useState, useRef, useCallback, useEffect } from "react";
import { diffLines } from "diff";
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
  const changes = diffLines(left, right);
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
  const [diffLines, setDiffLines] = useState<DiffLine[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const selectedEntries = useFileListStore((s) => s.getSelectedEntries());

  useEffect(() => {
    if (selectedEntries.length >= 2) {
      const [first, second] = selectedEntries;
      if (!first.is_dir && !second.is_dir) {
        setLeftPath(first.path);
        setRightPath(second.path);
      }
    }
  }, []);

  useEffect(() => {
    if (!leftPath || !rightPath) return;
    let cancelled = false;

    Promise.all([
      invoke<{ content: string }>("read_file_content", { path: leftPath }),
      invoke<{ content: string }>("read_file_content", { path: rightPath }),
    ]).then(([left, right]) => {
      if (cancelled) return;
      setDiffLines(computeDiffLines(left.content, right.content));
    }).catch(() => {});

    return () => { cancelled = true; };
  }, [leftPath, rightPath]);

  const handleDropLeft = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const data = e.dataTransfer.getData("application/x-explorer-files");
    if (data) {
      const paths = JSON.parse(data) as string[];
      if (paths[0]) setLeftPath(paths[0]);
    }
  }, []);

  const handleDropRight = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const data = e.dataTransfer.getData("application/x-explorer-files");
    if (data) {
      const paths = JSON.parse(data) as string[];
      if (paths[0]) setRightPath(paths[0]);
    }
  }, []);

  const stats = diffLines.reduce((acc, line) => {
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
          {diffLines.length > 0 && (
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

      {/* File labels */}
      <div className="flex border-b border-border shrink-0">
        <div
          className="flex-1 px-3 py-1.5 text-[var(--font-xs)] text-text-muted truncate border-r border-border bg-bg-tertiary"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDropLeft}
        >
          {leftPath ? leftPath.split("/").pop() : "Drop or select left file"}
        </div>
        <div
          className="flex-1 px-3 py-1.5 text-[var(--font-xs)] text-text-muted truncate bg-bg-tertiary"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDropRight}
        >
          {rightPath ? rightPath.split("/").pop() : "Drop or select right file"}
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
          {diffLines.map((line, i) => (
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
