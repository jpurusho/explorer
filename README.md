# Explorer

A fast, keyboard-driven media file browser for macOS. Built with Tauri v2 (Rust + React/TypeScript) for native performance with a modern UI.

## Features

**Media-First Preview**
- Inline image previews with EXIF metadata
- Custom video player with scrubbing, volume, and fullscreen
- Audio playback with waveform-style controls
- PDF rendering, Markdown with Mermaid diagrams, syntax-highlighted code
- Document preview (pptx, docx, Keynote, Pages) via macOS Quick Look
- Archive contents browsing (zip, tar.gz) without extracting

**File Management**
- Drag-and-drop within the app and from Finder/Desktop
- Copy, cut, paste, duplicate, rename, trash with keyboard shortcuts
- Undo (Cmd+Z) for copy, move, and duplicate
- Double-click a name (or Enter) to rename; right-click empty space for Paste / New Folder
- Tag files with color-coded labels, filter by tag
- Tag-aware search (`tag:name` or `#name`)
- Free-form file filter (e.g. `*.png`, `.pdf`)
- Multi-select with Cmd+click, Shift+click, Cmd+A

**Scratch Pad** (Cmd+E)
- A built-in text formatter for cleaning up content before pasting elsewhere
- Auto-detects JSON, YAML, Markdown, or plain text (with manual override)
- **JSON:** repairs broken JSON (missing commas/brackets, single quotes, trailing commas) and pretty-prints, highlighting the corrected lines
- **YAML:** reformats with clean indentation and pinpoints the first error
- **Markdown:** heuristic text→Markdown with rendered/source toggle
- **Plain text:** wrap-to-width, full-justify, align columns into a grid, tabs→spaces (2/4/8), whitespace cleanup, unwrap, quote prefix
- Copy formatted output, save to a file, or paste straight from the clipboard
- Draft and settings persist across restarts

**Keyboard-Driven**
- Arrow keys to navigate, Enter to open, Backspace to go up
- Cmd+[ / ] for back/forward, Cmd+R to refresh
- Cmd+1 list view, Cmd+2 grid view
- Cmd+P global search, Cmd+K command palette
- Cmd+Shift+N new folder, Cmd+Shift+. toggle hidden files
- Home/End, Page Up/Down, Space to select
- Full context menu keyboard navigation (Arrow keys + Enter)

**Search & Organization**
- Trigram-indexed SQLite search across indexed paths
- Persistent file filter bar (pattern matching)
- Color-coded tags with drag-to-tag
- Global search overlay (Cmd+P)

**Polish**
- 7 themes (System, Light, Dark, Material, GitHub, Monokai, Atom)
- Adjustable gallery grid size
- Resizable sidebar and preview panel
- Auto-update with in-app download
- File watcher for live directory refresh

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Tauri v2 |
| Backend | Rust |
| Frontend | React 19, TypeScript, Vite |
| Styling | Tailwind CSS v4 |
| State | Zustand |
| Search | SQLite with trigram indexing |
| Icons | lucide-react |

## Development

```bash
npm install
npm run tauri dev
```

## Build

```bash
npm run tauri build
```

Produces a signed `.app` bundle for macOS (Apple Silicon).

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `↑` `↓` | Navigate files |
| `←` `→` | Navigate in/out of folders |
| `Enter` | Open directory / preview file |
| `Backspace` | Go to parent directory |
| `Space` | Select without navigating |
| `Cmd+A` | Select all |
| `Cmd+C` / `Cmd+X` / `Cmd+V` | Copy / Cut / Paste |
| `Cmd+D` | Duplicate |
| `Cmd+Z` | Undo last operation |
| `Enter` / double-click name | Rename |
| `Cmd+Shift+Backspace` | Move to Trash |
| `Cmd+Shift+N` | New Folder |
| `Cmd+[` / `Cmd+]` | Back / Forward |
| `Cmd+↑` / `Cmd+↓` | Parent / Open |
| `Cmd+R` | Refresh |
| `Cmd+P` | Global Search |
| `Cmd+K` | Command Palette |
| `Cmd+E` | Scratch Pad |
| `Cmd+1` / `Cmd+2` | List / Grid view |
| `Cmd+Shift+.` | Toggle hidden files |
| `Cmd+,` | Settings |
| `Cmd+/` | Keyboard shortcuts |
| `Home` / `End` | Jump to first/last |
| `Page Up` / `Page Down` | Scroll by page |

## License

Private
