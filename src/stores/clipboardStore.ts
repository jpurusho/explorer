import { create } from "zustand";

interface ClipboardState {
  paths: string[];
  operation: "copy" | "cut" | null;
  setPaths: (paths: string[], op: "copy" | "cut") => void;
  clear: () => void;
}

export const useClipboardStore = create<ClipboardState>((set) => ({
  paths: [],
  operation: null,
  setPaths: (paths, op) => set({ paths, operation: op }),
  clear: () => set({ paths: [], operation: null }),
}));
