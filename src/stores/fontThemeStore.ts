import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

export interface SectionStyle {
  bgColor: string;
  textColor: string;
  borderColor: string;
  borderRadius: number;
  paddingV: number;
  paddingH: number;
}

export interface LayoutConfig {
  toolbarHeight: number;
  statusBarHeight: number;
  panelPaddingX: number;
  panelPaddingY: number;
  radiusSm: number;
  radiusMd: number;
  radiusLg: number;
  radiusXl: number;
}

export interface FontThemeConfig {
  name: string;
  fonts: {
    sidebar: { heading: number; item: number; section: number; badge: number };
    fileList: { header: number; item: number; meta: number };
    preview: { title: number; meta: number; body: number };
    toolbar: { breadcrumb: number; button: number };
    statusBar: { text: number };
    editor: { code: number };
    global?: { xs: number; sm: number; base: number; md: number; lg: number };
  };
  sections?: SectionStyle;
  layout?: LayoutConfig;
}

interface FontThemeState {
  currentTheme: FontThemeConfig | null;
  availableThemes: FontThemeConfig[];
  watchedThemeName: string | null;
  loadTheme: (name: string) => Promise<void>;
  loadAvailableThemes: () => Promise<void>;
  applyTheme: (theme: FontThemeConfig) => void;
  startWatching: (name: string) => void;
}

const defaultFonts: FontThemeConfig = {
  name: "Default",
  fonts: {
    sidebar: { heading: 12, item: 13, section: 12, badge: 10 },
    fileList: { header: 11, item: 14.5, meta: 12.5 },
    preview: { title: 14, meta: 11, body: 13 },
    toolbar: { breadcrumb: 12.5, button: 12 },
    statusBar: { text: 11.5 },
    editor: { code: 13 },
  },
  sections: {
    bgColor: "#2c2c2f",
    textColor: "#f0f0f2",
    borderColor: "#38383a",
    borderRadius: 6,
    paddingV: 6,
    paddingH: 10,
  },
};

function applyCssVariables(theme: FontThemeConfig) {
  const root = document.documentElement;
  const f = theme.fonts;
  root.style.setProperty("--font-sidebar-heading", `${f.sidebar.heading}px`);
  root.style.setProperty("--font-sidebar-item", `${f.sidebar.item}px`);
  root.style.setProperty("--font-sidebar-section", `${f.sidebar.section}px`);
  root.style.setProperty("--font-sidebar-badge", `${f.sidebar.badge}px`);
  root.style.setProperty("--font-filelist-header", `${f.fileList.header}px`);
  root.style.setProperty("--font-filelist-item", `${f.fileList.item}px`);
  root.style.setProperty("--font-filelist-meta", `${f.fileList.meta}px`);
  root.style.setProperty("--font-preview-title", `${f.preview.title}px`);
  root.style.setProperty("--font-preview-meta", `${f.preview.meta}px`);
  root.style.setProperty("--font-preview-body", `${f.preview.body}px`);
  root.style.setProperty("--font-toolbar-breadcrumb", `${f.toolbar.breadcrumb}px`);
  root.style.setProperty("--font-toolbar-button", `${f.toolbar.button}px`);
  root.style.setProperty("--font-statusbar-text", `${f.statusBar.text}px`);
  root.style.setProperty("--font-editor-code", `${f.editor.code}px`);

  const s = theme.sections || defaultFonts.sections!;
  root.style.setProperty("--section-bg", s.bgColor);
  root.style.setProperty("--section-text", s.textColor);
  root.style.setProperty("--section-border", s.borderColor);
  root.style.setProperty("--section-radius", `${s.borderRadius}px`);
  root.style.setProperty("--section-padding-v", `${s.paddingV}px`);
  root.style.setProperty("--section-padding-h", `${s.paddingH}px`);

  // Global font scale tokens
  const g = f.global || { xs: 10, sm: 11, base: 12, md: 13, lg: 14 };
  root.style.setProperty("--font-xs", `${g.xs}px`);
  root.style.setProperty("--font-sm", `${g.sm}px`);
  root.style.setProperty("--font-base", `${g.base}px`);
  root.style.setProperty("--font-md", `${g.md}px`);
  root.style.setProperty("--font-lg", `${g.lg}px`);

  // Layout dimensions
  const l = theme.layout || { toolbarHeight: 42, statusBarHeight: 30, panelPaddingX: 20, panelPaddingY: 12, radiusSm: 3, radiusMd: 5, radiusLg: 8, radiusXl: 12 };
  root.style.setProperty("--toolbar-height", `${l.toolbarHeight}px`);
  root.style.setProperty("--statusbar-height", `${l.statusBarHeight}px`);
  root.style.setProperty("--panel-px", `${l.panelPaddingX}px`);
  root.style.setProperty("--panel-py", `${l.panelPaddingY}px`);
  root.style.setProperty("--radius-sm", `${l.radiusSm}px`);
  root.style.setProperty("--radius-md", `${l.radiusMd}px`);
  root.style.setProperty("--radius-lg", `${l.radiusLg}px`);
  root.style.setProperty("--radius-xl", `${l.radiusXl}px`);
}

let pollInterval: ReturnType<typeof setInterval> | null = null;
let lastThemeJson = "";

export const useFontThemeStore = create<FontThemeState>((set, get) => ({
  currentTheme: null,
  availableThemes: [],
  watchedThemeName: null,

  loadTheme: async (name) => {
    // Handle "scale:N" format (persisted from font slider)
    if (name.startsWith("scale:")) {
      const baseSize = parseFloat(name.slice(6));
      if (!isNaN(baseSize)) {
        const scale = baseSize / 14;
        const s = (v: number) => Math.round(v * scale * 2) / 2;
        const scaledTheme: FontThemeConfig = {
          ...defaultFonts,
          name: "Scaled",
          fonts: {
            sidebar: { heading: s(12), item: s(13.5), section: s(14), badge: s(10) },
            fileList: { header: s(11), item: baseSize, meta: s(12) },
            preview: { title: s(14), meta: s(11), body: s(13) },
            toolbar: { breadcrumb: s(13), button: s(12) },
            statusBar: { text: s(12.5) },
            editor: { code: s(14) },
            global: { xs: s(10), sm: s(11), base: s(12), md: s(13), lg: s(14) },
          },
        };
        get().applyTheme(scaledTheme);
        return;
      }
    }

    try {
      const theme = await invoke<FontThemeConfig>("load_font_theme", { name });
      get().applyTheme(theme);
      get().startWatching(name);
    } catch {
      get().applyTheme(defaultFonts);
    }
  },

  loadAvailableThemes: async () => {
    try {
      const themes = await invoke<FontThemeConfig[]>("list_font_themes");
      set({ availableThemes: themes.length > 0 ? themes : [defaultFonts] });
    } catch {
      set({ availableThemes: [defaultFonts] });
    }
  },

  applyTheme: (theme) => {
    applyCssVariables(theme);
    set({ currentTheme: theme });
  },

  startWatching: (name) => {
    if (pollInterval) clearInterval(pollInterval);
    set({ watchedThemeName: name });
    lastThemeJson = JSON.stringify(get().currentTheme);

    pollInterval = setInterval(async () => {
      try {
        const theme = await invoke<FontThemeConfig>("load_font_theme", { name });
        const json = JSON.stringify(theme);
        if (json !== lastThemeJson) {
          lastThemeJson = json;
          get().applyTheme(theme);
        }
      } catch {}
    }, 2000);
  },
}));
