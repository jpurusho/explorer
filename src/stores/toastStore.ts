import { create } from "zustand";

export type ToastKind = "error" | "success" | "info";

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastState {
  toasts: Toast[];
  show: (kind: ToastKind, message: string) => void;
  error: (message: string) => void;
  success: (message: string) => void;
  info: (message: string) => void;
  dismiss: (id: number) => void;
}

let _nextId = 1;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  show: (kind, message) => {
    const id = _nextId++;
    set((s) => ({ toasts: [...s.toasts, { id, kind, message }] }));
    // Auto-dismiss after a delay (errors linger longer than successes).
    const ttl = kind === "error" ? 6000 : 3000;
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, ttl);
  },

  error: (message) => useToastStore.getState().show("error", message),
  success: (message) => useToastStore.getState().show("success", message),
  info: (message) => useToastStore.getState().show("info", message),

  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Convenience for non-component code (stores, hooks). */
export const toast = {
  error: (m: string) => useToastStore.getState().error(m),
  success: (m: string) => useToastStore.getState().success(m),
  info: (m: string) => useToastStore.getState().info(m),
};
