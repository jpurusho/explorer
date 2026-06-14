import { useEffect, useRef, useState, useCallback } from "react";
import { EditorState, Compartment } from "@codemirror/state";
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
import { useEditorBufferStore } from "../../stores/editorBufferStore";
import { useSettingsStore } from "../../stores/settingsStore";

const wrapCompartments = new WeakMap<EditorView, Compartment>();

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
  const saveFileRef = useRef<() => void>(() => {});

  const snippets = useSnippetsStore((s) => s.snippets);
  const saveAndPushSnippet = useSnippetsStore((s) => s.saveAndPushSnippet);
  const bufferStore = useEditorBufferStore;

  const isMarkdown = fileType === "markdown" || fileName.endsWith(".md");

  const snippet = snippets.find((s) => {
    const snippetsRoot = path.includes("/.config/explorer/snippets/");
    if (!snippetsRoot) return false;
    return path.endsWith(`/${s.title}`);
  });
  const isGistSnippet = snippet && (snippet.tier === "secret" || snippet.tier === "public");

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
      if (isGistSnippet && snippet) {
        await saveAndPushSnippet(snippet.id, text);
      } else {
        await invoke("write_file", { path, content: text });
      }
      const bytes = new TextEncoder().encode(text).length;
      updateCache(path, { content: text, mime_type: "", size: bytes, truncated: false });
      emitContentUpdated(path);
      bufferStore.getState().markSaved(path, text);
      setModified(false);
      onModifiedChange?.(false);
      setSavedMessage(true);
      setTimeout(() => setSavedMessage(false), 2000);
    } catch (err) {
      console.error("Save failed:", err);
    }
  }, [path, onModifiedChange, isGistSnippet, snippet, saveAndPushSnippet, bufferStore]);

  saveFileRef.current = saveFile;

  // Attach/detach EditorView — keeps it alive across unmounts
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    const existingBuffer = bufferStore.getState().getBuffer(path);

    if (existingBuffer?.view) {
      // Reparent the existing view's DOM into our container
      if (existingBuffer.view.dom.parentElement !== container) {
        container.appendChild(existingBuffer.view.dom);
      }
      existingBuffer.view.requestMeasure();
      viewRef.current = existingBuffer.view;
      bufferStore.getState().touch(path);

      // Sync modified state from buffer
      const dirty = bufferStore.getState().isDirty(path);
      setModified(dirty);
      onModifiedChange?.(dirty);

      return () => {
        if (viewRef.current && viewRef.current.dom.parentElement === container) {
          container.removeChild(viewRef.current.dom);
        }
        viewRef.current = null;
      };
    }

    // No existing buffer (or evicted) — create a fresh EditorView
    const wrapCompartment = new Compartment();

    const langExt = getLanguageExtension(fileType, fileName);
    const initialContent = existingBuffer ? existingBuffer.content : content;

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
      wrapCompartment.of(wordWrap ? EditorView.lineWrapping : []),
      keymap.of([
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...searchKeymap,
        ...historyKeymap,
        ...foldKeymap,
        indentWithTab,
        {
          key: "Mod-s",
          run: () => { saveFileRef.current(); return true; },
        },
      ]),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          const newText = update.state.doc.toString();
          bufferStore.getState().updateContent(path, newText);
          setModified(true);
          onModifiedChange?.(true);

          // Autosave: gist snippets always auto-save; regular files if setting enabled
          const shouldAutoSave = isGistSnippet || useSettingsStore.getState().settings.autosave;
          if (shouldAutoSave) {
            if (autoSaveTimerRef.current) {
              clearTimeout(autoSaveTimerRef.current);
            }
            const delay = isGistSnippet ? 2000 : (useSettingsStore.getState().settings.autosave_delay_ms || 1000);
            autoSaveTimerRef.current = setTimeout(() => {
              saveFileRef.current();
            }, delay);
          }
        }
      }),
    ];

    const state = EditorState.create({ doc: initialContent, extensions });
    const view = new EditorView({ state, parent: container });
    viewRef.current = view;
    wrapCompartments.set(view, wrapCompartment);

    // Register in buffer store — preserve dirty state if restoring evicted buffer
    if (existingBuffer) {
      bufferStore.getState().registerView(path, view, container, existingBuffer.savedContent);
      bufferStore.getState().updateContent(path, existingBuffer.content);
      if (existingBuffer.content !== existingBuffer.savedContent) {
        setModified(true);
        onModifiedChange?.(true);
      }
    } else {
      bufferStore.getState().registerView(path, view, container, content);
    }

    return () => {
      if (viewRef.current && viewRef.current.dom.parentElement === container) {
        container.removeChild(viewRef.current.dom);
      }
      viewRef.current = null;
    };
  }, [path]);

  // Toggle word wrap via compartment (no view recreation)
  useEffect(() => {
    if (!viewRef.current) return;
    const compartment = wrapCompartments.get(viewRef.current);
    if (!compartment) return;
    viewRef.current.dispatch({
      effects: compartment.reconfigure(
        wordWrap ? EditorView.lineWrapping : []
      ),
    });
  }, [wordWrap]);

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
