import type { FileType } from "../../types";

/** Editable in the code editor (and used as the "render as text" fallback set). */
export const editableTypes: FileType[] = ["text", "code", "markdown", "json", "yaml", "html", "unknown"];

/** Have a non-editor rendered view (formatted, not raw source). */
export const renderableTypes: FileType[] = ["markdown", "json", "yaml", "html"];

/** Everything that can be shown in a preview pane / detached window. */
export const previewableTypes: FileType[] = [
  "image", "video", "audio", "markdown", "json", "yaml", "html",
  "text", "code", "document", "archive", "unknown",
];

/** True for PDF documents (routed to the embedded PDF viewer). */
export function isPdf(name: string): boolean {
  return name.toLowerCase().endsWith(".pdf");
}

/** True for HTML documents (offered as rendered iframe view). */
export function isHtml(name: string): boolean {
  const n = name.toLowerCase();
  return n.endsWith(".html") || n.endsWith(".htm");
}
