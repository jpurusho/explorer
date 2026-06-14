import { create } from "zustand";
import type { EditorView } from "@codemirror/view";

const MAX_LIVE_VIEWS = 5;

export interface BufferEntry {
  content: string;
  savedContent: string;
  view: EditorView | null;
  container: HTMLDivElement | null;
  lastAccessed: number;
}

interface EditorBufferState {
  buffers: Map<string, BufferEntry>;

  getBuffer: (path: string) => BufferEntry | undefined;
  registerView: (path: string, view: EditorView, container: HTMLDivElement, initialContent: string) => void;
  updateContent: (path: string, content: string) => void;
  markSaved: (path: string, content: string) => void;
  isDirty: (path: string) => boolean;
  getDirtyPaths: () => string[];
  removeBuffer: (path: string) => void;
  touch: (path: string) => void;
  evictIfNeeded: () => void;
  getBufferContent: (path: string) => string | undefined;
}

export const useEditorBufferStore = create<EditorBufferState>((set, get) => ({
  buffers: new Map(),

  getBuffer: (path) => {
    return get().buffers.get(path);
  },

  registerView: (path, view, container, initialContent) => {
    const buffers = new Map(get().buffers);
    buffers.set(path, {
      content: initialContent,
      savedContent: initialContent,
      view,
      container,
      lastAccessed: Date.now(),
    });
    set({ buffers });
    get().evictIfNeeded();
  },

  updateContent: (path, content) => {
    const buffers = new Map(get().buffers);
    const entry = buffers.get(path);
    if (entry) {
      buffers.set(path, { ...entry, content, lastAccessed: Date.now() });
      set({ buffers });
    }
  },

  markSaved: (path, content) => {
    const buffers = new Map(get().buffers);
    const entry = buffers.get(path);
    if (entry) {
      buffers.set(path, { ...entry, savedContent: content, content });
      set({ buffers });
    }
  },

  isDirty: (path) => {
    const entry = get().buffers.get(path);
    if (!entry) return false;
    return entry.content !== entry.savedContent;
  },

  getDirtyPaths: () => {
    const paths: string[] = [];
    for (const [path, entry] of get().buffers) {
      if (entry.content !== entry.savedContent) {
        paths.push(path);
      }
    }
    return paths;
  },

  removeBuffer: (path) => {
    const buffers = new Map(get().buffers);
    const entry = buffers.get(path);
    if (entry?.view) {
      entry.view.destroy();
    }
    buffers.delete(path);
    set({ buffers });
  },

  touch: (path) => {
    const buffers = new Map(get().buffers);
    const entry = buffers.get(path);
    if (entry) {
      buffers.set(path, { ...entry, lastAccessed: Date.now() });
      set({ buffers });
    }
  },

  evictIfNeeded: () => {
    const buffers = new Map(get().buffers);
    const liveViews = [...buffers.entries()].filter(([, e]) => e.view !== null);
    if (liveViews.length <= MAX_LIVE_VIEWS) return;

    liveViews.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
    const toEvict = liveViews.slice(0, liveViews.length - MAX_LIVE_VIEWS);

    for (const [path, entry] of toEvict) {
      if (entry.view) {
        entry.view.destroy();
      }
      buffers.set(path, { ...entry, view: null, container: null });
    }
    set({ buffers });
  },

  getBufferContent: (path) => {
    const entry = get().buffers.get(path);
    return entry?.content;
  },
}));
