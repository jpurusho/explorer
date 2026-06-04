import { create } from "zustand";
import type { FileEntry, ViewMode, SortField, SortDirection } from "../types";

export type ColumnId = "type" | "size" | "modified";

export interface ColumnConfig {
  id: ColumnId;
  label: string;
  width: number;
  minWidth: number;
  visible: boolean;
}

interface FileListState {
  entries: FileEntry[];
  visibleEntries: FileEntry[];
  loading: boolean;
  error: string | null;
  viewMode: ViewMode;
  sortBy: SortField;
  sortDirection: SortDirection;
  selectedIndices: Set<number>;
  anchorIndex: number;
  showHiddenFiles: boolean;
  columns: ColumnConfig[];

  // Computed getters
  selectedIndex: number;
  selectedPath: string | null;

  // Actions
  setEntries: (entries: FileEntry[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setViewMode: (mode: ViewMode) => void;
  setSortBy: (field: SortField) => void;
  toggleSortDirection: () => void;
  setSelectedIndex: (index: number) => void;
  setSelectedPath: (path: string | null) => void;
  toggleHiddenFiles: () => void;

  // Column actions
  setColumnWidth: (id: ColumnId, width: number) => void;
  toggleColumnVisibility: (id: ColumnId) => void;
  syncFromSettings: (settings: { column_type_width: number; column_size_width: number; column_modified_width: number; column_type_visible: boolean; column_size_visible: boolean; column_modified_visible: boolean; default_view: string; show_hidden_files: boolean; sort_by: string; sort_direction: string }) => void;

  // Multi-select actions
  selectIndex: (index: number) => void;
  toggleIndex: (index: number) => void;
  selectRange: (index: number) => void;
  selectAll: () => void;
  clearSelection: () => void;
  getSelectedEntries: () => FileEntry[];
  getSelectedPaths: () => string[];
}

function sortEntries(
  entries: FileEntry[],
  sortBy: SortField,
  sortDirection: SortDirection
): FileEntry[] {
  return [...entries].sort((a, b) => {
    if (a.is_dir && !b.is_dir) return -1;
    if (!a.is_dir && b.is_dir) return 1;

    let cmp = 0;
    switch (sortBy) {
      case "name":
        cmp = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
        break;
      case "size":
        cmp = a.size - b.size;
        break;
      case "modified":
        cmp = a.modified.localeCompare(b.modified);
        break;
      case "type":
        cmp = a.file_type.localeCompare(b.file_type);
        break;
    }
    return sortDirection === "asc" ? cmp : -cmp;
  });
}

function computeVisible(
  entries: FileEntry[],
  showHiddenFiles: boolean,
  sortBy: SortField,
  sortDirection: SortDirection
): FileEntry[] {
  const filtered = showHiddenFiles
    ? entries
    : entries.filter((e) => !e.is_hidden);
  return sortEntries(filtered, sortBy, sortDirection);
}

let _saveTimer: ReturnType<typeof setTimeout> | null = null;
function saveColumnSettings(columns: ColumnConfig[]) {
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(async () => {
    const { useSettingsStore } = await import("./settingsStore");
    const col = (id: ColumnId) => columns.find((c) => c.id === id)!;
    useSettingsStore.getState().updateSettings({
      column_type_width: col("type").width,
      column_size_width: col("size").width,
      column_modified_width: col("modified").width,
      column_type_visible: col("type").visible,
      column_size_visible: col("size").visible,
      column_modified_visible: col("modified").visible,
    });
  }, 500);
}

export const useFileListStore = create<FileListState>((set, get) => ({
  entries: [],
  visibleEntries: [],
  loading: false,
  error: null,
  viewMode: "list",
  sortBy: "name",
  sortDirection: "asc",
  selectedIndices: new Set<number>(),
  anchorIndex: -1,
  showHiddenFiles: false,
  columns: [
    { id: "type", label: "Type", width: 50, minWidth: 40, visible: true },
    { id: "size", label: "Size", width: 58, minWidth: 44, visible: true },
    { id: "modified", label: "Modified", width: 90, minWidth: 70, visible: true },
  ],

  selectedIndex: -1,
  selectedPath: null,

  setEntries: (entries) => {
    const { showHiddenFiles, sortBy, sortDirection } = get();
    const visibleEntries = computeVisible(entries, showHiddenFiles, sortBy, sortDirection);
    set({ entries, visibleEntries, selectedIndices: new Set(), anchorIndex: -1, selectedIndex: -1, selectedPath: null });
  },

  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setViewMode: (viewMode) => set({ viewMode }),

  setSortBy: (sortBy) => {
    const { entries, showHiddenFiles, sortDirection } = get();
    const visibleEntries = computeVisible(entries, showHiddenFiles, sortBy, sortDirection);
    set({ sortBy, visibleEntries, selectedIndices: new Set(), anchorIndex: -1, selectedIndex: -1, selectedPath: null });
  },

  toggleSortDirection: () => {
    const { entries, showHiddenFiles, sortBy, sortDirection } = get();
    const newDir = sortDirection === "asc" ? "desc" : "asc";
    const visibleEntries = computeVisible(entries, showHiddenFiles, sortBy, newDir);
    set({ sortDirection: newDir, visibleEntries, selectedIndices: new Set(), anchorIndex: -1, selectedIndex: -1, selectedPath: null });
  },

  setSelectedIndex: (index) => {
    const { visibleEntries } = get();
    const entry = visibleEntries[index];
    set({ selectedIndices: new Set(index >= 0 ? [index] : []), anchorIndex: index, selectedIndex: index, selectedPath: entry?.path ?? null });
  },

  setSelectedPath: (_path) => {},

  toggleHiddenFiles: () => {
    const { entries, showHiddenFiles, sortBy, sortDirection } = get();
    const newShow = !showHiddenFiles;
    const visibleEntries = computeVisible(entries, newShow, sortBy, sortDirection);
    set({ showHiddenFiles: newShow, visibleEntries, selectedIndices: new Set(), anchorIndex: -1, selectedIndex: -1, selectedPath: null });
  },

  setColumnWidth: (id, width) => {
    const { columns } = get();
    const updated = columns.map((col) =>
      col.id === id ? { ...col, width: Math.max(col.minWidth, width) } : col
    );
    set({ columns: updated });
    saveColumnSettings(updated);
  },

  toggleColumnVisibility: (id) => {
    const { columns } = get();
    const updated = columns.map((col) =>
      col.id === id ? { ...col, visible: !col.visible } : col
    );
    set({ columns: updated });
    saveColumnSettings(updated);
  },

  syncFromSettings: (settings) => {
    set({
      viewMode: (settings.default_view as ViewMode) || "list",
      showHiddenFiles: settings.show_hidden_files,
      sortBy: (settings.sort_by as SortField) || "name",
      sortDirection: (settings.sort_direction as SortDirection) || "asc",
      columns: [
        { id: "type", label: "Type", width: settings.column_type_width, minWidth: 40, visible: settings.column_type_visible },
        { id: "size", label: "Size", width: settings.column_size_width, minWidth: 44, visible: settings.column_size_visible },
        { id: "modified", label: "Modified", width: settings.column_modified_width, minWidth: 70, visible: settings.column_modified_visible },
      ],
    });
  },

  selectIndex: (index) => {
    const { visibleEntries } = get();
    const entry = visibleEntries[index];
    set({ selectedIndices: new Set([index]), anchorIndex: index, selectedIndex: index, selectedPath: entry?.path ?? null });
  },

  toggleIndex: (index) => {
    const { selectedIndices, visibleEntries } = get();
    const next = new Set(selectedIndices);
    if (next.has(index)) {
      next.delete(index);
    } else {
      next.add(index);
    }
    const primary = next.size > 0 ? Math.min(...next) : -1;
    const entry = primary >= 0 ? visibleEntries[primary] : null;
    set({ selectedIndices: next, anchorIndex: index, selectedIndex: primary, selectedPath: entry?.path ?? null });
  },

  selectRange: (index) => {
    const { anchorIndex, selectedIndices, visibleEntries } = get();
    const anchor = anchorIndex >= 0 ? anchorIndex : 0;
    const start = Math.min(anchor, index);
    const end = Math.max(anchor, index);
    const next = new Set(selectedIndices);
    for (let i = start; i <= end; i++) {
      next.add(i);
    }
    const primary = Math.min(...next);
    const entry = visibleEntries[primary];
    set({ selectedIndices: next, selectedIndex: index, selectedPath: entry?.path ?? null });
  },

  selectAll: () => {
    const { visibleEntries } = get();
    const all = new Set<number>();
    for (let i = 0; i < visibleEntries.length; i++) all.add(i);
    set({ selectedIndices: all, selectedIndex: 0, selectedPath: visibleEntries[0]?.path ?? null });
  },

  clearSelection: () => {
    set({ selectedIndices: new Set(), anchorIndex: -1, selectedIndex: -1, selectedPath: null });
  },

  getSelectedEntries: () => {
    const { visibleEntries, selectedIndices } = get();
    return [...selectedIndices].sort((a, b) => a - b).map((i) => visibleEntries[i]).filter(Boolean);
  },

  getSelectedPaths: () => {
    return get().getSelectedEntries().map((e) => e.path);
  },
}));
