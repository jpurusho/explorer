# 0020 — Search detects and resolves absolute paths

**Status:** accepted  
**Date:** 2026-06-17

## Context

Global search (Cmd+P) uses a trigram-indexed SQLite database, which only covers paths that have been visited or are under indexed directories (typically home tree). Searching for `/tmp/test.html` returned no results even if the file existed, because `/tmp` wasn't indexed.

Users expected search to work like Cmd+L — if you type an absolute path, just go there.

## Decision

Before falling back to trigram search, detect if the query looks like an absolute path:
- Starts with `/` or `~`
- Expand `~` to home directory
- Try `get_file_metadata` on the expanded path
- If it exists → return it as the only search result
- If it doesn't exist → fall through to normal trigram search

This makes search a superset of path navigation: fuzzy filename search *and* exact path lookup.

## Consequences

- Typing `/tmp/test.html` in search works even if `/tmp` isn't indexed
- Tilde expansion (`~/Downloads/file.pdf`) works in search
- No UI distinction between "exact path match" and "search result" — both appear in the results list
- If path doesn't exist, search still runs (shows fuzzy matches for the string `/tmp/test.html`, which is likely empty but harmless)
- Adds a metadata lookup before every search that starts with `/` or `~` (fast — single syscall)

## Why?

Search and path bar solve the same problem ("get me to this file"), so they should accept the same inputs. Typing `/tmp/test.html` shouldn't require remembering "use Cmd+L for paths, Cmd+P for names."
