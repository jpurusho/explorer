# 0004. Snippets feature with three storage tiers

**Date:** 2026-06-12
**Status:** Accepted

## Context

Explorer users want a productivity tool for personal code snippets:
fast capture, edit-in-place, search across everything, sync some
snippets across machines, share some publicly, keep some local-only.

GitHub Gists are the obvious sync target — most snippet tools use
them — but they have a privacy footgun: "secret" gists are not
actually private. Anyone with the URL can read them, no auth
required. Putting credentials in a "secret" gist is a leak waiting
to happen.

The feature must therefore be explicit about *where bytes live* and
make the unsafe option opt-in, not the default-by-omission.

## Decision

Snippets ship as a **three-tier feature**, with the tier picked per
snippet at creation time:

| Tier | Default | Where bytes live | Privacy guarantee |
|---|---|---|---|
| **Local** | — | `~/.explorer/snippets/local/<title>.<ext>` | Stays on this Mac. No network. |
| **Secret gist** | ✅ (cursor starts here) | `~/.explorer/snippets/gists/<gist-id>/` (cloned), origin = `https://gist.github.com/<user>/<id>.git` | URL-only access on GitHub. **Not real privacy** — tier dialog says so explicitly. |
| **Public gist** | — | Same disk layout as secret | Listed on gist.github.com/discover, indexed by search engines. |

**Default is Secret gist** because the productivity payoff of this
feature is the sync; users who already wanted local-only files have
a text editor. The unsafe-for-credentials warning is stated in the
create dialog.

**Auth:** GitHub Personal Access Token with `gist` scope. Stored in
macOS Keychain via the `keyring` crate. Never written to
`~/.explorer/config.json` or any file we control. A new "Gists" tab
in Settings lets the user paste/clear the PAT. No OAuth device flow
in v1 (revisit in a follow-up ADR if PAT-paste feels clunky).

**Sync model:** pull-on-demand. Selecting a gist in the sidebar runs
`git pull` (or initial `git clone` if missing). No background sync,
no auto-pull on a timer. Predictable network behavior.

**Editor flow:** the existing `Editor.tsx` saves to disk via
`write_file`, which already triggers preview-cache invalidation
(0001 invariant). For gist tiers, save additionally enqueues a
commit + push (debounced, 2s after last save). The push runs in
Rust via `git2` using the PAT for HTTPS auth. Failures surface as a
toast and the snippet keeps a "modified" badge until push succeeds.

**Search:** the existing trigram index in `src-tauri/src/commands/
search.rs` already indexes any directory we point it at. We simply
add `~/.explorer/snippets/` to its index roots. Same code path,
same UI, no new search component.

**Sidebar UI:** new "Snippets" section, toggleable in settings like
Favorites/Folders/Tags. Each row shows a colored dot:
- green (`bg-emerald-500`) = public gist
- amber (`bg-amber-500`) = secret gist
- gray (`bg-zinc-500`) = local

Clicking a snippet navigates to its containing folder — the existing
FileList renders it. The Editor opens it on Enter / double-click —
existing behavior. No new preview component.

**Tier transitions** (right-click → "Move to…"):

- **Local → Secret/Public:** create gist via API, push the file,
  move bytes into the gists/ subdir, update local metadata. One
  network round-trip + confirmation dialog naming what becomes
  accessible.
- **Secret → Public / Public → Secret:** GitHub does **not** allow
  changing visibility of an existing gist via the API. Implemented
  as: create new gist at target visibility with same files, delete
  old gist, update metadata. The user sees "this changes the gist's
  URL" in the confirmation dialog.
- **Gist → Local:** confirm, delete the gist on GitHub, move bytes
  into local/ subdir, update metadata. The URL stops working.

**Metadata:** one new SQLite table `snippets` in the existing
`tags.db` file. Columns: `id` (uuid), `title`, `tier`
(`local`/`secret`/`public`), `gist_id` (nullable), `created_at`,
`updated_at`, `language` (sniffed from extension). A separate
table because tags and snippets are different concepts and bundling
them would force a join on every snippet load.

**Conflict handling (external edits via web UI):** a gist edited on
gist.github.com between our pulls will produce a non-fast-forward
on push. v1 surfaces this as a toast: "Gist diverged on GitHub.
Open in browser to reconcile." We don't auto-merge or prompt for
strategy. Defer real conflict resolution to a future ADR.

## Consequences

**Enables:**
- Daily-driver snippet capture/edit with zero friction.
- Search across local and synced snippets in the same UI.
- Explicit visibility — every snippet has a colored dot, no
  ambiguity about where bytes live.
- Sync across machines via Gists (with the user's existing GitHub
  account) without us building a server.

**Constraints:**
- PAT auth means the user has to paste a token once. Less slick
  than OAuth, but ~100× simpler to implement and debug. Tradeoff
  noted; OAuth is a follow-up if needed.
- Pull-on-demand means a snippet edited in another Explorer won't
  appear until the user clicks it. Acceptable for v1.
- No encrypted-local tier in v1. Credentials should not go in any
  tier of this feature. The Settings → Gists tab will say so.

**Forbids:**
- Sensitive data of any kind. The create dialog warns explicitly:
  "Don't use snippets for passwords, API keys, or credentials."
- Auto-sync background polling. We don't burn the user's GitHub
  rate limit on idle.

## Alternatives considered

- **Two tiers (Local + one Gist tier with a public/secret toggle):**
  rejected. Hides the consequence — users would forget which
  default they picked and fall into the secret-≠-private trap.
- **Public gists only (no secret):** rejected. Loses the
  cross-machine sync use case for personal notes.
- **Encrypted-local tier in v1:** rejected. It's a different
  feature (passphrase UX, key derivation, recovery story).
  Deserves its own ADR if/when needed.
- **OAuth device flow for auth:** rejected for v1. PAT is enough
  for a power-user productivity tool; the user can paste once and
  forget.
- **Background sync (auto-pull every N minutes):** rejected.
  Surprise network traffic, rate-limit consumption, conflict
  surface area. Pull-on-demand is predictable.
- **Store snippet metadata in a JSON file:** rejected. Already
  have SQLite (tags), and snippets need indexed lookups by tier
  and id. New table is the right shape.

## Implementation plan (sketch — not part of the decision)

1. Rust: `commands/snippets.rs` — list/create/save/delete/move-tier,
   plus a tiny thin layer over `git2` for clone/pull/commit/push.
2. Rust: `commands/auth.rs` — `set_github_pat`, `get_github_pat`,
   `clear_github_pat` via the `keyring` crate.
3. Rust: extend search index roots to include
   `~/.explorer/snippets/`.
4. Frontend: `stores/snippetsStore.ts` mirroring `tagStore.ts`.
5. Frontend: `Sidebar.tsx` adds a "Snippets" section, color dots,
   create/delete/move-tier menu items.
6. Frontend: `SettingsPanel.tsx` adds a "Gists" tab with the PAT
   field.
7. Frontend: tier-create dialog with the three radios.
8. Editor save → debounced push for gist tiers (2s).

Each step ships as its own commit with the ADR referenced. v1.8.0
when the feature lands end-to-end.
