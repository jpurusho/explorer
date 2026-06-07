import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { X } from "lucide-react";
import { clsx } from "clsx";
import { useSettingsStore } from "../../stores/settingsStore";
import { useFileListStore } from "../../stores/fileListStore";
import { useFontThemeStore } from "../../stores/fontThemeStore";
import { themes } from "../../lib/themes";
import type { AppSettings } from "../../types";

interface SettingsPanelProps {
  onClose: () => void;
}

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="text-[var(--font-xs)] font-semibold text-accent/70 uppercase tracking-widest mb-3">
        {title}
      </h3>
      <div className="bg-bg-secondary rounded-lg border border-border/50 p-4 flex flex-col gap-0">
        {children}
      </div>
    </div>
  );
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border/30 last:border-b-0 gap-4">
      <span className="text-[var(--font-md)] text-text-secondary shrink-0">{label}</span>
      <div className="flex items-center justify-end min-w-0">
        {children}
      </div>
    </div>
  );
}

function FontSizeSlider() {
  const currentTheme = useFontThemeStore((s) => s.currentTheme);
  const applyTheme = useFontThemeStore((s) => s.applyTheme);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const baseSize = currentTheme?.fonts?.fileList?.item || 14;
  const [sliderValue, setSliderValue] = useState(baseSize);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newBase = parseFloat(e.target.value);
    setSliderValue(newBase);

    if (!currentTheme) return;

    const small = Math.round((newBase - 2) * 2) / 2;
    const tiny = Math.round((newBase - 4) * 2) / 2;

    const newTheme = {
      ...currentTheme,
      fonts: {
        sidebar: { heading: tiny, item: newBase, section: newBase, badge: tiny },
        fileList: { header: small, item: newBase, meta: newBase },
        preview: { title: newBase + 2, meta: small, body: newBase },
        toolbar: { breadcrumb: newBase, button: small },
        statusBar: { text: newBase },
        editor: { code: newBase },
        global: { xs: tiny, sm: small, base: newBase - 1, md: newBase, lg: newBase + 1 },
      },
    };
    applyTheme(newTheme);
  };

  const handleMouseUp = () => {
    // Persist when user releases the slider
    updateSettings({ font_theme: `scale:${sliderValue}` } as any);
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-text text-center leading-relaxed" style={{ fontSize: `${sliderValue}px` }}>
        The quick brown fox jumps over the lazy dog
      </p>
      <span className="text-[var(--font-sm)] text-accent font-medium tabular-nums">{sliderValue}px</span>
      <input
        type="range"
        min="10"
        max="30"
        step="0.5"
        value={sliderValue}
        onChange={handleChange}
        onMouseUp={handleMouseUp}
        onTouchEnd={handleMouseUp}
        className="w-full h-2 bg-bg-tertiary rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:cursor-pointer"
      />
      <div className="flex justify-between w-full text-[var(--font-xs)] text-text-muted">
        <span>Small</span>
        <span>Medium</span>
        <span>Large</span>
      </div>
    </div>
  );
}

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const viewMode = useFileListStore((s) => s.viewMode);
  const showHiddenFiles = useFileListStore((s) => s.showHiddenFiles);
  const showRowLines = useFileListStore((s) => s.showRowLines);
  const sortBy = useFileListStore((s) => s.sortBy);
  const setViewMode = useFileListStore((s) => s.setViewMode);
  const toggleHiddenFiles = useFileListStore((s) => s.toggleHiddenFiles);
  const setShowRowLines = useFileListStore((s) => s.setShowRowLines);
  const setSortBy = useFileListStore((s) => s.setSortBy);

  return (
    <div className="h-full bg-bg flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between py-3.5 border-b border-border shrink-0 bg-bg-secondary" style={{ padding: "14px 20px" }}>
        <h2 className="text-[var(--font-lg)] font-semibold text-text">Settings</h2>
        <button
          onClick={onClose}
          className="p-1.5 rounded-[5px] hover:bg-bg-hover text-text-muted hover:text-text transition-colors"
        >
          <X size={15} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
        <div style={{ padding: "24px 20px" }}>
        <SettingsSection title="Color Theme">
          <p className="text-[var(--font-sm)] text-text-muted mb-3">Controls the overall color scheme of the application.</p>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => setTheme("system")}
              className={clsx(
                "flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-all",
                settings.theme === "system"
                  ? "border-accent bg-accent/8"
                  : "border-border hover:border-text-muted"
              )}
            >
              <div className="w-full h-6 rounded flex overflow-hidden border border-border/50">
                <div className="flex-1 bg-[#1c1c1e]" /><div className="flex-1 bg-[#ffffff]" />
              </div>
              <span className="text-[var(--font-xs)] text-text-secondary">System</span>
            </button>
            {themes.map((t) => {
              const swatches: Record<string, string[]> = {
                light: ["#ffffff", "#f8f8fa", "#0066ff"],
                dark: ["#1c1c1e", "#232326", "#4da8ff"],
                material: ["#212121", "#2c2c2c", "#82b1ff"],
                github: ["#0d1117", "#161b22", "#58a6ff"],
                monokai: ["#272822", "#3e3d32", "#a6e22e"],
                atom: ["#282c34", "#2c313a", "#61afef"],
              };
              const colors = swatches[t.id] || ["#333", "#444", "#66f"];
              return (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  className={clsx(
                    "flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-all",
                    settings.theme === t.id
                      ? "border-accent bg-accent/8"
                      : "border-border hover:border-text-muted"
                  )}
                >
                  <div className="w-full h-6 rounded flex overflow-hidden border border-border/50">
                    <div className="flex-1" style={{ backgroundColor: colors[0] }} />
                    <div className="flex-1" style={{ backgroundColor: colors[1] }} />
                    <div className="w-2" style={{ backgroundColor: colors[2] }} />
                  </div>
                  <span className="text-[var(--font-xs)] text-text-secondary">{t.label}</span>
                </button>
              );
            })}
          </div>
        </SettingsSection>

        <SettingsSection title="Font Size">
          <p className="text-[var(--font-sm)] text-text-muted mb-4">
            Drag to adjust all font sizes proportionally.
          </p>
          <FontSizeSlider />
        </SettingsSection>

        <SettingsSection title="File Display">
          <SettingRow label="Default view">
            <div className="flex gap-1.5">
              <button
                onClick={() => { setViewMode("list"); updateSettings({ default_view: "list" }); }}
                className={clsx(
                  "px-3 py-1 rounded-[5px] text-[var(--font-sm)] font-medium transition-colors",
                  viewMode === "list"
                    ? "bg-accent/15 text-accent"
                    : "bg-bg-tertiary text-text-muted hover:text-text-secondary"
                )}
              >
                List
              </button>
              <button
                onClick={() => { setViewMode("grid"); updateSettings({ default_view: "grid" }); }}
                className={clsx(
                  "px-3 py-1 rounded-[5px] text-[var(--font-sm)] font-medium transition-colors",
                  viewMode === "grid"
                    ? "bg-accent/15 text-accent"
                    : "bg-bg-tertiary text-text-muted hover:text-text-secondary"
                )}
              >
                Grid
              </button>
              <button
                onClick={() => { setViewMode("columns"); updateSettings({ default_view: "columns" }); }}
                className={clsx(
                  "px-3 py-1 rounded-[5px] text-[var(--font-sm)] font-medium transition-colors",
                  viewMode === "columns"
                    ? "bg-accent/15 text-accent"
                    : "bg-bg-tertiary text-text-muted hover:text-text-secondary"
                )}
              >
                Columns
              </button>
            </div>
          </SettingRow>

          <SettingRow label="Show hidden files">
            <button
              onClick={() => { toggleHiddenFiles(); }}
              className={clsx(
                "w-9 h-5 rounded-full transition-colors relative shrink-0",
                showHiddenFiles ? "bg-accent" : "bg-bg-tertiary border border-border"
              )}
            >
              <div
                className={clsx(
                  "w-3.5 h-3.5 rounded-full bg-white shadow-sm absolute top-[3px] transition-transform",
                  showHiddenFiles ? "translate-x-[18px]" : "translate-x-[3px]"
                )}
              />
            </button>
          </SettingRow>

          <SettingRow label="Row lines">
            <button
              onClick={() => setShowRowLines(!showRowLines)}
              className={clsx(
                "w-9 h-5 rounded-full transition-colors relative shrink-0",
                showRowLines ? "bg-accent" : "bg-bg-tertiary border border-border"
              )}
            >
              <div
                className={clsx(
                  "w-3.5 h-3.5 rounded-full bg-white shadow-sm absolute top-[3px] transition-transform",
                  showRowLines ? "translate-x-[18px]" : "translate-x-[3px]"
                )}
              />
            </button>
          </SettingRow>

          <SettingRow label="Sort by">
            <select
              value={sortBy}
              onChange={(e) => { setSortBy(e.target.value as AppSettings["sort_by"]); }}
              className="bg-bg-tertiary border border-border rounded-[5px] px-2.5 py-1 text-[var(--font-sm)] text-text-secondary outline-none"
            >
              <option value="name">Name</option>
              <option value="size">Size</option>
              <option value="modified">Modified</option>
              <option value="type">Type</option>
            </select>
          </SettingRow>
        </SettingsSection>

        <SettingsSection title="Editor">
          <div className="text-[var(--font-sm)] text-text-muted leading-relaxed">
            <p className="mb-3 text-text-secondary">Vim keybindings:</p>
            <div className="grid grid-cols-[80px_1fr] gap-y-2">
              <span className="text-text-secondary font-mono text-[var(--font-sm)]">i</span>
              <span>Enter insert mode</span>
              <span className="text-text-secondary font-mono text-[var(--font-sm)]">Esc</span>
              <span>Return to normal mode</span>
              <span className="text-text-secondary font-mono text-[var(--font-sm)]">:w</span>
              <span>Save file</span>
              <span className="text-text-secondary font-mono text-[var(--font-sm)]">⌘S</span>
              <span>Save file</span>
              <span className="text-text-secondary font-mono text-[var(--font-sm)]">⌘F</span>
              <span>Find in file</span>
              <span className="text-text-secondary font-mono text-[var(--font-sm)]">/pattern</span>
              <span>Vim search</span>
              <span className="text-text-secondary font-mono text-[var(--font-sm)]">dd</span>
              <span>Delete line</span>
              <span className="text-text-secondary font-mono text-[var(--font-sm)]">u</span>
              <span>Undo</span>
              <span className="text-text-secondary font-mono text-[var(--font-sm)]">Ctrl+r</span>
              <span>Redo</span>
            </div>
          </div>
        </SettingsSection>

        <SettingsSection title="Navigation">
          <div className="grid grid-cols-[80px_1fr] gap-y-2 text-[var(--font-sm)]">
            <span className="text-text-secondary font-mono text-[var(--font-sm)]">↑/↓</span>
            <span className="text-text-muted">Navigate files</span>
            <span className="text-text-secondary font-mono text-[var(--font-sm)]">Enter</span>
            <span className="text-text-muted">Open folder</span>
            <span className="text-text-secondary font-mono text-[var(--font-sm)]">⌘⌫</span>
            <span className="text-text-muted">Go up</span>
            <span className="text-text-secondary font-mono text-[var(--font-sm)]">⌘[</span>
            <span className="text-text-muted">Back</span>
            <span className="text-text-secondary font-mono text-[var(--font-sm)]">⌘]</span>
            <span className="text-text-muted">Forward</span>
            <span className="text-text-secondary font-mono text-[var(--font-sm)]">⌘1</span>
            <span className="text-text-muted">List view</span>
            <span className="text-text-secondary font-mono text-[var(--font-sm)]">⌘2</span>
            <span className="text-text-muted">Grid view</span>
            <span className="text-text-secondary font-mono text-[var(--font-sm)]">⌘⇧.</span>
            <span className="text-text-muted">Toggle hidden files</span>
            <span className="text-text-secondary font-mono text-[var(--font-sm)]">⌘,</span>
            <span className="text-text-muted">Settings</span>
            <span className="text-text-secondary font-mono text-[var(--font-sm)]">⌘F</span>
            <span className="text-text-muted">Find</span>
          </div>
        </SettingsSection>

        <SettingsSection title="Search Index">
          <IndexStatsPanel />
        </SettingsSection>
      </div>
      </div>
    </div>
  );
}

function IndexStatsPanel() {
  const [stats, setStats] = useState<{ file_count: number; dir_count: number; trigram_count: number; db_size_bytes: number } | null>(null);
  const [rebuilding, setRebuilding] = useState(false);

  useEffect(() => {
    invoke<any>("get_index_stats").then(setStats).catch(() => {});
    const interval = setInterval(() => {
      invoke<any>("get_index_stats").then(setStats).catch(() => {});
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  return (
    <div className="space-y-3">
      {stats && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-bg-tertiary rounded-lg p-3 text-center">
            <div className="text-[var(--font-lg)] text-text font-bold">{stats.file_count.toLocaleString()}</div>
            <div className="text-[var(--font-xs)] text-text-muted">Files</div>
          </div>
          <div className="bg-bg-tertiary rounded-lg p-3 text-center">
            <div className="text-[var(--font-lg)] text-text font-bold">{stats.dir_count.toLocaleString()}</div>
            <div className="text-[var(--font-xs)] text-text-muted">Folders</div>
          </div>
          <div className="bg-bg-tertiary rounded-lg p-3 text-center">
            <div className="text-[var(--font-lg)] text-text font-bold">{stats.trigram_count.toLocaleString()}</div>
            <div className="text-[var(--font-xs)] text-text-muted">Trigrams</div>
          </div>
          <div className="bg-bg-tertiary rounded-lg p-3 text-center">
            <div className="text-[var(--font-lg)] text-text font-bold">{formatBytes(stats.db_size_bytes)}</div>
            <div className="text-[var(--font-xs)] text-text-muted">Index Size</div>
          </div>
        </div>
      )}
      <div className="flex gap-2">
        <button
          onClick={() => { invoke("rebuild_trigrams"); setRebuilding(true); setTimeout(() => setRebuilding(false), 5000); }}
          disabled={rebuilding}
          className="px-3 py-1.5 rounded-lg text-[var(--font-sm)] font-medium border border-border bg-bg-tertiary text-text-secondary hover:border-accent hover:text-accent disabled:opacity-50 transition-all"
        >
          {rebuilding ? "Rebuilding..." : "Rebuild Trigrams"}
        </button>
        <button
          onClick={() => { invoke("reindex"); setRebuilding(true); setTimeout(() => setRebuilding(false), 10000); }}
          disabled={rebuilding}
          className="px-3 py-1.5 rounded-lg text-[var(--font-sm)] font-medium border border-border bg-bg-tertiary text-text-secondary hover:border-accent hover:text-accent disabled:opacity-50 transition-all"
        >
          {rebuilding ? "Reindexing..." : "Full Reindex"}
        </button>
      </div>
      <p className="text-[var(--font-xs)] text-text-muted">
        Index stored at ~/.config/explorer/index.db
      </p>
      <IndexPathsEditor />
    </div>
  );
}

function IndexPathsEditor() {
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const [newPath, setNewPath] = useState("");

  const paths = settings.index_paths?.length ? settings.index_paths : [];
  const displayPaths = paths.length ? paths : ["~ (all of home — default)"];

  const addPath = () => {
    const trimmed = newPath.trim();
    if (!trimmed) return;
    const expanded = trimmed.startsWith("~")
      ? trimmed.replace("~", `/Users/${settings.favorites[0]?.split("/")[2] || ""}`)
      : trimmed;
    const updated = [...(settings.index_paths || []), expanded];
    updateSettings({ index_paths: updated });
    setNewPath("");
  };

  const removePath = (idx: number) => {
    const updated = (settings.index_paths || []).filter((_, i) => i !== idx);
    updateSettings({ index_paths: updated });
  };

  return (
    <div className="mt-3 pt-3 border-t border-border/30">
      <div className="text-[var(--font-xs)] text-text-muted uppercase tracking-wider mb-2 font-semibold">Indexed Paths</div>
      <div className="space-y-1 mb-2">
        {displayPaths.map((p, i) => (
          <div key={i} className="flex items-center justify-between gap-2 text-[var(--font-sm)] text-text-secondary bg-bg-tertiary rounded px-2 py-1">
            <span className="truncate">{p}</span>
            {paths.length > 0 && (
              <button onClick={() => removePath(i)} className="text-text-muted hover:text-red-400 shrink-0 text-[var(--font-xs)]">✕</button>
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={newPath}
          onChange={(e) => setNewPath(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") addPath(); }}
          placeholder="/path/to/index"
          className="flex-1 bg-bg-tertiary border border-border rounded px-2 py-1 text-[var(--font-sm)] text-text outline-none placeholder:text-text-muted/40"
        />
        <button
          onClick={addPath}
          className="px-3 py-1 rounded text-[var(--font-sm)] font-medium bg-accent/15 text-accent hover:bg-accent/25 transition-colors shrink-0"
        >
          Add
        </button>
      </div>
      <p className="text-[var(--font-xs)] text-text-muted mt-1.5">
        Empty = index all of $HOME. Reindex after changing paths.
      </p>
    </div>
  );
}
