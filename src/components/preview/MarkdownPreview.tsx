import { useEffect, useRef, useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import mermaid from "mermaid";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

interface MarkdownPreviewProps {
  content: string;
  basePath?: string;
  onNavigate?: (path: string) => void;
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
        containerRef.current.innerHTML = `<pre class="text-[var(--font-sm)] text-red-400">Failed to render mermaid diagram</pre>`;
      }
    });
  }, [code]);

  const zoomIn = () => setScale((s) => Math.min(s + 0.1, 4));
  const zoomOut = () => setScale((s) => Math.max(s - 0.1, 0.25));
  const resetZoom = () => setScale(1);

  return (
    <div className="my-4 rounded-md border border-border overflow-hidden">
      <div className="flex items-center justify-end gap-1 px-3 py-1.5 bg-bg-secondary border-b border-border">
        <span className="text-[var(--font-xs)] text-text-muted mr-2">{Math.round(scale * 100)}%</span>
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

export function MarkdownPreview({ content, basePath, onNavigate }: MarkdownPreviewProps) {
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

  const renderLink = useCallback(({ href, node, children, ...props }: any) => {
    const linkHref = href || node?.properties?.href || "";

    const handleClick = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!linkHref) return;

      if (linkHref.startsWith("http://") || linkHref.startsWith("https://")) {
        return;
      }

      if (onNavigate && basePath) {
        const dir = basePath.substring(0, basePath.lastIndexOf("/"));
        let resolved = linkHref;
        if (linkHref.startsWith("./")) {
          resolved = `${dir}/${linkHref.slice(2)}`;
        } else if (linkHref.startsWith("../")) {
          let currentDir = dir;
          let remaining = linkHref;
          while (remaining.startsWith("../")) {
            currentDir = currentDir.substring(0, currentDir.lastIndexOf("/"));
            remaining = remaining.slice(3);
          }
          resolved = `${currentDir}/${remaining}`;
        } else if (!linkHref.startsWith("/")) {
          resolved = `${dir}/${linkHref}`;
        }
        resolved = resolved.split("#")[0];
        if (resolved) {
          onNavigate(resolved);
        }
      }
    };

    const isExternal = linkHref.startsWith("http://") || linkHref.startsWith("https://");
    const isInternal = !isExternal && !!linkHref;

    return (
      <a
        href={linkHref}
        onClick={handleClick}
        className={isExternal ? "cursor-not-allowed opacity-60" : isInternal ? "cursor-pointer underline decoration-accent/40 hover:decoration-accent" : ""}
        title={isExternal ? linkHref : isInternal ? `Open: ${linkHref}` : undefined}
        {...props}
      >
        {children}
        {isExternal && <span className="text-[var(--font-xs)] text-text-muted ml-1">(external)</span>}
      </a>
    );
  }, [basePath, onNavigate]);

  return (
    <div className="h-full overflow-auto">
      <div className="py-5 prose-explorer max-w-full" style={{ paddingLeft: "calc(var(--panel-px) + 8px)", paddingRight: "var(--panel-px)" }}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{ code: renderCode, a: renderLink }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}
