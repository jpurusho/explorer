# Explorer — Native macOS Filesystem Explorer

## Project Overview
A Tauri v2 desktop app (Rust backend + React/TypeScript frontend) that replaces Finder with rich file previews, keyboard-driven navigation, and multi-theme support.

## Tech Stack
- **Backend:** Rust + Tauri v2 (src-tauri/)
- **Frontend:** React 19 + TypeScript + Vite (src/)
- **Styling:** Tailwind CSS v4 with CSS variable themes
- **State:** Zustand stores (src/stores/)
- **Icons:** lucide-react

## Commands
- `npm run tauri dev` — Start development (frontend + backend)
- `npm run tauri build` — Production build (outputs .app and .dmg)
- `npm run dev` — Frontend-only dev server (no Rust)
- `npm run build` — Frontend production build

## Project Structure
```
src/                 # React frontend
  components/        # UI components (layout/, files/, preview/)
  hooks/             # React hooks
  stores/            # Zustand state stores
  lib/               # Utilities (tauri API wrappers, theme defs)
  types/             # TypeScript type definitions
  styles/            # CSS (globals with theme variables)
src-tauri/           # Rust backend
  src/commands/      # Tauri command handlers
  src/models/        # Data structures
  src/utils/         # Error types, helpers
```

## Conventions
- All file operations go through Rust commands (never use frontend fs directly for perf-critical ops)
- Themes use CSS variables defined in src/styles/globals.css, switched via data-theme attribute
- State management: one Zustand store per domain (navigation, fileList, settings)
- File type classification lives in Rust (models/file_entry.rs classify_file_type)
- Settings stored at platform config dir via the `directories` crate
- All rendering is native to the app — never launch external apps or browsers

## Key Keyboard Shortcuts
- ↑/↓ Navigate files, Enter open/enter dir, Backspace go up
- Cmd+1 list view, Cmd+2 grid view, Cmd+Shift+. toggle hidden files
- Cmd+[ back, Cmd+] forward
