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
        "flex items-center gap-2.5 px-4 py-2.5 mx-2 mt-2 mb-1 rounded-lg transition-all group/section",
        dragOver ? "ring-2 ring-accent/50 scale-[1.01]" : ""
      )}
      style={{
        backgroundColor: `${section.color}18`,
        borderLeft: `4px solid ${section.color}`,
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <button
        onClick={onToggleCollapse}
        className="text-text-secondary hover:text-text p-0.5 shrink-0"
      >
        {section.collapsed ? (
          <ChevronRight size={15} />
        ) : (
          <ChevronDown size={15} />
        )}
      </button>

      <span
        className="text-[--font-md] font-bold tracking-wide"
        style={{ color: section.color }}
      >
        {section.name}
      </span>

      <span className="text-[--font-xs] text-text-muted bg-bg-tertiary px-1.5 py-0.5 rounded-full">
        {fileCount}
      </span>

      <div className="flex-1" />

      <div className="flex items-center gap-1 opacity-0 group-hover/section:opacity-100 transition-opacity">
        <button
          onClick={onToggleHidden}
          className="p-1 rounded hover:bg-bg-hover text-text-muted hover:text-text-secondary"
          title="Hide section"
        >
          <EyeOff size={12} />
        </button>
        <button
          onClick={onDelete}
          className="p-1 rounded hover:bg-bg-hover text-text-muted hover:text-red-400"
          title="Delete section"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}
