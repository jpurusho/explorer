import { Extension } from "@codemirror/state";
import { StreamLanguage } from "@codemirror/language";
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
import { dockerFile } from "@codemirror/legacy-modes/mode/dockerfile";
import { shell } from "@codemirror/legacy-modes/mode/shell";
import { nginx } from "@codemirror/legacy-modes/mode/nginx";
import { toml } from "@codemirror/legacy-modes/mode/toml";
import { ruby } from "@codemirror/legacy-modes/mode/ruby";
import { swift } from "@codemirror/legacy-modes/mode/swift";
import { lua } from "@codemirror/legacy-modes/mode/lua";
import { cmake } from "@codemirror/legacy-modes/mode/cmake";

export function getLanguageExtension(fileType: string, fileName: string): Extension | null {
  const nameLower = fileName.toLowerCase();

  // Well-known extensionless files
  if (nameLower === "makefile" || nameLower === "gnumakefile" || nameLower === "bsdmakefile") return StreamLanguage.define(shell);
  if (nameLower === "dockerfile" || nameLower === "containerfile") return StreamLanguage.define(dockerFile);
  if (nameLower === "gemfile" || nameLower === "rakefile") return StreamLanguage.define(ruby);
  if (nameLower === "justfile" || nameLower === "procfile") return StreamLanguage.define(shell);
  if (nameLower === "cmakelists.txt") return StreamLanguage.define(cmake);
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
    case "sh":
    case "bash":
    case "zsh":
    case "fish":
      return StreamLanguage.define(shell);
    case "rb":
      return StreamLanguage.define(ruby);
    case "swift":
      return StreamLanguage.define(swift);
    case "lua":
      return StreamLanguage.define(lua);
    case "toml":
    case "ini":
    case "cfg":
    case "conf":
      return StreamLanguage.define(toml);
    case "nginx":
      return StreamLanguage.define(nginx);
    case "cmake":
      return StreamLanguage.define(cmake);
    default:
      if (fileType === "json") return json();
      if (fileType === "yaml") return yaml();
      if (fileType === "markdown") return markdown();
      if (fileType === "code") return javascript();
      return null;
  }
}
