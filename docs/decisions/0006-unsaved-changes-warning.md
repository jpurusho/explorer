# 0006. Unsaved changes warning with native confirm()

**Date:** 2026-06-12  
**Status:** Accepted

## Context

User edits a file in the preview panel's editor, makes changes, then
either (a) clicks the eye icon to switch to rendered view, or (b) clicks
a different file. Without a warning, unsaved changes are silently lost.

We could: (a) show a native `window.confirm()` dialog, (b) build a
custom in-app modal, or (c) auto-save on every change.

## Decision

Use native `window.confirm()` dialog when user attempts to discard
unsaved changes. Editor tracks `modified` state via CodeMirror's
`updateListener`; when user clicks the eye icon or navigates to a new
file, check `hasUnsavedChanges` and show:

```
"You have unsaved changes. [Action] will discard them.

Continue without saving?"
```

**Why native confirm():**
- Blocks correctly (async dialogs race with navigation)
- Zero UI code (no modal component, no z-index wars)
- Familiar pattern (users recognize the OS-native dialog)
- Simple implementation (one-liner: `if (!window.confirm(...)) return`)

**Why not auto-save:** Cmd+S is intentional. Auto-save on every
keystroke would write half-formed thoughts to disk and invalidate the
"Modified" badge. The user should explicitly save when ready.

## Consequences

- **Pro:** Zero data loss from accidental view switches
- **Pro:** Native dialog is battle-tested, no custom modal bugs
- **Pro:** Works in vim mode, insert mode, any editor state
- **Con:** Native dialog doesn't match app theme (system-styled)
- **Con:** No "Save and continue" button (only OK/Cancel)

## Alternatives considered

**Custom modal:** Radix Dialog with "Save", "Discard", "Cancel" buttons.
Rejected because it's ~100 lines of code for a feature that happens
rarely. Native confirm() solves 95% of the problem in 1 line.

**Auto-save:** Write on every change (debounced). Rejected because it
removes the deliberate Cmd+S action. Users expect "Modified" badge →
Cmd+S → "Saved" confirmation, not silent writes.

**No warning:** Trust user to remember. Rejected because data loss is
unacceptable — even vim shows "[No write since last change]" warnings.
