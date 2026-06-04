import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

interface PdfPreviewProps {
  path: string;
}

export function PdfPreview({ path }: PdfPreviewProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    invoke<string>("read_image_base64", { path }).then((base64) => {
      if (!cancelled) {
        setDataUrl(`data:application/pdf;base64,${base64}`);
      }
    }).catch((err) => {
      if (!cancelled) setError(String(err));
    });
    return () => { cancelled = true; };
  }, [path]);

  if (error) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <span className="text-[11px] text-red-400">Cannot load PDF</span>
      </div>
    );
  }

  if (!dataUrl) {
    return (
      <div className="h-full flex items-center justify-center">
        <span className="text-[11px] text-text-muted">Loading PDF...</span>
      </div>
    );
  }

  return (
    <div className="h-full overflow-hidden">
      <embed
        src={dataUrl}
        type="application/pdf"
        className="w-full h-full"
      />
    </div>
  );
}
