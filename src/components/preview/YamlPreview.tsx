import { useState, useMemo } from "react";
import { ChevronRight, ChevronDown, AlertTriangle } from "lucide-react";
import jsYaml from "js-yaml";

interface YamlPreviewProps {
  content: string;
}

function YamlNode({ keyName, data, depth }: {
  keyName?: string;
  data: unknown;
  depth: number;
}) {
  const [collapsed, setCollapsed] = useState(depth > 3);

  if (data === null || data === undefined) {
    return (
      <div style={{ paddingLeft: `${depth * 16}px` }} className="flex items-baseline py-[2px]">
        {keyName !== undefined && (
          <>
            <span className="text-accent">{keyName}</span>
            <span className="text-text-muted mx-1">:</span>
          </>
        )}
        <span className="text-orange-400 italic">null</span>
      </div>
    );
  }

  if (typeof data === "boolean") {
    return (
      <div style={{ paddingLeft: `${depth * 16}px` }} className="flex items-baseline py-[2px]">
        {keyName !== undefined && (
          <>
            <span className="text-accent">{keyName}</span>
            <span className="text-text-muted mx-1">:</span>
          </>
        )}
        <span className="text-yellow-400">{data.toString()}</span>
      </div>
    );
  }

  if (typeof data === "number") {
    return (
      <div style={{ paddingLeft: `${depth * 16}px` }} className="flex items-baseline py-[2px]">
        {keyName !== undefined && (
          <>
            <span className="text-accent">{keyName}</span>
            <span className="text-text-muted mx-1">:</span>
          </>
        )}
        <span className="text-purple-400">{data}</span>
      </div>
    );
  }

  if (typeof data === "string") {
    const multiline = data.includes("\n");
    return (
      <div style={{ paddingLeft: `${depth * 16}px` }} className="flex items-baseline py-[2px]">
        {keyName !== undefined && (
          <>
            <span className="text-accent">{keyName}</span>
            <span className="text-text-muted mx-1">:</span>
          </>
        )}
        {multiline ? (
          <span className="text-green-400 whitespace-pre-wrap">{data}</span>
        ) : (
          <span className="text-green-400">{data}</span>
        )}
      </div>
    );
  }

  if (Array.isArray(data)) {
    if (data.length === 0) {
      return (
        <div style={{ paddingLeft: `${depth * 16}px` }} className="flex items-baseline py-[2px]">
          {keyName !== undefined && (
            <>
              <span className="text-accent">{keyName}</span>
              <span className="text-text-muted mx-1">:</span>
            </>
          )}
          <span className="text-text-muted">[]</span>
        </div>
      );
    }

    return (
      <div>
        <div
          style={{ paddingLeft: `${depth * 16}px` }}
          className="flex items-center gap-1 py-[2px] cursor-pointer hover:bg-bg-hover rounded"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed
            ? <ChevronRight size={12} className="text-text-muted shrink-0" />
            : <ChevronDown size={12} className="text-text-muted shrink-0" />
          }
          {keyName !== undefined && (
            <>
              <span className="text-accent">{keyName}</span>
              <span className="text-text-muted mx-1">:</span>
            </>
          )}
          <span className="text-text-muted text-[--font-xs]">[{data.length} items]</span>
        </div>
        {!collapsed && data.map((item, idx) => {
          if (typeof item === "object" && item !== null) {
            return (
              <div key={idx}>
                <div style={{ paddingLeft: `${(depth + 1) * 16}px` }} className="flex items-baseline py-[2px]">
                  <span className="text-text-muted mr-1">-</span>
                  <span className="text-text-muted text-[--font-xs]">
                    {Array.isArray(item) ? `[${item.length}]` : `{${Object.keys(item).length}}`}
                  </span>
                </div>
                {Object.entries(item as Record<string, unknown>).map(([k, v]) => (
                  <YamlNode key={k} keyName={k} data={v} depth={depth + 2} />
                ))}
              </div>
            );
          }
          return (
            <div key={idx} style={{ paddingLeft: `${(depth + 1) * 16}px` }} className="flex items-baseline py-[2px]">
              <span className="text-text-muted mr-1">-</span>
              <span className={
                typeof item === "string" ? "text-green-400" :
                typeof item === "number" ? "text-purple-400" :
                typeof item === "boolean" ? "text-yellow-400" :
                "text-orange-400 italic"
              }>
                {item === null ? "null" : String(item)}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  if (typeof data === "object") {
    const entries = Object.entries(data as Record<string, unknown>);
    if (entries.length === 0) {
      return (
        <div style={{ paddingLeft: `${depth * 16}px` }} className="flex items-baseline py-[2px]">
          {keyName !== undefined && (
            <>
              <span className="text-accent">{keyName}</span>
              <span className="text-text-muted mx-1">:</span>
            </>
          )}
          <span className="text-text-muted">{"{}"}</span>
        </div>
      );
    }

    if (keyName !== undefined) {
      return (
        <div>
          <div
            style={{ paddingLeft: `${depth * 16}px` }}
            className="flex items-center gap-1 py-[2px] cursor-pointer hover:bg-bg-hover rounded"
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed
              ? <ChevronRight size={12} className="text-text-muted shrink-0" />
              : <ChevronDown size={12} className="text-text-muted shrink-0" />
            }
            <span className="text-accent">{keyName}</span>
            <span className="text-text-muted mx-1">:</span>
            <span className="text-text-muted text-[--font-xs]">{`{${entries.length}}`}</span>
          </div>
          {!collapsed && entries.map(([key, value]) => (
            <YamlNode key={key} keyName={key} data={value} depth={depth + 1} />
          ))}
        </div>
      );
    }

    return (
      <div>
        {entries.map(([key, value]) => (
          <YamlNode key={key} keyName={key} data={value} depth={depth} />
        ))}
      </div>
    );
  }

  return (
    <div style={{ paddingLeft: `${depth * 16}px` }} className="py-[2px] text-text-secondary">
      {String(data)}
    </div>
  );
}

export function YamlPreview({ content }: YamlPreviewProps) {
  const result = useMemo(() => {
    try {
      const data = jsYaml.load(content);
      return { data, error: null };
    } catch (e: any) {
      return { data: null, error: e.message || "Failed to parse YAML" };
    }
  }, [content]);

  if (result.error) {
    return (
      <div className="h-full overflow-auto pl-6 pr-8 py-4">
        <div className="flex items-center gap-2 text-amber-400 mb-3">
          <AlertTriangle size={12} />
          <span className="text-[--font-sm]">Parse error: {result.error}</span>
        </div>
        <pre className="text-[--font-sm] text-text-secondary font-mono whitespace-pre-wrap">
          {content}
        </pre>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto pl-6 pr-8 py-3 font-mono text-[--font-sm] leading-[1.7]">
      <YamlNode data={result.data} depth={0} />
    </div>
  );
}
