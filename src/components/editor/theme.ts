import { EditorView } from "@codemirror/view";
import { HighlightStyle } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";

export const explorerTheme = EditorView.theme({
  "&": {
    height: "100%",
    fontSize: "12.5px",
    backgroundColor: "var(--explorer-bg)",
    color: "var(--explorer-text)",
  },
  ".cm-content": {
    fontFamily: "'SF Mono', 'Fira Code', 'JetBrains Mono', 'Cascadia Code', Menlo, monospace",
    padding: "8px 32px 8px 12px",
    caretColor: "var(--explorer-accent)",
  },
  ".cm-cursor, .cm-dropCursor": {
    borderLeftColor: "var(--explorer-accent)",
    borderLeftWidth: "2px",
  },
  ".cm-activeLine": {
    backgroundColor: "var(--explorer-bg-hover)",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "var(--explorer-bg-hover)",
  },
  ".cm-gutters": {
    backgroundColor: "var(--explorer-bg-secondary)",
    color: "var(--explorer-text-muted)",
    border: "none",
    borderRight: "1px solid var(--explorer-border)",
    paddingRight: "4px",
  },
  ".cm-lineNumbers .cm-gutterElement": {
    padding: "0 8px 0 12px",
    fontSize: "11px",
  },
  ".cm-foldGutter .cm-gutterElement": {
    padding: "0 4px",
  },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
    backgroundColor: "var(--explorer-bg-selected) !important",
  },
  ".cm-selectionMatch": {
    backgroundColor: "rgba(255, 200, 0, 0.15)",
    borderRadius: "2px",
  },
  ".cm-searchMatch": {
    backgroundColor: "rgba(255, 200, 0, 0.25)",
    borderRadius: "2px",
    outline: "1px solid rgba(255, 200, 0, 0.4)",
  },
  ".cm-searchMatch.cm-searchMatch-selected": {
    backgroundColor: "rgba(255, 150, 0, 0.35)",
  },
  ".cm-panels": {
    backgroundColor: "var(--explorer-bg-secondary)",
    color: "var(--explorer-text)",
    borderBottom: "1px solid var(--explorer-border)",
  },
  ".cm-panels.cm-panels-top": {
    borderBottom: "1px solid var(--explorer-border)",
  },
  ".cm-panel.cm-search": {
    padding: "6px 12px",
  },
  ".cm-panel.cm-search input": {
    backgroundColor: "var(--explorer-bg)",
    color: "var(--explorer-text)",
    border: "1px solid var(--explorer-border)",
    borderRadius: "4px",
    padding: "3px 8px",
    fontSize: "12px",
    outline: "none",
  },
  ".cm-panel.cm-search input:focus": {
    borderColor: "var(--explorer-accent)",
  },
  ".cm-panel.cm-search button": {
    backgroundColor: "var(--explorer-bg-tertiary)",
    color: "var(--explorer-text-secondary)",
    border: "1px solid var(--explorer-border)",
    borderRadius: "4px",
    padding: "3px 10px",
    fontSize: "11px",
    cursor: "pointer",
  },
  ".cm-panel.cm-search button:hover": {
    backgroundColor: "var(--explorer-bg-hover)",
  },
  ".cm-tooltip": {
    backgroundColor: "var(--explorer-bg-secondary)",
    border: "1px solid var(--explorer-border)",
    borderRadius: "6px",
  },
  ".cm-vim-panel": {
    backgroundColor: "var(--explorer-bg-secondary)",
    color: "var(--explorer-text)",
    padding: "2px 12px",
    fontSize: "12px",
    fontFamily: "'SF Mono', monospace",
  },
}, { dark: true });

export const explorerHighlightStyle = HighlightStyle.define([
  { tag: t.keyword, color: "#c678dd" },
  { tag: [t.name, t.deleted, t.character, t.macroName], color: "#e06c75" },
  { tag: [t.function(t.variableName), t.labelName], color: "#61afef" },
  { tag: [t.color, t.constant(t.name), t.standard(t.name)], color: "#d19a66" },
  { tag: [t.definition(t.name), t.separator], color: "#abb2bf" },
  { tag: [t.typeName, t.className, t.number, t.changed, t.annotation, t.modifier, t.self, t.namespace], color: "#e5c07b" },
  { tag: [t.operator, t.operatorKeyword, t.url, t.escape, t.regexp, t.link, t.special(t.string)], color: "#56b6c2" },
  { tag: [t.meta, t.comment], color: "#7f848e", fontStyle: "italic" },
  { tag: t.strong, fontWeight: "bold" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.strikethrough, textDecoration: "line-through" },
  { tag: t.link, color: "#61afef", textDecoration: "underline" },
  { tag: t.heading, fontWeight: "bold", color: "#e06c75" },
  { tag: [t.atom, t.bool, t.special(t.variableName)], color: "#d19a66" },
  { tag: [t.processingInstruction, t.string, t.inserted], color: "#98c379" },
  { tag: t.invalid, color: "#ff0000" },
]);
