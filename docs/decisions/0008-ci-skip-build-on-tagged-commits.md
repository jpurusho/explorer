# 0008. Skip Build & Test on tagged commits via runtime API check

**Date:** 2026-06-13
**Status:** Accepted

## Context
Pushing a commit to master AND tagging it fires two independent GitHub
Actions events (branch-push and tag-push). The Release workflow handles
the tag; Build & Test should not also run for the same commit. An
earlier `tags-ignore: ["v*"]` in build.yml was ineffective because it
only suppresses the tag-push event from triggering build.yml — the
branch-push event still fires independently.

## Decision
Added a lightweight `skip-if-tagged` job (ubuntu-latest, ~5s) that
queries the GitHub API for matching `v*` tags on the commit SHA. If a
tag exists, `check` and `build` jobs are skipped via `if:` conditions.

## Consequences
- Tagged releases no longer produce duplicate builds.
- Build & Test still appears in Actions on tagged pushes but exits
  immediately after the API check (no macOS runner minutes consumed).
- Removing `tags-ignore` from the trigger simplifies the `on:` block.

## Alternatives considered
- Keeping `tags-ignore`: doesn't solve the problem (branch-push still
  fires).
- Conditional on `github.ref_type`: only distinguishes the event that
  triggered the workflow, not whether the commit also has a tag from a
  concurrent push.
