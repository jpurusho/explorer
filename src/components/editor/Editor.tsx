import { useEffect, useRef, useState, useCallback } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, rectangularSelection } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching, foldGutter, foldKeymap } from "@codemirror/language";
import { vim } from "@replit/codemirror-vim";
import { invoke } from "@tauri-apps/api/core";
import { WrapText } from "lucide-react";
import { clsx } from "clsx";
import { getLanguageExtension } from "./languages";
import { explorerTheme, explorerHighlightStyle } from "./theme";

interface EditorProps {
  path: string;
  content: string;
  fileType: string;
  fileName: string;
}

export function Editor({ path, content, fileType, fileName }: EditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [modified, setModified] = useState(false);
  const [savedMessage, setSavedMessage] = useState(false);
  const [wordWrap, setWordWrap] = useState(true);

  const saveFile = useCallback(async () => {
    if (!viewRef.current) return;
    const text = viewRef.current.state.doc.toString();
    try {
      await invoke("write_file", { path, content: text });
      setModified(false);
      setSavedMessage(true);
      setTimeout(() => setSavedMessage(false), 2000);
    } catch (err) {
      console.error("Save failed:", err);
    }
  }, [path]);

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
      <div className="h-8 bg-bg-tertiary/60 border-b border-border flex items-center pl-6 pr-14 gap-3 shrink-0">
        <span className="text-[--font-sm] text-text-secondary font-medium truncate max-w-[160px]">
          {fileName}
        </span>
        {modified && (
          <span className="text-[--font-xs] text-amber-400 font-medium px-1.5 py-0.5 bg-amber-400/10 rounded">Modified</span>
        )}
        {savedMessage && (
          <span className="text-[--font-xs] text-green-400 font-medium px-1.5 py-0.5 bg-green-400/10 rounded">Saved</span>
        )}
        <div className="flex-1" />
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
        <span className="text-[--font-xs] text-text-muted font-mono">VIM</span>
      </div>

      {/* Editor container */}
      <div ref={containerRef} className="flex-1 overflow-hidden editor-container" />
    </div>
  );
}
