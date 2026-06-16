# 0011 — Skills require subdirectory structure

**Status:** accepted  
**Date:** 2026-06-14

## Context

Project-local skills were failing to load when created as flat files (`.claude/skills/<name>.md`). Claude Code harness requires a specific directory structure but this wasn't documented. The `claude-init` script was creating flat files, causing skills to silently fail to register.

## Decision

Skills must follow this structure: `.claude/skills/<skill-name>/SKILL.md`

- **NOT:** `.claude/skills/exclear.md` (flat file)
- **YES:** `.claude/skills/exclear/SKILL.md` (subdirectory + SKILL.md)

Updated `claude-init` (line 379) to create the subdirectory structure. The existing `write_if_missing` function already handles parent directory creation via `mkdir -p`.

Also clarified the template naming in `claude-init`:
- Changed prompt from "exclear" (instance name) to "checkpoint" (template type)
- Template auto-derives skill name from git branch prefix (e.g., "master" → "exclear", "ots-main" → "otsclear")

## Consequences

**Positive:**
- Skills created by `claude-init` now load correctly
- CLAUDE.md documents the requirement for future reference
- Template naming is less confusing (generic "checkpoint" vs instance "exclear")

**Negative:**
- Existing flat-file skills must be manually migrated to subdirectory structure

## Alternatives considered

Could have modified the harness to accept flat files, but the subdirectory structure is the established convention across all built-in skills in `~/.claude/skills/`.
