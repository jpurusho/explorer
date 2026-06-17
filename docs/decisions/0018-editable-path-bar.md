# 0018 — Editable path bar for arbitrary navigation

**Status:** accepted  
**Date:** 2026-06-17

## Context

Users could only navigate by clicking breadcrumb segments or drilling down into subdirectories. No way to jump to an arbitrary absolute path like `/tmp` or `/Applications` without manually navigating the tree. This made Explorer feel restricted compared to Finder's Cmd+Shift+G "Go to Folder" feature.

## Decision

Make the breadcrumb path editable:
- **Click the breadcrumb** → switches to text input showing current path
- **Cmd+L** → activates path input from anywhere (standard browser shortcut)
- **Type any path** → `/tmp`, `/Applications`, `~/Downloads`, `/tmp/test.html`
- **Tilde expansion** → `~` expands to home directory
- **File detection** → if path is a file, navigates to parent and selects the file
- **Enter** → commits, **Escape** → cancels

## Consequences

- Users can navigate anywhere on the filesystem (not just home subtree)
- Cmd+L matches browser/IDE conventions (address bar focus)
- File paths work: `/tmp/test.html` navigates to `/tmp` with file selected
- Tilde expansion adds shell-like ergonomics
- Path input doesn't validate until Enter (no autocomplete yet)
- Clicking breadcrumb now switches to input mode (slight behavior change, but discoverable via tooltip)

## Why not a separate "Go to Folder" dialog?

In-place editing is faster (no modal) and visually shows what you're changing. The breadcrumb is already the path display, so making it editable feels natural.
