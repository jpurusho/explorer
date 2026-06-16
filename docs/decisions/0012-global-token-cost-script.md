# 0012 — Use global token cost script, not per-project copies

**Date:** 2026-06-15  
**Status:** Accepted

## Context

Explorer originally had `scripts/token_cost.py` copied into the repo. The `claude-init` scaffolding script was copying this Explorer-specific script into every new project (standard and enterprise mode), creating maintenance overhead and polluting repositories with personal tooling.

The script reads from `~/.claude/projects/<sanitized-path>/` which is user-specific, not project-specific. It works identically from any directory.

## Decision

Remove `scripts/token_cost.py` from Explorer and all projects. Use `~/bin/claude-token-cost.py` as the single source of truth for all projects.

Changes:
- Removed `scripts/token_cost.py` from Explorer repo
- Updated CLAUDE.md to reference `~/bin/claude-token-cost.py --summary`
- Fixed `claude-init` to skip creating per-project copies (all modes)
- Updated checkpoint skill templates to reference `~/bin/claude-token-cost.py`
- Added `scripts/token_cost.py` to `.gitignore` template as a safety net

## Consequences

**Benefits:**
- Single source of truth — bug fixes in one place benefit all projects
- No per-project maintenance (update once in ~/bin/, not N repos)
- Cleaner repos — personal tooling doesn't pollute project directories
- Consistent behavior across all projects

**Trade-offs:**
- Requires `~/bin/claude-token-cost.py` to exist on the user's machine
- Cross-machine portability requires manual setup of ~/bin/ tools
- Team members without Claude Code see references to a script they don't have (enterprise mode mitigates this by keeping references in local-only files)

## Alternatives Considered

**Keep per-project copies:** Rejected due to maintenance overhead and repository bloat. Script is fundamentally user-scoped, not project-scoped.

**Package as npm/pip module:** Overkill for a single-user tool. Would add dependency management overhead for no gain.
