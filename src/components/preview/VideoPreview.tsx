interface VideoPreviewProps {
  path: string;
  name: string;
}

function getMediaUrl(filePath: string): string {
  const encoded = encodeURIComponent(filePath);
  return `media://localhost/${encoded}`;
}

export function VideoPreview({ path, name }: VideoPreviewProps) {
  const src = getMediaUrl(path);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 flex items-center justify-center p-4 bg-black/20 min-h-0">
        <video
          key={path}
          controls
          preload="metadata"
          className="max-w-full max-h-full rounded-md shadow-lg"
        >
          <source src={src} />
        </video>
      </div>
      <div className="shrink-0 px-6 py-2 bg-bg-secondary border-t border-border">
        <p className="text-[11px] text-text-muted truncate">{name}</p>
      </div>
    </div>
  );
}
