import { useEffect, useRef, useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkSupersub from "remark-supersub";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import mermaid from "mermaid";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import hljs from "highlight.js";
import "katex/dist/katex.min.css";
import "highlight.js/styles/github-dark.min.css";

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

const COLOR_RE = /^#(?:[0-9a-fA-F]{3}){1,2}$|^#(?:[0-9a-fA-F]{4}){1,2}$|^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$|^rgba\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*[\d.]+\s*\)$|^hsl\(\s*\d{1,3}\s*,\s*\d{1,3}%\s*,\s*\d{1,3}%\s*\)$/;

export function MarkdownPreview({ content, basePath, onNavigate }: MarkdownPreviewProps) {
  const renderCode = useCallback(({ className, children, ...props }: any) => {
    const match = /language-(\w+)/.exec(className || "");
    const lang = match?.[1];
    const code = String(children).replace(/\n$/, "");
    const isBlock = !!lang || code.includes("\n");

    if (lang === "mermaid") {
      return <MermaidBlock code={code} />;
    }

    if (isBlock) {
      let highlighted: string;
      if (lang && hljs.getLanguage(lang)) {
        highlighted = hljs.highlight(code, { language: lang }).value;
      } else {
        highlighted = hljs.highlightAuto(code).value;
      }
      return (
        <code
          className={`hljs ${className || ""}`}
          dangerouslySetInnerHTML={{ __html: highlighted }}
          {...props}
        />
      );
    }

    // Inline code: check if it's a color value and show a swatch
    if (COLOR_RE.test(code.trim())) {
      return (
        <code {...props}>
          <span
            className="inline-block w-3 h-3 rounded-sm mr-1 align-middle border border-border/50"
            style={{ backgroundColor: code.trim() }}
          />
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

  const renderBlockquote = useCallback(({ children, ...props }: any) => {
    // Detect GitHub-style admonitions: > [!NOTE], > [!TIP], > [!WARNING], > [!CAUTION], > [!IMPORTANT]
    const childArray = Array.isArray(children) ? children : [children];
    const firstParagraph = childArray.find(
      (c: any) => c?.type === "p" || (c?.props?.children && typeof c !== "string")
    );

    let textContent = "";
    if (firstParagraph?.props?.children) {
      const pChildren = Array.isArray(firstParagraph.props.children)
        ? firstParagraph.props.children
        : [firstParagraph.props.children];
      textContent = pChildren
        .filter((c: any) => typeof c === "string")
        .join("");
    }

    const admonitionMatch = textContent.match(/^\[!(NOTE|TIP|WARNING|CAUTION|IMPORTANT)\]\s*/i);
    if (admonitionMatch) {
      const type = admonitionMatch[1].toUpperCase();
      const styles: Record<string, { border: string; bg: string; icon: string; title: string }> = {
        NOTE: { border: "border-blue-500/40", bg: "bg-blue-500/5", icon: "ℹ️", title: "text-blue-400" },
        TIP: { border: "border-green-500/40", bg: "bg-green-500/5", icon: "💡", title: "text-green-400" },
        WARNING: { border: "border-amber-500/40", bg: "bg-amber-500/5", icon: "⚠️", title: "text-amber-400" },
        CAUTION: { border: "border-red-500/40", bg: "bg-red-500/5", icon: "🚨", title: "text-red-400" },
        IMPORTANT: { border: "border-purple-500/40", bg: "bg-purple-500/5", icon: "❗", title: "text-purple-400" },
      };
      const s = styles[type] || styles.NOTE;

      // Remove the [!TYPE] marker from the rendered content
      const modifiedChildren = childArray.map((child: any, i: number) => {
        if (child === firstParagraph && child?.props?.children) {
          const pChildren = Array.isArray(child.props.children)
            ? [...child.props.children]
            : [child.props.children];
          // Strip the admonition marker from the first text node
          for (let j = 0; j < pChildren.length; j++) {
            if (typeof pChildren[j] === "string" && pChildren[j].match(/^\[!(NOTE|TIP|WARNING|CAUTION|IMPORTANT)\]\s*/i)) {
              pChildren[j] = pChildren[j].replace(/^\[!(NOTE|TIP|WARNING|CAUTION|IMPORTANT)\]\s*/i, "");
              if (!pChildren[j]) pChildren.splice(j, 1);
              break;
            }
          }
          return <p key={i}>{pChildren}</p>;
        }
        return child;
      });

      return (
        <div className={`my-3 rounded-md border-l-4 ${s.border} ${s.bg} px-4 py-3`}>
          <div className={`flex items-center gap-2 font-medium text-[var(--font-sm)] ${s.title} mb-1`}>
            <span>{s.icon}</span>
            <span>{type.charAt(0) + type.slice(1).toLowerCase()}</span>
          </div>
          <div className="text-text-secondary">{modifiedChildren}</div>
        </div>
      );
    }

    return <blockquote {...props}>{children}</blockquote>;
  }, []);

  return (
    <div className="h-full overflow-auto">
      <div className="py-5 prose-explorer max-w-full" style={{ paddingLeft: "calc(var(--panel-px) + 8px)", paddingRight: "var(--panel-px)" }}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath, remarkSupersub]}
          rehypePlugins={[rehypeKatex, rehypeRaw]}
          components={{ code: renderCode, a: renderLink, blockquote: renderBlockquote }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}
