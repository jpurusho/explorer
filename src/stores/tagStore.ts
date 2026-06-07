import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

export interface Tag {
  id: number;
  name: string;
  color: string;
  sort_order: number;
}

interface TagState {
  tags: Tag[];
  fileTagMap: Map<string, Tag[]>;
  activeTagFilter: number | null;

  loadTags: () => Promise<void>;
  createTag: (name: string, color: string) => Promise<Tag>;
  updateTag: (id: number, name?: string, color?: string, sort_order?: number) => Promise<void>;
  deleteTag: (id: number) => Promise<void>;
  tagFiles: (paths: string[], tagId: number) => Promise<void>;
  untagFiles: (paths: string[], tagId: number) => Promise<void>;
  loadTagsForFiles: (paths: string[]) => Promise<void>;
  setTagFilter: (tagId: number | null) => void;
  getTagsForPath: (path: string) => Tag[];
}

export const useTagStore = create<TagState>((set, get) => ({
  tags: [],
  fileTagMap: new Map(),
  activeTagFilter: null,

  loadTags: async () => {
    const tags = await invoke<Tag[]>("get_all_tags");
    set({ tags });
  },

  createTag: async (name, color) => {
    const tag = await invoke<Tag>("create_tag", { name, color });
    set((s) => ({ tags: [...s.tags, tag] }));
    return tag;
  },

  updateTag: async (id, name, color, sort_order) => {
    await invoke("update_tag", { id, name: name ?? null, color: color ?? null, sortOrder: sort_order ?? null });
    await get().loadTags();
  },

  deleteTag: async (id) => {
    await invoke("delete_tag", { id });
    set((s) => ({
      tags: s.tags.filter((t) => t.id !== id),
      activeTagFilter: s.activeTagFilter === id ? null : s.activeTagFilter,
    }));
  },

  tagFiles: async (paths, tagId) => {
    await invoke("tag_files", { paths, tagId });
    await get().loadTagsForFiles(paths);
  },

  untagFiles: async (paths, tagId) => {
    await invoke("untag_files", { paths, tagId });
    await get().loadTagsForFiles(paths);
  },

  loadTagsForFiles: async (paths) => {
    if (paths.length === 0) {
      set({ fileTagMap: new Map() });
      return;
    }
    const result = await invoke<Record<string, Tag[]>>("get_tags_for_files", { paths });
    const map = new Map<string, Tag[]>();
    for (const [path, tags] of Object.entries(result)) {
      map.set(path, tags);
    }
    set({ fileTagMap: map });
  },

  setTagFilter: (tagId) => {
    set({ activeTagFilter: tagId });
    // Trigger a refresh so useDirectory picks up the filter change
    import("./navigationStore").then(({ useNavigationStore }) => {
      useNavigationStore.getState().refreshCurrent();
    });
  },

  getTagsForPath: (path) => {
    return get().fileTagMap.get(path) || [];
  },
}));
