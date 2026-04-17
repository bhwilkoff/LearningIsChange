# Learning is Change — Architecture & Technology Decisions

Entries are ordered by date. This file is **append-only** — never edit
or remove past decisions. Add a new entry that supersedes an old one if
direction changes.

---

## Decision 001 — Static HTML on GitHub Pages (no WordPress)
*Date: 2025 (pre-Claude-Code; recorded 2026-04-17)*

**Decision**: The site is flat HTML served by GitHub Pages from `main`
at `learningischange.com`. No PHP, no database at request time, no
WordPress.

**Rationale**: The prior WordPress multisite required hosting fees,
plugin maintenance, and security patching — the stack we were trying
to leave. GitHub Pages is free, versioned, and serves the existing
Fluida-rendered HTML as-is.

**Trade-offs**: No runtime dynamics. Anything interactive (search,
admin) must be client-side JS, a prebuilt index, or a GitHub Action.

---

## Decision 002 — Preserve WordPress URL structure and archival fidelity
*Date: 2025*

**Decision**: Every URL served by the old WordPress multisite must
keep working. Post slugs, category/tag archives, author pages, year
archives, and RSS GUIDs do not change.

**Rationale**: The archive is the product. Years of inbound links,
subscribers, and syndication depend on stable URLs.

**Trade-offs**: The directory layout is WordPress-shaped (thousands
of slug-named folders at the repo root). Any restructuring proposal
must include a redirect plan.

---

## Decision 003 — JSON files under `database/` as the content index
*Date: 2025*

**Decision**: `database/` holds the structured index of the site:
`pages.json`, `taxonomies.json`, `authors.json`, per-year
`posts/YYYY.json`, `search.json`, `manifest.json`, `changelog.json`,
plus `search.db` (SQLite FTS for client-side search).

**Rationale**: Static JSON is cheap to serve, easy to diff, and can
be mutated by admin tools via the GitHub REST API. Sharding posts
per year keeps each file small enough for the API's practical blob
ceiling.

**Trade-offs**: No referential integrity. Mutation code must be
null-safe and idempotent because post shapes drift across years.

---

## Decision 004 — Hybrid GitHub REST API + Actions for writes
*Date: 2025*

**Decision**: Admin tools write small files directly via the GitHub
REST API. Large files (notably `feed/full.xml` at ~42 MB) are edited
by GitHub Actions workflows (`update-rss.yml`,
`remove-from-rss.yml`) dispatched via `workflow_dispatch`.

**Rationale**: The REST API's blob endpoint has a practical ceiling
around 35–50 MB for base64-encoded JSON payloads, despite the
documented 100 MB. Actions run on GitHub's servers and don't hit
that ceiling.

**Trade-offs**: Two code paths. Tools must classify each write and
pick the right one. `workflow_dispatch` has a 65 KB input size
limit and returns 204 No Content — both require special handling.

---

## Decision 005 — Bearer token authentication for the GitHub API
*Date: 2025*

**Decision**: Admin tools authenticate with
`Authorization: Bearer <PAT>`.

**Rationale**: The legacy `Authorization: token <PAT>` format is
deprecated. Bearer works for both classic and fine-grained PATs.

**Trade-offs**: None significant; this is strictly a correctness fix.

---

## Decision 006 — Template-based archive regeneration
*Date: 2025*

**Decision**: When an admin tool updates an archive, category, tag,
or year page, it fetches the existing page from GitHub Pages as a
template and string-replaces the content region. It does not
hand-construct Fluida HTML.

**Rationale**: The Fluida theme has enough DOM nuance
(content-right/sidebar-left layout, breadcrumb, pagination, widget
areas) that re-emitting it from scratch causes visual regressions.
Fetching-and-replacing preserves the theme output exactly.

**Trade-offs**: Depends on the Pages site being live and reachable
during admin operations. If Pages is down, admin tools stall.

---

## Decision 007 — Batch + resume for mass operations
*Date: 2025*

**Decision**: Tools that touch many files (mass find/replace,
archive rebuild, full-DB refresh) batch work into configurable
chunks, persist progress (IndexedDB in-browser), and resume from the
last checkpoint on retry.

**Rationale**: GitHub's secondary rate limits bite well below the
documented 5,000/hr cap on concurrent writes. Without resume, a
multi-thousand-file operation that hits a limit loses all progress.

**Trade-offs**: Admin tool code is more complex. Operations can
span hours with pauses — user must be patient.

---

## Decision 008 — Adopt Claude Code governance (CLAUDE/SCRATCHPAD/DECISIONS)
*Date: 2026-04-17*

**Decision**: This repo adopts the three-file governance pattern
from `bhwilkoff/DualAppTemplate`: `CLAUDE.md` (standing identity),
`SCRATCHPAD.md` (live work state, append-only session log),
`DECISIONS.md` (this file — append-only).

**Rationale**: The 10 admin tools are each 1,000–4,200 lines of
single-file HTML+JS (~20k lines total, already in-repo). Iterating
on them in chat stopped scaling — a single tool file fills a chat
context before shared plumbing can be refactored. Claude Code with
local file access plus persistent docs unblocks systematic work on
M1 (shared admin plumbing), M2 (size reduction), M3 (bulk-update as
a first-class workflow).

**Trade-offs**: Three files to keep current. The session log can
grow long — accept that; append-only is the invariant.

---

## Decision 009 — Rely on Jetpack CDN for resized image variants
*Date: 2026-04-17*

**Decision**: Delete WP-generated size variants (`-150x150.jpg`,
`-300x300.jpg`, `-720x340.jpg`, `-scaled.jpg`, etc.) from
`wp-content/uploads/`. Keep only the original upload. Requests for
specific sizes go through Jetpack Photon (`i0.wp.com`), which
generates them on demand from the original served by GitHub Pages.

**Rationale**: 13,640 of 15,618 files in `wp-content/uploads/` are
size variants; most (13,593 of 13,640) are unreferenced anywhere in
the repo. Jetpack CDN is verified live for this domain without the
Jetpack plugin being active — it uses the canonical URL at
`learningischange.com` as the source. Deleting variants recovers
~758 MB with no visible change to the served site.

**Alternatives considered**:
- Keep everything (simplest, but the repo is already over GitHub's
  1 GB recommendation)
- Move media to external storage (explicitly ruled out: Ben wants
  to stay on GitHub Pages)
- Regenerate variants client-side (not viable in a static site)

**Trade-offs**:
- Dependency on Jetpack/WordPress.com's CDN continuing to serve
  this domain. If WordPress.com disconnects the domain from Jetpack,
  any HTML that uses `i*.wp.com/...` URLs would fail. Mitigation:
  references that point directly at size-variant files (46 refs)
  should be rewritten to Jetpack URLs or to the original, not left
  pointing at the now-deleted variant.
- One-time migration cost: the 46 direct variant refs need rewriting
  as part of the delete pass.

---

## Decision 010 — Admin tools share code via `admin/lib/` ES modules
*Date: 2026-04-17*

**Decision**: Shared admin plumbing lives in `admin/lib/*.js`, loaded
by tools via `<script type="module">`. Current modules: `config.js`
(site-agnostic settings), `github.js` (REST client with Bearer
auth, retries, contents API + git data API + workflow dispatch).
Each subdomain repo can adopt the same structure by editing only
`config.js`.

**Rationale**: The 10 existing admin tools (~20k lines of single-
file HTML+JS) each reimplement GitHub API auth, retry, template
fetch, null-safe JSON mutation. One bug fix required touching ten
files. Centralizing into `admin/lib/` lets each tool shrink and lets
fixes happen once.

**Alternatives considered** (see SCRATCHPAD open question 1 earlier):
- Inline + build script (keeps tools single-file; adds a build step)
- Hybrid (pure utilities external, tool logic inline)

**Trade-offs**: Tools stop being single-file. `file://` opening
breaks (ES module CORS); a dev server is needed for local testing.
GitHub Pages serves modules fine. Existing tools will migrate in M1.

---

## Decision 011 — `admin/dedup/` as the canonical cleanup tool
*Date: 2026-04-17*

**Decision**: Media cleanup runs through the versioned
`admin/dedup/` tool, not ad-hoc scripts. `scan.js` (Node) produces
`data/manifest.json`; `index.html` is a review UI that captures
decisions; a future executor applies them via the GitHub API or a
workflow.

**Rationale**: Bulk deletions are high-risk. A reviewable blueprint
that separates "what to delete" from "execute the delete" is safer
and auditable. Committing the manifest + decisions to the repo
provides history for what was removed and why.

**Trade-offs**: Scan manifest is ~4 MB; committed and served to the
UI. Re-running the scan after bulk deletions means committing a
different 4 MB file — accept the churn.

---

## Decision 012 — Bulk deletions run via workflow_dispatch, not browser
*Date: 2026-04-17*

**Decision**: When the dedup tool is ready to delete files, it commits
`admin/dedup/data/decisions.json` via the Contents API and then
dispatches `.github/workflows/dedup-execute.yml`. The workflow reads
the committed decisions file, deletes paths, commits, and pushes. The
browser never holds a long-running delete loop.

**Rationale**: Two-way consistent with the existing pattern
(`update-rss.yml`, `remove-from-rss.yml`): small files via the REST
API, big/bulk operations via Actions. Browser-driven deletion of 13k+
files would take hours, hit secondary rate limits, and have no good
resume story. Actions runs it in minutes on a single runner.

**Safety gates embedded in the workflow**:
- Path allowlist: every entry must start with `wp-content/uploads/`.
- No `..` traversal or absolute paths.
- `confirm_count` input must match `decisions.json` — defends against
  stale decisions or dispatching with a different branch state.
- Max 20,000 deletions per run. Forces splitting large batches.
- `dry_run` mode prints the plan without changing anything.

**Trade-offs**:
- Every execution round creates two commits on `main`: one updating
  `decisions.json`, one deleting the files. Accept the noise; the
  history is informative.
- Requires the PAT to have `workflow` scope in addition to `repo`.
- The tool UI doesn't track workflow run status directly — it links
  to the Actions tab. Polling runs would add complexity that isn't
  yet justified.

---

## Decision 013 — Full CMS overhaul: content-as-data + template regeneration
*Date: 2026-04-17*

**Decision**: The site migrates to a content-as-data architecture.
JSON under `database/` becomes the single source of truth for post
and page content. HTML files (`YYYY/MM/DD/slug/index.html`, archive
pages, category/tag/author pages) become derived artifacts,
regenerated from templates + data. Theme-level zones (masthead, nav,
sidebar, footer) live in shared fragments under
`templates/fragments/` and propagate via a regenerator.

Migration proceeds in strict order: **M1 (shared admin lib) → M3
(zone markers + fragments) → M4 (content canonicalization + full
templates) → M5 (unified bulk-update pipeline)**. All four milestones
are in scope.

**Rationale**: The current setup — 8,180 self-contained HTML files
with duplicated theme markup, and 10 admin tools each with its own
copy of GitHub API / DB / template code — cannot absorb further
growth. Ben's daily workflow (adding posts, making theme tweaks) is
bottlenecked by the lack of abstraction. The audit found concrete
duplication targets in the tools and highly regular Fluida structure
across pages, both of which make a templated regeneration approach
feasible.

**Alternatives considered**:
- **Partial scope (M1 + M3 only)**: rejected — leaves post bodies in
  HTML, preserves the content/metadata asymmetry that makes bulk
  edits painful.
- **Deferred (do M1+M3, evaluate M4 later)**: rejected — Ben
  specified the full overhaul up front to avoid half-migrations.
- **Client-side rendering (SPA-style shells + fetch JSON)**:
  rejected at Decision 001 (static-first) and reinforced here
  (SEO, robustness, archival fidelity).

**Trade-offs**:
- Every post on the site will be touched by the M3 marker migration
  and M4 backfill. One-time churn is large.
- Regeneration becomes a core operation — every content edit triggers
  it. Must be fast and reliable.
- The JSON content field will inline rendered HTML (matching how
  `pages.json` already works), not a structured content tree. Simpler
  and matches WordPress origin, at the cost of not being able to
  re-theme without an HTML-level transformation.
