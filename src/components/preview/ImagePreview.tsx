import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Camera, Aperture, Clock, Sun } from "lucide-react";

interface ImagePreviewProps {
  path: string;
  name: string;
}

interface ExifData {
  camera_make: string | null;
  camera_model: string | null;
  lens_model: string | null;
  focal_length: string | null;
  aperture: string | null;
  shutter_speed: string | null;
  iso: string | null;
  date_taken: string | null;
  width: number | null;
  height: number | null;
  orientation: number | null;
}

export function ImagePreview({ path, name }: ImagePreviewProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [exif, setExif] = useState<ExifData | null>(null);
  const [showExif, setShowExif] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadImage() {
      try {
        const base64 = await invoke<string>("read_image_base64", { path });
        if (!cancelled) {
          const ext = path.split(".").pop()?.toLowerCase() || "png";
          const mime =
            ext === "jpg" || ext === "jpeg"
              ? "image/jpeg"
              : ext === "gif"
              ? "image/gif"
              : ext === "webp"
              ? "image/webp"
              : ext === "svg"
              ? "image/svg+xml"
              : "image/png";
          setDataUrl(`data:${mime};base64,${base64}`);
        }
      } catch {
        if (!cancelled) setDataUrl(null);
      }
    }

    async function loadExif() {
      try {
        const data = await invoke<ExifData>("read_exif_data", { path });
        if (!cancelled) setExif(data);
      } catch {
        if (!cancelled) setExif(null);
      }
    }

    loadImage();
    loadExif();
    return () => { cancelled = true; };
  }, [path]);

  if (!dataUrl) {
    return (
      <div className="h-full flex items-center justify-center">
        <span className="text-xs text-text-muted">Loading image...</span>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden min-h-0">
        <img
          src={dataUrl}
          alt={name}
          className="max-w-full max-h-full object-contain rounded-md"
        />
      </div>

      {exif && showExif && (
        <div className="shrink-0 border-t border-border bg-bg-secondary px-6 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-text-muted uppercase tracking-wider font-semibold">
              EXIF Data
            </span>
            <button
              onClick={() => setShowExif(false)}
              className="text-[10px] text-text-muted hover:text-text-secondary"
            >
              Hide
            </button>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[11px]">
            {exif.camera_model && (
              <div className="flex items-center gap-1.5">
                <Camera size={10} className="text-text-muted shrink-0" />
                <span className="text-text-secondary truncate">
                  {exif.camera_make ? `${exif.camera_make} ${exif.camera_model}` : exif.camera_model}
                </span>
              </div>
            )}
            {exif.lens_model && (
              <div className="flex items-center gap-1.5">
                <Aperture size={10} className="text-text-muted shrink-0" />
                <span className="text-text-secondary truncate">{exif.lens_model}</span>
              </div>
            )}
            {exif.focal_length && (
              <div className="text-text-secondary">{exif.focal_length}</div>
            )}
            {exif.aperture && (
              <div className="text-text-secondary">f/{exif.aperture}</div>
            )}
            {exif.shutter_speed && (
              <div className="flex items-center gap-1.5">
                <Clock size={10} className="text-text-muted shrink-0" />
                <span className="text-text-secondary">{exif.shutter_speed}</span>
              </div>
            )}
            {exif.iso && (
              <div className="flex items-center gap-1.5">
                <Sun size={10} className="text-text-muted shrink-0" />
                <span className="text-text-secondary">ISO {exif.iso}</span>
              </div>
            )}
            {(exif.width && exif.height) && (
              <div className="text-text-secondary">{exif.width} x {exif.height}</div>
            )}
            {exif.date_taken && (
              <div className="text-text-secondary">{exif.date_taken}</div>
            )}
          </div>
        </div>
      )}

      {exif && !showExif && (
        <div className="shrink-0 border-t border-border bg-bg-secondary px-6 py-1.5">
          <button
            onClick={() => setShowExif(true)}
            className="text-[10px] text-text-muted hover:text-text-secondary"
          >
            Show EXIF
          </button>
        </div>
      )}
    </div>
  );
}
