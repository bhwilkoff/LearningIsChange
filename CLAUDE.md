# Learning is Change — Project Identity & Standing Instructions

Static content platform (formerly WordPress multisite) preserved as flat
HTML on GitHub Pages. The goal is a fully free, self-hostable archive and
publishing workflow with no WordPress dependencies.

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
permalinks, RSS item GUIDs, or the Fluida visual structure require an
explicit entry in `DECISIONS.md`.

---

## Platform

- **Stack**: Vanilla HTML/CSS/JS, no build step. GitHub Pages serves
  from `main` at apex `learningischange.com` (see `CNAME`).
- **Theme**: Fluida (WordPress origin) — layout is content-right,
  sidebar-left. Regenerate archive pages by fetching an existing page as
  a template and substituting content, not by hand-constructing HTML.
- **Admin surface**: `admin/index.html` is a dashboard that links to a
  set of single-file HTML apps, each at its own top-level path. They
  all talk to the GitHub REST API via Bearer tokens and dispatch
  workflows for large files (see "Admin tools" below).
- **Data layer**: `database/` holds JSON indices (`pages.json`,
  `taxonomies.json`, `authors.json`, per-year `posts/YYYY.json`,
  `search.json`, `manifest.json`, `changelog.json`) plus `search.db`
  (SQLite/FTS for client-side search).
- **Shared admin code**: `admin/lib/*.js` (ES modules) — config,
  auth, base64, github client, slug, database read, mutate (null-safe),
  feeds (RSS), archives (page HTML surgery), editor (contenteditable
  wrapper), pickers (tag/category UI). See `admin/lib/README.md`.
- **Regeneration scripts**: `scripts/add-zone-markers.js`,
  `scripts/capture-fragments.js`, `scripts/regenerate-fragments.js`.
  Master theme fragments live in `templates/fragments/{masthead,
  sidebar,colophon,footer}.html`.
- **Feeds**: `feed/index.xml` (excerpts, small) and `feed/full.xml`
  (full archive, ~42 MB). `full.xml` is too large for the GitHub REST
  API blob endpoint — edits go through `.github/workflows/update-rss.yml`
  and `remove-from-rss.yml`.

### Key rules

- **No paid services, no runtime dependencies.** Free GitHub Pages +
  Actions only. If a feature requires a paid tier, surface it in
  `DECISIONS.md` before building.
- **Small files via API, large files via Actions.** The ~35–50 MB
  practical blob ceiling is the dividing line. Admin tools must classify
  the payload and pick the right path.
- **Use Bearer tokens** (`Authorization: Bearer <PAT>`), not the
  deprecated `token <PAT>` format.
- **Template-based regeneration.** For archive/category/tag/year pages,
  fetch the existing page and string-replace the content block. Never
  reconstruct the Fluida DOM from scratch.
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
| `/remove/` | Post Remover | 1,653 | Delete post + clean homepage/archives/feeds/DB |
| `/rss-creator/` | RSS Creator | 1,104 | Regenerate `feed/index.xml` and friends |
| `/podcast-rss/` | Podcast RSS | 1,264 | Apple Podcasts/Spotify compatible feed |
| `/menus/` | Menu Editor | 1,096 | Edit nav/sidebar/footer fragments |
| `/links/` | Link Checker | 1,741 | Site-wide broken link scan (IndexedDB cache) |
| `/search/` | Search Console | 1,102 | Search tester (also user-facing search UI) |

*`/database-generator/` is listed on the dashboard but not committed
yet — it's one of the known gaps.*

Every tool touches some combination of: the GitHub REST API
(authenticated with a PAT held in `localStorage`), the per-year
`database/posts/YYYY.json`, the Fluida-rendered archive pages, and the
feed XML files. Pulling that shared plumbing into `admin/lib/` is the
core M1 cleanup.

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

- **Reach for existing tools first.** Fluida theme, GitHub Actions,
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
