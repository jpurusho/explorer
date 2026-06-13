import { useEffect, useRef, useState, useCallback } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, rectangularSelection } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching, foldGutter, foldKeymap } from "@codemirror/language";
import { vim } from "@replit/codemirror-vim";
import { invoke } from "@tauri-apps/api/core";
import { WrapText, HelpCircle } from "lucide-react";
import { clsx } from "clsx";
import { getLanguageExtension } from "./languages";
import { explorerTheme, explorerHighlightStyle } from "./theme";
import { updateCache, emitContentUpdated } from "../../lib/previewCache";
import { MarkdownReference } from "./MarkdownReference";
import { useSnippetsStore } from "../../stores/snippetsStore";

interface EditorProps {
  path: string;
  content: string;
  fileType: string;
  fileName: string;
  onModifiedChange?: (modified: boolean) => void;
}

export function Editor({ path, content, fileType, fileName, onModifiedChange }: EditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [modified, setModified] = useState(false);
  const [savedMessage, setSavedMessage] = useState(false);
  const [wordWrap, setWordWrap] = useState(true);
  const [showMarkdownHelp, setShowMarkdownHelp] = useState(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const snippets = useSnippetsStore((s) => s.snippets);
  const saveAndPushSnippet = useSnippetsStore((s) => s.saveAndPushSnippet);

  const isMarkdown = fileType === "markdown" || fileName.endsWith(".md");

  // Check if this file is a snippet (for auto-push to gist)
  const snippet = snippets.find((s) => {
    const snippetsRoot = path.includes("/.config/explorer/snippets/");
    if (!snippetsRoot) return false;
    // Match by filename in the path
    return path.endsWith(`/${s.title}`);
  });
  const isGistSnippet = snippet && (snippet.tier === "secret" || snippet.tier === "public");

  // Clear auto-save timer on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  const saveFile = useCallback(async () => {
    if (!viewRef.current) return;
    const text = viewRef.current.state.doc.toString();
    try {
      // If it's a gist snippet, use saveAndPushSnippet (saves + commits + pushes)
      if (isGistSnippet && snippet) {
        await saveAndPushSnippet(snippet.id, text);
      } else {
        await invoke("write_file", { path, content: text });
      }
      // Refresh the cached read with the fresh bytes and broadcast so the
      // preview panel can re-render instantly without waiting for the
      // ~300ms watcher debounce round-trip.
      const bytes = new TextEncoder().encode(text).length;
      updateCache(path, { content: text, mime_type: "", size: bytes, truncated: false });
      emitContentUpdated(path);
      setModified(false);
      onModifiedChange?.(false);
      setSavedMessage(true);
      setTimeout(() => setSavedMessage(false), 2000);
    } catch (err) {
      console.error("Save failed:", err);
      // Save failed — user sees "Modified" badge persist
    }
  }, [path, onModifiedChange, isGistSnippet, snippet, saveAndPushSnippet]);

  useEffect(() => {
    if (!containerRef.current) return;

    const langExt = getLanguageExtension(fileType, fileName);

    const extensions = [
      vim(),
      lineNumbers(),
      highlightActiveLine(),
      highlightActiveLineGutter(),
      drawSelection(),
      rectangularSelection(),
      bracketMatching(),
      closeBrackets(),
      foldGutter(),
      history(),
      highlightSelectionMatches(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      syntaxHighlighting(explorerHighlightStyle),
      explorerTheme,
      ...(langExt ? [langExt] : []),
      keymap.of([
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...searchKeymap,
        ...historyKeymap,
        ...foldKeymap,
        indentWithTab,
        {
          key: "Mod-s",
          run: () => { saveFile(); return true; },
        },
      ]),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          setModified(true);
          onModifiedChange?.(true);

          // For gist snippets, debounce auto-save by 2s (ADR 0004)
          if (isGistSnippet) {
            if (autoSaveTimerRef.current) {
              clearTimeout(autoSaveTimerRef.current);
            }
            autoSaveTimerRef.current = setTimeout(() => {
              saveFile();
            }, 2000);
          }
        }
      }),
    ];

    if (wordWrap) {
      extensions.push(EditorView.lineWrapping);
    }

    const state = EditorState.create({ doc: content, extensions });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [path, content, wordWrap]);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Editor toolbar */}
      <div className="h-8 bg-bg-tertiary/60 border-b border-border flex items-center gap-3 shrink-0" style={{ padding: "0 var(--panel-px)" }}>
        <span className="text-[var(--font-sm)] text-text-secondary font-medium truncate max-w-[160px]">
          {fileName}
        </span>
        {modified && (
          <span className="text-[var(--font-xs)] text-amber-400 font-medium px-1.5 py-0.5 bg-amber-400/10 rounded">Modified</span>
        )}
        {savedMessage && (
          <span className="text-[var(--font-xs)] text-green-400 font-medium px-1.5 py-0.5 bg-green-400/10 rounded">Saved</span>
        )}
        <div className="flex-1" />
        {isMarkdown && (
          <button
            onClick={() => setShowMarkdownHelp(true)}
            className="p-1 rounded transition-colors text-text-muted hover:text-text-secondary hover:bg-bg-hover"
            title="Markdown syntax help"
          >
            <HelpCircle size={13} />
          </button>
        )}
        <button
          onClick={() => setWordWrap((w) => !w)}
          className={clsx(
            "p-1 rounded transition-colors",
            wordWrap
              ? "text-accent bg-accent/10"
              : "text-text-muted hover:text-text-secondary hover:bg-bg-hover"
          )}
          title={wordWrap ? "Word wrap: On" : "Word wrap: Off"}
        >
          <WrapText size={13} />
        </button>
        <span className="text-[var(--font-xs)] text-text-muted font-mono">VIM</span>
      </div>

      {/* Editor container */}
      <div ref={containerRef} className="flex-1 overflow-hidden editor-container" />

      {/* Markdown help dialog */}
      {showMarkdownHelp && <MarkdownReference onClose={() => setShowMarkdownHelp(false)} />}
    </div>
  );
}
