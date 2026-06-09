import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FileText } from "lucide-react";

interface DocumentPreviewProps {
  path: string;
  name: string;
}

export function DocumentPreview({ path, name }: DocumentPreviewProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    setImageSrc(null);
    invoke<string>("generate_document_preview", { path, page: 0 })
      .then(setImageSrc)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
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

  if (error || !imageSrc) {
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

  return (
    <div className="h-full flex items-center justify-center bg-bg p-4 overflow-auto">
      <img
        src={imageSrc}
        alt={name}
        className="max-w-full max-h-full object-contain rounded shadow-lg"
      />
    </div>
  );
}
