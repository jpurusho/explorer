# 0007. Sync-status dot indicator (pushed vs local)

**Date:** 2026-06-13
**Status:** Accepted

## Context
User wanted a visual cue showing whether each file/snippet is on GitHub
or only local. Files live in git repos; snippets sync via GitHub Gists.

## Decision
- Green dot = pushed to remote; blue dot = local only.
- For files: a separate Tauri command `get_sync_statuses` compares the
  working-tree blob against the upstream tracking branch's tree via git2.
  Called asynchronously after `list_directory` to avoid blocking the
  initial listing.
- For snippets: presence of `gist_id` determines the dot color. This is
  a **second** dot alongside the existing tier dot (not a replacement).
- The snippet legend is pinned below the scrollable list in the sidebar
  layout, not inside SnippetsSection itself.

## Consequences
- The sync query adds a lightweight async call per directory navigation.
- Directories without a git remote show all-blue (no upstream = local).
- Snippets now display two dots; the tier dot retains its existing
  semantics (gray/amber/green for local/secret/public).

## Alternatives considered
- Embedding sync status in `FileEntry` struct: rejected because it would
  slow the primary listing and couple unrelated concerns.
- Repurposing the tier dot for sync status: rejected — user preferred
  keeping tier info visible and adding a separate sync dot.
