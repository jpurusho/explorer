# 0019 — Double-click opens archives and unknown types with system app

**Status:** accepted  
**Date:** 2026-06-17

## Context

Double-clicking a file did nothing unless it was a directory. Users expected Finder-like behavior: double-clicking a `.zip` should extract it, double-clicking a `.pages` file should open Pages, etc.

Explorer's philosophy is "everything renders in-app," but some file types (archives, proprietary formats) have no in-app representation.

## Decision

**Double-click routing:**
- **Directories** → navigate into them (unchanged)
- **Previewable types** (image, video, audio, markdown, JSON, YAML, HTML, text, code, PDF) → do nothing; preview panel shows them
- **Archives** (`.zip`, `.tgz`, `.tar.gz`, etc.) → `open_with_system_app` (macOS Finder extracts automatically)
- **Unknown types** → `open_with_system_app` (launches default app)

Added Rust command `open_with_system_app`:
- macOS: `open <path>`
- Linux: `xdg-open <path>`
- Windows: `start <path>`

## Consequences

- Archives extract in place on double-click (Finder behavior)
- Unknown file types open with their default app (e.g., `.pages` → Pages)
- Previewable types remain in-app (no external app launch for images/videos)
- Users can still right-click → "Open with..." for explicit app choice (future enhancement)
- No way to double-click to "do nothing" — single-click selects, double-click acts

## Why not extract archives in-app?

Extraction is a side-effect (writes new files to disk). Better to delegate to the OS, which has extraction UI (progress, errors, destination choice). Users already understand "double-click .zip extracts it."
