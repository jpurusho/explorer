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
  show_row_lines: false,
  column_name_width: 300,
  column_type_width: 50,
  column_size_width: 58,
  column_modified_width: 90,
  column_type_visible: true,
  column_size_visible: true,
  column_modified_visible: true,
  font_theme: "default",
  index_paths: [],
  show_favorites_section: true,
  show_folders_section: true,
  show_tags_section: true,
  show_snippets_section: true,
  favorites_height: 140,
  folders_height: 300,
  preview_max_mb: 5,
  grid_card_size: 175,
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
      // Migrate removed "columns" view mode
      if ((settings.default_view as string) === "columns") settings.default_view = "list";
      // Self-heal: an empty favorites array means defaults were never seeded (or
      // a prior bug wiped them). Repopulate from the real home directory so the
      // sidebar roots at the user's home instead of falling back to "/Users".
      if (!settings.favorites || settings.favorites.length === 0) {
        try {
          const home = await invoke<string>("get_home_directory");
          settings.favorites = [home, `${home}/Documents`, `${home}/Downloads`, `${home}/Desktop`];
          await invoke("save_settings", { settings });
        } catch {
          // leave favorites empty; sidebar falls back to /Users
        }
      }

      // Auto-add snippets directory to search index if not already present
      try {
        const home = await invoke<string>("get_home_directory");
        const snippetsPath = `${home}/.config/explorer/snippets`;
        if (!settings.index_paths?.includes(snippetsPath)) {
          settings.index_paths = [...(settings.index_paths || []), snippetsPath];
          await invoke("save_settings", { settings });
        }
      } catch {
        // Ignore if we can't get home dir
      }
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
    // Guard against persisting before the real config has loaded — otherwise an
    // early updateSettings() (e.g. a sidebar toggle on mount) would merge into
    // the in-memory DEFAULTS and overwrite the saved config (resetting theme,
    // font, favorites, etc.).
    if (!get().loaded) return;
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
