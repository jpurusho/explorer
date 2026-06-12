# 0003. Commit `Cargo.lock` for deterministic CI builds

**Date:** 2026-06-12
**Status:** Accepted

## Context

Earlier `.gitignore` listed `src-tauri/Cargo.lock`. Local builds
always passed because the developer's local lockfile pinned working
dependency versions. CI had no lockfile, so every release run
executed an implicit `cargo update` and resolved fresh transitive
versions.

v1.7.5 release CI failed: `cargo update` resolved
`time-macros 0.2.28`, which has a conflicting `From` trait impl with
the version of `tauri-utils` we depend on (E0119). The local build
worked. The release didn't ship.

Cargo's official guidance: **library** crates omit `Cargo.lock`;
**application** crates commit it. Explorer is an application. The
`.gitignore` line was a mistake inherited from the initial Tauri
template.

## Decision

`src-tauri/Cargo.lock` is committed to the repo. The line was
removed from `.gitignore` in commit `72002a4`.

## Consequences

- CI now builds deterministically against the same dep tree the
  developer tested on locally.
- Dependency upgrades are explicit: `cargo update` (or
  `cargo update -p crate`) on the dev machine, commit the resulting
  Lock changes, push.
- Slightly noisier diffs when bumping deps — acceptable trade-off
  for not shipping broken releases.

## Alternatives considered

- **Pin specific transitive versions in `Cargo.toml`** — fragile;
  doesn't actually pin transitive-of-transitive deps.
- **Run `cargo generate-lockfile` in CI before build** — same
  problem; CI still resolves fresh versions.
- **Accept the flakiness** — already shipped a broken release once;
  not acceptable for an auto-updating app.
