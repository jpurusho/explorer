import { Extension } from "@codemirror/state";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { rust } from "@codemirror/lang-rust";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { yaml } from "@codemirror/lang-yaml";
import { java } from "@codemirror/lang-java";
import { cpp } from "@codemirror/lang-cpp";
import { go } from "@codemirror/lang-go";
import { sql } from "@codemirror/lang-sql";

export function getLanguageExtension(fileType: string, fileName: string): Extension | null {
  const nameLower = fileName.toLowerCase();

  // Well-known extensionless files
  if (nameLower === "makefile" || nameLower === "gnumakefile" || nameLower === "bsdmakefile") return null;
  if (nameLower === "dockerfile" || nameLower === "containerfile") return null;
  if (nameLower === "gemfile" || nameLower === "rakefile") return python();
  if (nameLower === "justfile" || nameLower === "procfile") return null;
  if (nameLower.endsWith(".yml") || nameLower.endsWith(".yaml")) return yaml();

  const ext = fileName.split(".").pop()?.toLowerCase() || "";

  switch (ext) {
    case "js":
    case "mjs":
    case "jsx":
      return javascript({ jsx: true });
    case "ts":
    case "tsx":
      return javascript({ typescript: true, jsx: true });
    case "py":
      return python();
    case "rs":
      return rust();
    case "json":
      return json();
    case "md":
    case "mdx":
      return markdown();
    case "html":
    case "htm":
    case "svelte":
    case "vue":
      return html();
    case "css":
    case "scss":
    case "less":
      return css();
    case "yml":
    case "yaml":
      return yaml();
    case "java":
    case "kt":
      return java();
    case "c":
    case "cpp":
    case "h":
    case "hpp":
    case "cc":
      return cpp();
    case "go":
      return go();
    case "sql":
      return sql();
    default:
      if (fileType === "json") return json();
      if (fileType === "yaml") return yaml();
      if (fileType === "markdown") return markdown();
      if (fileType === "code") return javascript();
      return null;
  }
}
