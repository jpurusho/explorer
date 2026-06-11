import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { X, Palette, Type, Layout, Keyboard, Search } from "lucide-react";
import { clsx } from "clsx";
import { useSettingsStore } from "../../stores/settingsStore";
import { useFileListStore } from "../../stores/fileListStore";
import { useFontThemeStore } from "../../stores/fontThemeStore";
import { themes } from "../../lib/themes";
import { formatSize } from "../../lib/formatters";
import type { AppSettings } from "../../types";

interface SettingsPanelProps {
  onClose: () => void;
  initialTab?: string;
}

type SettingsTab = "appearance" | "font" | "files" | "shortcuts" | "search";

const tabs: { id: SettingsTab; label: string; icon: typeof Palette }[] = [
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "font", label: "Font Size", icon: Type },
  { id: "files", label: "File Display", icon: Layout },
  { id: "shortcuts", label: "Shortcuts", icon: Keyboard },
  { id: "search", label: "Search Index", icon: Search },
];

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h3 className="text-[var(--font-sm)] font-semibold text-text mb-0.5">{title}</h3>
      {description && <p className="text-[var(--font-xs)] text-text-muted mb-3">{description}</p>}
      {!description && <div className="mb-3" />}
      <div className="bg-bg-secondary/60 rounded-lg border border-border/40 p-3">
        {children}
      </div>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={clsx(
        "w-9 h-5 rounded-full transition-colors relative shrink-0",
        checked ? "bg-accent" : "bg-bg-tertiary border border-border"
      )}
    >
      <div
        className={clsx(
          "w-3.5 h-3.5 rounded-full bg-white shadow-sm absolute top-[3px] transition-transform",
          checked ? "translate-x-[18px]" : "translate-x-[3px]"
        )}
      />
    </button>
  );
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/20 last:border-b-0 gap-3">
      <span className="text-[var(--font-xs)] text-text-secondary shrink-0">{label}</span>
      <div className="flex items-center justify-end min-w-0">
        {children}
      </div>
    </div>
  );
}

function AppearanceTab() {
  const settings = useSettingsStore((s) => s.settings);
  const setTheme = useSettingsStore((s) => s.setTheme);

  return (
    <Section title="Color Theme" description="Controls the overall color scheme.">
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => setTheme("system")}
          className={clsx(
            "flex flex-col items-center gap-2 p-3 rounded-lg border transition-all",
            settings.theme === "system"
              ? "border-accent bg-accent/8"
              : "border-border hover:border-text-muted"
          )}
        >
          <div className="w-full h-8 rounded flex overflow-hidden border border-border/50">
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
                "flex flex-col items-center gap-2 p-3 rounded-lg border transition-all",
                settings.theme === t.id
                  ? "border-accent bg-accent/8"
                  : "border-border hover:border-text-muted"
              )}
            >
              <div className="w-full h-8 rounded flex overflow-hidden border border-border/50">
                <div className="flex-1" style={{ backgroundColor: colors[0] }} />
                <div className="flex-1" style={{ backgroundColor: colors[1] }} />
                <div className="w-3" style={{ backgroundColor: colors[2] }} />
              </div>
              <span className="text-[var(--font-xs)] text-text-secondary">{t.label}</span>
            </button>
          );
        })}
      </div>
    </Section>
  );
}

function FontTab() {
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
    updateSettings({ font_theme: `scale:${sliderValue}` } as any);
  };

  return (
    <Section title="Font Size" description="Drag to adjust all font sizes proportionally.">
      <p className="text-text text-center leading-relaxed mb-4" style={{ fontSize: `${sliderValue}px` }}>
        The quick brown fox jumps over the lazy dog
      </p>
      <div className="flex items-center gap-3">
        <span className="text-[var(--font-xs)] text-text-muted">A</span>
        <input
          type="range"
          min="10"
          max="30"
          step="0.5"
          value={sliderValue}
          onChange={handleChange}
          onMouseUp={handleMouseUp}
          onTouchEnd={handleMouseUp}
          className="flex-1 h-1.5 bg-bg-tertiary rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:cursor-pointer"
        />
        <span className="text-[var(--font-md)] text-text-muted">A</span>
        <span className="text-[var(--font-xs)] text-accent font-medium tabular-nums">{sliderValue}px</span>
      </div>
    </Section>
  );
}

function FilesTab() {
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const viewMode = useFileListStore((s) => s.viewMode);
  const showHiddenFiles = useFileListStore((s) => s.showHiddenFiles);
  const showRowLines = useFileListStore((s) => s.showRowLines);
  const sortBy = useFileListStore((s) => s.sortBy);
  const setViewMode = useFileListStore((s) => s.setViewMode);
  const toggleHiddenFiles = useFileListStore((s) => s.toggleHiddenFiles);
  const setShowRowLines = useFileListStore((s) => s.setShowRowLines);
  const setSortBy = useFileListStore((s) => s.setSortBy);

  return (
    <Section title="File Display" description="Configure how files are shown and sorted.">
      <SettingRow label="Default view">
        <div className="flex gap-1.5">
          {(["list", "grid"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => { setViewMode(mode); updateSettings({ default_view: mode }); }}
              className={clsx(
                "px-2.5 py-1 rounded-md text-[var(--font-xs)] font-medium transition-colors capitalize",
                viewMode === mode
                  ? "bg-accent/15 text-accent"
                  : "bg-bg-tertiary text-text-muted hover:text-text-secondary"
              )}
            >
              {mode}
            </button>
          ))}
        </div>
      </SettingRow>

      <SettingRow label="Show hidden files">
        <Toggle checked={showHiddenFiles} onChange={toggleHiddenFiles} />
      </SettingRow>

      <SettingRow label="Row lines">
        <Toggle checked={showRowLines} onChange={() => setShowRowLines(!showRowLines)} />
      </SettingRow>

      <SettingRow label="Sort by">
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as AppSettings["sort_by"])}
          className="bg-bg-tertiary border border-border rounded-md px-2 py-1 text-[var(--font-xs)] text-text-secondary outline-none"
        >
          <option value="name">Name</option>
          <option value="size">Size</option>
          <option value="modified">Modified</option>
          <option value="type">Type</option>
        </select>
      </SettingRow>
      <SidebarSectionsRows />
    </Section>
  );
}

function SidebarSectionsRows() {
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  return (
    <>
      <SettingRow label="Show Favorites">
        <Toggle
          checked={settings.show_favorites_section}
          onChange={() => updateSettings({ show_favorites_section: !settings.show_favorites_section })}
        />
      </SettingRow>
      <SettingRow label="Show Folders">
        <Toggle
          checked={settings.show_folders_section}
          onChange={() => updateSettings({ show_folders_section: !settings.show_folders_section })}
        />
      </SettingRow>
      <SettingRow label="Show Tags">
        <Toggle
          checked={settings.show_tags_section}
          onChange={() => updateSettings({ show_tags_section: !settings.show_tags_section })}
        />
      </SettingRow>
    </>
  );
}

function ShortcutsTab() {
  const sections = [
    {
      title: "Navigation",
      shortcuts: [
        ["↑ / ↓", "Navigate files"],
        ["← / →", "Go up / Enter folder"],
        ["Enter", "Open selected item"],
        ["⌘ ↑", "Go to parent directory"],
        ["⌘ ↓", "Open selected item"],
        ["⌘ [", "Back"],
        ["⌘ ]", "Forward"],
        ["⌘ R", "Refresh directory"],
        ["Home / End", "Jump to first / last"],
        ["Page Up / Down", "Scroll by page"],
      ],
    },
    {
      title: "Selection",
      shortcuts: [
        ["⌘ A", "Select all"],
        ["Shift + ↑ / ↓", "Extend selection"],
        ["Shift + Home / End", "Extend to first / last"],
        ["⌘ + Click", "Toggle item selection"],
        ["Shift + Click", "Range select"],
        ["Escape", "Clear selection"],
        ["Space", "Select without navigating"],
      ],
    },
    {
      title: "File Operations",
      shortcuts: [
        ["⌘ C", "Copy files"],
        ["⌘ X", "Cut files"],
        ["⌘ V", "Paste files"],
        ["⌘ D", "Duplicate files"],
        ["⌘ Z", "Undo last operation"],
        ["⌘ ⇧ N", "New folder"],
        ["⌘ ⇧ ⌫", "Move to Trash"],
        ["Delete / ⌫", "Move to Trash"],
        ["↵ / double-click name", "Rename"],
      ],
    },
    {
      title: "View & Panels",
      shortcuts: [
        ["⌘ 1", "List view"],
        ["⌘ 2", "Grid view"],
        ["⌘ ⇧ .", "Toggle hidden files"],
        ["⌘ ,", "Settings"],
        ["⌘ /", "Keyboard shortcuts"],
        ["⌘ E", "Scratch Pad"],
        ["⌘ P", "Global search"],
        ["⌘ K", "Command palette"],
        ["⌘ F", "Find in directory"],
        ["⌘ N", "New window"],
      ],
    },
    {
      title: "Editor (Vim)",
      shortcuts: [
        ["i", "Enter insert mode"],
        ["Esc", "Normal mode"],
        [":w", "Save file"],
        ["⌘ S", "Save file"],
        ["⌘ F", "Find in file"],
        ["/pattern", "Vim search"],
        ["dd", "Delete line"],
        ["u", "Undo"],
        ["Ctrl+r", "Redo"],
      ],
    },
  ];

  return (
    <div className="space-y-4">
      {sections.map((section) => (
        <Section key={section.title} title={section.title}>
          <table className="w-full">
            <tbody>
              {section.shortcuts.map(([key, desc], i) => (
                <tr key={i} className="border-b border-border/15 last:border-b-0">
                  <td className="py-1.5 text-[var(--font-xs)] text-text-muted pr-4">{desc}</td>
                  <td className="py-1.5 text-right">
                    <kbd className="text-[var(--font-xs)] font-mono bg-bg-tertiary border border-border/50 rounded px-1.5 py-0.5 text-text-secondary whitespace-nowrap">
                      {key}
                    </kbd>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      ))}
    </div>
  );
}

function SearchTab() {
  const [stats, setStats] = useState<{ file_count: number; dir_count: number; trigram_count: number; db_size_bytes: number } | null>(null);
  const [rebuilding, setRebuilding] = useState(false);

  useEffect(() => {
    invoke<any>("get_index_stats").then(setStats).catch(() => {});
    const interval = setInterval(() => {
      invoke<any>("get_index_stats").then(setStats).catch(() => {});
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const formatBytes = (bytes: number) => formatSize(bytes, { zero: "0 B" });

  return (
    <div>
      {stats && (
        <Section title="Index Stats" description="Current search index state.">
          <div className="grid grid-cols-2 gap-2">
            <div className="text-center py-2">
              <div className="text-[var(--font-md)] text-text font-bold">{stats.file_count.toLocaleString()}</div>
              <div className="text-[var(--font-xs)] text-text-muted">Files</div>
            </div>
            <div className="text-center py-2">
              <div className="text-[var(--font-md)] text-text font-bold">{stats.dir_count.toLocaleString()}</div>
              <div className="text-[var(--font-xs)] text-text-muted">Folders</div>
            </div>
            <div className="text-center py-2">
              <div className="text-[var(--font-md)] text-text font-bold">{stats.trigram_count.toLocaleString()}</div>
              <div className="text-[var(--font-xs)] text-text-muted">Trigrams</div>
            </div>
            <div className="text-center py-2">
              <div className="text-[var(--font-md)] text-text font-bold">{formatBytes(stats.db_size_bytes)}</div>
              <div className="text-[var(--font-xs)] text-text-muted">Size</div>
            </div>
          </div>
        </Section>
      )}

      <Section title="Actions">
        <div className="flex gap-2">
          <button
            onClick={() => { invoke("rebuild_trigrams"); setRebuilding(true); setTimeout(() => setRebuilding(false), 5000); }}
            disabled={rebuilding}
            className="px-2.5 py-1.5 rounded-md text-[var(--font-xs)] font-medium border border-border bg-bg-tertiary text-text-secondary hover:border-accent hover:text-accent disabled:opacity-50 transition-all"
          >
            {rebuilding ? "Rebuilding..." : "Rebuild Trigrams"}
          </button>
          <button
            onClick={() => { invoke("reindex"); setRebuilding(true); setTimeout(() => setRebuilding(false), 10000); }}
            disabled={rebuilding}
            className="px-2.5 py-1.5 rounded-md text-[var(--font-xs)] font-medium border border-border bg-bg-tertiary text-text-secondary hover:border-accent hover:text-accent disabled:opacity-50 transition-all"
          >
            {rebuilding ? "Reindexing..." : "Full Reindex"}
          </button>
        </div>
      </Section>

      <Section title="Indexed Paths" description="Directories included in the search index.">
        <IndexPathsEditor />
        <p className="text-[var(--font-xs)] text-text-muted mt-2">
          Stored at ~/.config/explorer/index.db
        </p>
      </Section>
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
    <div>
      <div className="space-y-1 mb-2">
        {displayPaths.map((p, i) => (
          <div key={i} className="flex items-center justify-between gap-2 bg-bg-tertiary/50 rounded-md px-2.5 py-1.5">
            <span className="truncate font-mono text-[var(--font-xs)] text-text-secondary">{p}</span>
            {paths.length > 0 && (
              <button onClick={() => removePath(i)} className="text-text-muted hover:text-red-400 shrink-0">
                <X size={10} />
              </button>
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
          className="flex-1 bg-bg-tertiary/50 border border-border/40 rounded-md px-2.5 py-1 text-[var(--font-xs)] text-text outline-none placeholder:text-text-muted/40 focus:border-accent/50"
        />
        <button
          onClick={addPath}
          className="px-3 py-1 rounded-md text-[var(--font-xs)] font-medium bg-accent/15 text-accent hover:bg-accent/25 transition-colors shrink-0"
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

export function SettingsPanel({ onClose, initialTab }: SettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>((initialTab as SettingsTab) || "appearance");

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab as SettingsTab);
  }, [initialTab]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div className="h-full flex flex-col bg-bg">
      {/* Header with tab buttons */}
      <div className="shrink-0 border-b border-border bg-bg-secondary/60 px-3 py-2 flex items-center gap-1 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[var(--font-xs)] whitespace-nowrap transition-colors",
                activeTab === tab.id
                  ? "bg-accent/12 text-accent font-medium"
                  : "text-text-muted hover:bg-bg-hover hover:text-text-secondary"
              )}
            >
              <Icon size={12} className="shrink-0" />
              {tab.label}
            </button>
          );
        })}
        <div className="flex-1" />
        <button
          onClick={onClose}
          className="p-1 rounded-md hover:bg-bg-hover text-text-muted hover:text-text transition-colors shrink-0"
        >
          <X size={14} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="p-5 max-w-[360px]">
          {activeTab === "appearance" && <AppearanceTab />}
          {activeTab === "font" && <FontTab />}
          {activeTab === "files" && <FilesTab />}
          {activeTab === "shortcuts" && <ShortcutsTab />}
          {activeTab === "search" && <SearchTab />}
        </div>
      </div>
    </div>
  );
}
