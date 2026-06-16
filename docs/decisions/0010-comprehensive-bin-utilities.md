# 0010 — Comprehensive ~/bin Claude Code Utilities

**Status:** accepted  
**Date:** 2026-06-13

## Context

Need consistent Claude Code workflow across all projects (personal, enterprise repos like cisco-aispg/cisco-sbg). Prior approach had Explorer-specific scripts that weren't portable. Enterprise repos can't accept Claude-specific files in main codebase.

## Decision

Create comprehensive ~/bin utilities with three modes:
1. **Standard mode** — Personal projects, commits everything (CLAUDE.md, docs/, .claude/)
2. **Enterprise mode** (`--enterprise`) — All Claude files in .claude/ (gitignored), zero footprint
3. **Companion mode** (`--companion`) — Separate context repo, symlinked from main repo

Core utilities:
- `claude-init` — Scaffolds projects with CLAUDE.md, ADRs, skills, settings
- `claude-token-cost.py` — Generic token analyzer (auto-detects project)
- `claude-settings-template.json` — Safe permission defaults
- `claude-gitignore-template` — Standard ignore rules
- Skills: exclear (checkpoint), shipit (pre-commit), bootstrap (existing projects)

Token cost script enhanced with `--summary` flag showing:
- Current session (since last /clear): turns, tokens, cost
- Cumulative (all sessions): total turns, tokens, cost
- Top models used

## Consequences

**Positive:**
- Portable: backup ~/bin, works on any machine
- Enterprise-safe: no pollution of shared codebases
- Consistent workflow across all projects
- Cost awareness: clear visibility before /clear
- Team collaboration: companion mode for shared context
- Generic: works for any project, auto-detects paths

**Negative:**
- Two repos to manage (companion mode)
- Enterprise mode context is machine-local (doesn't travel on git clone)
- Symlinks can break if repos move (companion mode)

**Neutral:**
- Comprehensive documentation: COMPLETE-GUIDE.md (47KB), ENTERPRISE-GUIDE.md, QUICK-REF.md
- Skills auto-named from git branch (master → /exclear, feature-xyz → /feclear)
- Settings template has safe defaults (deny destructive operations)
