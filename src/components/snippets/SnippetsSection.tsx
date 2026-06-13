import { useState, useEffect, useRef } from "react";
import { Plus, MoreVertical, Trash2 } from "lucide-react";
import { clsx } from "clsx";
import { useSnippetsStore } from "../../stores/snippetsStore";
import { useNavigationStore } from "../../stores/navigationStore";
import { useToastStore } from "../../stores/toastStore";
import type { Snippet, SnippetTier } from "../../types";

interface CreateSnippetDialogProps {
  onClose: () => void;
  onCreate: (title: string, tier: SnippetTier) => Promise<void>;
}

function CreateSnippetDialog({ onClose, onCreate }: CreateSnippetDialogProps) {
  const [title, setTitle] = useState("");
  const [tier, setTier] = useState<SnippetTier>("local");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!title.trim() || creating) return;
    setCreating(true);
    setError(null);
    try {
      await onCreate(title.trim(), tier);
      onClose();
    } catch (err) {
      console.error("Create snippet failed:", err);
      setError(err instanceof Error ? err.message : String(err));
      setCreating(false);
    }
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
        <div className="bg-bg-secondary border border-border rounded-lg shadow-2xl w-[360px] pointer-events-auto">
          <div className="p-4 border-b border-border">
            <h3 className="text-[var(--font-base)] font-semibold text-text">New Snippet</h3>
          </div>
          <div className="p-4 space-y-4">
            <div>
              <label className="block text-[var(--font-xs)] text-text-muted mb-1.5">Title</label>
              <input
                autoFocus
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
                placeholder="my-snippet.md"
                className="w-full bg-bg-tertiary border border-border rounded-md px-3 py-2 text-[var(--font-sm)] text-text outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-[var(--font-xs)] text-text-muted mb-2">Storage</label>
              <div className="space-y-2">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="radio"
                    checked={tier === "local"}
                    onChange={() => setTier("local")}
                    className="mt-0.5 accent-accent"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-zinc-500" />
                      <span className="text-[var(--font-sm)] text-text font-medium">Local</span>
                    </div>
                    <p className="text-[var(--font-xs)] text-text-muted mt-0.5">Only on this Mac</p>
                  </div>
                </label>
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="radio"
                    checked={tier === "secret"}
                    onChange={() => setTier("secret")}
                    className="mt-0.5 accent-accent"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-amber-500" />
                      <span className="text-[var(--font-sm)] text-text font-medium">Secret gist</span>
                    </div>
                    <p className="text-[var(--font-xs)] text-text-muted mt-0.5">URL-only, syncs to GitHub</p>
                  </div>
                </label>
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="radio"
                    checked={tier === "public"}
                    onChange={() => setTier("public")}
                    className="mt-0.5 accent-accent"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span className="text-[var(--font-sm)] text-text font-medium">Public gist</span>
                    </div>
                    <p className="text-[var(--font-xs)] text-text-muted mt-0.5">Anyone can find on github.com</p>
                  </div>
                </label>
              </div>
            </div>
            {error && (
              <div className="px-4 pb-2">
                <div className="bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2 text-[var(--font-xs)] text-red-400">
                  {error}
                </div>
              </div>
            )}
          </div>
          <div className="p-4 border-t border-border flex items-center justify-end gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-md text-[var(--font-sm)] text-text-muted hover:bg-bg-hover transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!title.trim() || creating}
              className="px-3 py-1.5 rounded-md text-[var(--font-sm)] font-medium bg-accent text-white hover:bg-accent/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {creating ? "Creating..." : "Create"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function tierDotClass(tier: SnippetTier): string {
  switch (tier) {
    case "local":
      return "bg-zinc-500";
    case "secret":
      return "bg-amber-500";
    case "public":
      return "bg-emerald-500";
  }
}

function SnippetContextMenu({
  snippet,
  position,
  onClose,
}: {
  snippet: Snippet;
  position: { x: number; y: number };
  onClose: () => void;
}) {
  const moveSnippetTier = useSnippetsStore((s) => s.moveSnippetTier);
  const deleteSnippet = useSnippetsStore((s) => s.deleteSnippet);
  const showSuccess = useToastStore((s) => s.success);
  const showError = useToastStore((s) => s.error);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  const handleMoveTier = async (newTier: SnippetTier) => {
    try {
      await moveSnippetTier(snippet.id, newTier);
      showSuccess(`Moved to ${newTier}`);
      onClose();
    } catch (err) {
      showError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${snippet.title}"?`)) return;
    try {
      await deleteSnippet(snippet.id);
      showSuccess("Snippet deleted");
      onClose();
    } catch (err) {
      showError(err instanceof Error ? err.message : String(err));
    }
  };

  const tiers: Array<{ tier: SnippetTier; label: string; color: string }> = [
    { tier: "local", label: "Local", color: "bg-zinc-500" },
    { tier: "secret", label: "Secret gist", color: "bg-amber-500" },
    { tier: "public", label: "Public gist", color: "bg-emerald-500" },
  ];

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        ref={menuRef}
        className="fixed z-50 bg-bg-secondary border border-border rounded-lg shadow-xl py-1 min-w-[160px]"
        style={{ left: position.x, top: position.y }}
      >
        <div className="px-2 py-1 text-[var(--font-xs)] text-text-muted">Move to...</div>
        {tiers
          .filter((t) => t.tier !== snippet.tier)
          .map((t) => (
            <button
              key={t.tier}
              onClick={() => handleMoveTier(t.tier)}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-[var(--font-sm)] text-text hover:bg-bg-hover"
            >
              <div className={clsx("w-1.5 h-1.5 rounded-full", t.color)} />
              <span>{t.label}</span>
            </button>
          ))}
        <div className="my-1 border-t border-border" />
        <button
          onClick={handleDelete}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-[var(--font-sm)] text-red-400 hover:bg-bg-hover"
        >
          <Trash2 size={13} />
          <span>Delete</span>
        </button>
      </div>
    </>
  );
}

export function SnippetsSection() {
  const snippets = useSnippetsStore((s) => s.snippets);
  const loadSnippets = useSnippetsStore((s) => s.loadSnippets);
  const createSnippet = useSnippetsStore((s) => s.createSnippet);
  const [showCreate, setShowCreate] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ snippet: Snippet; x: number; y: number } | null>(null);

  useEffect(() => {
    loadSnippets();
  }, []);

  const handleCreate = async (title: string, tier: SnippetTier) => {
    await createSnippet(title, tier, "# " + title + "\n\n");
    // Navigate to the snippet's folder
    const root = await getSnippetsRoot();
    const navigateTo = useNavigationStore.getState().navigateTo;
    if (tier === "local") {
      navigateTo(`${root}/local`);
    } else {
      // Gist tier — once implemented, navigate to gists/<id>
      navigateTo(`${root}/local`); // temp fallback
    }
  };

  if (snippets.length === 0) {
    return (
      <div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 text-text-muted hover:text-text-secondary py-1 text-left w-full"
          style={{ fontSize: "var(--font-sidebar-item)" }}
        >
          <Plus size={12} /> New snippet
        </button>
        {showCreate && <CreateSnippetDialog onClose={() => setShowCreate(false)} onCreate={handleCreate} />}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 text-text-muted hover:text-text-secondary py-0.5"
          style={{ fontSize: "var(--font-sidebar-item)" }}
        >
          <Plus size={11} />
          <span>New</span>
        </button>
      </div>
      <nav className="flex flex-col gap-[2px]">
        {snippets.map((snippet) => (
          <div key={snippet.id} className="flex items-center gap-1 group">
            <button
              onClick={() => handleSnippetClick(snippet)}
              className={clsx(
                "flex-1 flex items-center gap-2.5 px-2.5 py-[4px] rounded-[var(--radius-md)] text-left",
                "transition-colors duration-75",
                "text-text-secondary hover:bg-bg-hover"
              )}
            >
              <div className={clsx("w-1.5 h-1.5 rounded-full shrink-0", tierDotClass(snippet.tier))} />
              <span className="flex-1 min-w-0 truncate" style={{ fontSize: "var(--font-sidebar-item)" }}>
                {snippet.title}
              </span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setContextMenu({ snippet, x: e.clientX, y: e.clientY });
              }}
              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-bg-hover transition-opacity"
            >
              <MoreVertical size={12} className="text-text-muted" />
            </button>
          </div>
        ))}
      </nav>
      {showCreate && <CreateSnippetDialog onClose={() => setShowCreate(false)} onCreate={handleCreate} />}
      {contextMenu && (
        <SnippetContextMenu
          snippet={contextMenu.snippet}
          position={{ x: contextMenu.x, y: contextMenu.y }}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}

async function getSnippetsRoot(): Promise<string> {
  // Snippets live at ~/.config/explorer/snippets/ alongside config.json and explorer.db
  const { homeDir } = await import("@tauri-apps/api/path");
  const home = await homeDir();
  return `${home}/.config/explorer/snippets`;
}

async function handleSnippetClick(snippet: Snippet) {
  const root = await getSnippetsRoot();
  const { useFileListStore } = await import("../../stores/fileListStore");

  // Compute the snippet's file path
  let filePath: string;
  if (snippet.tier === "local") {
    filePath = `${root}/local/${snippet.title}`;
  } else {
    // Gist tier — file is at gists/<id>/<title>
    filePath = `${root}/gists/${snippet.gist_id}/${snippet.title}`;
  }

  // Open snippet directly in preview without navigating the center panel
  // This keeps the user's current folder view intact
  useFileListStore.getState().setSelectedPath(filePath);
}
