import { useEffect, useState } from "react";
import { AppShell } from "./components/layout/AppShell";
import { DetachedPreview } from "./components/preview/DetachedPreview";
import { useSettingsStore } from "./stores/settingsStore";
import { useNavigationStore } from "./stores/navigationStore";
import { useDirectory } from "./hooks/useDirectory";
import { useTheme } from "./hooks/useTheme";
import { useKeyboard } from "./hooks/useKeyboard";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

function MainApp() {
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const navigateTo = useNavigationStore((s) => s.navigateTo);

  useDirectory();
  useTheme();
  useKeyboard();

  useEffect(() => {
    async function init() {
      await loadSettings();
      const home = await invoke<string>("get_home_directory");
      navigateTo(home);
    }
    init();
  }, []);

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
