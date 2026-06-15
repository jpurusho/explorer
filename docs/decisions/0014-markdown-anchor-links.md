# 0014 — Markdown anchor links jump within the preview pane

Date: 2026-06-15
Status: Accepted

## Context

User clicked a Table-of-Contents link (`[Overview](#overview)`) in a
markdown file previewed inside Explorer. Nothing happened. There was
also no obvious way back to the top.

## Findings

`src/components/preview/MarkdownPreview.tsx` already routed `<a>`
clicks through a custom handler, but:

1. The handler stripped fragments unconditionally — `resolved.split("#")[0]` —
   then guarded with `if (resolved)`. For a pure-anchor href like
   `#overview`, `resolved` becomes `""` and the click silently no-ops.
2. Even if the click had been handled, ReactMarkdown emits headings
   without `id` attributes, so there was nothing for an anchor to land on.
3. Even if both of the above were fixed, `window.scrollTo` would target
   the page, not the preview's `overflow-auto` container.

## Decision

Three coordinated changes in `MarkdownPreview.tsx`:

- **Heading id injection.** Custom `h1`–`h6` renderers slugify the
  visible text using GitHub's algorithm (lowercase, drop punctuation
  except `-`/`_`, spaces → `-`) and assign it as the element's `id`.
  Existing TOCs authored for GitHub work without modification.
- **Anchor handler.** The link click handler intercepts hrefs starting
  with `#` and dispatches them to `scrollToAnchor` instead of falling
  through to the file-resolution path.
- **Scope-aware scrolling.** A `useRef` on the scroll container is the
  query root, and `scrollIntoView({ behavior: "smooth", block: "start" })`
  lands the heading at the top of the preview pane — not the window.

`CSS.escape` guards against ids that could break the selector (numeric
prefixes, dots in slugs from headings like `## v1.0`).

## Consequences

- Anchor links work inside Explorer's preview, the detached preview
  window, and the scratch-pad markdown render — all three already
  funnel through `MarkdownPreview`.
- Authors don't need to add per-document workarounds (back-to-top
  links, manual `<a name>` tags). Standard GitHub-style TOCs work.
- "Back to top" is still useful as an editorial convenience and
  remains valid markdown — it just isn't required for navigation.
