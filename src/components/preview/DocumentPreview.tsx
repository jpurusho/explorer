import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FileText, Maximize2 } from "lucide-react";

interface DocumentPreviewProps {
  path: string;
  name: string;
}

function openNativePreview(path: string, name: string) {
  invoke("show_native_preview", { path, title: name }).catch(() => {});
}

export function DocumentPreview({ path, name }: DocumentPreviewProps) {
  // dataUrl is either a multi-page PDF (data:application/pdf) when the document
  // can be converted, or a single-page thumbnail (data:image/png) fallback.
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [isPdf, setIsPdf] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    setDataUrl(null);

    invoke<string>("convert_document_to_pdf", { path })
      .then((result) => {
        if (cancelled) return;
        // The Rust fallback returns a "data:image/png;base64,..." URL when it can
        // only produce a single-page thumbnail. A successful PDF conversion
        // returns raw base64 PDF bytes (no data: prefix).
        if (result.startsWith("data:image")) {
          setDataUrl(result);
          setIsPdf(false);
        } else {
          setDataUrl(`data:application/pdf;base64,${result}`);
          setIsPdf(true);
        }
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [path]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-6 h-6 border-2 border-text-muted/20 border-t-accent rounded-full animate-spin mx-auto mb-2" />
          <span className="text-[var(--font-sm)] text-text-muted">Generating preview...</span>
        </div>
      </div>
    );
  }

  if (error || !dataUrl) {
    return (
      <div className="h-full flex items-center justify-center px-4">
        <div className="text-center">
          <FileText size={28} className="mx-auto mb-2 text-text-muted/30" />
          <p className="text-[var(--font-sm)] text-text-muted">No inline preview available</p>
          <p className="text-[var(--font-xs)] text-text-muted/50 mt-1 mb-3">{name}</p>
          <button
            onClick={() => openNativePreview(path, name)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent/15 text-accent text-[var(--font-sm)] hover:bg-accent/25 transition-colors"
          >
            <Maximize2 size={13} />
            Open Quick Look
          </button>
        </div>
      </div>
    );
  }

  if (isPdf) {
    return (
      <div className="h-full overflow-hidden">
        <embed src={dataUrl} type="application/pdf" className="w-full h-full" />
      </div>
    );
  }

  // Single-page thumbnail fallback (e.g. Keynote/PowerPoint that can't be
  // converted to a multi-page PDF without launching the native app). Offer a
  // native Quick Look window for full multi-slide navigation like Finder.
  return (
    <div className="h-full flex flex-col bg-bg">
      <div className="shrink-0 flex items-center justify-end px-3 py-1.5 border-b border-border">
        <button
          onClick={() => openNativePreview(path, name)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-accent/15 text-accent text-[var(--font-xs)] hover:bg-accent/25 transition-colors"
          title="Open all pages in a Quick Look window"
        >
          <Maximize2 size={12} />
          View all pages
        </button>
      </div>
      <div className="flex-1 min-h-0 flex items-center justify-center p-4 overflow-auto">
        <img
          src={dataUrl}
          alt={name}
          className="max-w-full max-h-full object-contain rounded shadow-lg"
        />
      </div>
    </div>
  );
}
