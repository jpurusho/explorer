import { useRef, useState } from "react";
import { useFileListStore } from "../../stores/fileListStore";
import { useNavigationStore } from "../../stores/navigationStore";
import { useSectionStore } from "../../stores/sectionStore";
import { FileListItem } from "./FileListItem";
import { SectionHeader } from "./SectionHeader";
import { ContextMenu } from "./ContextMenu";
import type { FileEntry } from "../../types";

export function SectionedFileList() {
  const parentRef = useRef<HTMLDivElement>(null);
  const entries = useFileListStore((s) => s.visibleEntries);
  const selectedIndices = useFileListStore((s) => s.selectedIndices);
  const selectIndex = useFileListStore((s) => s.selectIndex);
  const toggleIndex = useFileListStore((s) => s.toggleIndex);
  const selectRange = useFileListStore((s) => s.selectRange);
  const navigateTo = useNavigationStore((s) => s.navigateTo);
  const sections = useSectionStore((s) => s.sections);
  const assignFiles = useSectionStore((s) => s.assignFiles);
  const toggleCollapsed = useSectionStore((s) => s.toggleCollapsed);
  const toggleHidden = useSectionStore((s) => s.toggleHidden);
  const deleteSection = useSectionStore((s) => s.deleteSection);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; entry: FileEntry } | null>(null);

  const handleClick = (index: number, e: React.MouseEvent) => {
    if (e.metaKey) toggleIndex(index);
    else if (e.shiftKey) selectRange(index);
    else selectIndex(index);
  };

  const handleContextMenu = (e: React.MouseEvent, entry: FileEntry, index: number) => {
    e.preventDefault();
    if (!selectedIndices.has(index)) selectIndex(index);
    setContextMenu({ x: e.clientX, y: e.clientY, entry });
  };

  // Build path->index map for quick lookup
  const pathToIndex = new Map<string, number>();
  entries.forEach((e, i) => pathToIndex.set(e.path, i));

  // Group files by section
  const assignedPaths = new Set<string>();
  const sectionGroups = sections
    .filter((s) => !s.hidden)
    .map((section) => {
      const sectionEntries = section.files
        .map((f) => {
          const idx = pathToIndex.get(f.file_path);
          if (idx !== undefined) {
            assignedPaths.add(f.file_path);
            return { entry: entries[idx], index: idx };
          }
          return null;
        })
        .filter(Boolean) as { entry: FileEntry; index: number }[];
      return { section, entries: sectionEntries };
    });

  // Unsorted files
  const unsorted = entries
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => !assignedPaths.has(entry.path));

  return (
    <div ref={parentRef} className="h-full overflow-y-auto overflow-x-hidden pt-2 file-list-font">
      {sectionGroups.map(({ section, entries: sectionEntries }) => (
        <div key={section.id} className="mb-2 group">
          <SectionHeader
            section={section}
            fileCount={sectionEntries.length}
            onToggleCollapse={() => toggleCollapsed(section.id)}
            onToggleHidden={() => toggleHidden(section.id)}
            onDelete={() => deleteSection(section.id)}
            onDrop={(paths) => assignFiles(section.id, paths)}
          />
          {!section.collapsed && sectionEntries.map(({ entry, index }) => (
            <FileListItem
              key={entry.path}
              entry={entry}
              selected={selectedIndices.has(index)}
              onClick={(e) => handleClick(index, e)}
              onDoubleClick={() => { if (entry.is_dir) navigateTo(entry.path); }}
              onContextMenu={(e) => handleContextMenu(e, entry, index)}
              draggable
              onDragStart={(e) => {
                const store = useFileListStore.getState();
                if (!selectedIndices.has(index)) selectIndex(index);
                const paths = store.getSelectedPaths();
                e.dataTransfer.setData("application/x-explorer-files", JSON.stringify(paths));
                e.dataTransfer.effectAllowed = "copyMove";
              }}
            />
          ))}
        </div>
      ))}

      {/* Unsorted section */}
      {unsorted.length > 0 && sectionGroups.length > 0 && (
        <div className="mb-2">
          <div className="flex items-center gap-2 px-4 py-1.5 mx-2">
            <span className="text-[--font-sm] text-text-muted font-medium">Unsorted</span>
            <span className="text-[--font-xs] text-text-muted/60">{unsorted.length}</span>
          </div>
        </div>
      )}
      {unsorted.map(({ entry, index }) => (
        <FileListItem
          key={entry.path}
          entry={entry}
          selected={selectedIndices.has(index)}
          onClick={(e) => handleClick(index, e)}
          onDoubleClick={() => { if (entry.is_dir) navigateTo(entry.path); }}
          onContextMenu={(e) => handleContextMenu(e, entry, index)}
          draggable
          onDragStart={(e) => {
            const store = useFileListStore.getState();
            if (!selectedIndices.has(index)) selectIndex(index);
            const paths = store.getSelectedPaths();
            e.dataTransfer.setData("application/x-explorer-files", JSON.stringify(paths));
            e.dataTransfer.effectAllowed = "copyMove";
          }}
        />
      ))}

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          entries={useFileListStore.getState().getSelectedEntries()}
          onClose={() => setContextMenu(null)}
          onOpen={() => {
            if (contextMenu.entry.is_dir) navigateTo(contextMenu.entry.path);
          }}
        />
      )}
    </div>
  );
}
