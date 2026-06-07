import { useEffect, useState } from "react";
import { AppShell } from "./components/layout/AppShell";
import { DetachedPreview } from "./components/preview/DetachedPreview";
import { useSettingsStore } from "./stores/settingsStore";
import { useNavigationStore } from "./stores/navigationStore";
import { useFileListStore } from "./stores/fileListStore";
import { useFontThemeStore } from "./stores/fontThemeStore";
import { useDirectory } from "./hooks/useDirectory";
import { useTheme } from "./hooks/useTheme";
import { useKeyboard } from "./hooks/useKeyboard";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { logger } from "./lib/logger";

function MainApp() {
  const [ready, setReady] = useState(false);

  useDirectory();
  useTheme();
  useKeyboard();

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        logger.info("App initializing");
        await useSettingsStore.getState().loadSettings();
        if (cancelled) return;
        const settings = useSettingsStore.getState().settings;
        logger.info(`Settings loaded: theme=${settings.theme}, font_theme=${settings.font_theme}`);
        useFileListStore.getState().syncFromSettings(settings);
        await useFontThemeStore.getState().loadTheme(settings.font_theme || "default");
        logger.info("Font theme applied");
        if (cancelled) return;
        const home = await invoke<string>("get_home_directory");
        if (cancelled) return;
        useNavigationStore.getState().navigateTo(home);
        logger.info(`Navigated to home: ${home}`);
        setReady(true);

        // Ensure window has focus for drag region to work
        getCurrentWebviewWindow().setFocus().catch(() => {});

        // Check for updates after startup (non-blocking, skipped if updater not configured)
        import("@tauri-apps/plugin-updater").then(({ check }) => {
          check().then(async (update) => {
            if (update) {
              logger.info(`Update available: ${update.version}`);
              await update.downloadAndInstall();
            }
          }).catch(() => {});
        }).catch(() => {});
      } catch (err) {
        logger.error(`Init failed: ${err}`);
        if (!cancelled) setReady(true);
      }
    }
    init();
    return () => { cancelled = true; };
  }, []);

  if (!ready) return null;
  return <AppShell />;
}

export default function App() {
  const [mode, setMode] = useState<"main" | "detached" | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const detachedParam = params.get("detached") === "true";

    if (detachedParam) {
      setMode("detached");
      return;
    }

    // Also check by window label as fallback
    try {
      const currentWindow = getCurrentWebviewWindow();
      if (currentWindow.label.startsWith("preview-")) {
        setMode("detached");
      } else {
        setMode("main");
      }
    } catch {
      setMode("main");
    }
  }, []);

  if (mode === null) return null;

  if (mode === "detached") {
    return <DetachedPreview />;
  }

  return <MainApp />;
}
