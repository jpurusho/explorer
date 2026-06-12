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
import { fileActions } from "./hooks/useFileActions";
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

      } catch (err) {
        logger.error(`Init failed: ${err}`);
        if (!cancelled) setReady(true);
      }
    }
    init();
    return () => { cancelled = true; };
  }, []);

  // Native drag-drop from outside the app (Finder, Dock, other apps). With
  // dragDropEnabled: true in tauri.conf.json, the OS intercepts drops before
  // the WebView sees them and Tauri forwards real absolute file paths here.
  // We import them as a copy into the current directory — same flow as the
  // existing in-app folder drop targets.
  useEffect(() => {
    if (!ready) return;
    let unlisten: (() => void) | undefined;
    getCurrentWebviewWindow()
      .onDragDropEvent((event) => {
        if (event.payload.type !== "drop") return;
        const paths = event.payload.paths;
        if (!paths || paths.length === 0) return;
        const dest = useNavigationStore.getState().currentPath;
        if (!dest) return;
        // Skip drops where every source is already inside the destination —
        // copying a file into its own directory is a no-op-with-rename and
        // almost always the user releasing their own drag back into Explorer.
        if (paths.every((p) => p.startsWith(dest + "/") && !p.slice(dest.length + 1).includes("/"))) {
          return;
        }
        fileActions.importPaths(paths, dest);
      })
      .then((u) => { unlisten = u; })
      .catch((e) => logger.error(`drag-drop subscribe failed: ${e}`));
    return () => { unlisten?.(); };
  }, [ready]);

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
