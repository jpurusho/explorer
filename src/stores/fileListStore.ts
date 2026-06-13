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
  showRowLines: boolean;
  filterPattern: string | null;
  nameWidth: number;
  columns: ColumnConfig[];

  // When set, the list/grid should auto-start an inline rename of the entry at
  // this path once it appears (used after New Folder / Duplicate).
  renameRequestPath: string | null;

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
  setNameWidth: (width: number) => void;
  setColumnWidth: (id: ColumnId, width: number) => void;
  toggleColumnVisibility: (id: ColumnId) => void;
  setShowRowLines: (show: boolean) => void;
  syncFromSettings: (settings: { show_row_lines: boolean; column_name_width: number; column_type_width: number; column_size_width: number; column_modified_width: number; column_type_visible: boolean; column_size_visible: boolean; column_modified_visible: boolean; default_view: string; show_hidden_files: boolean; sort_by: string; sort_direction: string }) => void;

  // Filter actions
  setFilterPattern: (pattern: string | null) => void;

  // Rename request (auto-start inline rename once the path appears)
  requestRename: (path: string | null) => void;

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

function matchesPattern(name: string, pattern: string): boolean {
  const lower = name.toLowerCase();
  const p = pattern.toLowerCase().trim();
  if (p.startsWith("*.")) {
    return lower.endsWith(p.slice(1));
  }
  if (p.startsWith(".")) {
    return lower.endsWith(p);
  }
  return lower.includes(p);
}

// Cache the last (entries, showHidden, sortBy, sortDirection, filter) tuple so a
// no-op re-render (or an unrelated state change) doesn't re-run sort+filter
// on a 5k-entry array. Sorting is O(n log n) on the main thread; this turns
// repeat calls into pointer compares.
let _visibleCache: {
  entries: FileEntry[];
  showHidden: boolean;
  sortBy: SortField;
  sortDirection: SortDirection;
  filterPattern: string | null;
  result: FileEntry[];
} | null = null;

function computeVisible(
  entries: FileEntry[],
  showHiddenFiles: boolean,
  sortBy: SortField,
  sortDirection: SortDirection,
  filterPattern: string | null = null
): FileEntry[] {
  const c = _visibleCache;
  if (
    c &&
    c.entries === entries &&
    c.showHidden === showHiddenFiles &&
    c.sortBy === sortBy &&
    c.sortDirection === sortDirection &&
    c.filterPattern === filterPattern
  ) {
    return c.result;
  }
  let filtered = showHiddenFiles
    ? entries
    : entries.filter((e) => !e.is_hidden);
  if (filterPattern) {
    filtered = filtered.filter((e) => e.is_dir || matchesPattern(e.name, filterPattern));
  }
  const result = sortEntries(filtered, sortBy, sortDirection);
  _visibleCache = { entries, showHidden: showHiddenFiles, sortBy, sortDirection, filterPattern, result };
  return result;
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
  showRowLines: false,
  filterPattern: null,
  nameWidth: 300,
  renameRequestPath: null,
  columns: [
    { id: "type", label: "Type", width: 50, minWidth: 40, visible: true },
    { id: "size", label: "Size", width: 58, minWidth: 44, visible: true },
    { id: "modified", label: "Modified", width: 120, minWidth: 80, visible: true },
  ],

  selectedIndex: -1,
  selectedPath: null,

  setEntries: (entries) => {
    const { showHiddenFiles, sortBy, sortDirection, filterPattern, selectedPath } = get();
    const visibleEntries = computeVisible(entries, showHiddenFiles, sortBy, sortDirection, filterPattern);

    // If selectedPath is set and exists in the new entries, preserve it
    const preservedIdx = selectedPath ? visibleEntries.findIndex((e) => e.path === selectedPath) : -1;

    if (preservedIdx >= 0) {
      // Keep the existing selection
      set({
        entries,
        visibleEntries,
        selectedIndices: new Set([preservedIdx]),
        anchorIndex: preservedIdx,
        selectedIndex: preservedIdx,
        selectedPath,
      });
    } else {
      // Auto-select first file for preview, or first item if no files
      const firstFileIdx = visibleEntries.findIndex((e) => !e.is_dir);
      const autoIdx = firstFileIdx >= 0 ? firstFileIdx : (visibleEntries.length > 0 ? 0 : -1);
      const autoEntry = autoIdx >= 0 ? visibleEntries[autoIdx] : null;
      set({
        entries,
        visibleEntries,
        selectedIndices: autoIdx >= 0 ? new Set([autoIdx]) : new Set(),
        anchorIndex: autoIdx,
        selectedIndex: autoIdx,
        selectedPath: autoEntry?.path ?? null,
      });
    }
  },

  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setViewMode: (viewMode) => {
    set({ viewMode });
    import("./settingsStore").then(({ useSettingsStore }) => {
      useSettingsStore.getState().updateSettings({ default_view: viewMode });
    });
  },

  setSortBy: (sortBy) => {
    const { entries, showHiddenFiles, sortDirection, filterPattern } = get();
    const visibleEntries = computeVisible(entries, showHiddenFiles, sortBy, sortDirection, filterPattern);
    set({ sortBy, visibleEntries, selectedIndices: new Set(), anchorIndex: -1, selectedIndex: -1, selectedPath: null });
    import("./settingsStore").then(({ useSettingsStore }) => {
      useSettingsStore.getState().updateSettings({ sort_by: sortBy });
    });
  },

  toggleSortDirection: () => {
    const { entries, showHiddenFiles, sortBy, sortDirection, filterPattern } = get();
    const newDir = sortDirection === "asc" ? "desc" : "asc";
    const visibleEntries = computeVisible(entries, showHiddenFiles, sortBy, newDir, filterPattern);
    set({ sortDirection: newDir, visibleEntries, selectedIndices: new Set(), anchorIndex: -1, selectedIndex: -1, selectedPath: null });
    import("./settingsStore").then(({ useSettingsStore }) => {
      useSettingsStore.getState().updateSettings({ sort_direction: newDir });
    });
  },

  setSelectedIndex: (index) => {
    const { visibleEntries } = get();
    const entry = visibleEntries[index];
    set({ selectedIndices: new Set(index >= 0 ? [index] : []), anchorIndex: index, selectedIndex: index, selectedPath: entry?.path ?? null });
  },

  setSelectedPath: (path) => {
    set({ selectedPath: path, selectedIndex: -1, selectedIndices: new Set() });
  },

  toggleHiddenFiles: () => {
    const { entries, showHiddenFiles, sortBy, sortDirection, filterPattern } = get();
    const newShow = !showHiddenFiles;
    const visibleEntries = computeVisible(entries, newShow, sortBy, sortDirection, filterPattern);
    set({ showHiddenFiles: newShow, visibleEntries, selectedIndices: new Set(), anchorIndex: -1, selectedIndex: -1, selectedPath: null });
    import("./settingsStore").then(({ useSettingsStore }) => {
      useSettingsStore.getState().updateSettings({ show_hidden_files: newShow });
    });
  },

  setShowRowLines: (show) => {
    set({ showRowLines: show });
    import("./settingsStore").then(({ useSettingsStore }) => {
      useSettingsStore.getState().updateSettings({ show_row_lines: show });
    });
  },

  setNameWidth: (width) => {
    const w = Math.max(100, width);
    set({ nameWidth: w });
    if (_saveTimer) clearTimeout(_saveTimer);
    _saveTimer = setTimeout(async () => {
      const { useSettingsStore } = await import("./settingsStore");
      useSettingsStore.getState().updateSettings({ column_name_width: w });
    }, 500);
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
      nameWidth: settings.column_name_width || 300,
      showRowLines: settings.show_row_lines ?? false,
      viewMode: settings.default_view === "grid" ? "grid" : "list",
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

  requestRename: (path) => set({ renameRequestPath: path }),

  setFilterPattern: (filterPattern) => {
    const { entries, showHiddenFiles, sortBy, sortDirection } = get();
    const visibleEntries = computeVisible(entries, showHiddenFiles, sortBy, sortDirection, filterPattern);
    set({ filterPattern, visibleEntries, selectedIndices: new Set(), anchorIndex: -1, selectedIndex: -1, selectedPath: null });
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
