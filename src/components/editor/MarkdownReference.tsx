import { X } from "lucide-react";

interface MarkdownReferenceProps {
  onClose: () => void;
}

export function MarkdownReference({ onClose }: MarkdownReferenceProps) {
  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none p-8">
        <div className="bg-bg-secondary border border-border rounded-lg shadow-2xl w-full max-w-3xl h-full max-h-[80vh] flex flex-col pointer-events-auto">
          <div className="p-4 border-b border-border flex items-center justify-between shrink-0">
            <h3 className="font-semibold text-text" style={{ fontSize: "var(--font-base)" }}>Markdown Quick Reference</h3>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-bg-hover text-text-muted transition-colors"
            >
              <X size={16} />
            </button>
          </div>
          <div className="flex-1 overflow-auto p-6" style={{ fontFamily: "var(--font-family)" }}>
            <div className="prose prose-invert max-w-none space-y-6 text-text-secondary" style={{ fontSize: "var(--font-sm)" }}>

              <section>
                <h4 className="text-text font-semibold mb-2" style={{ fontSize: "var(--font-base)" }}>Headers</h4>
                <pre className="bg-bg-tertiary p-3 rounded border border-border font-mono overflow-x-auto" style={{ fontSize: "var(--font-xs)" }}>
{`# H1
## H2
### H3
#### H4
##### H5
###### H6`}
                </pre>
              </section>

              <section>
                <h4 className="text-text font-semibold mb-2" style={{ fontSize: "var(--font-base)" }}>Emphasis</h4>
                <pre className="bg-bg-tertiary p-3 rounded border border-border font-mono overflow-x-auto" style={{ fontSize: "var(--font-xs)" }}>
{`*italic* or _italic_
**bold** or __bold__
***bold italic***
~~strikethrough~~`}
                </pre>
              </section>

              <section>
                <h4 className="text-text font-semibold mb-2" style={{ fontSize: "var(--font-base)" }}>Lists</h4>
                <pre className="bg-bg-tertiary p-3 rounded border border-border font-mono overflow-x-auto" style={{ fontSize: "var(--font-xs)" }}>
{`- Unordered item
- Another item
  - Nested item
  - Another nested

1. Ordered item
2. Another item
   1. Nested numbered
   2. Another nested

- [ ] Task item
- [x] Completed task`}
                </pre>
              </section>

              <section>
                <h4 className="text-text font-semibold mb-2" style={{ fontSize: "var(--font-base)" }}>Links & Images</h4>
                <pre className="bg-bg-tertiary p-3 rounded border border-border font-mono overflow-x-auto" style={{ fontSize: "var(--font-xs)" }}>
{`[Link text](https://example.com)
[Link with title](https://example.com "Title")
![Alt text](image.png)
![Image with title](image.png "Title")`}
                </pre>
              </section>

              <section>
                <h4 className="text-text font-semibold mb-2" style={{ fontSize: "var(--font-base)" }}>Code</h4>
                <pre className="bg-bg-tertiary p-3 rounded border border-border font-mono overflow-x-auto" style={{ fontSize: "var(--font-xs)" }}>
{`Inline \`code\` with backticks

\`\`\`javascript
function hello() {
  console.log("Hello!");
}
\`\`\`

\`\`\`python
def hello():
    print("Hello!")
\`\`\``}
                </pre>
              </section>

              <section>
                <h4 className="text-text font-semibold mb-2" style={{ fontSize: "var(--font-base)" }}>Blockquotes</h4>
                <pre className="bg-bg-tertiary p-3 rounded border border-border font-mono overflow-x-auto" style={{ fontSize: "var(--font-xs)" }}>
{`> Single line quote

> Multi-line quote
> continues here
>
> New paragraph in quote`}
                </pre>
              </section>

              <section>
                <h4 className="text-text font-semibold mb-2" style={{ fontSize: "var(--font-base)" }}>Tables</h4>
                <pre className="bg-bg-tertiary p-3 rounded border border-border font-mono overflow-x-auto" style={{ fontSize: "var(--font-xs)" }}>
{`| Left | Center | Right |
|:-----|:------:|------:|
| A    | B      | C     |
| 1    | 2      | 3     |`}
                </pre>
              </section>

              <section>
                <h4 className="text-text font-semibold mb-2" style={{ fontSize: "var(--font-base)" }}>Horizontal Rules</h4>
                <pre className="bg-bg-tertiary p-3 rounded border border-border font-mono overflow-x-auto" style={{ fontSize: "var(--font-xs)" }}>
{`---
***
___`}
                </pre>
              </section>

              <section>
                <h4 className="text-text font-semibold mb-2" style={{ fontSize: "var(--font-base)" }}>Mermaid Diagrams</h4>
                <pre className="bg-bg-tertiary p-3 rounded border border-border font-mono overflow-x-auto" style={{ fontSize: "var(--font-xs)" }}>
{`\`\`\`mermaid
graph TD
  A[Start] --> B{Decision}
  B -->|Yes| C[OK]
  B -->|No| D[Cancel]
\`\`\`

\`\`\`mermaid
sequenceDiagram
  Alice->>Bob: Hello
  Bob->>Alice: Hi!
\`\`\``}
                </pre>
              </section>

            </div>
          </div>
        </div>
      </div>
    </>
  );
}
