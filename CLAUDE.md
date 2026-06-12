# Explorer — Media-First File Viewer & Manager

## Working with this project (read first)

**Model selection.** Default to **Sonnet** for this project. Switch to
**Opus** only for: root-causing nonobvious bugs that span multiple files,
designing new subsystems (e.g. native drag, asset-protocol wiring,
search index changes), or any "why isn't this working" investigation
that requires holding several files in mind at once. Mechanical work —
UI polish, version bumps, file edits with a clear spec, commit
messages, small bug fixes with a known cause — should run on Sonnet.
Past project totals were ~95% Opus and the dollar cost reflected that;
most of those turns would have been just as good on Sonnet.

**Where decisions live.** Anything that would otherwise be
"established in conversation and forgotten by the next session" goes
in `docs/decisions/` as a short ADR (Architecture Decision Record).
Read `docs/decisions/README.md` for the format. If you find yourself
about to give an explanation that future-me will need to re-derive
("we picked X over Y because Z"), pause and write it as an ADR
instead — then reference the ADR in the commit message. The repo is
the durable spec; conversation context evaporates.

**Token discipline.** This project pays for cache reads on every turn,
so long conversations compound. After shipping a tag and starting an
unrelated task, prefer a fresh session over continuing. Don't re-read
files I just edited (the harness tracks state). For exploratory
questions ("how does X work?"), ask in a new session — they're
low-context and don't need the accumulated chat history.

**Cost tally.** `python3 scripts/token_cost.py` walks all transcripts
under `~/.claude/projects/-Users-jpurshot-experimental-explorer/` and
prints token totals + an API-equivalent dollar estimate.

## Project Overview
A Tauri v2 desktop app (Rust backend + React/TypeScript frontend) for viewing, previewing, and managing media files and documents. Rich inline previews, adjustable gallery grid, fast trigram-indexed search, keyboard-driven workflow, and multi-theme support.

## Tech Stack
- **Backend:** Rust + Tauri v2 (src-tauri/)
- **Frontend:** React 19 + TypeScript + Vite (src/)
- **Styling:** Tailwind CSS v4 with CSS variable themes
- **UI Primitives:** Radix UI (context menus, dropdowns, tooltips)
- **State:** Zustand stores (src/stores/)
- **Icons:** lucide-react
- **Search:** SQLite with trigram indexing (src-tauri/src/commands/search.rs)
- **Distribution:** GitHub Actions → DMG (Apple Silicon + Intel) with auto-update

## Commands
- `npm run tauri dev` — Start development (frontend + backend)
- `npm run tauri build` — Production build (outputs .app and .dmg)
- `npm run dev` — Frontend-only dev server (no Rust)
- `npm run build` — Frontend production build

## Project Structure
```
src/                 # React frontend
  components/        # UI components (layout/, files/, preview/, settings/)
  hooks/             # React hooks (useKeyboard, useDirectory, useTheme)
  stores/            # Zustand state stores
  lib/               # Utilities (thumbnailCache, formatters, themes)
  types/             # TypeScript type definitions
  styles/            # CSS (globals with theme variables)
src-tauri/           # Rust backend
  src/commands/      # Tauri command handlers (filesystem, search, file_ops, tags, watcher)
  src/models/        # Data structures (file_entry, settings)
  src/utils/         # Error types, helpers
.github/workflows/   # CI/CD (release.yml — builds on tag push)
```

## Architecture
- **Views:** Gallery (grid, adjustable card size) and List (sortable columns with virtual scroll)
- **Preview Panel:** Right-side panel showing rich previews (images, video player, PDF, markdown, code)
- **Settings:** Inline panel replacing preview area (not a modal)
- **Search:** Persistent search trigger in toolbar + Cmd+P global search overlay
- **Thumbnails:** Rust generates + disk-caches thumbnails (SHA256 keyed by path+mtime+size). Frontend LRU cache (500 entries) avoids re-invoking for already-loaded thumbnails.
- **Auto-Update:** Version badge in status bar glows amber when update available. One-click download+install.
- **Context Menu:** Styled flyout with submenus for tags/sections, keyboard navigable

## Conventions
- All file operations go through Rust commands (never use frontend fs directly for perf-critical ops)
- Themes use CSS variables defined in src/styles/globals.css, switched via data-theme attribute
- State management: one Zustand store per domain (navigation, fileList, settings)
- File type classification lives in Rust (models/file_entry.rs classify_file_type)
- Settings stored at platform config dir via the `directories` crate
- All rendering is native to the app — never launch external apps or
  browsers. Every preview, drag, and interaction stays inside Explorer.
- Browser default context menu is disabled globally (app provides its own)
- **Drag triggers:** in-app drag (folder→folder copy/move) is a normal
  HTML5 click-and-drag. Drag-out to Finder/other apps is a **350ms
  long-press, then drag** — escalates to a native `NSDraggingSession`
  in `src-tauri/src/commands/drag.rs`. **Do not propose modifier-key
  alternatives** (Cmd/Opt/Ctrl) — earlier Cmd+Opt collided with macOS
  Hide Others; long-press is the deliberate replacement. See
  `docs/decisions/0001-long-press-drag-out.md`.
- **Releasing a tag:** ALWAYS bump all three manifests together —
  `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`
  — and run `cargo check` so `Cargo.lock` updates. The auto-updater
  parses `tauri.conf.json`'s version; mismatched manifests break it.
- **Cargo.lock is committed** (it's an application crate, not a
  library). v1.7.5 shipped broken because CI's `cargo update`
  resolved a conflicting `time-macros` version. Don't re-add it to
  `.gitignore`.
- **Flex rows must not clip:** any flex row mixing a flexible text child with fixed
  trailing elements (shortcut hints, icons, badges) must give the text child
  `flex-1 min-w-0 truncate` and the fixed children `shrink-0`. Without `min-w-0`
  a flex item won't shrink below its content width, pushing trailing elements past
  the container edge. This is the root cause of recurring menu/settings clipping.
- Floating UI (context menus, popovers) must clamp to the viewport after mount
  (measure rect, shift left/up by overflow, keep an 8px margin)

## Key Keyboard Shortcuts
- ↑/↓ Navigate files, Enter open/enter dir, Backspace go up
- Cmd+1 list view, Cmd+2 grid view, Cmd+Shift+. toggle hidden files
- Cmd+[ back, Cmd+] forward
- Cmd+P global search, Cmd+K command palette
- Cmd+A select all, Cmd+click toggle select, Shift+click range select
- Cmd+C copy, Cmd+X cut, Cmd+V paste, Cmd+Shift+Backspace trash
- Cmd+, settings, Escape close panel/clear selection
