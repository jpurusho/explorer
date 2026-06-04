import { create } from "zustand";

interface NavigationState {
  currentPath: string;
  history: string[];
  historyIndex: number;
  canGoBack: boolean;
  canGoForward: boolean;
  refreshTrigger: number;
  navigateTo: (path: string) => void;
  goBack: () => void;
  goForward: () => void;
  goUp: () => void;
  refreshCurrent: () => void;
}

export const useNavigationStore = create<NavigationState>((set, get) => ({
  currentPath: "",
  history: [],
  historyIndex: -1,
  canGoBack: false,
  canGoForward: false,
  refreshTrigger: 0,

  navigateTo: (path: string) => {
    const { history, historyIndex } = get();
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(path);
    set({
      currentPath: path,
      history: newHistory,
      historyIndex: newHistory.length - 1,
      canGoBack: newHistory.length > 1,
      canGoForward: false,
    });
  },

  goBack: () => {
    const { history, historyIndex } = get();
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      set({
        currentPath: history[newIndex],
        historyIndex: newIndex,
        canGoBack: newIndex > 0,
        canGoForward: true,
      });
    }
  },

  goForward: () => {
    const { history, historyIndex } = get();
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      set({
        currentPath: history[newIndex],
        historyIndex: newIndex,
        canGoBack: true,
        canGoForward: newIndex < history.length - 1,
      });
    }
  },

  goUp: () => {
    const { currentPath, navigateTo } = get();
    const parent = currentPath.split("/").slice(0, -1).join("/") || "/";
    if (parent !== currentPath) {
      navigateTo(parent);
    }
  },

  refreshCurrent: () => {
    set((s) => ({ refreshTrigger: s.refreshTrigger + 1 }));
  },
}));
