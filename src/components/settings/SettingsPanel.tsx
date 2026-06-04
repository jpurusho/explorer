import { X, Check } from "lucide-react";
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
    <div className="mb-8">
      <h3 className="text-[--font-xs] font-semibold text-text-muted uppercase tracking-widest mb-3">
        {title}
      </h3>
      <div className="flex flex-col gap-0">
        {children}
      </div>
    </div>
  );
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border/30 gap-6">
      <span className="text-[--font-md] text-text-secondary shrink-0">{label}</span>
      <div className="flex items-center justify-end min-w-0">
        {children}
      </div>
    </div>
  );
}

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const availableThemes = useFontThemeStore((s) => s.availableThemes);
  const loadFontTheme = useFontThemeStore((s) => s.loadTheme);
  const loadAvailableThemes = useFontThemeStore((s) => s.loadAvailableThemes);
  const currentFontTheme = useFontThemeStore((s) => s.currentTheme);

  if (availableThemes.length === 0) {
    loadAvailableThemes();
  }

  return (
    <div className="h-full bg-bg flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-[--panel-px] py-3.5 border-b border-border shrink-0 bg-bg-secondary">
        <h2 className="text-[--font-lg] font-semibold text-text">Settings</h2>
        <button
          onClick={onClose}
          className="p-1.5 rounded-[5px] hover:bg-bg-hover text-text-muted hover:text-text transition-colors"
        >
          <X size={15} />
        </button>
      </div>

      {/* Content — generous horizontal padding */}
      <div className="flex-1 overflow-auto py-6 px-[--panel-px]">
        <SettingsSection title="Appearance">
          <div className="py-3 border-b border-border/30">
            <span className="text-[--font-md] text-text-secondary block mb-3">Theme</span>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setTheme("system")}
                className={clsx(
                  "px-3 py-1.5 rounded-[5px] text-[--font-sm] font-medium border transition-all",
                  settings.theme === "system"
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border bg-bg-tertiary text-text-secondary hover:border-text-muted"
                )}
              >
                {settings.theme === "system" && <Check size={10} className="inline mr-1.5" />}
                System
              </button>
              {themes.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  className={clsx(
                    "px-3 py-1.5 rounded-[5px] text-[--font-sm] font-medium border transition-all",
                    settings.theme === t.id
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border bg-bg-tertiary text-text-secondary hover:border-text-muted"
                  )}
                >
                  {settings.theme === t.id && <Check size={10} className="inline mr-1.5" />}
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </SettingsSection>

        <SettingsSection title="Font Theme">
          <div className="py-3 border-b border-border/30">
            <span className="text-[--font-md] text-text-secondary block mb-3">Size Preset</span>
            <div className="flex flex-wrap gap-2">
              {availableThemes.map((t) => (
                <button
                  key={t.name}
                  onClick={() => {
                    loadFontTheme(t.name.toLowerCase());
                    updateSettings({ font_theme: t.name.toLowerCase() });
                  }}
                  className={clsx(
                    "px-3 py-1.5 rounded-[5px] text-[--font-sm] font-medium border transition-all",
                    currentFontTheme?.name === t.name
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border bg-bg-tertiary text-text-secondary hover:border-text-muted"
                  )}
                >
                  {currentFontTheme?.name === t.name && <Check size={10} className="inline mr-1.5" />}
                  {t.name}
                </button>
              ))}
            </div>
            <p className="text-[--font-xs] text-text-muted mt-2">
              Edit ~/.config/explorer/themes/*.json for fine control. Changes apply live.
            </p>
          </div>
        </SettingsSection>

        <SettingsSection title="File Display">
          <SettingRow label="Default view">
            <div className="flex gap-1.5">
              <button
                onClick={() => updateSettings({ default_view: "list" })}
                className={clsx(
                  "px-3 py-1 rounded-[5px] text-[--font-sm] font-medium transition-colors",
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
                  "px-3 py-1 rounded-[5px] text-[--font-sm] font-medium transition-colors",
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
              className="bg-bg-tertiary border border-border rounded-[5px] px-2.5 py-1 text-[--font-sm] text-text-secondary outline-none"
            >
              <option value="name">Name</option>
              <option value="size">Size</option>
              <option value="modified">Modified</option>
              <option value="type">Type</option>
            </select>
          </SettingRow>
        </SettingsSection>

        <SettingsSection title="Editor">
          <div className="text-[--font-sm] text-text-muted leading-relaxed">
            <p className="mb-3 text-text-secondary">Vim keybindings:</p>
            <div className="grid grid-cols-[80px_1fr] gap-y-2">
              <span className="text-text-secondary font-mono text-[--font-sm]">i</span>
              <span>Enter insert mode</span>
              <span className="text-text-secondary font-mono text-[--font-sm]">Esc</span>
              <span>Return to normal mode</span>
              <span className="text-text-secondary font-mono text-[--font-sm]">:w</span>
              <span>Save file</span>
              <span className="text-text-secondary font-mono text-[--font-sm]">⌘S</span>
              <span>Save file</span>
              <span className="text-text-secondary font-mono text-[--font-sm]">⌘F</span>
              <span>Find in file</span>
              <span className="text-text-secondary font-mono text-[--font-sm]">/pattern</span>
              <span>Vim search</span>
              <span className="text-text-secondary font-mono text-[--font-sm]">dd</span>
              <span>Delete line</span>
              <span className="text-text-secondary font-mono text-[--font-sm]">u</span>
              <span>Undo</span>
              <span className="text-text-secondary font-mono text-[--font-sm]">Ctrl+r</span>
              <span>Redo</span>
            </div>
          </div>
        </SettingsSection>

        <SettingsSection title="Navigation">
          <div className="grid grid-cols-[80px_1fr] gap-y-2 text-[--font-sm]">
            <span className="text-text-secondary font-mono text-[--font-sm]">↑/↓</span>
            <span className="text-text-muted">Navigate files</span>
            <span className="text-text-secondary font-mono text-[--font-sm]">Enter</span>
            <span className="text-text-muted">Open folder</span>
            <span className="text-text-secondary font-mono text-[--font-sm]">⌘⌫</span>
            <span className="text-text-muted">Go up</span>
            <span className="text-text-secondary font-mono text-[--font-sm]">⌘[</span>
            <span className="text-text-muted">Back</span>
            <span className="text-text-secondary font-mono text-[--font-sm]">⌘]</span>
            <span className="text-text-muted">Forward</span>
            <span className="text-text-secondary font-mono text-[--font-sm]">⌘1</span>
            <span className="text-text-muted">List view</span>
            <span className="text-text-secondary font-mono text-[--font-sm]">⌘2</span>
            <span className="text-text-muted">Grid view</span>
            <span className="text-text-secondary font-mono text-[--font-sm]">⌘⇧.</span>
            <span className="text-text-muted">Toggle hidden files</span>
            <span className="text-text-secondary font-mono text-[--font-sm]">⌘,</span>
            <span className="text-text-muted">Settings</span>
            <span className="text-text-secondary font-mono text-[--font-sm]">⌘F</span>
            <span className="text-text-muted">Find</span>
          </div>
        </SettingsSection>
      </div>
    </div>
  );
}
