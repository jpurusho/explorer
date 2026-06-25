# 0022 — Settings UI for hidden file patterns and reindex

**Status:** accepted  
**Date:** 2026-06-24

## Context

ADR 0021 added support for configuring hidden file patterns via `index_hidden_patterns` in settings.json, but required manual JSON editing. Users needed an easier way to:
1. Add/remove hidden directory patterns (`.idea`, `.github`, etc.)
2. Trigger a full reindex after changing paths or patterns
3. Understand when a reindex is needed

The existing "Full Reindex" button in Settings → Search Index was buried and lacked explanation about when to use it.

## Decision

Added two UI sections to the **Settings → Search Index** tab:

### 1. Hidden File Patterns editor
- Lists current patterns (defaults: `.config`, `.claude`, `.vscode`)
- Add/remove custom patterns via input field + button
- Validation: patterns must start with `.`
- Toast notification reminds user to run "Full Reindex" after changes
- Shows "(default)" label when no custom patterns are configured

### 2. Enhanced Actions section
- **Full Reindex** button now has visual emphasis (accent-colored border)
- Description explains when to use it: "after changing indexed paths or hidden patterns"
- Better feedback: "Full reindex started — files will appear in search as indexing progresses"
- Button disables for 10 seconds while reindex runs in background

## Implementation

**Frontend**:
- `HiddenPatternsEditor` component in `SettingsPanel.tsx`
- Added `index_hidden_patterns?: string[]` to `AppSettings` type
- Uses existing `updateSettings()` store method (settings persist to disk automatically)

**No backend changes needed** — Rust code already reads `index_hidden_patterns` from settings.json (ADR 0021).

## Consequences

### Positive
- Users can configure hidden patterns without editing JSON
- Clear call-to-action: "Run Full Reindex to apply"
- Visual feedback confirms patterns were added/removed
- Reindex button is more discoverable and explains its purpose

### Caveats
- Still requires manual reindex button click (not automatic)
- No validation that pattern exists on disk (user can add `.nonexistent` and it's accepted)
- No per-pattern enable/disable toggles (delete to remove)

### Future enhancements
- Auto-trigger reindex when patterns change (with confirmation dialog)
- Suggest common patterns (`.idea`, `.github`, `.vscode`) via dropdown
- Show which patterns are actively excluding files (stats per pattern)
- Glob pattern support (e.g., `.*rc` to match `.bashrc`, `.zshrc`, etc.)
