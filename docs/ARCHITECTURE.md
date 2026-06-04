# Explorer — Architecture

## Overview

Explorer is a native macOS filesystem explorer built with Tauri v2. It replaces Finder with rich file previews, keyboard-driven navigation, and multi-theme support.

The app is fully self-contained — all dependencies are bundled into the `.app` package. No external runtime (Node, Python, etc.) is required.

```
┌─────────────────────────────────────────────────────────────┐
│                      Explorer.app                            │
│                                                             │
│  ┌──────────────────────┐    ┌───────────────────────────┐  │
│  │   Frontend (WebView) │    │    Backend (Rust)         │  │
│  │                      │◄──►│                           │  │
│  │  React 19 + TS       │IPC │  Tauri v2 Commands        │  │
│  │  Tailwind CSS v4     │    │  File I/O (tokio)         │  │
│  │  Zustand State       │    │  Image Processing         │  │
│  │  CodeMirror 6        │    │  EXIF Reading             │  │
│  │  Mermaid Diagrams    │    │  Thumbnail Caching        │  │
│  └──────────────────────┘    │  Trash (native macOS)     │  │
│                              └───────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## System Architecture

### Communication Flow

```
User Interaction
       │
       ▼
┌─────────────┐     invoke()      ┌──────────────────┐
│  React UI   │──────────────────►│  Tauri Commands  │
│  Components │◄──────────────────│  (Rust)          │
└─────────────┘     Result/Error  └──────────────────┘
       │                                   │
       │                                   ▼
       │                          ┌──────────────────┐
       │                          │  macOS Filesystem │
       │                          │  /Applications    │
       │                          │  /Users/...       │
       ▼                          └──────────────────┘
┌─────────────┐
│  Zustand    │
│  Stores     │
│  (State)    │
└─────────────┘
```

### Data Flow for File Navigation

```
1. User clicks folder
       │
2. navigateTo(path) ──► navigationStore updates currentPath
       │
3. useDirectory hook reacts to path change
       │
4. invoke("list_directory", {path}) ──► Rust reads fs::read_dir
       │
5. Returns Vec<FileEntry> ──► fileListStore.setEntries()
       │
6. computeVisible() applies sort + hidden filter
       │
7. React re-renders FileList with new visibleEntries
```

### Preview Flow

```
1. User selects file ──► fileListStore.selectIndex(i)
       │
2. selectedPath changes ──► PreviewPanel useEffect fires
       │
3. 80ms debounce (skip rapid selections)
       │
4. Check LRU cache (10 entries)
       │
       ├── Cache HIT  ──► Instant render
       │
       └── Cache MISS ──► invoke("read_file_content")
                               │
                          Content returned
                               │
                          Store in cache + render
                               │
                          Prefetch prev/next files
```

## Project Structure

```
explorer/
├── src/                          # React Frontend
│   ├── App.tsx                   # Root — routes main vs detached window
│   ├── main.tsx                  # Entry point
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppShell.tsx      # 3-panel layout orchestration
│   │   │   ├── Sidebar.tsx       # Directory tree + favorites
│   │   │   ├── ContentPanel.tsx  # Switches list/grid view
│   │   │   ├── Toolbar.tsx       # Breadcrumb + view controls
│   │   │   ├── StatusBar.tsx     # Selection info + counts
│   │   │   └── ResizeHandle.tsx  # Panel divider drag handle
│   │   ├── files/
│   │   │   ├── FileList.tsx      # Virtualized list + resizable columns
│   │   │   ├── FileListItem.tsx  # Single row with dynamic columns
│   │   │   ├── FileGrid.tsx      # Card grid layout
│   │   │   ├── FileCard.tsx      # Card with thumbnail/snippet
│   │   │   ├── FileIcon.tsx      # Type-based icon
│   │   │   └── ContextMenu.tsx   # Right-click menu
│   │   ├── preview/
│   │   │   ├── PreviewPanel.tsx  # Preview orchestrator
│   │   │   ├── DetachedPreview.tsx # Standalone preview window
│   │   │   ├── ImagePreview.tsx  # Image + EXIF metadata
│   │   │   ├── VideoPreview.tsx  # Video player (media://)
│   │   │   ├── AudioPreview.tsx  # Audio player
│   │   │   ├── MarkdownPreview.tsx # Rendered MD + Mermaid zoom
│   │   │   ├── JsonPreview.tsx   # Collapsible JSON tree
│   │   │   ├── YamlPreview.tsx   # Collapsible YAML tree
│   │   │   ├── TextPreview.tsx   # Plain text display
│   │   │   └── PdfPreview.tsx    # PDF rendering
│   │   ├── editor/
│   │   │   ├── Editor.tsx        # CodeMirror 6 + Vim mode
│   │   │   ├── languages.ts     # Language extension mapping
│   │   │   └── theme.ts         # Editor theme (CSS vars)
│   │   ├── settings/
│   │   │   └── SettingsPanel.tsx # App settings UI
│   │   └── search/
│   │       └── SearchBar.tsx     # Cmd+F file search
│   ├── stores/
│   │   ├── fileListStore.ts      # File entries, selection, columns
│   │   ├── navigationStore.ts    # Path history, navigation
│   │   └── settingsStore.ts      # Persisted preferences
│   ├── hooks/
│   │   ├── useDirectory.ts       # Directory loading + refresh
│   │   ├── useKeyboard.ts        # Global keyboard shortcuts
│   │   ├── useTheme.ts           # Theme detection + switching
│   │   └── useSettings.ts        # Settings persistence
│   ├── lib/
│   │   ├── detachPreview.ts      # Multi-window preview creation
│   │   ├── previewCache.ts       # LRU content cache
│   │   └── themes.ts             # Theme definitions
│   ├── types/
│   │   └── index.ts              # Shared TypeScript types
│   └── styles/
│       └── globals.css           # Themes + base styles
│
├── src-tauri/                    # Rust Backend
│   ├── Cargo.toml                # Dependencies
│   ├── tauri.conf.json           # Tauri configuration
│   ├── capabilities/
│   │   └── default.json          # Permission grants
│   └── src/
│       ├── main.rs               # Entry point
│       ├── lib.rs                # Plugin + command registration
│       ├── commands/
│       │   ├── mod.rs
│       │   ├── filesystem.rs     # list_directory, read_file, EXIF, thumbnails
│       │   ├── file_ops.rs       # trash, move, copy, rename
│       │   └── settings.rs       # load/save settings
│       ├── models/
│       │   ├── mod.rs
│       │   ├── file_entry.rs     # FileEntry, ExifData, classify_file_type
│       │   └── settings.rs       # AppSettings struct
│       └── utils/
│           ├── mod.rs
│           └── errors.rs         # AppError type
│
├── .github/workflows/
│   ├── build.yml                 # CI: type check + build on push/PR
│   └── release.yml               # CD: build + publish DMG on tag
│
└── docs/
    └── ARCHITECTURE.md           # This file
```

## Key Design Decisions

### Custom Media Protocol

Video/audio files use a custom `media://` protocol registered in Tauri. This enables:
- HTTP Range request support for seeking
- Streaming large files without loading into memory
- No base64 overhead for media playback

### Preview Caching

An LRU cache (10 entries) stores recently-read file contents. Combined with 80ms debounce and adjacent-file prefetching, this makes file browsing feel instant even for large files.

### Multi-Window Architecture

The same React app serves both the main window and detached preview windows. URL parameters (`?detached=true&path=...`) determine which UI to render. Each window gets full theme support and access to all Tauri commands.

### Thumbnail Pipeline

```
Image selected in grid view
       │
       ▼
invoke("generate_thumbnail", {path, size: 300})
       │
       ▼
Rust: Check SHA256-keyed cache in ~/Library/Caches/
       │
       ├── Cache HIT  ──► Return JPEG bytes as base64
       │
       └── Cache MISS ──► image crate resizes + encodes JPEG
                               │
                          Save to cache dir + return base64
```

### File Type Classification

Rust classifies files on `list_directory`:
1. Well-known extensionless names (Makefile, Dockerfile, .gitignore, etc.)
2. Extension-based mapping (rs→code, md→markdown, mp4→video, etc.)
3. Fallback: extensionless files → "text", unknown extensions → "unknown"

### State Management

Three Zustand stores with clear domains:
- **fileListStore** — entries, selection (multi-select Set), sort, columns, view mode
- **navigationStore** — path history, back/forward, refresh trigger
- **settingsStore** — theme, preferences, persistence via Rust

## Packaging

The app is built as a standard macOS `.app` bundle via `tauri build`:
- Frontend is compiled to static HTML/CSS/JS and embedded in the binary
- Rust backend compiles to a native binary
- All crate dependencies are statically linked
- No external runtime required
- Outputs: `.app` (direct) and `.dmg` (installer)
- Targets: Apple Silicon (aarch64) and Intel (x86_64)

## CI/CD Pipeline

```
Push to master ──► build.yml
                       │
                  TypeScript check
                  Rust cargo check
                  Build for both architectures
                  Upload artifacts

Push tag v* ──► release.yml
                       │
                  Build for both architectures
                  Create GitHub Release
                  Attach .dmg files
```
