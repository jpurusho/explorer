# 0005. Snippet direct preview (not folder navigation)

**Date:** 2026-06-12  
**Status:** Accepted

## Context

When user clicks a snippet in the sidebar, we could either (a) navigate
the center panel to the snippet's folder and select the file, or (b)
open the snippet directly in preview without changing the center panel.

Option (a) treats snippets like regular files — navigate to their
folder, see them in the file list. Option (b) treats snippets as
first-class bookmarks — click one, it opens directly, your current
folder view stays intact.

## Decision

Snippet clicks open the file directly in the preview panel without
navigating the center panel. `handleSnippetClick()` calls
`setSelectedPath(filePath)` only — no `navigateTo()`.

**Why:** Snippets are meant to be quick-access references, not files
you browse to. The folder navigation would disrupt the user's current
context. If the user is browsing ~/Documents and clicks a snippet, they
don't want ~/Documents to disappear — they want to peek at the snippet
while staying in their current location.

Snippets still live as regular files on disk (at
`~/.config/explorer/snippets/`) and appear in Cmd+P search alongside
other files. If the user navigates manually to the snippets folder, they
see the full list. But the sidebar snippet list is a shortcut that
doesn't hijack navigation.

## Consequences

- **Pro:** Snippets feel like bookmarks/starred items, not folders
- **Pro:** Preserves user's current navigation context
- **Pro:** Scales well (20+ snippets won't clutter sidebar navigation)
- **Con:** If user wants to rename/delete a snippet, they must navigate
  to the folder manually or use a context menu (future feature)
- **Con:** Two ways to reach the same file: sidebar click (direct) vs
  folder navigation (explicit)

## Alternatives considered

**Folder navigation:** Navigate center panel to snippet's folder and
select the file. Rejected because it destroys user's current folder
view. Every snippet click would change the center panel to
`~/.config/explorer/snippets/local/`, forcing the user to navigate back
to wherever they were.

**Separate snippet viewer UI:** New panel/mode for snippets only, not
tied to file preview. Rejected as over-engineering — the preview panel
already handles markdown/code/etc. Why build a second viewer?
