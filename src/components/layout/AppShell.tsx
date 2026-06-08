import { useState, useCallback, useEffect, useRef } from "react";
import { Sidebar } from "./Sidebar";
import { Toolbar } from "./Toolbar";
import { ContentPanel } from "./ContentPanel";
import { StatusBar } from "./StatusBar";
import { PreviewPanel } from "../preview/PreviewPanel";
import { ResizeHandle } from "./ResizeHandle";
import { SearchBar } from "../search/SearchBar";
import { GlobalSearch } from "../search/GlobalSearch";
import { CommandPalette } from "../CommandPalette";
import { SettingsPanel } from "../settings/SettingsPanel";
import { useSettingsStore } from "../../stores/settingsStore";
import { openNewWindow } from "../../lib/detachPreview";

export function AppShell() {
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const [sidebarWidth, setSidebarWidth] = useState(settings.sidebar_width || 220);
  const [previewWidth, setPreviewWidth] = useState(settings.preview_width || 420);
  const [searchVisible, setSearchVisible] = useState(false);
  const [globalSearchVisible, setGlobalSearchVisible] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persistWidths = useCallback((sw: number, pw: number) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      updateSettings({ sidebar_width: sw, preview_width: pw });
    }, 500);
  }, [updateSettings]);

  const handleSidebarResize = useCallback((delta: number) => {
    setSidebarWidth((w) => {
      const next = Math.max(100, w + delta);
      persistWidths(next, previewWidth);
      return next;
    });
  }, [previewWidth, persistWidths]);

  const handlePreviewResize = useCallback((delta: number) => {
    setPreviewWidth((w) => {
      const maxWidth = Math.floor(window.innerWidth * 0.6);
      const next = Math.max(200, Math.min(maxWidth, w + delta));
      persistWidths(sidebarWidth, next);
      return next;
    });
  }, [sidebarWidth, persistWidths]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === "f") {
        e.preventDefault();
        setSearchVisible(true);
      }
      if (e.metaKey && e.key === "p") {
        e.preventDefault();
        setGlobalSearchVisible(true);
      }
      if (e.metaKey && e.key === "n") {
        e.preventDefault();
        openNewWindow();
      }
      if (e.metaKey && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen((s) => !s);
      }
      if (e.metaKey && e.key === ",") {
        e.preventDefault();
        setSettingsOpen((s) => !s);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <>
    <GlobalSearch visible={globalSearchVisible} onClose={() => setGlobalSearchVisible(false)} />
    <CommandPalette open={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} onOpenSettings={() => { setCommandPaletteOpen(false); setSettingsOpen(true); }} />
    <div className="h-screen w-screen flex flex-col bg-bg overflow-hidden select-none">
      <Toolbar onOpenSettings={() => setSettingsOpen(!settingsOpen)} onOpenSearch={() => setGlobalSearchVisible(true)} />
      <SearchBar visible={searchVisible} onClose={() => setSearchVisible(false)} />

      <div className="flex-1 flex overflow-hidden">
        <div style={{ width: sidebarWidth }} className="shrink-0 border-r border-border bg-bg-secondary/60 backdrop-blur-xl">
          <Sidebar />
        </div>
        <ResizeHandle onResize={handleSidebarResize} direction="left" />

        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <ContentPanel />
        </div>

        <ResizeHandle onResize={handlePreviewResize} direction="right" />

        <div style={{ width: previewWidth }} className="shrink-0 overflow-hidden border-l border-border">
          {settingsOpen ? (
            <SettingsPanel onClose={() => setSettingsOpen(false)} />
          ) : (
            <PreviewPanel />
          )}
        </div>
      </div>

      <StatusBar />
    </div>
    </>
  );
}
