import { create } from "zustand";
import type { ScratchFormat } from "../lib/textFormat";

/** Auto means "detect from content"; the others force a specific formatter. */
export type ScratchMode = "auto" | ScratchFormat;

interface ScratchState {
  rawText: string;
  mode: ScratchMode;
  wrapWidth: number;
  // Plain-text transform toggles (applied in this order when mode is text)
  doCleanup: boolean;
  doWrap: boolean;
  doJustify: boolean;
  doQuote: boolean;
  doJoin: boolean;
  // Markdown: show raw source vs rendered
  mdShowSource: boolean;
  lastSaveDir: string | null;

  setRawText: (t: string) => void;
  setMode: (m: ScratchMode) => void;
  setWrapWidth: (n: number) => void;
  toggle: (key: "doCleanup" | "doWrap" | "doJustify" | "doQuote" | "doJoin" | "mdShowSource") => void;
  setLastSaveDir: (dir: string) => void;
  clear: () => void;
}

const STORAGE_KEY = "explorer.scratch";

interface Persisted {
  rawText: string;
  mode: ScratchMode;
  wrapWidth: number;
  doCleanup: boolean;
  doWrap: boolean;
  doJustify: boolean;
  doQuote: boolean;
  doJoin: boolean;
  mdShowSource: boolean;
  lastSaveDir: string | null;
}

const defaults: Persisted = {
  rawText: "",
  mode: "auto",
  wrapWidth: 80,
  doCleanup: false,
  doWrap: false,
  doJustify: false,
  doQuote: false,
  doJoin: false,
  mdShowSource: false,
  lastSaveDir: null,
};

function load(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    return { ...defaults, ...JSON.parse(raw) };
  } catch {
    return defaults;
  }
}

let _saveTimer: ReturnType<typeof setTimeout> | null = null;
function persist(state: Persisted) {
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // storage full / unavailable — drafts just won't persist this session
    }
  }, 300);
}

export const useScratchStore = create<ScratchState>((set, get) => {
  const snapshot = (): Persisted => {
    const s = get();
    return {
      rawText: s.rawText,
      mode: s.mode,
      wrapWidth: s.wrapWidth,
      doCleanup: s.doCleanup,
      doWrap: s.doWrap,
      doJustify: s.doJustify,
      doQuote: s.doQuote,
      doJoin: s.doJoin,
      mdShowSource: s.mdShowSource,
      lastSaveDir: s.lastSaveDir,
    };
  };
  const save = () => persist(snapshot());

  return {
    ...load(),

    setRawText: (rawText) => { set({ rawText }); save(); },
    setMode: (mode) => { set({ mode }); save(); },
    setWrapWidth: (wrapWidth) => { set({ wrapWidth }); save(); },
    toggle: (key) => { set((s) => ({ [key]: !s[key] }) as Partial<ScratchState>); save(); },
    setLastSaveDir: (lastSaveDir) => { set({ lastSaveDir }); save(); },
    clear: () => { set({ rawText: "" }); save(); },
  };
});
