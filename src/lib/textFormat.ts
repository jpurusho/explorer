import { jsonrepair } from "jsonrepair";
import jsYaml from "js-yaml";

export type ScratchFormat = "text" | "json" | "yaml" | "markdown";

// ---------------------------------------------------------------------------
// Plain-text transforms
// ---------------------------------------------------------------------------

/** Word-aware greedy wrap to `cols` columns. Preserves blank-line paragraph
 *  breaks; never splits a word (a word longer than cols sits on its own line). */
export function wrapToWidth(text: string, cols: number): string {
  if (cols < 1) return text;
  // Split into paragraphs on blank lines so structure is preserved.
  const paragraphs = text.replace(/\r\n/g, "\n").split(/\n[ \t]*\n/);
  return paragraphs
    .map((para) => {
      const words = para.split(/\s+/).filter(Boolean);
      if (words.length === 0) return "";
      const lines: string[] = [];
      let line = "";
      for (const word of words) {
        if (line === "") {
          line = word;
        } else if (line.length + 1 + word.length <= cols) {
          line += " " + word;
        } else {
          lines.push(line);
          line = word;
        }
      }
      if (line) lines.push(line);
      return lines.join("\n");
    })
    .join("\n\n");
}

/** Full-justify text to `cols`: word-wrap, then distribute extra spaces between
 *  words so each line is flush on both the left and right margins. The last line
 *  of each paragraph (and any single-word line) stays left-aligned, as is
 *  typographic convention. */
export function justifyToWidth(text: string, cols: number): string {
  if (cols < 1) return text;
  const paragraphs = text.replace(/\r\n/g, "\n").split(/\n[ \t]*\n/);
  return paragraphs
    .map((para) => {
      const words = para.split(/\s+/).filter(Boolean);
      if (words.length === 0) return "";

      // Greedy-wrap into lines of words first.
      const lines: string[][] = [];
      let line: string[] = [];
      let lineLen = 0;
      for (const word of words) {
        const add = (line.length === 0 ? 0 : 1) + word.length;
        if (lineLen + add <= cols || line.length === 0) {
          line.push(word);
          lineLen += add;
        } else {
          lines.push(line);
          line = [word];
          lineLen = word.length;
        }
      }
      if (line.length) lines.push(line);

      return lines
        .map((lineWords, idx) => {
          const isLast = idx === lines.length - 1;
          // Last line or single word: leave ragged.
          if (isLast || lineWords.length === 1) return lineWords.join(" ");

          const textLen = lineWords.reduce((s, w) => s + w.length, 0);
          const gaps = lineWords.length - 1;
          const totalSpaces = cols - textLen;
          if (totalSpaces <= gaps) return lineWords.join(" ");

          // Distribute spaces as evenly as possible, leftmost gaps get the extra.
          const base = Math.floor(totalSpaces / gaps);
          let extra = totalSpaces - base * gaps;
          let out = lineWords[0];
          for (let i = 1; i < lineWords.length; i++) {
            const pad = base + (extra > 0 ? 1 : 0);
            if (extra > 0) extra--;
            out += " ".repeat(pad) + lineWords[i];
          }
          return out;
        })
        .join("\n");
    })
    .join("\n\n");
}

/** Expand tab characters to spaces, honoring tab stops every `width` columns
 *  (so indentation lines up the way an editor renders it) rather than a blind
 *  1-tab → N-spaces swap. Column position resets at each newline. */
export function tabsToSpaces(text: string, width = 4): string {
  if (width < 1) width = 1;
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  return lines
    .map((line) => {
      let out = "";
      let col = 0;
      for (const ch of line) {
        if (ch === "\t") {
          const pad = width - (col % width);
          out += " ".repeat(pad);
          col += pad;
        } else {
          out += ch;
          col += 1;
        }
      }
      return out;
    })
    .join("\n");
}

/** Align tab- or multi-space-separated rows into even columns by padding each
 *  cell to the widest cell in its column (+`gutter` spaces between columns).
 *  This is what actually makes a ragged table line up — unlike tab-stop
 *  expansion, which only aligns when cell widths happen to share tab stops.
 *
 *  Only lines that look tabular (contain a tab, or a run of 2+ spaces between
 *  non-space text) are reflowed; other lines (prose, code, blank) pass through
 *  unchanged, so it's safe to run on mixed content. */
export function alignColumns(text: string, gutter = 2): string {
  const lines = text.replace(/\r\n/g, "\n").split("\n");

  const isTabular = (line: string) =>
    line.includes("\t") || /\S {2,}\S/.test(line);

  const splitCells = (line: string): string[] =>
    line.includes("\t")
      ? line.split("\t").map((c) => c.trim())
      : line.trim().split(/ {2,}/).map((c) => c.trim());

  // First pass: compute max width per column across the tabular rows only.
  const colWidths: number[] = [];
  for (const line of lines) {
    if (!isTabular(line)) continue;
    splitCells(line).forEach((cell, i) => {
      colWidths[i] = Math.max(colWidths[i] ?? 0, cell.length);
    });
  }

  // Second pass: re-emit. Tabular rows get padded; everything else untouched.
  return lines
    .map((line) => {
      if (!isTabular(line)) return line;
      const cells = splitCells(line);
      return cells
        .map((cell, i) => (i < cells.length - 1 ? cell.padEnd(colWidths[i] + gutter) : cell))
        .join("")
        .replace(/\s+$/, "");
    })
    .join("\n");
}

/** Collapse runs of spaces, convert tabs to spaces, trim trailing whitespace,
 *  and reduce 3+ blank lines to a single blank line. */
export function cleanWhitespace(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\t/g, "  ")
    .split("\n")
    .map((line) => line.replace(/[ ]{2,}/g, " ").replace(/[ \t]+$/g, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Prefix every line with `prefix` (default "> ") for pasting as a quoted reply. */
export function quotePrefix(text: string, prefix = "> "): string {
  return text.replace(/\r\n/g, "\n").split("\n").map((l) => prefix + l).join("\n");
}

/** Remove a leading quote prefix ("> ", ">", etc.) from every line. */
export function stripQuotePrefix(text: string): string {
  return text.replace(/\r\n/g, "\n").split("\n").map((l) => l.replace(/^\s*>\s?/, "")).join("\n");
}

/** Merge hard-wrapped lines back into single-line paragraphs. A blank line is a
 *  paragraph boundary; within a paragraph, line breaks become spaces. */
export function joinParagraphs(text: string): string {
  const paragraphs = text.replace(/\r\n/g, "\n").split(/\n[ \t]*\n/);
  return paragraphs
    .map((para) => para.split("\n").map((l) => l.trim()).filter(Boolean).join(" "))
    .filter(Boolean)
    .join("\n\n");
}

// ---------------------------------------------------------------------------
// JSON repair + pretty-print
// ---------------------------------------------------------------------------

export interface JsonFormatResult {
  output: string;
  /** Lines (0-based) in `output` that differ from the corresponding input line. */
  changedLines: Set<number>;
  /** Number of changed lines — a proxy for "corrections applied". */
  fixCount: number;
  /** Set when the input could not be repaired into valid JSON. */
  error: string | null;
}

/** Repair lenient/broken JSON (missing commas, trailing commas, single quotes,
 *  comments, unquoted keys) and pretty-print with 2-space indent. Changed lines
 *  are diffed so the UI can highlight what was corrected. */
export function formatJson(raw: string): JsonFormatResult {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { output: "", changedLines: new Set(), fixCount: 0, error: null };
  }
  try {
    const repaired = jsonrepair(trimmed);
    const output = JSON.stringify(JSON.parse(repaired), null, 2);
    const changedLines = diffChangedLines(raw, output);
    return { output, changedLines, fixCount: changedLines.size, error: null };
  } catch (e) {
    return {
      output: raw,
      changedLines: new Set(),
      fixCount: 0,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/** Naive line diff: marks output lines whose trimmed text isn't present at the
 *  same-ish position in the input. Good enough to surface "what changed" without
 *  a full LCS — pretty-printing reflows structure, so exact alignment isn't the
 *  goal, just drawing the eye to corrected regions. */
function diffChangedLines(input: string, output: string): Set<number> {
  const inputLines = input.replace(/\r\n/g, "\n").split("\n").map((l) => l.trim());
  const inputSet = new Set(inputLines.filter(Boolean));
  const changed = new Set<number>();
  output.split("\n").forEach((line, i) => {
    const t = line.trim();
    if (t && !inputSet.has(t)) changed.add(i);
  });
  return changed;
}

// ---------------------------------------------------------------------------
// YAML reformat
// ---------------------------------------------------------------------------

export interface YamlFormatResult {
  output: string;
  error: { line: number; column: number; message: string } | null;
}

/** Parse and re-dump YAML with clean 2-space indentation. On parse failure,
 *  return the original text plus the error location (no deep repair available). */
export function formatYaml(raw: string): YamlFormatResult {
  const trimmed = raw.trim();
  if (!trimmed) return { output: "", error: null };
  try {
    const data = jsYaml.load(trimmed);
    const output = jsYaml.dump(data, { indent: 2, lineWidth: -1, sortKeys: false });
    return { output, error: null };
  } catch (e) {
    const err = e as { mark?: { line: number; column: number }; reason?: string; message?: string };
    return {
      output: raw,
      error: {
        line: err.mark ? err.mark.line + 1 : 0,
        column: err.mark ? err.mark.column + 1 : 0,
        message: err.reason || err.message || "Invalid YAML",
      },
    };
  }
}

// ---------------------------------------------------------------------------
// Text -> Markdown (heuristic, best-effort)
// ---------------------------------------------------------------------------

/** Best-effort conversion of plain prose into reasonable Markdown:
 *  - first non-empty line becomes an H1 if it looks like a title (short, no
 *    sentence-ending punctuation)
 *  - bullet-ish lines (bullet, asterisk, dash) become "- " list items
 *  - "N." / "N)" become ordered list items
 *  - bare URLs are left as-is (GFM autolinks them)
 *  - paragraphs preserved */
export function textToMarkdown(raw: string): string {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let titleDone = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      out.push("");
      continue;
    }

    // Title heuristic: first content line, short, no ending punctuation, not a list.
    if (!titleDone) {
      titleDone = true;
      const looksLikeTitle =
        trimmed.length <= 60 &&
        !/[.:;,!?]$/.test(trimmed) &&
        !/^([-*•]|\d+[.)])\s/.test(trimmed);
      if (looksLikeTitle) {
        out.push(`# ${trimmed}`);
        continue;
      }
    }

    // Bullets: normalize •/* to -
    const bullet = trimmed.match(/^[•*-]\s+(.*)$/);
    if (bullet) {
      out.push(`- ${bullet[1]}`);
      continue;
    }

    // Ordered list: keep the number, normalize ")" to "."
    const ordered = trimmed.match(/^(\d+)[.)]\s+(.*)$/);
    if (ordered) {
      out.push(`${ordered[1]}. ${ordered[2]}`);
      continue;
    }

    out.push(trimmed);
  }

  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

// ---------------------------------------------------------------------------
// Format detection
// ---------------------------------------------------------------------------

/** Sniff the most likely format of pasted content. Conservative: falls back to
 *  "text" unless there are clear JSON/YAML/markdown signals. */
export function detectFormat(raw: string): ScratchFormat {
  const t = raw.trim();
  if (!t) return "text";

  // JSON: starts with { or [ and looks structured.
  if (/^[[{]/.test(t) && /[}\]]\s*$/.test(t)) return "json";

  // Markdown: headings, fenced code, or multiple bullet lines.
  if (/^#{1,6}\s/m.test(t) || /^```/m.test(t)) return "markdown";

  // YAML: several "key: value" lines or a document marker.
  const yamlKeyLines = (t.match(/^[ \t]*[\w.-]+:(\s|$)/gm) || []).length;
  if (t.startsWith("---") || yamlKeyLines >= 2) return "yaml";

  const bulletLines = (t.match(/^\s*[-*•]\s+/gm) || []).length;
  if (bulletLines >= 2) return "markdown";

  return "text";
}
