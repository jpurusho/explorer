import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FileText } from "lucide-react";

interface DocumentPreviewProps {
  path: string;
  name: string;
}

function getMediaUrl(filePath: string): string {
  const encoded = encodeURIComponent(filePath);
  return `media://localhost/${encoded}`;
}

export function DocumentPreview({ path, name }: DocumentPreviewProps) {
  const [mode, setMode] = useState<"iframe" | "image" | "error">("iframe");
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const src = getMediaUrl(path);

  useEffect(() => {
    setMode("iframe");
    setImageSrc(null);
  }, [path]);

  const handleIframeError = () => {
    // iframe didn't render — fall back to qlmanage thumbnail
    loadFallbackImage();
  };

  const loadFallbackImage = () => {
    invoke<string>("generate_document_preview", { path, page: 0 })
      .then((result) => {
        setImageSrc(result);
        setMode("image");
      })
      .catch(() => setMode("error"));
  };

  if (mode === "error") {
    return (
      <div className="h-full flex items-center justify-center px-4">
        <div className="text-center">
          <FileText size={28} className="mx-auto mb-2 text-text-muted/30" />
          <p className="text-[var(--font-sm)] text-text-muted">Cannot preview this document</p>
          <p className="text-[var(--font-xs)] text-text-muted/50 mt-1">{name}</p>
        </div>
      </div>
    );
  }

  if (mode === "image" && imageSrc) {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        <div className="shrink-0 px-4 py-1.5 border-b border-border/40">
          <span className="text-[var(--font-xs)] text-text-muted/60">
            Quick Look preview
          </span>
        </div>
        <div className="flex-1 flex items-center justify-center bg-bg p-4 overflow-auto min-h-0">
          <img
            src={imageSrc}
            alt={name}
            className="max-w-full max-h-full object-contain rounded shadow-lg"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-hidden relative">
      <iframe
        key={path}
        src={src}
        title={name}
        className="w-full h-full border-0 bg-white"
        onError={handleIframeError}
        onLoad={(e) => {
          // If the iframe loaded but has no content (blank page), fall back
          try {
            const iframe = e.currentTarget;
            // Give it a moment to render
            setTimeout(() => {
              if (iframe.contentDocument?.body?.innerText === "" && !iframe.contentDocument?.querySelector("embed, object, img")) {
                loadFallbackImage();
              }
            }, 1000);
          } catch {
            // Cross-origin — means it rendered something, which is fine
          }
        }}
      />
    </div>
  );
}
