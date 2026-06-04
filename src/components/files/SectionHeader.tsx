import { useState } from "react";
import { ChevronDown, ChevronRight, EyeOff, Trash2 } from "lucide-react";
import { clsx } from "clsx";
import type { Section } from "../../stores/sectionStore";

interface SectionHeaderProps {
  section: Section;
  fileCount: number;
  onToggleCollapse: () => void;
  onToggleHidden: () => void;
  onDelete: () => void;
  onDrop: (paths: string[]) => void;
}

export function SectionHeader({
  section,
  fileCount,
  onToggleCollapse,
  onToggleHidden,
  onDelete,
  onDrop,
}: SectionHeaderProps) {
  const [dragOver, setDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const data = e.dataTransfer.getData("application/x-explorer-files");
    if (data) {
      const paths = JSON.parse(data) as string[];
      onDrop(paths);
    }
  };

  return (
    <div
      className={clsx(
        "flex items-center gap-2 px-4 py-2 mx-2 rounded-md transition-colors",
        dragOver ? "ring-2 ring-accent/50" : ""
      )}
      style={{ backgroundColor: `${section.color}15`, borderLeft: `3px solid ${section.color}` }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <button
        onClick={onToggleCollapse}
        className="text-text-secondary hover:text-text p-0.5"
      >
        {section.collapsed ? (
          <ChevronRight size={14} />
        ) : (
          <ChevronDown size={14} />
        )}
      </button>

      <span
        className="text-[12px] font-semibold tracking-wide"
        style={{ color: section.color }}
      >
        {section.name}
      </span>

      <span className="text-[10px] text-text-muted ml-1">
        {fileCount} {fileCount === 1 ? "file" : "files"}
      </span>

      <div className="flex-1" />

      <button
        onClick={onToggleHidden}
        className="p-1 rounded hover:bg-bg-hover text-text-muted hover:text-text-secondary opacity-0 group-hover:opacity-100 transition-opacity"
        title="Hide section"
      >
        <EyeOff size={11} />
      </button>
      <button
        onClick={onDelete}
        className="p-1 rounded hover:bg-bg-hover text-text-muted hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
        title="Delete section"
      >
        <Trash2 size={11} />
      </button>
    </div>
  );
}
