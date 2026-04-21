# Admin tools overview

This directory is the CMS. Each top-level path under the repo root is
a single-file HTML app (except `admin/lib/` and `admin/*/data/`).
Every tool talks to the GitHub REST API with a Bearer PAT held in
`localStorage`, and dispatches Actions workflows for operations that
exceed the ~35 MB single-blob limit.

## Tools

| Path | Role |
|---|---|
| `/admin/` | Dashboard / tool launcher |
| `/new/` | Post Generator — create a post, update DB, regenerate archives, dispatch RSS update |
| `/edit/` | Page Editor — WYSIWYG (native contenteditable) edit for any page/post; writes back to `database/posts/YYYY.json` |
| `/update/` | Mass Updater — one-off visual find/replace across the repo. **Prefer the more structured tools below for most changes.** |
| `/remove/` | Post Remover — delete a post + clean homepage/archives/feeds/DB |
| `/admin/regenerate/` | Fragments + post regeneration (dispatches `regenerate-fragments.yml` and `regenerate-posts.yml`) |
| `/admin/dedup/` | Media-dedup review tool — reads scan manifest, emits a decisions JSON, dispatches `dedup-execute.yml` |
| `/admin/db-maintenance/` | Recompute counts in manifest, taxonomies, search index from the canonical posts/pages JSON |
| `/rss-creator/` | Regenerate `feed/index.xml` and friends |
| `/podcast-rss/` | Regenerate `feed/podcast/feed.xml` (Apple Podcasts / Spotify compatible) |
| `/menus/` | Edit nav/sidebar/footer fragments |
| `/links/` | Site-wide broken-link scan (IndexedDB cache) |
| `/search/` | Search tester (also user-facing search UI) |

## Shared plumbing

`admin/lib/` holds ES modules used by all of the above. A single
classic-script tool can pull everything it needs via the
`<script type="module" src="/admin/lib/bootstrap.js">` tag — the
bootstrap attaches every helper to `window.LIB`.

The lib is site-agnostic: all site-specific values live in
`admin/lib/config.js` (repo owner/name, hostname, CDN host, etc.),
so the same files can drop into subdomain repos with a one-file
config change. See `docs/SUBDOMAIN_ROLLOUT.md` for the porting
playbook.

## Workflows (what each one does)

All workflows dispatched from admin tools live in
`.github/workflows/`:

- **`regenerate-fragments.yml`** — wraps `scripts/regenerate-fragments.js`.
  Walks all HTML pages with `LIC:ZONE:*` markers and replaces the
  bounded content with the shared `templates/fragments/*.html`.
  Use this after editing `masthead`, `sidebar`, `colophon`, or `footer`.

- **`regenerate-posts.yml`** — wraps `scripts/regenerate-posts.js`.
  Re-renders post HTML files from `templates/post.html` + the per-year
  `database/posts/YYYY.json` (the JSON `content` field is the source
  of truth; HTML is derived). Use this after editing the post template
  or editing posts' JSON content.
  Inputs: `scope` (year like `2026` or `all`), `url` (optional single
  post URL, overrides scope), `dry_run`.

- **`update-rss.yml` / `remove-from-rss.yml`** — maintain the large
  `feed/full.xml` (too big to commit via the REST API blob endpoint).

- **`database-maintenance.yml`** — wraps `scripts/recompute-database-stats.js`.
  Rebuilds `database/manifest.json`, `database/taxonomies.json`, and
  `database/search.json` from the canonical post/page shards. Run
  after any bulk JSON mutation.

- **`dedup-execute.yml`** — reads `admin/dedup/data/decisions.json`
  and deletes the listed paths. Safety-gated (dry-run first, 20k max
  files, uploads-dir allowlist, path-traversal check).

## When to use which tool

The rule of thumb: **JSON-first, template-first, then fragments, then
raw find/replace as the last resort.**

| You want to… | Use |
|---|---|
| Add or edit a single post's body | `/edit/` (writes JSON, regenerates the one post HTML) |
| Change the masthead / sidebar / colophon / footer across every page | `/admin/regenerate/` Visual editor → Apply |
| Change the post template (entry-meta, breadcrumbs, etc.) | Edit `templates/post.html` locally → `/admin/regenerate/` Regenerate Posts card → Apply |
| Re-render all posts after editing JSON (e.g., tag rename in `taxonomies.json`) | `/admin/regenerate/` Regenerate Posts card, scope `all` |
| Add a new post | `/new/` |
| Remove a post (and unlink it from archives/feeds) | `/remove/` |
| One-off string replacement in specific files (typo fix across N posts where no template change applies) | `/update/` |
| Inspect for broken links | `/links/` |
| Review media duplicates / orphans | `/admin/dedup/` |
| Recompute taxonomy / search counts | `/admin/db-maintenance/` |

## Scope picker (admin/regenerate/)

The Regenerate Posts card in `/admin/regenerate/` lets you target:
- A single **year** (e.g. `2026`) — fastest; regenerates ~10–1000 posts
- `all` — regenerates every post (3,651+ files, ~3–5 min on the runner)
- A single **URL** (e.g. `/2026/03/26/foo/`) — regenerates one post

Always **dry-run first** — it prints the plan without writing. Uncheck
dry-run to commit changes.

## Safety notes

- All workflows use `contents: write` scope only and run on a fresh
  Ubuntu runner.
- The regenerate-posts workflow uses a retry-rebase loop (5 attempts)
  because the 3k-file commit can race other pushes.
- The dedup-execute workflow enforces: uploads-dir allowlist, path
  traversal check, 20k-max cap.
- All writes are idempotent — safe to rerun.
