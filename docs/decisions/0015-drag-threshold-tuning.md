# 15. Long-Press Drag Threshold Tuning

**Status:** Accepted  
**Date:** 2026-06-16

## Context

Explorer supports two drag modes:
- **HTML5 drag** (fast click-drag): in-app folder-to-folder moves
- **Native macOS drag** (long-press): drag-out to Finder/other apps via `NSDraggingSession`

Original threshold was 350ms. In practice, users accidentally triggered native drag when attempting fast in-app moves, causing unreliable folder-to-folder operations (sometimes HTML5 fired, sometimes native drag took over and dropped back into the source window, which doesn't fire JavaScript drop events).

## Decision

Increase long-press threshold to **800ms** (~1 second hold). This makes external drag a deliberate action: user must hold still for a full second before the native drag activates.

## Consequences

**Positive:**
- In-app folder moves are reliable — users don't accidentally hold long enough to trigger native drag
- External drag intent is now explicit and unambiguous
- No modifier key required (earlier attempts with Ctrl/Cmd/Opt collided with macOS shortcuts)

**Negative:**
- Drag-out to Finder/Desktop requires longer hold (800ms vs 350ms)
- If 800ms feels too long in practice, can be tuned down to 600ms

**Alternatives Considered:**
- Modifier keys (Cmd/Opt/Ctrl): All collided with macOS window/app management shortcuts
- Visual indicator during hold: Deferred — threshold tuning came first
- Separate button/menu for external drag: Breaks direct-manipulation UX

**Related:**
- ADR 0001 explains why long-press was chosen over modifiers
- `useLongPressDragOut.ts` implements the timer (`LONG_PRESS_MS = 800`)
