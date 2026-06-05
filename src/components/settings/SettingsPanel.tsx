import { useState, useRef } from "react";
import { X } from "lucide-react";
import { clsx } from "clsx";
import { useSettingsStore } from "../../stores/settingsStore";
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
    <div className="flex items-center justify-between py-3 border-b border-border/30 last:border-b-0 gap-6 pr-2">
      <span className="text-[var(--font-md)] text-text-secondary shrink-0">{label}</span>
      <div className="flex items-center justify-end min-w-0 shrink-0">
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
  const originalBaseRef = useRef(baseSize);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newBase = parseFloat(e.target.value);
    setSliderValue(newBase);

    if (!currentTheme) return;
    const scale = newBase / originalBaseRef.current;
    const scaled = (v: number) => Math.round(v * scale * 2) / 2;

    const newTheme = {
      ...currentTheme,
      fonts: {
        sidebar: { heading: scaled(12), item: scaled(13.5), section: scaled(14), badge: scaled(10) },
        fileList: { header: scaled(11), item: newBase, meta: scaled(12) },
        preview: { title: scaled(16), meta: scaled(12), body: scaled(14) },
        toolbar: { breadcrumb: scaled(13), button: scaled(12) },
        statusBar: { text: scaled(12.5) },
        editor: { code: scaled(14) },
        global: { xs: scaled(10), sm: scaled(11), base: scaled(12), md: scaled(13), lg: scaled(14) },
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

  return (
    <div className="h-full bg-bg flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between py-3.5 border-b border-border shrink-0 bg-bg-secondary" style={{ padding: "14px var(--panel-px)" }}>
        <h2 className="text-[var(--font-lg)] font-semibold text-text">Settings</h2>
        <button
          onClick={onClose}
          className="p-1.5 rounded-[5px] hover:bg-bg-hover text-text-muted hover:text-text transition-colors"
        >
          <X size={15} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto py-6" style={{ padding: "24px var(--panel-px)" }}>
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
                onClick={() => updateSettings({ default_view: "list" })}
                className={clsx(
                  "px-3 py-1 rounded-[5px] text-[var(--font-sm)] font-medium transition-colors",
                  settings.default_view === "list"
                    ? "bg-accent/15 text-accent"
                    : "bg-bg-tertiary text-text-muted hover:text-text-secondary"
                )}
              >
                List
              </button>
              <button
                onClick={() => updateSettings({ default_view: "grid" })}
                className={clsx(
                  "px-3 py-1 rounded-[5px] text-[var(--font-sm)] font-medium transition-colors",
                  settings.default_view === "grid"
                    ? "bg-accent/15 text-accent"
                    : "bg-bg-tertiary text-text-muted hover:text-text-secondary"
                )}
              >
                Grid
              </button>
            </div>
          </SettingRow>

          <SettingRow label="Show hidden files">
            <button
              onClick={() => updateSettings({ show_hidden_files: !settings.show_hidden_files })}
              className={clsx(
                "w-9 h-5 rounded-full transition-colors relative shrink-0",
                settings.show_hidden_files ? "bg-accent" : "bg-bg-tertiary border border-border"
              )}
            >
              <div
                className={clsx(
                  "w-3.5 h-3.5 rounded-full bg-white shadow-sm absolute top-[3px] transition-transform",
                  settings.show_hidden_files ? "translate-x-[18px]" : "translate-x-[3px]"
                )}
              />
            </button>
          </SettingRow>

          <SettingRow label="Sort by">
            <select
              value={settings.sort_by}
              onChange={(e) => updateSettings({ sort_by: e.target.value as AppSettings["sort_by"] })}
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
      </div>
    </div>
  );
}
