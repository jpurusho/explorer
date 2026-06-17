# 0017 — HTML as distinct file type with iframe preview

**Status:** accepted  
**Date:** 2026-06-17

## Context

HTML files were classified as `"code"` (alongside JS, CSS, etc.), which defaulted them to the code editor view. Users expected HTML files to render in the preview panel like markdown or JSON, not show as raw source.

The `HtmlPreview` component existed but was unreachable because:
1. Backend classified `.html`/`.htm` as `"code"`
2. Frontend's `renderableTypes` array didn't include `"code"`
3. Routing logic used filename check (`isHtml()`) as a workaround, but the type mismatch broke preview selection logic

## Decision

Split HTML into its own file type:
- Backend: `.html` and `.htm` → `"html"` (not `"code"`)
- Frontend: added `"html"` to `FileType` union, `renderableTypes`, `editableTypes`, and `previewableTypes`
- Preview routing: check `fileType === "html"` (filename check remains as fallback)
- Icon: Globe (blue)

HTML files now default to rendered iframe view with a toggle to switch to source (code editor).

## Consequences

- HTML files preview like markdown/JSON — rendered by default, editable on toggle
- Consistent with user expectations ("show me the page, not the tags")
- Requires updating type definitions and icon maps when adding `"html"` type
- Breaking change if external code assumed all previewable text was `"code"`/`"text"`/`"markdown"`
