interface TextPreviewProps {
  content: string;
  truncated: boolean;
}

export function TextPreview({ content, truncated }: TextPreviewProps) {
  return (
    <div className="h-full overflow-auto px-[var(--panel-px)] py-4">
      <pre className="text-[var(--font-sm)] text-text-secondary font-mono whitespace-pre-wrap break-words leading-[1.6]">
        {content}
      </pre>
      {truncated && (
        <div className="mt-3 text-[var(--font-xs)] text-text-muted italic border-t border-border pt-2">
          File truncated — showing first 1MB
        </div>
      )}
    </div>
  );
}
