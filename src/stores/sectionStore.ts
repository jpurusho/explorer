import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

export interface SectionFile {
  file_path: string;
  sort_order: number;
}

export interface Section {
  id: number;
  dir_path: string;
  name: string;
  color: string;
  sort_order: number;
  collapsed: boolean;
  hidden: boolean;
  files: SectionFile[];
}

interface SectionState {
  sections: Section[];
  sectionsEnabled: boolean;

  loadSections: (dirPath: string) => Promise<void>;
  createSection: (dirPath: string, name: string, color: string) => Promise<Section>;
  updateSection: (id: number, updates: { name?: string; color?: string; sort_order?: number; collapsed?: boolean; hidden?: boolean }) => Promise<void>;
  deleteSection: (id: number) => Promise<void>;
  assignFiles: (sectionId: number, paths: string[]) => Promise<void>;
  removeFiles: (sectionId: number, paths: string[]) => Promise<void>;
  toggleCollapsed: (id: number) => Promise<void>;
  toggleHidden: (id: number) => Promise<void>;
  reorderSections: (dirPath: string, ids: number[]) => Promise<void>;
  getSectionForPath: (path: string) => Section | null;
  getUnsortedPaths: (allPaths: string[]) => string[];
}

export const useSectionStore = create<SectionState>((set, get) => ({
  sections: [],
  sectionsEnabled: false,

  loadSections: async (dirPath) => {
    const sections = await invoke<Section[]>("get_sections", { dirPath });
    set({ sections, sectionsEnabled: sections.length > 0 });
  },

  createSection: async (dirPath, name, color) => {
    const section = await invoke<Section>("create_section", { dirPath, name, color });
    set((s) => ({ sections: [...s.sections, section], sectionsEnabled: true }));
    return section;
  },

  updateSection: async (id, updates) => {
    await invoke("update_section", {
      id,
      name: updates.name ?? null,
      color: updates.color ?? null,
      sortOrder: updates.sort_order ?? null,
      collapsed: updates.collapsed ?? null,
      hidden: updates.hidden ?? null,
    });
    set((s) => ({
      sections: s.sections.map((sec) =>
        sec.id === id ? { ...sec, ...updates } : sec
      ),
    }));
  },

  deleteSection: async (id) => {
    await invoke("delete_section", { id });
    const remaining = get().sections.filter((s) => s.id !== id);
    set({ sections: remaining, sectionsEnabled: remaining.length > 0 });
  },

  assignFiles: async (sectionId, paths) => {
    await invoke("assign_files_to_section", { sectionId, paths });
    const dirPath = get().sections.find((s) => s.id === sectionId)?.dir_path;
    if (dirPath) await get().loadSections(dirPath);
  },

  removeFiles: async (sectionId, paths) => {
    await invoke("remove_files_from_section", { sectionId, paths });
    const dirPath = get().sections.find((s) => s.id === sectionId)?.dir_path;
    if (dirPath) await get().loadSections(dirPath);
  },

  toggleCollapsed: async (id) => {
    const section = get().sections.find((s) => s.id === id);
    if (!section) return;
    await get().updateSection(id, { collapsed: !section.collapsed });
  },

  toggleHidden: async (id) => {
    const section = get().sections.find((s) => s.id === id);
    if (!section) return;
    await get().updateSection(id, { hidden: !section.hidden });
  },

  reorderSections: async (dirPath, ids) => {
    await invoke("reorder_sections", { dirPath, sectionIds: ids });
    await get().loadSections(dirPath);
  },

  getSectionForPath: (path) => {
    return get().sections.find((s) => s.files.some((f) => f.file_path === path)) || null;
  },

  getUnsortedPaths: (allPaths) => {
    const assigned = new Set<string>();
    for (const section of get().sections) {
      for (const f of section.files) {
        assigned.add(f.file_path);
      }
    }
    return allPaths.filter((p) => !assigned.has(p));
  },
}));
