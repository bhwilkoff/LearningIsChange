# Learning is Change — Project Identity & Standing Instructions

Static content platform (formerly WordPress multisite), now rendered
entirely from JSON on GitHub Pages. Fully free, self-hostable, and — since
2026-09-16 (Decision 014) — free of WordPress code.

**Governing docs:** work status lives in `SCRATCHPAD.md`, architecture
decisions live in `DECISIONS.md`. This file is standing context.

---

## Core Philosophy

Learning over polish. *"Does this change make the archive easier to
maintain, faster to serve, or more durable — without reintroducing the
WordPress stack we walked away from?"* Diagnostics before iteration:
instrument with real counts/sizes on the real repo before making
structural changes.

**Preserve, don't break.** Every URL currently served must keep working.
The archive is the product. Changes that would invalidate existing
permalinks or RSS item GUIDs require an explicit entry in `DECISIONS.md`.
`scripts/check-permalinks.js` enforces this (every URL that ever shipped
must still resolve; `full.xml` GUIDs are retained unless the post is a
tombstone) and gates every render commit.

---

## Platform

- **Stack**: Vanilla HTML/CSS/JS, no build step. GitHub Pages serves
  from `main` at apex `learningischange.com` (see `CNAME`).
- **Rendering**: **JSON in `database/` is the source of truth; every
  HTML page is derived.** `scripts/lib/shell.js` + `templates/`
  (`post.html`, `archive.html`, `home.html`, `page.html`,
  `redirect.html`, `partials/{nav,rail,footer}.html`) and the renderers
  `regenerate-posts.js`, `render-archives.js`, `render-pages.js`,
  `render-feeds.js`, `render-shell.js` (portfolio/support/meet shell),
  `generate-sitemap.js`. `.github/workflows/render-site.yml` runs them
  all with the permalink gate. The whole site renders in ~5 s.
- **Design system**: `portfolio/css/style.css` + `/css/site.css`
  (tokens, dark/light mode, blog layout). Blog, portfolio, `/meet/`,
  `/support.html` and the admin tools (`admin/admin.css`) share it.
  **Keep the portfolio consistent with the blog** (standing instruction).
- **Admin surface**: `admin/index.html` is a dashboard that links to a
  set of single-file HTML apps, each at its own top-level path. They
  all talk to the GitHub REST API via Bearer tokens and dispatch
  workflows for large files (see "Admin tools" below).
- **Data layer**: `database/` holds JSON indices (`pages.json`,
  `taxonomies.json`, `authors.json`, per-year `posts/YYYY.json`,
  `search.json`, `manifest.json`, `changelog.json`) plus `search.db`
  (SQLite/FTS for client-side search).
- **Shared admin code**: `admin/lib/*.js` (ES modules) — config,
  auth, base64, github client, slug, database read, mutate (null-safe;
  `taxonomyTerm()` gives the canonical `{name, slug, url}` shape),
  feeds, editor, pickers. See `admin/lib/README.md`.
- **Feeds**: `feed/index.xml` (newest 50) and `feed/full.xml` (all
  posts, ~11 MB) are rendered by `scripts/render-feeds.js`; the podcast
  feed has its own tool. Never patch feeds in place.
- **Removed posts are tombstones** (`removed: true` in the shard): the
  permalink renders as a redirect to the year archive; listings, feeds
  and search skip it. Nothing under a public URL is ever deleted.
- **Static-page routing**: `database/page-rules.json` (redirects,
  noindex) — read by `render-pages.js` and `generate-sitemap.js`.

### Key rules

- **No paid services, no runtime dependencies.** Free GitHub Pages +
  Actions only. If a feature requires a paid tier, surface it in
  `DECISIONS.md` before building.
- **Small files via API, large files via Actions.** The ~35–50 MB
  practical blob ceiling is the dividing line. Admin tools must classify
  the payload and pick the right path.
- **Use Bearer tokens** (`Authorization: Bearer <PAT>`), not the
  deprecated `token <PAT>` format.
- **Edit JSON, then render.** Admin tools write `database/` and
  dispatch `render-site.yml`; they never write HTML, archives or feeds
  directly. Theme changes are template/partial edits + a render.
- **Null-safe JSON.** Every database-mutation path must guard against
  missing fields — old posts have inconsistent shapes.
- **Idempotent writes.** Admin tool operations should be safe to re-run.
  If a post already exists in the RSS feed or database, update in place
  rather than appending a duplicate.

### Admin tools (current)

All tools live in this repo as single-file HTML apps, each at its own
top-level path. Together they are ~20k lines of HTML+JS. They are the
CMS — there is no WordPress fallback. The systematization problem is
not that they live elsewhere; it's that each one is big enough to be
painful to iterate on in a single chat context.

| Path | Tool | Size | Role |
|---|---|---|---|
| `/admin/` | Dashboard | 414 | Launcher / tool index |
| `/new/` | Post Generator | 3,570 | Create post, update DB, dispatch RSS |
| `/edit/` | Page Editor | 2,506 | WYSIWYG (native contenteditable) edit any page/post |
| `/update/` | Mass Updater | 4,201 | Bulk find/replace across the repo |
| `/remove/` | Post Remover | 1,653 | Tombstone a post in its shard + dispatch render |
| `/podcast-rss/` | Podcast RSS | 1,264 | Apple Podcasts/Spotify compatible feed |
| `/links/` | Link Checker | 1,741 | Site-wide broken link scan (IndexedDB cache) |
| `/search/` | Search Console | 1,102 | Search tester (also user-facing search UI) |

*Status 2026-09-16: `/admin/regenerate/` (now "Render Site"), `/new/`,
`/edit/`, `/remove/` are on the JSON + render pipeline; the others are
next (see `docs/MODERNIZATION-AUDIT.md`). All 13 tools load
`admin/admin.css` + `admin/admin-bar.js`.*

Every tool talks to the GitHub REST API (PAT in `localStorage`) and
writes JSON under `database/`; rendering is the workflow's job.

### Subdomains

The WordPress multisite originally included `bothand`, `getwhale`,
`whitfordwest.family`, `masculinitydetox.org`. Each now lives in its
**own separate GitHub repo** and stays that way. This repo only
links to them.

**Implication for the shared admin lib**: design it to be
site-agnostic. Repo owner, repo name, branding, theme paths, and
feed filenames should be config, not constants. The subdomain repos
should be able to adopt the same `admin/lib/` with a one-file config
change.

---

## Repo Size & GitHub Pages Limits

GitHub Pages soft-recommends 1 GB repo size and caps at 10 GB published
site / 100 MB per file / 100 GB monthly bandwidth. This repo is well
over the 1 GB recommendation — size reduction is a live workstream,
tracked in `SCRATCHPAD.md`. Size-impacting changes (adding media,
enlarging feeds, adding history) require an entry in `DECISIONS.md`.

---

## Working Style

- **Reach for existing tools first.** The JSON renderers, GitHub Actions,
  GitHub REST API, native `contenteditable`, SQLite FTS — we already
  depend on them. Don't add a new dependency to solve a problem an
  existing one handles.
- **One systemic fix over N manual fixes.** If a change touches more
  than ~5 HTML files, it's a candidate for a mass-update tool, not a
  hand edit.
- **Preserve archival fidelity.** RSS GUIDs, permalinks, and comment
  threads on long-standing posts must survive every change.
- **Ask before destroying.** Git history rewrites, mass deletions, and
  .git-surgery operations require confirmation — they're irreversible
  on a push.

## Useful skills

- `frontend-design` / `ui-ux-pro-max` — admin UI polish
- `simplify` — review changed HTML/JS for reuse and dead code
- `update-config` — hooks/permissions for this repo's `.claude/`
- `review` / `security-review` — admin tools that hold GitHub PATs
  deserve a security pass
