interface TextPreviewProps {
  content: string;
  truncated: boolean;
}

export function TextPreview({ content, truncated }: TextPreviewProps) {
  return (
    <div className="h-full overflow-auto pl-6 pr-8 py-4">
      <pre className="text-[11px] text-text-secondary font-mono whitespace-pre-wrap break-words leading-[1.6]">
        {content}
      </pre>
      {truncated && (
        <div className="mt-3 text-[10px] text-text-muted italic border-t border-border pt-2">
          File truncated — showing first 1MB
        </div>
      )}
    </div>
  );
}
