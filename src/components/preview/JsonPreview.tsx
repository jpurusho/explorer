import { useState, useMemo } from "react";
import { ChevronRight, ChevronDown, AlertTriangle } from "lucide-react";

interface JsonPreviewProps {
  content: string;
}

function tryParseJson(content: string): { data: unknown; error: string | null; fixed: boolean; fixDescription: string | null } {
  try {
    return { data: JSON.parse(content), error: null, fixed: false, fixDescription: null };
  } catch (firstError) {
    const fixes: string[] = [];
    let cleaned = content;

    // Remove single-line comments
    const noSingleComments = cleaned.replace(/\/\/.*$/gm, "");
    if (noSingleComments !== cleaned) { fixes.push("removed // comments"); cleaned = noSingleComments; }

    // Remove multi-line comments
    const noMultiComments = cleaned.replace(/\/\*[\s\S]*?\*\//g, "");
    if (noMultiComments !== cleaned) { fixes.push("removed /* */ comments"); cleaned = noMultiComments; }

    // Remove trailing commas before } or ]
    const noTrailing = cleaned.replace(/,\s*([}\]])/g, "$1");
    if (noTrailing !== cleaned) { fixes.push("removed trailing commas"); cleaned = noTrailing; }

    // Fix single quotes to double quotes (in keys/values)
    const doubleQuotes = cleaned.replace(/(['"])?(\w+)(['"])?\s*:/g, '"$2":')
      .replace(/:\s*'([^']*)'/g, ': "$1"');
    if (doubleQuotes !== cleaned) { fixes.push("fixed quotes"); cleaned = doubleQuotes; }

    try {
      return { data: JSON.parse(cleaned), error: null, fixed: true, fixDescription: fixes.join(", ") };
    } catch {
      // Last resort: try to extract valid JSON from within the content
      const jsonMatch = content.match(/[\[{][\s\S]*[\]}]/);
      if (jsonMatch) {
        try {
          return { data: JSON.parse(jsonMatch[0]), error: null, fixed: true, fixDescription: "extracted JSON block from content" };
        } catch { /* fall through */ }
      }
      return { data: null, error: String(firstError), fixed: false, fixDescription: null };
    }
  }
}

function JsonNode({ data, keyName, depth, isLast }: {
  data: unknown;
  keyName?: string;
  depth: number;
  isLast: boolean;
}) {
  const [expanded, setExpanded] = useState(depth < 3);

  const keyEl = keyName !== undefined ? (
    <>
      <span className="text-accent">"{keyName}"</span>
      <span className="text-text-muted mx-1">:</span>
    </>
  ) : null;

  if (data === null) {
    return (
      <div style={{ paddingLeft: `${depth * 14}px` }} className="flex items-baseline py-[1px]">
        {keyEl}
        <span className="text-orange-400 italic">null</span>
        {!isLast && <span className="text-text-muted">,</span>}
      </div>
    );
  }

  if (typeof data === "boolean") {
    return (
      <div style={{ paddingLeft: `${depth * 14}px` }} className="flex items-baseline py-[1px]">
        {keyEl}
        <span className="text-purple-400">{String(data)}</span>
        {!isLast && <span className="text-text-muted">,</span>}
      </div>
    );
  }

  if (typeof data === "number") {
    return (
      <div style={{ paddingLeft: `${depth * 14}px` }} className="flex items-baseline py-[1px]">
        {keyEl}
        <span className="text-green-400">{String(data)}</span>
        {!isLast && <span className="text-text-muted">,</span>}
      </div>
    );
  }

  if (typeof data === "string") {
    const display = data.length > 120 ? data.slice(0, 120) + "…" : data;
    return (
      <div style={{ paddingLeft: `${depth * 14}px` }} className="flex items-baseline py-[1px] min-w-0">
        {keyEl}
        <span className="text-amber-300 break-all">"{display}"</span>
        {!isLast && <span className="text-text-muted">,</span>}
      </div>
    );
  }

  if (Array.isArray(data)) {
    if (data.length === 0) {
      return (
        <div style={{ paddingLeft: `${depth * 14}px` }} className="flex items-baseline py-[1px]">
          {keyEl}
          <span className="text-text-muted">[]</span>
          {!isLast && <span className="text-text-muted">,</span>}
        </div>
      );
    }

    return (
      <div>
        <div
          style={{ paddingLeft: `${depth * 14}px` }}
          className="flex items-center py-[1px] cursor-pointer hover:bg-bg-hover/50 rounded-sm"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded
            ? <ChevronDown size={10} className="mr-1 text-text-muted shrink-0" />
            : <ChevronRight size={10} className="mr-1 text-text-muted shrink-0" />
          }
          {keyEl}
          <span className="text-text-muted">[</span>
          {!expanded && (
            <span className="text-text-muted/70 ml-1 text-[10px]">{data.length} items</span>
          )}
          {!expanded && <span className="text-text-muted ml-0.5">]</span>}
          {!expanded && !isLast && <span className="text-text-muted">,</span>}
        </div>
        {expanded && (
          <>
            {data.map((item, idx) => (
              <JsonNode key={idx} data={item} depth={depth + 1} isLast={idx === data.length - 1} />
            ))}
            <div style={{ paddingLeft: `${depth * 14}px` }} className="py-[1px]">
              <span className="text-text-muted">]</span>
              {!isLast && <span className="text-text-muted">,</span>}
            </div>
          </>
        )}
      </div>
    );
  }

  if (typeof data === "object") {
    const entries = Object.entries(data as Record<string, unknown>);
    if (entries.length === 0) {
      return (
        <div style={{ paddingLeft: `${depth * 14}px` }} className="flex items-baseline py-[1px]">
          {keyEl}
          <span className="text-text-muted">{"{}"}</span>
          {!isLast && <span className="text-text-muted">,</span>}
        </div>
      );
    }

    return (
      <div>
        <div
          style={{ paddingLeft: `${depth * 14}px` }}
          className="flex items-center py-[1px] cursor-pointer hover:bg-bg-hover/50 rounded-sm"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded
            ? <ChevronDown size={10} className="mr-1 text-text-muted shrink-0" />
            : <ChevronRight size={10} className="mr-1 text-text-muted shrink-0" />
          }
          {keyEl}
          <span className="text-text-muted">{"{"}</span>
          {!expanded && (
            <span className="text-text-muted/70 ml-1 text-[10px]">{entries.length} keys</span>
          )}
          {!expanded && <span className="text-text-muted ml-0.5">{"}"}</span>}
          {!expanded && !isLast && <span className="text-text-muted">,</span>}
        </div>
        {expanded && (
          <>
            {entries.map(([key, val], idx) => (
              <JsonNode key={key} data={val} keyName={key} depth={depth + 1} isLast={idx === entries.length - 1} />
            ))}
            <div style={{ paddingLeft: `${depth * 14}px` }} className="py-[1px]">
              <span className="text-text-muted">{"}"}</span>
              {!isLast && <span className="text-text-muted">,</span>}
            </div>
          </>
        )}
      </div>
    );
  }

  return null;
}

export function JsonPreview({ content }: JsonPreviewProps) {
  const result = useMemo(() => tryParseJson(content), [content]);

  if (result.error) {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 border-b border-amber-500/20">
          <AlertTriangle size={13} className="text-amber-400 shrink-0" />
          <span className="text-[11px] text-amber-300">Invalid JSON — showing raw content</span>
        </div>
        <div className="flex-1 overflow-auto p-4">
          <pre className="text-[11px] text-text-secondary font-mono whitespace-pre-wrap break-all leading-relaxed">
            {content}
          </pre>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {result.fixed && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border-b border-amber-500/20">
          <AlertTriangle size={12} className="text-amber-400 shrink-0" />
          <span className="text-[10px] text-amber-300">
            Auto-fixed: {result.fixDescription || "syntax issues"}
          </span>
        </div>
      )}
      <div className="flex-1 overflow-auto pl-6 pr-8 py-3 font-mono text-[11px] leading-[1.6]">
        <JsonNode data={result.data} depth={0} isLast={true} />
      </div>
    </div>
  );
}
