import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

type UndoAction =
  | { type: "copy"; createdPaths: string[] }
  | { type: "move"; moves: { from: string; to: string }[] }
  | { type: "duplicate"; createdPaths: string[] }
  | { type: "trash"; paths: string[] };

interface UndoState {
  stack: UndoAction[];
  push: (action: UndoAction) => void;
  undo: () => Promise<boolean>;
  canUndo: () => boolean;
}

export const useUndoStore = create<UndoState>((set, get) => ({
  stack: [],

  push: (action) => set((s) => ({ stack: [...s.stack.slice(-49), action] })),

  canUndo: () => get().stack.length > 0,

  undo: async () => {
    const { stack } = get();
    if (stack.length === 0) return false;

    const action = stack[stack.length - 1];
    let success = false;

    try {
      switch (action.type) {
        case "copy":
        case "duplicate":
          await invoke("trash_items", { paths: action.createdPaths });
          success = true;
          break;
        case "move":
          for (const m of action.moves) {
            await invoke("move_items", { paths: [m.to], destination: m.from.substring(0, m.from.lastIndexOf("/")) });
          }
          success = true;
          break;
        case "trash":
          // Can't undo trash (macOS manages the trash bin)
          success = false;
          break;
      }
    } catch {
      success = false;
    }

    if (success) {
      set((s) => ({ stack: s.stack.slice(0, -1) }));
    }
    return success;
  },
}));
