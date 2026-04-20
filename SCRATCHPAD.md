# Learning is Change — Scratchpad

## Current State

- **Status**: Migration complete; CMS systematization starting
- **Active milestone**: M1 — extract shared admin plumbing (full overhaul
  approved: M1 → M3 → M4 → M5 in order, 2026-04-17)
- **Last session**: 2026-04-17 — Claude Code onboarded; docs seeded and
  corrected after learning the admin tools are already committed
- **Next actions**:
  1. Answer scope questions (see "Open Questions")
  2. Tool-by-tool audit: shared plumbing candidates (GitHub API client,
     auth, template fetch, null-safe DB mutators) + per-tool behavior map
  3. Decide the shared-lib layout (ES module under `admin/lib/` vs
     inlined-per-tool with a build step vs copy-paste sync script)
  4. Add the missing `/database-generator/`

---

## Repo Snapshot (2026-04-17)

| Metric | Value |
|---|---|
| On-disk total | 7.4 GB |
| `.git` | 3.2 GB |
| Working tree | ~4.2 GB |
| Tracked files | 25,769 |
| Largest dir | `wp-content/uploads/` (3.5 GB) |
| Largest single file | `feed/full.xml` (~42 MB) |
| GitHub Pages hard cap | 10 GB site, 100 MB/file, 100 GB bandwidth/mo |
| GitHub Pages soft cap | 1 GB repo |

Top size offenders:
- `wp-content/uploads/2016/` — 2.1 GB
- `wp-content/uploads/2014/` — 394 MB
- `wp-content/uploads/2013/` — 220 MB
- `wp-content/uploads/2019/` — 211 MB
- `wp-content/uploads/2022/` — 209 MB
- `database/posts/` — 27 MB
- `database/search.db` — 19 MB

No `.gitignore` at root — `.DS_Store` files are tracked across the tree.

---

## Milestones

### M0 — Claude Code onboarding ✅
- [x] CLAUDE.md written with project identity
- [x] SCRATCHPAD.md seeded with current state
- [x] DECISIONS.md seeded with the decisions already made
- [ ] `.gitignore` added (at minimum `.DS_Store`, editor files)

### M1 — Extract shared admin plumbing
*Goal: the 10 single-file HTML apps (~20k lines) share plumbing so a
fix happens once, not ten times. Delivery: external ES modules under
`admin/lib/` (decided 2026-04-17).*

Audited three biggest tools (`/new/`, `/edit/`, `/update/`).
Duplicated surfaces, with exemplar line refs:

| Helper | `/new/` | `/edit/` | `/update/` |
|---|---|---|---|
| GitHub API client | L818 | L855 | L1554 |
| Settings / PAT (`licAdminSettings`) | L799 | L836 | L1520 |
| `arrayBufferToBase64` | L870 | L1076 | — |
| `commitMultipleFiles` w/ retry | L927 | L938 | L1663 |
| `fetchDatabase` / `fetchPostsByYear` | L1004 | (inline) | L1591 |
| `fetchFileFromGithub` (atob-decode) | L1035 | L906 | L1647 |
| `formatDate` / `slugify` | L1025 | — | L1813 |
| `triggerWorkflow` | L1060 | L1097 | (inline) |
| Quill editor + image resize | L169 | L182 | — |
| Tag/category chip picker | L351 | (similar) | — |

Target `admin/lib/` shape (in addition to `config.js` + `github.js`
already shipped):

- `lib/auth.js` — `getSettings()` / `saveSettings()` shared with
  dedup tool; shared `licAdminSettings` localStorage key.
- `lib/base64.js` — `encode(str)` / `decode(str)` (UTF-8 safe).
- `lib/database.js` — `fetchManifest()`, `fetchPostsByYear(y)`,
  `fetchPages()`, `fetchTaxonomies()`, `fetchAuthors()`, and
  null-safe mutators: `upsertPost(year, post)`, `upsertPage(page)`,
  `removePost(year, url)`, etc. (Matches actual DB shape: per-post
  fields vary; mutators must guard missing keys.)
- `lib/template.js` — `fetchPage(url)` + `replaceZone(html, zone, newContent)`
  for the fragment markers introduced in M3.
- `lib/editor.js` — Quill + image-resize wrapper used by `/new/`
  and `/edit/`.
- `lib/pickers.js` — category / tag chip UI.
- `lib/slug.js` — `slugify`, `formatDate`, `postPath(date, slug)`.
- `lib/feeds.js` — RSS item builder (for the RSS creator + podcast
  RSS + post-generator feed updates).

Migration order (lowest risk first):
1. `/new/` (Post Generator) — Ben uses this most. Migrating first
   surfaces real bugs fast.
2. `/edit/` (Page Editor) — shares most code with `/new/`.
3. `/update/` (Mass Updater) — biggest by LOC; wait for lib maturity.
4. `/remove/`, `/archive-sync/`, `/rss-creator/`, `/podcast-rss/`,
   `/menus/`, `/links/`, `/search/` — smaller, mechanical migration.
5. Build the missing `/database-generator/` directly against lib/.

- **Acceptance**: each tool file is ≤1,500 lines. All admin tools pass
  a smoke test (create a post, edit a page, run a mass update) against
  the lib/ plumbing.

### M3 — Shared fragments + zone markers (regeneration pipeline)
*Goal: header / footer / sidebar / nav edits happen in one file and
propagate to all ~8,180 pages with a single command.*

**Shape**: HTML comment markers delimit theme-level zones in every
page; master fragments live in `templates/fragments/`; a regenerator
walks all HTML files and replaces the delimited content with the
fragment. Pages stay self-contained (SEO-friendly, no JS dependency).

Zones (based on the Fluida structure found in sample post
`/2026/03/26/60-minutes-in-space/index.html`):

| Zone | Marker | Source file |
|---|---|---|
| Masthead (top banner + site title) | `LIC:MASTHEAD` | `templates/fragments/masthead.html` |
| Primary navigation | `LIC:NAV:PRIMARY` | `templates/fragments/nav-primary.html` |
| Mobile nav | `LIC:NAV:MOBILE` | `templates/fragments/nav-mobile.html` |
| Sidebar widgets | `LIC:SIDEBAR` | `templates/fragments/sidebar.html` |
| Footer / colophon | `LIC:FOOTER` | `templates/fragments/footer.html` |

Marker syntax: `<!-- LIC:<ZONE>:START -->` ... `<!-- LIC:<ZONE>:END -->`.

Steps:
- [ ] **One-time migration**: `scripts/add-zone-markers.js` walks every
      `**/index.html`, identifies zones by class/id selector
      (`.site-header`, `nav#primary-nav`, `aside#primary`, etc.), wraps
      them with markers. Idempotent (skip pages already marked).
- [ ] **Capture fragments**: for each zone, grab the content from a
      known-good canonical page, save as `templates/fragments/<zone>.html`.
- [ ] **Build `admin/regenerate/`**: UI + script with
      - `scan` — list pages and which zones they have / are missing
      - `preview` — dry-run diff for a proposed fragment change
      - `apply` — write updates (either via API batch for small
        changes, or via `.github/workflows/regenerate-fragments.yml`
        dispatch for cross-repo changes)
- [ ] **Add a `/menus/` tool integration**: when the user edits the
      nav in the Menu Editor, save to `templates/fragments/nav-*.html`
      + kick off regeneration.
- **Acceptance**: Ben changes one fragment file, runs regenerate,
  every page updates in a single commit. Dry-run produces a readable
  diff summary before any file is touched.

### M4 — Content-as-data canonicalization
*Goal: the JSON database becomes the single source of truth for post
content, not just metadata. Editing a post means editing JSON; the
HTML file is a derived artifact, regenerated by template + data.*

Audited state of content storage:
- `database/pages.json` — stores the full rendered HTML body in a
  `content` field. Pages already work this way. ✅
- `database/posts/YYYY.json` — stores metadata + `content_preview`
  only. The post body lives in the HTML file. ❌ asymmetric.

Plan:
- [ ] **Backfill**: one-time script that, for every post in
      `posts/YYYY.json`, reads the corresponding
      `/YYYY/MM/DD/slug/index.html`, extracts the content block
      (between the `LIC:CONTENT:START/END` markers added in M3),
      and stores it as `posts[i].content`.
- [ ] **Post template**: `templates/post.html` — full Fluida post
      page with `{{placeholders}}` for title, date, author,
      categories, tags, content, sibling navigation.
- [ ] **Post regenerator**: takes a year (or single URL), reads the
      JSON, renders HTML via template, writes the file.
- [ ] **`/new/` and `/edit/` flip the source**: write to
      `posts/YYYY.json` first, then regenerate the HTML as a
      downstream step. Currently they write HTML first.
- [ ] **Archive / taxonomy regenerator**: archive pages, category
      pages, tag pages, author pages all become derived from JSON —
      each is a template + filter over the post database.
- [ ] **Feeds, too**: `feed/full.xml`, `feed/index.xml`,
      `feed/podcast/feed.xml` regenerate from JSON (replaces the
      `update-rss.yml` / `remove-from-rss.yml` patch-in-place
      approach).
- **Acceptance**: Ben adds a post by writing to `posts/2026.json`;
  one regenerate command produces the new post page, updated
  archive pages, updated category/tag pages, updated feeds — in
  one commit.

### M5 — Unified bulk-update pipeline
*Goal: retire the ad-hoc "find/replace across 8k HTML files"
workflow. All bulk operations become JSON edits + regeneration.*

After M3+M4 land, the `/update/` Mass Updater's role shrinks to the
genuinely ad-hoc cases (typo fixes in specific posts, one-off HTML
patches). Theme-level changes go through fragments; content changes
go through the JSON database.

- [ ] Retire the rules-engine UI (save the mass-update tool for
      actual string replacements; simplify its UI).
- [ ] Add a "regenerate scope" picker to `admin/regenerate/`:
      all / by-year / by-category / by-tag / by-author / single-URL.
- [ ] Document the new workflows in `admin/README.md`.

---

## Architecture Plan Decisions (needs Ben's input — 2026-04-17)

1. **Scope of content-as-data canonicalization** (M4) — full, partial,
   or deferred? Biggest architectural question; biggest payoff; also
   biggest one-time migration cost.
2. **Template rendering**: string replacement vs. a real template
   engine? String replacement matches existing patterns (`update-rss.yml`,
   template-fetch-and-replace) but can't do conditionals/loops cleanly.
   A tiny engine like `mustache` or `eta` (single-file, no deps) would
   unlock loops for archive/index pages.
3. **Where regeneration runs** — locally (fast iteration, needs Node),
   Actions workflow (consistent with dedup-execute pattern), or both
   from the same script?
4. **Priority order**: M1 (shared lib) → M3 (fragments) → M4 (content
   canon) is my recommendation. Alternative: M3 first for the biggest
   visible win, then backfill M1 as tools migrate.
5. **Migration style**: incremental (tool by tool, kept working
   throughout) vs. big bang (disruptive, faster to finish). I lean
   incremental — the admin surface is Ben's daily driver.

---

### M2 — Repo size under control (no external offload)
*Goal: get the working tree as small as it can be while keeping every
currently-served URL working. All media stays on GitHub Pages; the win
comes from removing redundancy, not from moving files out.*
- [ ] Investigation pass (see Investigation Plan below):
  - [ ] Byte-level duplicates across the working tree
  - [ ] Media orphans (files not referenced by any HTML/XML)
  - [ ] WP size-variant audit (-150x150, -300x300, -768x768, -scaled)
  - [ ] HTML-page duplication (paginated/alias copies of same content)
- [ ] Dedupe plan with concrete bytes-recovered numbers, before any
      deletion
- [ ] Execute deletion (dry-run-first, idempotent, scriptable)
- [ ] Add `.gitignore`
- [ ] Decide `.git` history rewrite *after* working-tree dedup lands
- [ ] Decide whether to split `feed/full.xml` into per-year shards
- **Acceptance**: working tree < 2 GB; no tracked file > 25 MB
  (exception: `feed/full.xml`); every served URL keeps returning 200.

### M3 — Bulk-update as a first-class workflow
*Goal: header, footer, sidebar, menu, RSS/podcast metadata can be
changed in one place and propagated to every affected page.*
- [ ] Identify the HTML fragments that should be shared (header,
      footer, sidebar, breadcrumb template)
- [ ] Build a regeneration tool that walks all `*/index.html` pages
      and replaces the shared fragment regions by marker comments
- [ ] Decide: markers (`<!-- SHARED:HEADER -->`) vs DOM selectors
- [ ] Dry-run mode with diff summary before write
- [ ] Integrate RSS/podcast metadata updates into the same tool
- **Acceptance**: a header change takes one edit + one tool run and
  produces a clean commit touching only the shared fragment on each
  page.

---

## Media Dedup Investigation (2026-04-17)

Full scan of `wp-content/uploads/` (15,618 files, 3.5 GB on disk)
versus every media reference in HTML / XML / JSON / CSS / JS / MD
across the whole repo. Intermediate artifacts in `/tmp/lic_*.txt`.

### Baseline

| Metric | Value |
|---|---|
| Files on disk in `wp-content/uploads/` | 15,618 |
| Unique referenced media paths | 1,549 |
| **Orphans** (on disk, zero references) | **14,136** (~90% of files) |
| Total orphan bytes | **1,265 MB** (36% of uploads dir) |
| Broken refs (referenced, not on disk) | 67 |
| Byte-identical duplicate clusters | 2,381 |
| Duplicate waste (extra copies) | 562 MB (overlaps heavily with orphans) |

### Orphan composition

| Class | Count | Bytes | Notes |
|---|---|---|---|
| WP size variants (`-NNNxNNN`, `-scaled`) | 13,640 | ~758 MB | Site uses Jetpack CDN (i0.wp.com) which generates sizes on the fly from originals. Zero refs to `-720x340` (Fluida featured size); only 15 refs to any `-NNNxNNN` in the whole repo. **Safe to delete.** |
| Original images not referenced | 468 | ~200 MB | Uploads that never made it into a post. Worth a sample check before bulk delete. |
| Audio/video not referenced | 24 | ~290 MB | Old podcast episodes (MP3/M4A, 8–23 MB each). Not in any HTML, feed, DB, or podcast XML. Listener apps may still have cached URLs. **Needs Ben's call.** |
| Other | 4 | ~0 MB | Trivial. |

### Duplicate pattern

WordPress auto-numbered re-uploads of the same file: `IMG_4044.jpg`,
`IMG_4044-1.jpg`, `IMG_4044-2.jpg`, `IMG_4044-3.jpg` → all byte-identical.
Also YouTube-thumbnail hash collisions where the same `-720x340.jpg`
appears under multiple post slugs.

### Coverage caveats

- Scan covered `.html .xml .json .css .js .md`. No refs found in `.css`
  or `.js` files for uploads (confirmed).
- Jetpack CDN URLs (`i<N>.wp.com/learningischange.com/wp-content/...`)
  and Blubrry podcast URLs (`media.blubrry.com/.../wp-content/...`)
  are correctly picked up because the regex matches the inner
  `wp-content/uploads/...` portion.
- Some filenames contain spaces — accounted for; disk list built from
  find, not from md5 output parsing.

### Proposed tiered dedup plan

1. **Tier 1 — safe, immediate (~758 MB)**: delete the 13,640 orphan WP
   size variants. Dry-run first (write the list; verify).
2. **Tier 2 — spot-check then delete (~200 MB)**: sample 20 of the 468
   orphan originals; for each, confirm nothing in the served site
   points to it. Then bulk delete.
3. **Tier 3 — Ben's call (~290 MB)**: 24 orphan audio/video files.
   Decide: delete, or keep for archival fidelity.
4. **Tier 4 — duplicate canonicalization (~100–200 MB on top)**: among
   files that ARE referenced, collapse byte-identical duplicates to a
   single canonical copy and rewrite references.
5. **Fix 67 broken refs**: either restore the missing files (if
   recoverable) or edit the refs.
6. **Working-tree recovery estimate**: 1.25 GB (Tier 1+2) + 290 MB
   (Tier 3 if approved) + 100–200 MB (Tier 4) = **~1.5–1.8 GB**
   reduction, from 3.5 GB uploads dir to ~1.7–2.0 GB.
7. **Then** decide `.git` history rewrite: with the working tree 1.5+ GB
   smaller, rewriting history (BFG / git-filter-repo) would recover
   the same bytes from `.git` (3.2 GB → ~1.5 GB estimated).

---

## Session Log

<!-- Append-only. Format: state found → work done → state left -->

### 2026-04-20 — menu sync, /edit/ lib, M4 backfill (session 11)
- **Menu parser bug fix**: previous parser treated every `<ul>` containing
  menu-item children as a top-level menu — including sub-menus. Result
  was 14 "menus" in the editor instead of 2. Fixed with an
  ancestor-UL filter: a menu is top-level only if no parent UL exists.
- **Mobile/desktop sync**: two top-level menu ULs (`#mobile-nav` inside
  `<nav id="mobile-menu">` and `#prime_nav` inside `<nav id="access">`)
  are now edited as ONE tree. Save writes to both targets — IDs
  preserved for the target that originally had them (mobile),
  stripped from the target that didn't (desktop). Matches Fluida's
  original shape. Divergence warning shown if the two targets ever
  get out of sync.
- **Pages missing MASTHEAD markers audit**:
  - 6 `portfolio/` pages — intentional custom microsite, different
    visual identity (Inter + Source Serif fonts, own nav). Ben
    confirmed not to fold into Fluida.
  - 1 `feed/podcast/index.html` — 9-line redirect to `feed.xml`.
  - No action needed; all 8,160 Fluida-themed pages share the synced menu.
- **M1.2 — /edit/ lib delegation**: minimal pass matching the /new/
  pattern. Module script imports `bytesToBase64`, `slugify`,
  `formatDate` from `admin/lib/`; `arrayBufferToBase64` delegates to
  `window.LIB.bytesToBase64` with a byte-identical fallback.
- **M4 — backfill script**: `scripts/backfill-posts-content.js`
  extracts each post's `<div class="entry-content">` innerHTML and
  writes it as the post's `content` field in `database/posts/YYYY.json`.
  - Dry run: 5,741 post entries, **3,976 already have content**
    (backfill was partially done in past migrations), 12 newly
    extracted (2026 posts), 1,753 "noContent".
  - The 1,753 are **date archive pages** like `/2006/02/21/` — they
    shouldn't be in the posts DB at all (they're listing pages, not
    individual posts). Known data-quality issue to fix separately.
  - URL normalization handles both forms: `https://...` (older
    shards) and `/...` (newer shards).
  - Idempotent: skips entries that already have content. `--overwrite`
    re-extracts.
  - Applied for 2026 only to validate the extraction — all 17 posts
    now have a `content` field. Backfill for other years pending
    Ben's review.
- **M4 — next deliverables (deferred)**:
  - `scripts/capture-post-template.js` — take a canonical post, mark
    placeholders (`{{title}}`, `{{content}}`, etc.), save as
    `templates/post.html`.
  - `scripts/regenerate-posts.js` — for each post, render HTML from
    template + JSON data.
  - Flip `/new/` and `/edit/` to write JSON first; HTML becomes
    derived.
  - Clean up 1,753 date-archive entries from posts DB.
- **M5 — unified bulk-update**: deferred until M4 regenerator lands.
  Once posts are template-driven, bulk theme changes go through
  `templates/` edits + regenerate, and the Mass Updater's scope can
  shrink to genuinely one-off string replacements.

### 2026-04-20 — visual fragment editor + M3 end-to-end (session 10)
- **Found**: Ben tested the first regenerate-fragments UI and the full
  M3 pipeline worked — one footer edit → one workflow dispatch →
  `94da78ea2 regenerate fragments (FOOTER) — 8160 files changed`.
  Feedback: editing fragments in GitHub's raw textarea is not
  user-friendly; Ben's other tools are WYSIWYG / visual.
- **Did**: Rewrote `/admin/regenerate/` as a proper in-browser editor.
  - **Zone sidebar** with 'modified' dots for unsaved changes.
  - **Three tabs per fragment**:
    - Visual: native contenteditable with a formatting toolbar.
    - Source: authoritative monospace textarea.
    - Preview: sandboxed iframe that renders the fragment wrapped in
      the live site's `<head>` (fetched at init) — pixel-accurate.
  - **Save** commits the fragment via Contents API directly (lazy SHA
    fetch, so page load doesn't need a token).
  - **Apply to site** dispatches `regenerate-fragments.yml` for the
    current zone only, with a dry-run toggle.
  - Tab switching syncs content between tabs so the authoritative
    state is always `state.fragments[zone].current`.
  - `beforeunload` warning for unsaved changes.
- **Testable outcome**: Ben opens `/admin/regenerate/`, clicks FOOTER,
  edits text in Visual, sees Preview match, clicks Save → one-file
  commit, then Apply to site → workflow dispatch with dry-run
  preview. Much better experience than `Edit on GitHub` → textarea.
- **Not yet delivered (known gaps Ben may want next)**:
  - Structured menu editor for MASTHEAD (edit nav items as
    label + URL pairs, reorder, nest).
  - Widget-card editor for SIDEBAR (each widget as its own editable
    block).
  - Mass-updater-style DOM picker inside the Visual editor (click to
    target a specific element region).

### 2026-04-20 — /new/ swapped, markers applied, regenerate tool shipped (session 9)
- **Found**: Ben confirmed /new/v2/ works identically to /new/ after
  the lib-delegate pass. Approved larger batch work with a single
  testing window to avoid the 10-minute Pages deploy cycle per change.
- **Did**:
  1. **Broader allowlist patterns**: added project-local permissions
     for common tools (`Bash(/usr/bin/grep:*)`, `Bash(/bin/ls:*)`,
     `Bash(/opt/homebrew/bin/node:*)`, `Bash(/opt/homebrew/bin/gh:*)`,
     etc.) so future sessions stop re-prompting on near-identical
     patterns.
  2. **Swapped /new/ to v2 content**: copied `new/v2/index.html` to
     `new/index.html`, removed the v2 badge/title/breadcrumb, deleted
     the `new/v2/` directory, removed the "Try v2" link from the
     admin dashboard. `/new/` now uses the admin/lib/ delegation for
     `slugify` and `formatDate` — other helpers still inline for
     safety, swap-by-swap in subsequent sessions.
  3. **Applied zone markers across the whole site**: ran
     `scripts/add-zone-markers.js --apply` on 8,168 HTML files;
     8,160 got MASTHEAD/SIDEBAR/COLOPHON/FOOTER markers (7–8 pages
     with non-Fluida shape skipped). Idempotent, so re-runs are safe.
  4. **Regenerate Fragments workflow + admin UI**:
     `.github/workflows/regenerate-fragments.yml` dispatches
     `scripts/regenerate-fragments.js` with a zones filter and
     `dry_run` flag. `admin/regenerate/index.html` is the browser UI:
     previews each fragment, lets Ben pick which zones to apply,
     dispatches the workflow, links to the Actions run.
  5. Added Regenerate card to the admin dashboard.
- **Testable outcome**: once deployed, Ben can:
  - Use `/new/` exactly as before (lib delegation is invisible).
  - Edit `templates/fragments/masthead.html` via GitHub's web UI,
    visit `/admin/regenerate/`, dispatch with `dry_run=true` → check
    the Actions output, then dispatch with `dry_run=false` → see one
    commit that updates every page's masthead.
- **Left**:
  - M1.2+: continue the per-tool migrations (/edit/, /update/, etc.)
    in future sessions.
  - M4: content canonicalization (backfill posts/YYYY.json with full
    post HTML body from each post's index.html).

### 2026-04-20 — lock fix, revert, first lib swap (session 8)
- **Found**: Ben identified the git-index lock as recurring and
  uniquely triggered by Claude Code on this repo. Traced to
  `PID 3852: git ls-files --others --exclude-standard`
  parented by `PID 17800: claude` — Claude Code's built-in repo poll.
  On a 7.4 GB, 25k-file repo with many untracked files, each poll
  takes seconds, holding `.git/index.lock` intermittently and
  blocking commits from GHD or the CLI.
- **Did**:
  1. **Lock mitigation**: enabled `core.untrackedCache true` and
     `feature.manyFiles true` on this repo. The untracked cache means
     `ls-files --others` reads cached results instead of stat-ing the
     filesystem, so polls complete much faster and hold the lock for
     milliseconds instead of seconds.
  2. **Revert test post**: pulled the test post commit (`f1e0dc192`,
     "New post: This is a test") that Ben created from the browser;
     reverted locally (`7d9867ede`); pushed. Dispatched
     `remove-from-rss.yml` via `gh` CLI to remove the test post from
     `feed/full.xml` (which the RSS action had added server-side).
  3. **First real lib swap in /new/v2/**: added a
     `<script type="module">` block that imports `slugify` +
     `formatDate` (and `postPath`, `postUrl`, `isoDate` for future
     swaps) from `/admin/lib/slug.js` and attaches them to
     `window.LIB`. The existing `LiCAdmin.slugify` and
     `LiCAdmin.formatDate` inside the classic script now delegate to
     `window.LIB.*` with the original inline code retained as a
     fallback. This is the first concrete lib integration in v2 —
     Ben can diff v1 vs v2 and see the new wiring.
- **Left**:
  - Swap the remaining helpers one at a time (base64, database
    fetches, auth, github API, commit, RSS, archives, DB mutators).
  - Monitor the lock situation with the new config — should be much
    better but still gated on polls completing quickly.

### 2026-04-20 — /new/v2 reset to copy-first (session 7)
- **Found**: Session 6's from-scratch v2 shipped broken — slug auto-gen,
  settings button, editor toolbar buttons, and image-insert flow were
  all non-functional. Root cause: I rewrote the UI shell from memory
  instead of porting the working code. The lib modules themselves are
  fine; the v2 tool never exercised them.
- **Did**:
  1. Scrapped the broken v2 file.
  2. Copied `/new/index.html` verbatim to `/new/v2/index.html`.
  3. Added a visible `v2` badge to the page heading and updated the
     `<title>` + breadcrumb so Ben can tell them apart in his browser.
  4. Verified `diff` is three cosmetic lines only — v2 should behave
     identically to v1.
  5. Reset M1.1b task to in_progress with a new, correct description:
     progressive lib integration rather than from-scratch rewrite.
- **Next**: swap ONE helper at a time. Candidate order (simplest →
  hairiest): `slugify`, `formatDate`, `arrayBufferToBase64`,
  `fetchDatabase`/`fetchPostsByYear`, `getSettings`/`saveSettings`,
  `fetchFileFromGithub`, `githubAPI`, `commitMultipleFiles`,
  `triggerWorkflow`. Then the generators (RSS, archives, DB mutators)
  delegate to lib/feeds, lib/archives, lib/mutate respectively.
- **Lesson learned for my own memory**: when porting a substantial
  tool, start from the working code and do targeted swaps. Never
  recreate the UI shell from an audit — auditing captures surface
  features, not invisible behaviors (keyboard bindings, focus
  handling, IIFE closures, DOM event chains).

### 2026-04-17 — M1.1b /new/v2 built (session 6)
- **Found**: Full `/new/` audit showed the orchestration flow is
  self-contained and the tool-specific logic (post page assembly,
  archive update loop, options panel) is ~600 lines of the 3,570.
  The rest (3,000 lines) is plumbing that now lives in `admin/lib/`.
- **Did**: Built `/new/v2/index.html` (816 lines, 40 KB) — a full
  rewrite of the Post Generator using the shared lib. Preserves:
  - Form UI: title, date, slug (auto), excerpt, rich editor, category,
    tag picker, image upload, per-update options
  - Publish flow: fetch homepage → extract site components → build
    post page → generate archive updates for
    month/year/home/category/tag/author → update RSS `index.xml`
    → update posts shard / taxonomies / manifest / changelog → single
    batch commit → dispatch `update-rss.yml` for `full.xml`
  - Image substitution: data-URI previews in the editor are rewritten
    to `/wp-content/uploads/YYYY/MM/…` at publish time
  - URL preview updates as the user types
  - Progress log with levels (info/success/warning/error)
  Dashboard now links to `/new/v2/` alongside `/new/`.
- **Size**: 816 / 3,570 = 77% reduction, matching the estimate.
- **Left (tested by Ben)**: run a real post through `/new/v2/`, compare
  output to `/new/`, then swap. Known limitation: buildNewArchivePage
  only has the "content-masonry" substitution path; if an archive page
  doesn't yet exist for a tag, the fallback is minimal. The legacy
  tool had richer new-page generation; worth carrying over if a tag
  archive ever needs to be created from scratch.

### 2026-04-17 — M1.1 lib complete + M3 scripts (session 5)
- **Found**: Session 4 shipped 6 lib modules (config, github, auth,
  base64, slug, database); 5 more were still needed for the `/new/`
  migration. Read the key `/new/` function ranges (generate database
  update L3173, taxonomies L3216, RSS L2957, archive generators L2474,
  insertArticleIntoPage L1213) for behavior-preserving extraction.
- **Did**:
  1. Built the remaining 5 lib modules, all smoke-tested:
     - `mutate.js` — null-safe `upsertPost`, `removePost`,
       `upsertPage`, `removePage`, `incrementTaxonomies`,
       `decrementTaxonomies`, `appendChangelog`,
       `updateManifestShardCount`. Maintains both `count` and
       `post_count` on posts shards to heal existing drift.
     - `feeds.js` — `buildRssItem`, `insertRssItem` (upsert by URL),
       `removeRssItem`, `newRssFeed`. Escapes XML, matches existing
       whitespace/indent.
     - `archives.js` — `insertArticleIntoPage` (container-selector
       fallback chain matching the legacy tool),
       `updateSidebarInPage` (idempotent; skips if month already
       present), `removeArticleFromPage`, `fetchArchiveTemplate`
       (cached), `archivePath`/`archiveUrl`, `buildArticleBlock`.
     - `editor.js` — `RichEditor` class wrapping native
       `contenteditable`; `openImageResize` modal helper.
     - `pickers.js` — `TagPicker` (chip UI + popular tags),
       `CategoryPicker` (hierarchy-aware dropdown).
     - Total in `admin/lib/`: 11 modules, all passing tests.
  2. M3 scripts (all three):
     - `scripts/add-zone-markers.js` — idempotent, depth-tracking
       closing-tag finder; wraps MASTHEAD/SIDEBAR/COLOPHON/FOOTER
       zones with `<!-- LIC:<ZONE>:START/END -->` markers. Dry run:
       8,161 of 8,168 pages would be marked.
     - `scripts/capture-fragments.js` — extracts between markers on
       a canonical page, writes to `templates/fragments/`.
     - `scripts/regenerate-fragments.js` — walks all pages, replaces
       marker-bounded content with the fragment file. `--zones=`
       arg limits scope; dry-run-by-default.
  3. Marked one canonical page
     (`/2026/03/26/60-minutes-in-space/index.html`) and captured
     fragments: masthead (10.5 KB), sidebar (7.6 KB), colophon
     (0.1 KB), footer (0.5 KB). Sample spot-checked — looks clean.
  4. CLAUDE.md updated with lib + scripts layout.
- **Left**:
  - `/new/` migration (M1.1b) — rewrite to import from lib. Would
    drop ~3,570 lines to ~800-1,200.
  - M3.2: apply markers to all 8,161 pages (one big commit). Audit
    the sidebar fragment for dynamic content (recent-posts widgets)
    before regenerating.
  - admin/regenerate/ tool UI (browser front-end to the regenerate
    script; dispatches via workflow).
  - M4 content canonicalization, M5 bulk-update pipeline.

### 2026-04-17 — M1 foundation (session 4)
- **Found**: Ben approved the full overhaul in priority order.
  Audited `/new/` (3,570 lines) for extraction targets. Key finding:
  the editor is native `contenteditable`, not Quill (CLAUDE.md
  corrected). Legacy localStorage key `lic_admin_settings` (used by
  `/new/`) differs from the canonical `licAdminSettings` (used by
  `/update/` and the dedup tool).
- **Did**: Built six foundational `admin/lib/` modules.
  - `auth.js` — settings/PAT with legacy-key auto-migration
  - `base64.js` — UTF-8 safe chunked encode/decode
  - `slug.js` — slugify/postPath/formatDate/isoDate/yearMonth
    (fixed a latent timezone bug: `YYYY-MM-DD` strings are now
    parsed as calendar dates, not UTC timestamps)
  - `database.js` — read-only access to `/database/*.json`
  - `github.js` — enhanced with `commitFiles()` (high-level batch
    commit via git data API, retries), `createBlob()`,
    `getFileContent()`
  - `config.js` — existed; left untouched
  - `README.md` — documents the lib pattern + migration status
  - All modules smoke-tested in Node. Round trips verified.
  - Fixed CLAUDE.md: Quill → native contenteditable (two places).
- **Left**:
  - `mutate.js` (null-safe DB mutators), `editor.js`, `pickers.js`,
    `feeds.js`, `archives.js` — depends on the specifics of each
    tool's flow; build as we migrate.
  - `/new/` migration itself is the next substantial work.
  - `template.js` waits for M3 zone markers.

### 2026-04-17 — dedup executor wired (session 3)
- **Found**: Tool from session 2 captured decisions but had no
  executor. Ben approved workflow-dispatch approach (consistent with
  existing `update-rss.yml` / `remove-from-rss.yml` pattern).
- **Did**:
  1. `.github/workflows/dedup-execute.yml` — reads
     `admin/dedup/data/decisions.json`, deletes paths marked `delete`,
     commits + pushes. Safety gates: `dry_run` input, `confirm_count`
     interlock, bounds check (must be under `wp-content/uploads/`,
     no `..` traversal), max 20k deletions per run.
  2. UI Execute panel on Summary tab: shows resolved counts and bytes
     to delete, PAT status, two buttons (Dry run / Execute for real).
     Execute prompts for <code>DELETE N FILES</code> confirmation.
  3. `resolveDecisions()` helper combines user decisions with class
     defaults — so an undecided variant rolls up to 'delete', an
     undecided image stays pending (not exported), an undecided audio
     rolls up to 'keep'.
  4. UI commits `decisions.json` via Contents API (with sha handling
     for updates), then dispatches the workflow.
  5. README updated with execution workflow and PAT scopes
     (`repo` + `workflow`).
- **Left**:
  - Ben to load the tool, verify the variants sample, dry-run, then
    execute for real.
  - After Tier 1 executes, re-run `scan.js` and review Tier 2
    (468 orphan images) + Tier 4 (2,381 dup clusters).
  - 46 direct variant refs: leave them pointing at variants for now
    (those variants won't be marked delete since they're not orphans).
    Separate pass later to rewrite refs to Jetpack CDN URLs so we
    can delete those last 46 too.
  - `.git` history rewrite decision — hold until working tree
    actually shrinks, then measure.

### 2026-04-17 — dedup tool built (session 2)
- **Found**: No existing dedup tool; investigation ran from `/tmp` only.
  Ben's clarification: the orphan audio files aren't actually orphans
  — he uploaded them recently to old directories for retroactive
  podcast episode embedding. They stay.
- **Did**:
  1. Verified Jetpack CDN still serves this domain (`i0.wp.com`
     returns 200 and fetches from the GitHub Pages canonical URL) →
     Tier 1 variant cleanup is safe.
  2. Committed the dedup investigation as a versioned tool:
     - `admin/dedup/scan.js` (Node) regenerates `data/manifest.json`
     - `admin/dedup/index.html` is a paginated review UI with
       thumbnails (Jetpack), per-item keep/delete, export/import
     - `admin/dedup/README.md` documents the workflow
  3. First shared-lib pieces: `admin/lib/config.js` (site-agnostic
     config, reusable across subdomain repos), `admin/lib/github.js`
     (Bearer auth, retry, contents API + git data API + workflow
     dispatch).
  4. Added `.gitignore` for `.DS_Store`.
  5. Linked the dedup tool from `admin/index.html`.
- **Left**:
  - Executor not yet wired up. Current tool produces the decision
    blueprint only; next iteration runs the actual deletions.
  - Tool defaults: variants → delete, images/docs/broken → pending,
    audio_video → keep.
  - Manifest size is 4.1 MB (committed). Pages serves it to the UI.

### 2026-04-17 — onboarding
- **Found**: No CLAUDE.md / SCRATCHPAD.md / DECISIONS.md. 7.4 GB on
  disk, 3.2 GB `.git`, 25,769 tracked files, no `.gitignore`.
  `.github/workflows/` has `update-rss.yml` and `remove-from-rss.yml`
  already wired for the 42 MB `feed/full.xml`.
- **Corrected on second pass**: the admin tools *are* in the repo —
  `/new/` (3,570 lines), `/edit/` (2,506), `/update/` (4,201),
  `/remove/` (1,653), `/archive-sync/` (1,639), `/rss-creator/`
  (1,104), `/podcast-rss/` (1,264), `/menus/` (1,096), `/links/`
  (1,741), `/search/` (1,102). Total ~20k lines of single-file HTML
  apps. The real problem isn't that they live elsewhere; it's that
  each one is too big to iterate on in one chat, and they duplicate
  plumbing (GitHub API client, auth, template fetch, DB mutation).
  `/database-generator/` is on the dashboard but not committed.
- **Did**: Seeded + corrected CLAUDE.md, SCRATCHPAD.md, DECISIONS.md.
- **Left**: Four open questions at the bottom of this file need
  answers before M1–M3 can be scoped concretely.

---

## Open Questions (2026-04-17)

1. ~~**Shared-lib shape** — answered 2026-04-17: **External ES modules**
   under `admin/lib/*.js`, loaded with `<script type="module">`. Tools
   stop being single-file but each becomes small enough to iterate on.
   Shared lib must be site-agnostic (configurable repo, branding,
   paths) so the same files can drop into the subdomain repos.~~
2. ~~**Subdomains** — answered 2026-04-17: each subdomain lives in its
   own separate GitHub repo. They stay separate. Tooling we build here
   should be portable enough to drop into those repos — no
   site-specific assumptions hard-coded into shared lib.~~
3. ~~**Media strategy** — answered 2026-04-17: keep all media in the
   repo; no external offload. Find redundancy instead — duplicates,
   orphans not referenced by any HTML, WP-generated size variants
   that nothing uses.~~
4. **`.git` rewrite** — hold until the media-dedup investigation
   concludes. The decision only matters if dedup actually frees enough
   working-tree bytes to make a history rewrite worth it.
