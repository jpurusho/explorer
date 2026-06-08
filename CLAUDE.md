# Explorer — Media-First File Viewer & Manager

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
- All rendering is native to the app — never launch external apps or browsers
- Browser default context menu is disabled globally (app provides its own)

## Key Keyboard Shortcuts
- ↑/↓ Navigate files, Enter open/enter dir, Backspace go up
- Cmd+1 list view, Cmd+2 grid view, Cmd+Shift+. toggle hidden files
- Cmd+[ back, Cmd+] forward
- Cmd+P global search, Cmd+K command palette
- Cmd+A select all, Cmd+click toggle select, Shift+click range select
- Cmd+C copy, Cmd+X cut, Cmd+V paste, Cmd+Shift+Backspace trash
- Cmd+, settings, Escape close panel/clear selection
