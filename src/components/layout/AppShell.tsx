import { useState, useCallback, useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { Toolbar } from "./Toolbar";
import { ContentPanel } from "./ContentPanel";
import { StatusBar } from "./StatusBar";
import { PreviewPanel } from "../preview/PreviewPanel";
import { ResizeHandle } from "./ResizeHandle";
import { SearchBar } from "../search/SearchBar";
import { SettingsPanel } from "../settings/SettingsPanel";

export function AppShell() {
  const [sidebarWidth, setSidebarWidth] = useState(220);
  const [previewWidth, setPreviewWidth] = useState(420);
  const [searchVisible, setSearchVisible] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const handleSidebarResize = useCallback((delta: number) => {
    setSidebarWidth((w) => Math.max(160, Math.min(400, w + delta)));
  }, []);

  const handlePreviewResize = useCallback((delta: number) => {
    setPreviewWidth((w) => Math.max(280, Math.min(700, w + delta)));
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === "f") {
        e.preventDefault();
        setSearchVisible(true);
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
    <div className="h-screen w-screen flex flex-col bg-bg overflow-hidden select-none">
      <Toolbar onOpenSettings={() => setSettingsOpen(!settingsOpen)} />
      <SearchBar visible={searchVisible} onClose={() => setSearchVisible(false)} />

      <div className="flex-1 flex overflow-hidden">
        <div style={{ width: sidebarWidth }} className="shrink-0 border-r border-border">
          <Sidebar />
        </div>
        <ResizeHandle onResize={handleSidebarResize} direction="left" />

        <div className="flex-1 overflow-hidden min-w-0">
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
  );
}
