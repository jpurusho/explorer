import { Music } from "lucide-react";

interface AudioPreviewProps {
  path: string;
  name: string;
}

function getMediaUrl(filePath: string): string {
  const encoded = encodeURIComponent(filePath);
  return `media://localhost/${encoded}`;
}

export function AudioPreview({ path, name }: AudioPreviewProps) {
  const src = getMediaUrl(path);

  return (
    <div className="h-full flex flex-col items-center justify-center p-6 gap-6">
      <div className="w-24 h-24 rounded-2xl bg-bg-tertiary border border-border flex items-center justify-center">
        <Music size={36} className="text-text-muted" strokeWidth={1.5} />
      </div>
      <p className="text-[12px] text-text-secondary text-center max-w-[250px] truncate">
        {name}
      </p>
      <audio
        key={path}
        controls
        preload="metadata"
        className="w-full max-w-[300px]"
      >
        <source src={src} />
      </audio>
    </div>
  );
}
