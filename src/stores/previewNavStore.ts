import { create } from "zustand";

interface PreviewNavState {
  stack: string[];
  currentIndex: number;

  pushPath: (path: string) => void;
  goBack: () => string | null;
  goForward: () => string | null;
  reset: (path: string) => void;
  canGoBack: () => boolean;
  canGoForward: () => boolean;
  currentPath: () => string | null;
}

export const usePreviewNavStore = create<PreviewNavState>((set, get) => ({
  stack: [],
  currentIndex: -1,

  pushPath: (path: string) => {
    const { stack, currentIndex } = get();
    if (stack[currentIndex] === path) return;
    const newStack = stack.slice(0, currentIndex + 1);
    newStack.push(path);
    set({ stack: newStack, currentIndex: newStack.length - 1 });
  },

  goBack: () => {
    const { stack, currentIndex } = get();
    if (currentIndex <= 0) return null;
    const newIndex = currentIndex - 1;
    set({ currentIndex: newIndex });
    return stack[newIndex];
  },

  goForward: () => {
    const { stack, currentIndex } = get();
    if (currentIndex >= stack.length - 1) return null;
    const newIndex = currentIndex + 1;
    set({ currentIndex: newIndex });
    return stack[newIndex];
  },

  reset: (path: string) => {
    set({ stack: [path], currentIndex: 0 });
  },

  canGoBack: () => get().currentIndex > 0,
  canGoForward: () => get().currentIndex < get().stack.length - 1,
  currentPath: () => {
    const { stack, currentIndex } = get();
    return currentIndex >= 0 ? stack[currentIndex] : null;
  },
}));
