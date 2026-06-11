import { useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { X, Copy, Save, Trash2, Eye, Code, ClipboardPaste } from "lucide-react";
import { clsx } from "clsx";
import { useScratchStore, type ScratchMode } from "../../stores/scratchStore";
import { toast } from "../../stores/toastStore";
import { MarkdownPreview } from "../preview/MarkdownPreview";
import {
  detectFormat,
  formatJson,
  formatYaml,
  textToMarkdown,
  wrapToWidth,
  justifyToWidth,
  cleanWhitespace,
  quotePrefix,
  joinParagraphs,
  type ScratchFormat,
} from "../../lib/textFormat";

interface ScratchPadProps {
  onClose: () => void;
}

const MODES: { id: ScratchMode; label: string }[] = [
  { id: "auto", label: "Auto" },
  { id: "text", label: "Text" },
  { id: "json", label: "JSON" },
  { id: "yaml", label: "YAML" },
  { id: "markdown", label: "Markdown" },
];

const EXT: Record<ScratchFormat, string> = {
  text: "txt",
  json: "json",
  yaml: "yaml",
  markdown: "md",
};

export function ScratchPad({ onClose }: ScratchPadProps) {
  const {
    rawText, mode, wrapWidth, doCleanup, doWrap, doJustify, doQuote, doJoin, mdShowSource, lastSaveDir,
    setRawText, setMode, setWrapWidth, toggle, setLastSaveDir, clear,
  } = useScratchStore();

  const effective: ScratchFormat = mode === "auto" ? detectFormat(rawText) : mode;

  // Compute the formatted output + any per-mode metadata.
  const result = useMemo(() => {
    if (effective === "json") {
      const r = formatJson(rawText);
      return { output: r.output, changedLines: r.changedLines, fixCount: r.fixCount, jsonError: r.error, yamlError: null as null | { line: number; column: number; message: string } };
    }
    if (effective === "yaml") {
      const r = formatYaml(rawText);
      return { output: r.output, changedLines: new Set<number>(), fixCount: 0, jsonError: null, yamlError: r.error };
    }
    if (effective === "markdown") {
      return { output: textToMarkdown(rawText), changedLines: new Set<number>(), fixCount: 0, jsonError: null, yamlError: null };
    }
    // text: apply enabled transforms in a sensible order
    let out = rawText;
    if (doJoin) out = joinParagraphs(out);
    if (doCleanup) out = cleanWhitespace(out);
    // Justify implies wrapping; if both are on, justify wins (it wraps too).
    if (doJustify) out = justifyToWidth(out, wrapWidth);
    else if (doWrap) out = wrapToWidth(out, wrapWidth);
    if (doQuote) out = quotePrefix(out);
    return { output: out, changedLines: new Set<number>(), fixCount: 0, jsonError: null, yamlError: null };
  }, [rawText, effective, doCleanup, doWrap, doJustify, doQuote, doJoin, wrapWidth]);

  const counts = useMemo(() => {
    const text = result.output;
    return {
      chars: text.length,
      words: (text.match(/\S+/g) || []).length,
      lines: text ? text.split("\n").length : 0,
    };
  }, [result.output]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(result.output);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Copy failed");
    }
  };

  // Clear the pad, then pull in whatever's on the system clipboard so a fresh
  // paste is one click away. If the clipboard is empty/unreadable, just clears.
  const handleClear = async () => {
    clear();
    try {
      const clip = await navigator.clipboard.readText();
      if (clip.trim()) {
        setRawText(clip);
        toast.info("Loaded clipboard");
      }
    } catch {
      // clipboard read denied/empty — pad is simply cleared
    }
  };

  // Pull the system clipboard into the pad on demand (header button).
  const handlePasteClipboard = async () => {
    try {
      const clip = await navigator.clipboard.readText();
      if (clip.trim()) {
        setRawText(clip);
      } else {
        toast.info("Clipboard is empty");
      }
    } catch {
      toast.error("Could not read clipboard");
    }
  };

  const handleSave = async () => {
    try {
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      const saved = await invoke<string | null>("save_text_file", {
        content: result.output,
        defaultName: `scratch-${stamp}.${EXT[effective]}`,
        startDir: lastSaveDir,
      });
      if (saved) {
        const dir = saved.slice(0, saved.lastIndexOf("/"));
        if (dir) setLastSaveDir(dir);
        toast.success("Saved");
      }
    } catch (e) {
      toast.error(`Save failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <div className="h-full bg-bg flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-border bg-bg-secondary/60 flex items-center gap-2" style={{ padding: "8px var(--panel-px)" }}>
        <span className="text-[var(--font-sm)] font-semibold text-text-secondary flex-1 min-w-0 truncate">Scratch Pad</span>
        <button onClick={handlePasteClipboard} className="flex items-center gap-1 px-2 py-1 rounded-md text-[var(--font-xs)] text-text-muted hover:bg-bg-hover hover:text-text-secondary transition-colors shrink-0" title="Paste from clipboard">
          <ClipboardPaste size={12} /> Paste
        </button>
        <button onClick={onClose} className="p-1 rounded-md hover:bg-bg-hover text-text-muted hover:text-text transition-colors shrink-0" aria-label="Close">
          <X size={14} />
        </button>
      </div>

      {/* Mode selector */}
      <div className="shrink-0 flex items-center gap-1 px-3 py-2 border-b border-border/40 overflow-x-auto">
        {MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            className={clsx(
              "px-2.5 py-1 rounded-md text-[var(--font-xs)] whitespace-nowrap transition-colors",
              mode === m.id ? "bg-accent/15 text-accent font-medium" : "text-text-muted hover:bg-bg-hover hover:text-text-secondary"
            )}
          >
            {m.label}
            {m.id === "auto" && mode === "auto" && <span className="opacity-60"> · {effective}</span>}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="shrink-0 border-b border-border/40" style={{ height: "38%" }}>
        <textarea
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          placeholder="Paste text, JSON, YAML, or notes here…"
          spellCheck={false}
          className="w-full h-full resize-none bg-transparent text-text outline-none p-3 font-mono text-[var(--font-sm)] leading-relaxed placeholder:text-text-muted/60"
        />
      </div>

      {/* Per-mode controls */}
      <div className="shrink-0 px-3 py-2 border-b border-border/40 flex items-center gap-2 flex-wrap">
        {effective === "text" && (
          <>
            <TogglePill active={doWrap} onClick={() => toggle("doWrap")} label="Wrap" />
            <TogglePill active={doJustify} onClick={() => toggle("doJustify")} label="Justify" />
            {(doWrap || doJustify) && (
              <div className="flex items-center gap-1.5">
                <input
                  type="range" min={40} max={120} step={1} value={wrapWidth}
                  onChange={(e) => setWrapWidth(parseInt(e.target.value))}
                  className="w-20 h-1.5 bg-bg-tertiary rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent"
                />
                <span className="text-[var(--font-xs)] text-text-muted tabular-nums w-6">{wrapWidth}</span>
              </div>
            )}
            <TogglePill active={doCleanup} onClick={() => toggle("doCleanup")} label="Clean" />
            <TogglePill active={doJoin} onClick={() => toggle("doJoin")} label="Unwrap" />
            <TogglePill active={doQuote} onClick={() => toggle("doQuote")} label="Quote" />
          </>
        )}
        {effective === "json" && result.jsonError && (
          <span className="text-[var(--font-xs)] text-red-400">Unrepairable JSON: {result.jsonError}</span>
        )}
        {effective === "json" && !result.jsonError && result.fixCount > 0 && (
          <span className="text-[var(--font-xs)] text-amber-400">{result.fixCount} line{result.fixCount > 1 ? "s" : ""} corrected (highlighted)</span>
        )}
        {effective === "json" && !result.jsonError && result.fixCount === 0 && rawText.trim() && (
          <span className="text-[var(--font-xs)] text-green-400">Valid · formatted</span>
        )}
        {effective === "yaml" && result.yamlError && (
          <span className="text-[var(--font-xs)] text-red-400">YAML error at line {result.yamlError.line}:{result.yamlError.column} — {result.yamlError.message}</span>
        )}
        {effective === "yaml" && !result.yamlError && rawText.trim() && (
          <span className="text-[var(--font-xs)] text-green-400">Valid · formatted</span>
        )}
        {effective === "markdown" && (
          <button
            onClick={() => toggle("mdShowSource")}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[var(--font-xs)] bg-bg-tertiary text-text-muted hover:text-text-secondary transition-colors"
          >
            {mdShowSource ? <Code size={11} /> : <Eye size={11} />}
            {mdShowSource ? "Source" : "Rendered"}
          </button>
        )}
      </div>

      {/* Preview */}
      <div className="flex-1 min-h-0 overflow-auto">
        {effective === "markdown" && !mdShowSource ? (
          <MarkdownPreview content={result.output} />
        ) : (
          <pre className="p-3 font-mono text-[var(--font-sm)] leading-relaxed whitespace-pre-wrap break-words text-text-secondary">
            {result.output.split("\n").map((line, i) => (
              <div
                key={i}
                className={clsx(result.changedLines.has(i) && "bg-amber-400/15 -mx-3 px-3 rounded-sm")}
              >
                {line || " "}
              </div>
            ))}
          </pre>
        )}
      </div>

      {/* Action bar */}
      <div className="shrink-0 border-t border-border bg-bg-secondary/60 flex items-center gap-2" style={{ padding: "8px var(--panel-px)" }}>
        <span className="text-[var(--font-xs)] text-text-muted tabular-nums flex-1 min-w-0 truncate">
          {counts.words} words · {counts.lines} lines · {counts.chars} chars
        </span>
        <button onClick={handleClear} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[var(--font-xs)] text-text-muted hover:bg-bg-hover hover:text-text-secondary transition-colors shrink-0" title="Clear, then load clipboard if available">
          <Trash2 size={12} /> Clear
        </button>
        <button onClick={handleSave} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[var(--font-xs)] text-text-secondary bg-bg-tertiary hover:bg-bg-hover transition-colors shrink-0" title="Save to file">
          <Save size={12} /> Save
        </button>
        <button onClick={handleCopy} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[var(--font-xs)] font-medium bg-accent/15 text-accent hover:bg-accent/25 transition-colors shrink-0" title="Copy formatted output">
          <Copy size={12} /> Copy
        </button>
      </div>
    </div>
  );
}

function TogglePill({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "px-2.5 py-1 rounded-md text-[var(--font-xs)] transition-colors",
        active ? "bg-accent/15 text-accent font-medium" : "bg-bg-tertiary text-text-muted hover:text-text-secondary"
      )}
    >
      {label}
    </button>
  );
}
