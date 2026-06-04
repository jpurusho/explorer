import { create } from "zustand";
import type { AppSettings } from "../types";
import type { ThemeName } from "../lib/themes";
import { applyTheme, getSystemTheme } from "../lib/themes";
import { invoke } from "@tauri-apps/api/core";

interface SettingsState {
  settings: AppSettings;
  loaded: boolean;
  resolvedTheme: ThemeName;
  loadSettings: () => Promise<void>;
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>;
  setTheme: (theme: AppSettings["theme"]) => void;
}

const defaultSettings: AppSettings = {
  theme: "system",
  default_view: "list",
  show_hidden_files: false,
  sort_by: "name",
  sort_direction: "asc",
  sidebar_width: 240,
  preview_width: 420,
  favorites: [],
  recent_paths: [],
  column_type_width: 50,
  column_size_width: 58,
  column_modified_width: 90,
  column_type_visible: true,
  column_size_visible: true,
  column_modified_visible: true,
  font_theme: "default",
};

function resolveTheme(theme: AppSettings["theme"]): ThemeName {
  if (theme === "system") return getSystemTheme();
  return theme;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: defaultSettings,
  loaded: false,
  resolvedTheme: getSystemTheme(),

  loadSettings: async () => {
    try {
      const settings = await invoke<AppSettings>("load_settings");
      const resolved = resolveTheme(settings.theme);
      applyTheme(resolved);
      set({ settings, loaded: true, resolvedTheme: resolved });
    } catch {
      const resolved = resolveTheme("system");
      applyTheme(resolved);
      set({ settings: defaultSettings, loaded: true, resolvedTheme: resolved });
    }
  },

  updateSettings: async (partial) => {
    const current = get().settings;
    const updated = { ...current, ...partial };
    set({ settings: updated });
    try {
      await invoke("save_settings", { settings: updated });
    } catch {
      // Settings save failed silently — will retry on next change
    }
  },

  setTheme: (theme) => {
    const resolved = resolveTheme(theme);
    applyTheme(resolved);
    set({ resolvedTheme: resolved });
    get().updateSettings({ theme });
  },
}));
