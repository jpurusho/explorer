import { useEffect, useRef, useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import mermaid from "mermaid";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

interface MarkdownPreviewProps {
  content: string;
}

mermaid.initialize({
  startOnLoad: false,
  theme: "dark",
  darkMode: true,
  fontFamily: "ui-rounded, -apple-system, system-ui, sans-serif",
  themeVariables: {
    primaryColor: "#4da8ff",
    primaryTextColor: "#f0f0f2",
    primaryBorderColor: "#38383a",
    lineColor: "#7a7a80",
    secondaryColor: "#2c2c2f",
    tertiaryColor: "#232326",
  },
});

function MermaidBlock({ code }: { code: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (!containerRef.current) return;
    const id = `mermaid-${Math.random().toString(36).slice(2, 10)}`;
    containerRef.current.innerHTML = "";

    mermaid.render(id, code).then(({ svg }) => {
      if (containerRef.current) {
        containerRef.current.innerHTML = svg;
        const svgEl = containerRef.current.querySelector("svg");
        if (svgEl) {
          svgEl.style.maxWidth = "100%";
          svgEl.style.height = "auto";
        }
      }
    }).catch(() => {
      if (containerRef.current) {
        containerRef.current.innerHTML = `<pre class="text-[11px] text-red-400">Failed to render mermaid diagram</pre>`;
      }
    });
  }, [code]);

  const zoomIn = () => setScale((s) => Math.min(s + 0.1, 4));
  const zoomOut = () => setScale((s) => Math.max(s - 0.1, 0.25));
  const resetZoom = () => setScale(1);

  return (
    <div className="my-4 rounded-md border border-border overflow-hidden">
      <div className="flex items-center justify-end gap-1 px-3 py-1.5 bg-bg-secondary border-b border-border">
        <span className="text-[10px] text-text-muted mr-2">{Math.round(scale * 100)}%</span>
        <button onClick={zoomOut} className="p-1 rounded hover:bg-bg-hover text-text-muted hover:text-text-secondary">
          <ZoomOut size={12} />
        </button>
        <button onClick={resetZoom} className="p-1 rounded hover:bg-bg-hover text-text-muted hover:text-text-secondary">
          <RotateCcw size={12} />
        </button>
        <button onClick={zoomIn} className="p-1 rounded hover:bg-bg-hover text-text-muted hover:text-text-secondary">
          <ZoomIn size={12} />
        </button>
      </div>
      <div className="overflow-auto bg-bg-tertiary p-4">
        <div
          ref={containerRef}
          className="flex justify-center origin-top-left transition-transform duration-150"
          style={{ transform: `scale(${scale})`, transformOrigin: "center top" }}
        />
      </div>
    </div>
  );
}

export function MarkdownPreview({ content }: MarkdownPreviewProps) {
  const renderCode = useCallback(({ className, children, ...props }: any) => {
    const match = /language-(\w+)/.exec(className || "");
    const lang = match?.[1];
    const code = String(children).replace(/\n$/, "");

    if (lang === "mermaid") {
      return <MermaidBlock code={code} />;
    }

    if (lang) {
      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    }

    return <code {...props}>{children}</code>;
  }, []);

  return (
    <div className="h-full overflow-auto">
      <div className="pl-6 pr-8 py-5 prose-explorer max-w-full">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{ code: renderCode }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}
