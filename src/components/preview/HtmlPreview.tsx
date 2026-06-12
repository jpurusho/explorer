import { useEffect, useMemo, useRef, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { AlertTriangle } from "lucide-react";
import { useSettingsStore } from "../../stores/settingsStore";

interface HtmlPreviewProps {
  /** The HTML source text (possibly truncated). */
  content: string;
  /** Absolute path of the HTML file — used as the base for relative asset URLs. */
  basePath: string;
  /** True when the source was cut off at the preview size limit. */
  truncated?: boolean;
  /** Full file size in bytes (for the warning copy). */
  size?: number;
}

/**
 * Renders an HTML file inside a sandboxed iframe. Sibling assets (images, CSS,
 * scripts loaded with relative URLs) resolve against the file's folder via the
 * Tauri asset protocol. Top-level navigation is blocked so a stray <a href>
 * click can't replace the app; scripts inside the iframe run normally.
 */
export function HtmlPreview({ content, basePath, truncated, size }: HtmlPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [error, setError] = useState<string | null>(null);
  const previewMaxMb = useSettingsStore((s) => s.settings.preview_max_mb || 5);

  const srcDoc = useMemo(() => {
    try {
      // Strip the filename, keep the trailing slash so the <base href> resolves
      // sibling assets correctly (a base without trailing slash treats the last
      // path segment as a filename, not a directory).
      const lastSlash = basePath.lastIndexOf("/");
      const dir = lastSlash >= 0 ? basePath.slice(0, lastSlash + 1) : basePath;
      const baseHref = convertFileSrc(dir);
      return injectBase(content, baseHref);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return "";
    }
  }, [content, basePath]);

  useEffect(() => {
    setError(null);
  }, [content, basePath]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-full px-4">
        <span className="text-[var(--font-sm)] text-text-muted">Failed to render: {error}</span>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col">
      {truncated && (
        <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-border bg-amber-500/10 text-amber-600 dark:text-amber-400">
          <AlertTriangle size={14} className="shrink-0" />
          <span className="text-[var(--font-xs)] flex-1 min-w-0">
            File is {formatMb(size)} — preview truncated to {previewMaxMb} MB.
            Increase the limit in Settings to render the full document.
          </span>
        </div>
      )}
      <iframe
        ref={iframeRef}
        title="HTML preview"
        srcDoc={srcDoc}
        // allow-scripts: render JS-driven pages.
        // allow-same-origin: relative fetches and DOM APIs work normally.
        // Omitting allow-top-navigation prevents the iframe from replacing
        // Explorer's own UI if the page does location = "..." or clicks <a>.
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        className="flex-1 min-h-0 w-full bg-white border-0"
      />
    </div>
  );
}

function formatMb(bytes: number | undefined): string {
  if (!bytes && bytes !== 0) return "large";
  const mb = bytes / (1024 * 1024);
  return mb >= 10 ? `${mb.toFixed(0)} MB` : `${mb.toFixed(1)} MB`;
}

/**
 * Inject a `<base href="...">` tag into the HTML so relative URLs resolve
 * against the source file's directory. If a <base> already exists, leave it
 * alone — the author's intent wins.
 */
function injectBase(html: string, baseHref: string): string {
  if (/<base\b[^>]*>/i.test(html)) return html;
  const baseTag = `<base href="${escapeAttr(baseHref)}">`;
  if (/<head\b[^>]*>/i.test(html)) {
    return html.replace(/<head\b[^>]*>/i, (m) => `${m}\n${baseTag}`);
  }
  if (/<html\b[^>]*>/i.test(html)) {
    return html.replace(/<html\b[^>]*>/i, (m) => `${m}\n<head>${baseTag}</head>`);
  }
  return `<!DOCTYPE html><html><head>${baseTag}</head><body>${html}</body></html>`;
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}
