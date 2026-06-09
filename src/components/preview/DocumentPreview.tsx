import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FileText } from "lucide-react";

interface DocumentPreviewProps {
  path: string;
  name: string;
}

export function DocumentPreview({ path, name }: DocumentPreviewProps) {
  const [pdfData, setPdfData] = useState<string | null>(null);
  const [fallbackImage, setFallbackImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    setPdfData(null);
    setFallbackImage(null);

    invoke<string>("convert_document_to_pdf", { path })
      .then((result) => {
        if (result.startsWith("data:image/")) {
          // Fallback: got a PNG thumbnail instead of PDF
          setFallbackImage(result);
        } else {
          // Got base64 PDF data
          setPdfData(`data:application/pdf;base64,${result}`);
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [path]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-6 h-6 border-2 border-text-muted/20 border-t-accent rounded-full animate-spin mx-auto mb-2" />
          <span className="text-[var(--font-sm)] text-text-muted">Converting document...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center px-4">
        <div className="text-center">
          <FileText size={28} className="mx-auto mb-2 text-text-muted/30" />
          <p className="text-[var(--font-sm)] text-text-muted">No preview available</p>
          <p className="text-[var(--font-xs)] text-text-muted/50 mt-1">{name}</p>
        </div>
      </div>
    );
  }

  // Full PDF rendering with native scroll and page navigation
  if (pdfData) {
    return (
      <div className="h-full overflow-hidden">
        <embed
          src={pdfData}
          type="application/pdf"
          className="w-full h-full"
        />
      </div>
    );
  }

  // Fallback: single-page image thumbnail
  if (fallbackImage) {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        <div className="shrink-0 px-4 py-1.5 border-b border-border/40">
          <span className="text-[var(--font-xs)] text-text-muted/60">
            First page preview (install Keynote/Pages for full document)
          </span>
        </div>
        <div className="flex-1 flex items-center justify-center bg-bg p-4 overflow-auto min-h-0">
          <img
            src={fallbackImage}
            alt={name}
            className="max-w-full max-h-full object-contain rounded shadow-lg"
          />
        </div>
      </div>
    );
  }

  return null;
}
