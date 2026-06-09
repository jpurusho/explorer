import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FileText, ChevronLeft, ChevronRight } from "lucide-react";

interface DocumentPreviewProps {
  path: string;
  name: string;
}

export function DocumentPreview({ path, name }: DocumentPreviewProps) {
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [pageCount, setPageCount] = useState(1);
  const [currentPage, setCurrentPage] = useState(0);

  const ext = name.split(".").pop()?.toLowerCase() || "";
  const isDocx = ext === "doc" || ext === "docx";

  useEffect(() => {
    setCurrentPage(0);
    setPageCount(1);
    invoke<number>("get_document_page_count", { path })
      .then((count) => setPageCount(count))
      .catch(() => {});
  }, [path]);

  useEffect(() => {
    setLoading(true);
    setError(false);
    setPreviewSrc(null);
    invoke<string>("generate_document_preview", { path, page: currentPage })
      .then(setPreviewSrc)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [path, currentPage]);

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

  if (error || !previewSrc) {
    return (
      <div className="h-full flex items-center justify-center px-4">
        <div className="text-center">
          <FileText size={28} className="mx-auto mb-2 text-text-muted/30" />
          <p className="text-[var(--font-sm)] text-text-muted">No preview available for this document</p>
          <p className="text-[var(--font-xs)] text-text-muted/50 mt-1">{name}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Page navigation */}
      {pageCount > 1 && (
        <div className="shrink-0 flex items-center justify-center gap-3 px-4 py-2 border-b border-border/40">
          <button
            onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
            disabled={currentPage === 0}
            className="p-1 rounded hover:bg-bg-hover disabled:opacity-30 disabled:cursor-not-allowed text-text-muted"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="text-[var(--font-xs)] text-text-muted tabular-nums">
            Page {currentPage + 1} of {pageCount}
          </span>
          <button
            onClick={() => setCurrentPage(Math.min(pageCount - 1, currentPage + 1))}
            disabled={currentPage >= pageCount - 1}
            className="p-1 rounded hover:bg-bg-hover disabled:opacity-30 disabled:cursor-not-allowed text-text-muted"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}

      {/* Info for single-page preview formats */}
      {!isDocx && pageCount === 1 && (
        <div className="shrink-0 px-4 py-1.5 border-b border-border/40">
          <span className="text-[var(--font-xs)] text-text-muted/60">
            Showing first page preview
          </span>
        </div>
      )}

      {/* Preview image */}
      <div className="flex-1 flex items-center justify-center bg-bg p-4 overflow-auto min-h-0">
        <img
          src={previewSrc}
          alt={name}
          className="max-w-full max-h-full object-contain rounded shadow-lg"
        />
      </div>
    </div>
  );
}
