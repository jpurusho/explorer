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
import { ScratchPad } from "../scratch/ScratchPad";
import { Toaster } from "../Toaster";
import { useSettingsStore } from "../../stores/settingsStore";
import { useEditorBufferStore } from "../../stores/editorBufferStore";
import { toast } from "../../stores/toastStore";
import { openNewWindow } from "../../lib/detachPreview";
import { invoke } from "@tauri-apps/api/core";
import { updateCache, emitContentUpdated } from "../../lib/previewCache";

export function AppShell() {
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const [sidebarWidth, setSidebarWidth] = useState(settings.sidebar_width || 220);
  const [previewWidth, setPreviewWidth] = useState(settings.preview_width || 420);
  const [searchVisible, setSearchVisible] = useState(false);
  const [globalSearchVisible, setGlobalSearchVisible] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<string | undefined>(undefined);
  const [scratchOpen, setScratchOpen] = useState(false);
  const [windowWidth, setWindowWidth] = useState(() => window.innerWidth);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track window width so the side panels can be clamped to never starve the
  // center file list (e.g. when a wide preview width is restored on a narrower
  // window after an update/relaunch).
  useEffect(() => {
    const onResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Center panel can shrink to 180px — at that width the FileList header
  // columns overflow but the container scrolls horizontally, and the grid
  // view collapses to a single card column.
  const MIN_CENTER = 180;
  const MIN_PREVIEW = 200;
  const effectiveSidebarWidth = Math.max(100, Math.min(sidebarWidth, windowWidth - MIN_CENTER - MIN_PREVIEW));
  const effectivePreviewWidth = Math.max(
    MIN_PREVIEW,
    Math.min(previewWidth, windowWidth - effectiveSidebarWidth - MIN_CENTER)
  );

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

  const handlePanelSwitch = useCallback((toggle: () => void) => {
    // Buffer store preserves editor state across panel switches — just toggle.
    // If autosave is on, flush dirty buffers to disk as a courtesy.
    const { autosave } = useSettingsStore.getState().settings;
    if (autosave) {
      const dirtyPaths = useEditorBufferStore.getState().getDirtyPaths();
      for (const p of dirtyPaths) {
        const buffer = useEditorBufferStore.getState().getBuffer(p);
        if (buffer) {
          invoke("write_file", { path: p, content: buffer.content }).then(() => {
            const bytes = new TextEncoder().encode(buffer.content).length;
            updateCache(p, { content: buffer.content, mime_type: "", size: bytes, truncated: false });
            emitContentUpdated(p);
            useEditorBufferStore.getState().markSaved(p, buffer.content);
          }).catch((err) => {
            // Don't markSaved — leave the dirty flag so the user knows the
            // change isn't on disk. Surface the failure so it isn't silent.
            console.error("[AppShell] Autosave failed for", p, err);
            const name = p.split("/").pop() || p;
            toast.error(`Auto-save failed for ${name}: ${err instanceof Error ? err.message : String(err)}`);
          });
        }
      }
    }
    toggle();
  }, []);

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
        handlePanelSwitch(() => {
          setSettingsTab(undefined);
          setSettingsOpen((s) => !s);
        });
      }
      if (e.metaKey && e.key === "/") {
        e.preventDefault();
        handlePanelSwitch(() => {
          setSettingsTab("shortcuts");
          setSettingsOpen(true);
        });
      }
      if (e.metaKey && e.key === "e") {
        e.preventDefault();
        handlePanelSwitch(() => {
          setScratchOpen((s) => !s);
        });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);


  return (
    <>
    <GlobalSearch visible={globalSearchVisible} onClose={() => setGlobalSearchVisible(false)} />
    <CommandPalette open={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} onOpenSettings={() => { setCommandPaletteOpen(false); setSettingsOpen(true); }} />
    <Toaster />
    <div className="h-screen w-screen flex flex-col bg-bg overflow-hidden select-none">
      <Toolbar onOpenSettings={() => handlePanelSwitch(() => setSettingsOpen(!settingsOpen))} onOpenSearch={() => setGlobalSearchVisible(true)} onOpenScratch={() => handlePanelSwitch(() => setScratchOpen((s) => !s))} />
      <SearchBar visible={searchVisible} onClose={() => setSearchVisible(false)} />

      <div className="flex-1 flex overflow-hidden">
        <div style={{ width: effectiveSidebarWidth }} className="shrink-0 border-r border-border/50 bg-bg-secondary/60 backdrop-blur-xl">
          <Sidebar />
        </div>
        <ResizeHandle onResize={handleSidebarResize} direction="left" />

        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <ContentPanel />
        </div>

        <ResizeHandle onResize={handlePreviewResize} direction="right" />

        <div style={{ width: effectivePreviewWidth }} className="shrink-0 overflow-hidden border-l border-border/50">
          {settingsOpen ? (
            <SettingsPanel onClose={() => setSettingsOpen(false)} initialTab={settingsTab} />
          ) : scratchOpen ? (
            <ScratchPad onClose={() => setScratchOpen(false)} />
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
