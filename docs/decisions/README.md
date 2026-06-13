# Architecture Decision Records (ADRs)

Short notes that record **why** something is the way it is — anything
that a future contributor (or future-me reopening the project months
later) would otherwise have to re-derive from conversation context.

## When to write one

Write an ADR if:

- A non-obvious choice was made between alternatives ("we picked X
  over Y because…").
- A constraint exists that isn't visible in the code ("Cmd+Opt+drag
  collides with macOS Hide Others").
- An earlier approach was tried and abandoned ("dragDropEnabled: true
  broke in-app drag handlers").
- Something looks wrong but is intentional ("Cargo.lock is committed
  on purpose").

Don't write one for: obvious choices, taste preferences with no
trade-off, anything fully explained by the code itself.

## Format

One file per decision, named `NNNN-kebab-case-title.md` where `NNNN`
is the next sequential number. Use this template:

```markdown
# NNNN. Title in plain English

**Date:** YYYY-MM-DD
**Status:** Accepted | Superseded by [#NNNN](./NNNN-other.md)

## Context
What was the situation? What forces were at play?

## Decision
What did we choose? Be specific.

## Consequences
What does this enable, prevent, or make harder? Any follow-ups parked
as future work?

## Alternatives considered
Brief notes on options ruled out and why.
```

## Index

- [0001 — Long-press drag-out, no modifier key](./0001-long-press-drag-out.md)
- [0002 — Reject Tauri dragDropEnabled for drag-in](./0002-reject-tauri-dragdropenabled.md)
- [0003 — Commit Cargo.lock for deterministic CI](./0003-commit-cargo-lock.md)
- [0004 — Snippets feature with three storage tiers](./0004-snippets-storage-tiers.md)
- [0007 — Sync-status dot indicator (pushed vs local)](./0007-sync-status-dot-indicator.md)
- [0008 — Skip Build & Test on tagged commits](./0008-ci-skip-build-on-tagged-commits.md)

## Linking

When you ship a change driven by an ADR, reference it in the commit
message: `Implements docs/decisions/0007-foo.md`. When `CLAUDE.md` or
another ADR alludes to a decision, link directly to its file.
