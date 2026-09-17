# Learning is Change — Modernization Audit

*Living document. Started 2026-09-16 by the `/loop` audit. Each tick
appends to the log at the bottom and updates the tables in place.*

**Ground rules for this program**
1. **No content rewrites.** Post and page bodies are preserved
   byte-for-byte from `database/posts/YYYY.json` / `pages.json`.
   Anything that *looks* worth updating goes into the
   [Content Review Queue](#content-review-queue) for Ben to approve.
2. **Every URL keeps working** (Decision 002). Permalinks, feed
   GUIDs, category/tag/author/date archives.
3. **Design direction and site-wide regenerations need Ben's sign-off**
   via `DECISIONS.md` before they run. Diagnostics, research, docs,
   and non-visual SEO plumbing may proceed autonomously.
4. **Diagnostics before iteration.** Numbers below come from the real
   repo, re-measured when they change.

---

## 1. Diagnostics (2026-09-16)

### What the site is made of

| Area | HTML files | Notes |
|---|---:|---|
| Posts (`/YYYY/MM/DD/slug/`) | 3,651 | All have full `content` in `database/posts/YYYY.json` |
| Date archives (`/YYYY/`, `/YYYY/MM/`, `/YYYY/MM/DD/`) | 2,006 | Derived listings; not JSON-rendered yet |
| `category/` | 536 | Incl. paginated `page/N/` |
| `tag/` | 432 | " |
| `author/` | 391 | " |
| `page/` (homepage pagination) | 389 | `/page/2/` … `/page/389/` |
| Static pages (about, bio, services, pd, …) | ~65 | Full content in `database/pages.json` |
| Portfolio (`/portfolio/*`, `/support.html`, `/meet/`) | 9 | Hand-built; the design system to converge on |
| Admin tools | 10 dirs | `/admin/`, `/new/`, `/edit/`, `/update/`, `/remove/`, `/rss-creator/`, `/podcast-rss/`, `/menus/`, `/links/`, `/search/` |

### What a post page costs today

Representative post (`/2026/03/04/computer-shaped-problems/`):

| Measure | Value |
|---|---:|
| Total HTML | 91.7 KB |
| `<head>` | 58.2 KB |
| Inline `<style>` blocks | 16 (53.5 KB) |
| Stylesheets | 7 (Fluida, fontfaces, block-library, 3× Jetpack) |
| `<script>` tags | 16 (9 external; jQuery, wp-emoji, Jetpack likes/carousel, stats.wp.com) |
| External hosts referenced | gmpg.org, i0.wp.com, secure.gravatar.com, stats.wp.com, wp.me, facebook, twitter |
| **The actual article** | **4.6 KB (5% of the page)** |
| JSON-LD structured data | none → `BlogPosting` on every post (tick 3) |
| `og:url` | was `/` on every post → fixed tick 3 (absolute, per post) |
| `<link rel="canonical">` | absolute, correct |
| `<title>` | `Post – Learning is Change` (en dash, WP default) |

Across the year directories that is ~500 MB of HTML wrapping ~8.5 MB
of content. Every one of those pages ships WordPress-era JS that
either no-ops or phones home to WordPress.com.

### What's missing at the root

| File | Status | Impact |
|---|---|---|
| `robots.txt` | **absent** → added this tick | Crawlers had no sitemap pointer and could index admin tools |
| `sitemap.xml` | **absent** → added this tick | 8k URLs discoverable only by link-crawl |
| `llms.txt` | absent | Optional (see research); cheap to add later |
| JSON-LD (`BlogPosting`, `Person`, `WebSite`) | `BlogPosting` on all posts (tick 3); `Person`/`WebSite` come with the new homepage | Main lever for AI-citation and rich results |

### Comments

**Corrected 2026-09-16 (tick 26).** The tick-1 finding was wrong: the
WordPress export hard-coded 7,132 comments into 1,079 posts, and they
were stripped by the *first M4 post regeneration* (`9b39a965`, before
this audit) because the JSON backfill captured only the article body.
Ben pointed this out. Recovered from git (`582b036dd3`, the last commit
with them) by `scripts/recover-comments.js` into each post's JSON as
`comments[]` (id, author, author_url, avatar, date, depth, parent,
html — verbatim) and rendered read-only under the post. 1,043 posts
(the rest were deduplicated later). **Lesson**: check git history
before declaring content lost.

### Regeneration pipeline — what already exists

| Piece | Exists | State |
|---|---|---|
| `database/posts/YYYY.json` with full `content` | ✅ | 3,651/3,651 posts (M4 backfill done — SCRATCHPAD checkbox stale) |
| `templates/post.html` + `scripts/regenerate-posts.js` | ✅ | Renders **every post** from JSON; dry-run clean |
| `templates/fragments/*` + `regenerate-fragments.js` | ✅ | Masthead/sidebar/colophon/footer zones on 7,473 pages |
| `templates/post.html` composes fragments at render time | ✅ | `regenerate-posts.js` splices `templates/fragments/*` into the zones at render (tick 3) |
| Archive/category/tag/author/date renderer from JSON | ❌ | `admin/lib/archives.js` does HTML surgery on Fluida pages instead |
| Homepage + `/page/N/` renderer | ❌ | " |
| Feed renderer from JSON | ❌ | `update-rss.yml` patches `full.xml` in place |
| Search index from JSON | ✅ | `database/search.json` + `search.db` |

**This is the key finding.** Decision 013 (content-as-data) is
further along than the docs say. The conversion the loop is asked for
is therefore *not* a rewrite of 8k files — it is: write a new set of
templates in the portfolio design system, finish the three missing
renderers (archives, homepage, feeds), and regenerate. Content is
never edited.

---

## 2. Research findings

### Indexing: Google and AI crawlers (Sept 2026)

- **Structured data is the lever, not `llms.txt`.** Google does not
  read `llms.txt` and lists it among unnecessary tactics; Ahrefs'
  137k-site study found AI bots almost never fetch it. Google's only
  recommended format is JSON-LD; `BlogPosting` (not `Article`) with
  `headline`, `datePublished`, `dateModified`, `author` (→ a single
  `Person` node), `image`, and `isPartOf` → `WebSite`. AI Overviews /
  ChatGPT / Perplexity use the same signals to decide what to cite.
  *Applies here*: one `Person` + one `WebSite` node on the homepage;
  a `BlogPosting` on every post; `CollectionPage` on archives — all
  trivially emitted by the renderers from JSON fields we already have.
- **Allow the answer bots, decide separately on training bots.**
  Vendors now split crawlers: `OAI-SearchBot` / `Claude-SearchBot` /
  `PerplexityBot` (answering, drives citations) vs `GPTBot` /
  `ClaudeBot` / `Google-Extended` (training). Ben's goal is to be
  *found and cited*, so `robots.txt` allows everything and blocks only
  admin tools and WordPress leftovers.
- **Sitemaps still matter most for deep archives.** 8k URLs, most
  with zero inbound links, need `sitemap.xml` + `lastmod`. Done this
  tick.
- **Clean HTML is the real AI-readability win.** A 4.6 KB article
  inside a 92 KB page with 16 scripts is exactly what LLM crawlers
  truncate. The new templates fix this as a side effect.
- **Optional, cheap, differentiating**: a Markdown twin of every post
  (`/YYYY/MM/DD/slug/index.md`) generated from the same JSON. Agents
  and humans-with-curl get clean text; `<link rel="alternate"
  type="text/markdown">` advertises it. Zero risk to the HTML site.
  → decision item D-4.

### Site architecture

- **Keep the no-framework renderer.** Astro / Eleventy were evaluated
  (Eleventy: 10k pages in ~12s, 0.4s incremental; Astro similar) but
  either adds `node_modules`, a config surface, and a second content
  model. The repo already has the shape of a static generator —
  JSON in, HTML out, `node scripts/*.js` — and the admin tools already
  target it. Recommendation: finish *that* generator rather than adopt
  one. Revisit only if the render script exceeds ~1,500 lines.
- **Modern archive patterns worth stealing** (all derivable from the
  JSON, none require new content):
  - *On this day* — posts from today's date across 20 years, on the
    homepage.
  - *Related posts* — by shared tags/categories, at the foot of each
    post (replaces WordPress "Jetpack related posts" that no longer
    runs).
  - *Series / projects* — the blogging-project categories
    (`#C4C15`, `#LifeWideLearning16`, `365 Questions…`) rendered as
    ordered series with prev/next, not just tag listings.
  - *Year-in-review pages* — `/YYYY/` becomes a real landing page
    (counts, top tags, highlights) rather than a paginated dump.
  - *Reading time + word count* — fields already exist in
    `pages.json`; compute for posts at render.
  - *Now page* — `/now/` linked from the portfolio; small, but the
    "Currently" card already exists on `/portfolio/`.
  - *Topic map* — the taxonomy (536 category + 432 tag pages) as a
    browsable, weighted index instead of WordPress tag clouds.
- **Design system**: converge on `portfolio/css/style.css` (Inter /
  Source Serif 4 / JetBrains Mono, teal accent). Blog pages become
  the same shell with a content column; sidebar becomes a right-rail
  or in-flow blocks on mobile (the Fluida sidebar-below-content
  problem goes away by construction).

---

## 3. Inventory & alignment status

Legend: ⬜ untouched · 🟨 audited / plan written · 🟩 converted · ⛔ retire

| Surface | Status | Notes / plan |
|---|:-:|---|
| Post pages (3,651) | 🟩 | **P1 done 2026-09-16.** `templates/post.html` on the refreshed system; nav/rail/footer partials composed at render; JSON-LD; related + prev/next; reading time; Markdown twin at `index.md` |
| Homepage + `/page/N/` (389) | 🟩 | **P2 done 2026-09-16.** `templates/home.html`; latest, on-this-day (server-rendered + client refresh from `database/on-this-day.json`), start-here, series; all 389 `/page/N/` kept (367–390 are clamped aliases) |
| Year / month / day archives (2,006) | 🟩 | **P2 done.** Year-in-review pages (topics + by month), month and day listings; 2,024 pages |
| Category / tag / author (1,359) | 🟩 | **P2 done.** 568 category + 1,596 tag + 391 author pages (C-9: every term now has a page); parent categories include descendants; `CollectionPage` JSON-LD; 121 protected-URL aliases (noindex, canonical → real page) |
| Static pages (65) | 🟩 | **P3 done 2026-09-16.** `scripts/render-pages.js` + `templates/page.html`/`redirect.html`, rules in `database/page-rules.json`: 55 pages (23 noindex), 11 redirects; `/all-posts/` is a real full index by year |
| Portfolio (`/portfolio/*`) | 🟩 | On the shared shell since tick 15: `site.css` (dark/light tokens) + nav/footer partials spliced by `scripts/render-shell.js` via `LIC:NAV`/`LIC:FOOTER` markers. **Standing item (Ben, 2026-09-16): keep the portfolio consistent with the blog as the loop continues** — any shell/design change lands on both |
| `/support.html`, `/meet/` | 🟩 | Already on the portfolio system |
| Feeds (`feed/index.xml`, `full.xml`, podcast) | 🟩 | **Done 2026-09-16.** `scripts/render-feeds.js` from JSON; every original GUID retained; podcast feed untouched. `update-rss.yml`/`remove-from-rss.yml` retire in P5 when the tools dispatch `render-site.yml` |
| Search (`/search/`) | 🟩 | **P5.6 done 2026-09-16.** Rebuilt on the blog shell (nav/rail/footer partials via `render-shell.js`, `site.css`); engine kept, now skips tombstones and accepts `?q=` (homepage form) as well as `?s=`; admin bar removed (user-facing page) |
| Masthead / sidebar / colophon / footer fragments | 🟩 | **Deleted (P4).** Shell partials in `templates/partials/` replace them; `render-site.yml` replaces `regenerate-fragments.yml` |
| `wp-includes/`, `wp-content/plugins/`, `wp-content/themes/` | 🟩 | **Deleted 2026-09-16 (P4, D-6).** −52 MB. `wp-content/uploads/` (media) stays |
| `wp-content/uploads/` (1.3 GB) | ⬜ | Stays (media); size workstream is separate (SCRATCHPAD M2) |
| WordPress stub routes (`/login/`, `/register/`, `/lostpassword/`, `/resetpass/`, `/logout/`) | 🟩 | Redirect pages → `/` (P3) |
| Admin tools (13) | 🟨 | `/admin/regenerate/`, `/new/`, `/edit/`, `/remove/` on JSON + `render-site.yml` (P5.1–5.3). **Look & feel (Ben, 2026-09-16)**: all 13 load `admin/admin.css` (site tokens, fonts, dark mode, WP chrome restyled) + `admin/admin-bar.js` (shared switcher). Per-tool polish continues |
| `robots.txt`, `sitemap.xml` | 🟩 | Added 2026-09-16 (`scripts/generate-sitemap.js`) |
| `llms.txt` | 🟩 | Added P4: start-here, archive, topics, apps, Markdown-twin note |

---

## 4. Direction — APPROVED 2026-09-16 (DECISIONS.md, Decision 014)

**One shell, rendered from JSON, in the portfolio design system.**
Phases, each independently shippable and each ending in a
regenerate + one commit:

| Phase | Deliverable | Touches |
|---|---|---|
| P0 | `robots.txt`, `sitemap.xml`, absolute `og:url` fix in the *existing* post template | root + 3,651 posts |
| P1 | New `templates/post.html` (portfolio shell, JSON-LD, related posts, prev/next) + fragments composed at render | 3,651 posts |
| P2 | `scripts/render-archives.js`: homepage, `/page/N/`, year/month/day, category/tag/author | ~4,400 pages |
| P3 | `templates/page.html` for `pages.json`; feeds from JSON | 65 pages + 3 feeds |
| P4 | Retire `wp-includes/`, plugin/theme CSS+JS, stub routes; Markdown twins; `llms.txt` | −52 MB |
| P5 | Admin tools re-pointed at JSON + regenerate workflows | admin/* |

Decision items — **answered 2026-09-16** (see Decision 014 for the record):

- **D-1** Design: **portfolio system as-is** vs a refreshed variant.
- **D-2** Sidebar: **right rail on desktop, in-flow blocks on mobile**
  vs no sidebar (top nav + footer only).
- **D-3** Homepage pagination: **keep all 389 `/page/N/` URLs** (they
  are indexed) vs cap at 40 and rely on archives.
- **D-4** Markdown twins for AI/agents: **yes**.
- **D-5** Training bots (`GPTBot`, `ClaudeBot`, `Google-Extended`):
  **allow** vs block.
- **D-6** Delete WordPress runtime dirs after P1–P3: **yes** (needs a
  size-impact DECISIONS entry per CLAUDE.md).

---

## 5. Content Review Queue

Nothing here is changed by the loop. Ben approves items; approved
items get done in a later tick and moved to *Done*.

### A. Stale / placeholder pages (WordPress leftovers)
- ✅ A-1 `/sample-page/` — retire → redirect to `/`.
- ✅ A-2 `/contact-page/` — retire → redirect to `/meet/`.
- ✅ A-3 `/login/`, `/register/`, `/lostpassword/`, `/resetpass/`,
  `/logout/` — retire → redirect to `/`.
- ✅ A-4 `/services/contact/` — retired with `/services/*` under D-2 (noindex, out of nav).
- ✅ A-5 test pages — keep as-is (Ben).

### B. Navigation & identity
- ✅ (Ben 2026-09-17: redirect) A-7 `/__qs/6b00bc294368/` and `/__qs/d43bf345f897/`
  ("MailPoet Page" shortcode shells) → redirect to `/` via `page-rules.json`.
- ✅ (Ben: homepage sections) B-5 Old-menu items without a home yet: "Video Posts" (category
  `videos` + children), "Recommendations" (`recs` + children). The
  categories exist and render; should the homepage get a "Watch" /
  "Recommendations" section, or is the Topics rail enough?
- ✅ (Ben: redirect all to `/`) A-6 Empty WordPress shells now rendered noindex on the new shell:
  `/events/*` (5 pages, an events-plugin placeholder), `/jing-install-tutorial/`,
  `/nvu-install/`, `/nvu-linking-tutorial/` (video-embed pages whose
  embeds did not survive export), `/test-for-google-talk/`. Redirect to
  `/` like the other stubs, or keep as empty archive pages?
- ✅ B-1 One unified nav; blog-only items move to the blog landing page.
- ✅ B-2 Tagline kept verbatim.
- ✅ B-3 Header image dropped (typographic header).
- ✅ (Ben 2026-09-17: keep as-is) B-4 Unified footer shows GitHub / LinkedIn / Bluesky only.

### C. Archive fidelity
- ✅ (Ben 2026-09-17: normalize) C-0 Data shape — post `url`s were already all
  relative (validator enforces `path`); `pages.json` (72 pages) normalized
  to relative this tick, zero rendered-output change. `guid` stays absolute
  by design (RSS GUID guarantee).
- ✅ **Done tick 8 (Ben approved full scope)** C-4 **Mojibake — corrected scope: 2,615 posts (72%), not 33.**
  The first count matched the cp1252 form (`â€™`); the data holds the
  latin-1 form (`â\x80\x99`), which browsers render identically. Same
  double-encoded-UTF-8 defect, present since the export, heaviest in
  2010–2015 (2013: 1,024 posts; 2014: 1,145). Dry run with `ftfy`
  (encoding fixes only, no quote/whitespace/HTML normalization) changes
  4,528 fields; every introduced character is a curly quote (’ “ ” ‘
  ×13,500), dash (– — ×1,067), ellipsis (…×1,050), bullet, accented
  letter (é í ñ ú á …), emoji (🙂 🙁 🎁 😉), or an invisible BOM/object
  placeholder that was already there in broken form. No run without a
  mojibake lead byte changes. Ben approved 33; the loop stopped to ask
  again at this scope (tick 7).
- ✅ **Done tick 5** C-5 — 12 posts (2026 shard, written by `/new/`)
  stored `categories`/`tags` as plain string arrays (not stringified
  lists — earlier note over-read a `str()` dump). Normalized to
  `{name, slug, url}`; `admin/lib/mutate.js` (`taxonomyTerm`) and
  `/new/` now write that shape.
- ✅ **Done (P2 renderer)** C-9 **1,153 of 1,403 terms have no archive page** (WordPress exported
  only 432 of 1,365 tag pages and skipped 3 categories), so most tag
  links in post footers are 404s today. P2's renderer generates every
  term page from JSON; no permalink is lost (they never existed).
- ✅ **Done tick 29** C-11 Three posts embed WordPress plugin decoration images through the
  Jetpack CDN (`ckeditor…/spacer.gif`, `powerpress/play_video.png`,
  `black.png`); one 2009 post links a smilie GIF at a path that never
  existed. The plugin dirs are gone, so those images will 404 when the CDN
  refetches. Leave (they were decorative) or strip the `<img>` tags?
- ✅ **Done tick 29** C-10 Twelve "tags" in `taxonomies.json` are 2007 Technorati links
  (`http://technorati.com/tag/VSS2007` …). The renderer skips them;
  remove from the taxonomy and from the ~12 posts that carry them?
- ✅ **Done tick 29** C-8 `/category/Typewriter/` — capitalized slug created by `/new/`
  (all other terms are lowercase). The URL is live and protected; when
  the archive renderer lands, emit `/category/typewriter/` as canonical
  and keep `/category/Typewriter/` as a redirect. Same for 5 tags
  (`VSS2007`, `Sustainability`, `Reframability`, `Startup`,
  `Learning%20Twitter%20Scalability`).
- ✅ **Done tick 6** C-6 `taxonomies.json` display names were slugified on export
  (`C4c15`, `Im Learning`, `Askbenw`, `Lifewidelearning16`); the old
  menu had the real names (`#C4C15`, `What I'm Learning`, `#AskBenW`).
  Restore display names from the menu fragment where they exist?
- ✅ **C-1 resolved tick 26** — comments were in git, not lost;
  recovered and rendered (see Diagnostics → Comments).
- ✅ **Done (P0)** C-2 `og:url` is now the absolute permalink on every post.
- ✅ (Ben: re-point at render) C-3 Posts embedding `i0.wp.com` (Jetpack CDN) image URLs — Decision
  009 relies on this CDN; confirm still acceptable or re-point to
  `/wp-content/uploads/`.

### D. Content that may deserve an update (not rewrites — Ben decides)
- ✅ D-1 `/about/`, `/bio/` → redirect to `/portfolio/about/`.
- ✅ D-2 `/services/`, `/pd/` → retired (out of nav + sitemap, `noindex`, files kept).
- ✅ **Done tick 29** D-3 `/important-posts/` — a curated list; candidate for becoming
  the "start here" page in the new homepage.

### E. Media (from the media index, 2026-09-17)
- ✅ (Ben 2026-09-17: consolidate) E-1 **77 groups of byte-identical
  uploads** — 75 groups consolidated (the two E-2 pairs left alone):
  96 references in 4 shards rewritten to one canonical copy (podcast-
  referenced copy wins, then most-referenced, then the name without a
  `-N` suffix), 77 files removed (−68 MB), 22 posts + `full.xml`
  re-rendered, podcast feed unchanged. Old direct URLs of the removed
  copies now 404 (accepted). List kept in `docs/MEDIA-DUPLICATES.md`.
- E-2 **Same recording attached to two different episodes** —
  `DigitalStickyNotes.m4a` (2007) = `Feedback.m4a` (Question 59, 2010);
  `MyStudentsAreKnownFor.m4a` (2007) = `Preceding_Reputations.m4a`
  (2016). One of each pair is probably the wrong audio; Ben to check.
- E-3 **341 unreferenced uploads** (254 of them a July 2016 batch:
  `hqdefault-*.jpg` YouTube thumbnails, `cropped-*.jpg` header crops,
  etc.). Prune to shrink the repo? Library → "unreferenced", sort by
  largest.
- E-4 **120 broken references** remain after the backup recovery (2007
  `.doc` attachments, 2007–2016 images) — exist in no backup we have.
  Options per post: remove the dead link, or leave.

*(The loop appends to these lists as the audit continues; it never
resolves them on its own.)*

---

## 6. Tick log

- **2026-09-16 · tick 1** — Diagnostics (page counts, page weight,
  missing SEO files, comment loss, regeneration pipeline state).
  Research (AI/Google indexing, SSG options, archive patterns).
  Wrote this document, Decision 014 (proposed), `robots.txt`,
  `scripts/generate-sitemap.js` → `sitemap.xml`. Seeded review queue.
  Ben answered Decision 014 + all sub-decisions and the first queue
  batch the same day (recorded in Decision 014). Loop cadence set to
  5 minutes.
  **Next**: see tick 2.
- **2026-09-16 · tick 2** — Permalink guarantee shipped:
  `scripts/check-permalinks.js` (+ `database/permalinks.json`, 7,482
  URLs + 3,864 feed GUIDs; the list only grows). Negative test passes
  (hiding one post → exit 1). Wired as a gate before the commit step in
  `regenerate-posts.yml` and `regenerate-fragments.yml`.
  **Next**: see tick 3.
- **2026-09-16 · tick 3 (P0)** — `regenerate-posts.js` now composes
  `templates/fragments/*` into the zones at render time (root cause of
  template drift fixed). Per-post `og:type=article`, `og:title`,
  `og:url` (absolute), `og:description` + `<meta name=description>`
  derived from excerpt/body at render (content untouched),
  `article:published_time`, and a JSON-LD `BlogPosting` (headline,
  dates, author/publisher Person, first image, keywords). Regenerated
  all 3,651 posts; permalink check OK; 0 posts missing JSON-LD, 0 with
  the old `og:url`, JSON-LD parses on all 3,651.
  **Next**: see tick 4.
- **2026-09-16 · tick 4** — Mockups for Ben, rendered from real JSON
  content: `docs/mockups/post.html` ("On Not Reading the News"),
  `docs/mockups/home.html`, and `docs/mockups/site.css` (the refresh
  layer over `portfolio/css/style.css`: warm-paper light tokens, full
  dark mode, unified nav, content + sticky right rail, `.prose` styles
  for WordPress-era bodies, post lists with thumbnails, series grid,
  "on this day"). Verified desktop + 390px. Found and queued C-4
  (mojibake, 33 posts), C-5 (stringified taxonomy lists in new shards),
  C-6 (slugified taxonomy display names).
  Ben approved the mockups as-is, plus C-4/C-5/C-6 repairs.
  **Next**: see tick 5.
- **2026-09-16 · tick 5 (C-5)** — Normalized the 12 string-array
  taxonomy fields in `posts/2026.json`; fixed the two writers
  (`admin/lib/mutate.js` `upsertPost` → new `taxonomyTerm()`, and the
  inline entry builder in `/new/`). Regenerated 2026 posts (11 changed:
  they now carry `category-*`/`tag-*` classes and footer tag links),
  `recompute-database-stats.js --apply`, permalink check OK. Queued C-8
  (capitalized slugs).
  **Next**: see tick 6.
- **2026-09-16 · tick 6 (C-6)** — Harvested the original WordPress
  names and hierarchical URLs from the 259 existing archive pages
  (`Category: <span>…`). Repaired 107 terms in `taxonomies.json`
  (104 names such as `#C4C15`, `What I’m Learning`, `365 Questions
  That Google Can’t Answer`; 10 category URLs that were flat and
  404ing, e.g. `/category/c4c15/` → `/category/blogging-projects/c4c15/`)
  and propagated to 3,699 term entries in 2,850 posts. Regenerated all
  posts (2,850 changed), recomputed stats, permalink check OK, zero
  flat links remain. Found C-9 (1,153 terms with no archive page).
  **Next**: see tick 7.
- **2026-09-16 · tick 7 (C-4, paused)** — Dry-run only. Real scope is
  2,587 posts (see C-4). Verified the repair touches nothing but
  double-encoded runs. Waiting on Ben before applying.
  **Next**: see tick 8.
- **2026-09-16 · tick 8 (C-4 applied)** — Ben approved the full scope.
  `ftfy` encoding-only repair on 4,591 fields in 2,615 posts (one JSON
  line per field); all posts regenerated (2,615 changed), stats/search
  rebuilt, permalink check OK, 0 rendered posts still contain a
  double-encoded run.
  **Next**: see tick 9.
- **2026-09-16 · tick 9 (P1 shipped)** — `scripts/lib/shell.js` (shared
  helpers, no deps), `templates/post.html` on the approved design,
  `templates/partials/{nav,rail,footer}.html`, `/css/site.css` promoted
  from the mockup, `regenerate-posts.js` rewritten (same CLI; adds
  Markdown twins, related/prev/next, reading time; renders all 3,651
  posts in 2.1 s). Fluida template kept at `templates/legacy/`. Full
  regeneration: 3,651 posts + 3,651 `index.md`, permalink check OK,
  post pages total 45 MB (were ~500 MB), representative post 17 KB
  (was 92 KB) with one `<script>` (JSON-LD). Mixed state until P2: the
  homepage/archives are still Fluida.
  **Next**: see tick 10.
- **2026-09-16 · tick 10 (P2 shipped)** — `scripts/render-archives.js`
  + `templates/{home,archive}.html`: 4,970 listing pages in 2 s
  (home, 389 `/page/N/`, 2,024 date, 568 category, 1,596 tag, 391
  author, `/type/video/`), `WebSite`/`Person`/`Blog` JSON-LD on the
  homepage, `CollectionPage` elsewhere, `database/on-this-day.json`.
  Protected-URL coverage rule: 121 URLs the data no longer fills
  (`/page/367–390/`, `/author/user/*`, capitalized slugs) render as
  noindex aliases with canonical → the real page. `describe()` now
  strips a title echoed at the start of the body. Permalink list grew
  to 8,696 (+1,214 new term/day pages); sitemap 8,691 URLs. Only the
  66 static pages remain on Fluida.
  **Next**: see tick 11.
- **2026-09-16 · tick 11 (P3 shipped)** — 66 static pages rendered from
  `pages.json`: 11 redirects per the approved set (+ `/blog/`, `/home/`
  — WordPress's page-for-posts — → `/`), `/services/*` + `/pd/*` noindex,
  `/all-posts/` a real 3,651-link index by year, empty shells noindex
  (queued A-6). Sitemap honors `page-rules.json` (8,666 URLs). Applied
  the C-4 encoding repair to `pages.json` as well (16 pages, 25 fields —
  same defect, same approval, noted here explicitly). **No page on the
  site uses the Fluida theme any more.**
  **Next**: see tick 12.
- **2026-09-16 · tick 12 (feeds)** — `scripts/render-feeds.js` renders
  `feed/index.xml` (newest 50) and `feed/full.xml` (all 3,651; 10.9 MB,
  was 39 MB) from JSON with the original channel metadata and
  permalink GUIDs; feed-only transform makes `src`/`href` absolute for
  readers. Found the patch-in-place drift: 14 posts had never reached
  `full.xml`, and `index.xml` carried a GUID for a deduplicated post.
  Checker semantics: `index.xml` is a rolling window (its GUIDs must
  exist in `full.xml`); `full.xml` + podcast keep full retention (3,878
  GUIDs). Podcast feed untouched. Added `.github/workflows/render-site.yml`
  — the single pipeline (posts → archives → pages → feeds → stats →
  permalinks → sitemap → check → commit) the admin tools will dispatch.
  **Next**: see tick 13.
- **2026-09-16 · tick 13 (P4 shipped)** — Deleted `wp-includes/`,
  `wp-content/plugins/`, `wp-content/themes/` (−52 MB, D-6), the Fluida
  fragment machinery (`templates/fragments/`, `templates/legacy/`,
  `regenerate-fragments.js` + `.yml`, `add-zone-markers.js`,
  `capture-*.js`) and `docs/mockups/`. Verified beforehand: no rendered
  page, tool, or feed links a deleted local path (3 post bodies reference
  plugin images via the Jetpack CDN → C-11). Removed the dead Fluida font
  link from `/search/` and `/menus/`. Added `llms.txt`. Permalink check OK.
  **The repository no longer contains any WordPress code.**
  **Next**: see tick 14.
- **2026-09-16 · tick 14 (P5.1)** — `admin/regenerate/` ported (shell
  kept, internals swapped): edits `templates/partials/{nav,rail,footer}.html`
  instead of the deleted Fluida fragments; "Apply to site" and the
  Render panel dispatch `render-site.yml` (scope all/posts/archives/
  pages/feeds, year, single URL — `url` input added to the workflow).
  Fluida-only Menu tab hidden. Dashboard card retitled "Render Site".
  Loads with no console errors.
  **Next**: see tick 15.
- **2026-09-16 · tick 15 (Ben's requests)** — (1) Rail collapsed to one
  card: "Did you just meet Ben? — Save my contact, try my apps, and see
  how I build. Meet →". (2) Portfolio consistency: `/portfolio/*` and
  `/support.html` now load `/css/site.css` (dark/light) and carry
  `LIC:NAV`/`LIC:FOOTER` markers filled by the new `scripts/render-shell.js`
  from the same partials as the blog (active item chosen by URL);
  `/meet/` keeps its minimal bar but gets `site.css`. "Portfolio" added to
  the unified nav. `render-shell.js` runs in `render-site.yml`. Whole
  site re-rendered; permalink check OK.
  **Next**: see tick 16.
- **2026-09-16 · tick 16 (P5.2)** — `/new/` ported: the generate step
  now produces only the source of truth (post entry in
  `database/posts/YYYY.json` with canonical terms, uploaded images,
  changelog); the eight "output options" collapsed into one "render the
  site after publishing" toggle; publish commits the JSON and dispatches
  `render-site.yml` (scope=all) instead of writing Fluida HTML, patching
  seven archive pages and `feed/index.xml`, and triggering
  `update-rss.yml`. Loads with no console errors; inline scripts pass
  `node --check`. The now-unused generators (~1,400 lines:
  `generatePostHtml`, archive/RSS/taxonomy/manifest/search updaters)
  stay in the file until a simplify pass after the first real publish.
  **Next**: see tick 17.
- **2026-09-16 · tick 17 (P5.3)** — `/edit/` loads the body from the
  JSON source of truth (post shard or `pages.json`; HTML scrape only as
  fallback), saves title/body/excerpt back to it, and dispatches
  `render-site.yml` (`url` for posts, `scope=pages` for pages).
  `/remove/` no longer deletes anything: it sets a **tombstone**
  (`removed: true, removed_at`) on the shard entry and dispatches render;
  `regenerate-posts.js` turns a tombstoned permalink into a redirect to
  its year archive, listings/feeds/search skip it, and
  `check-permalinks.js` exempts only tombstoned GUIDs. Reversible by
  clearing the flag. Both tools pass `node --check`.
  Ben (2026-09-16): **the admin tools' look and feel must be updated
  too** — added as P5.5 below, started the same day.
  **Next**: see tick 17b.
- **2026-09-16 · tick 17b (P5.5 first pass)** — `admin/admin.css`:
  remaps the tools' shared CSS variables (`--bg-*`, `--accent`,
  `--text-*`, `--border-*`, rss-creator's `--sitebg` family) onto the
  site tokens with light + dark mode, site fonts, and restyles the
  WordPress-era chrome (masthead → BW brand bar, coffee header image
  removed, breadcrumbs muted, cards/inputs/buttons on tokens).
  `admin/admin-bar.js` injects a shared tool switcher. Both wired into
  all 13 tools (document `<head>` only — several tools embed HTML
  templates with their own `</head>`). Remove tool copy updated for
  tombstone semantics. Verified: dashboard, /new/, /remove/.
  **Next**: see tick 18.
- **2026-09-16 · tick 18 (P5.4)** — Retired `update-rss.yml`,
  `remove-from-rss.yml`, `regenerate-posts.yml` (only `render-site.yml`,
  `database-maintenance.yml`, `dedup-execute.yml` remain); removed the
  dead RSS dispatcher from `/remove/`; updated `admin/README.md`,
  `docs/SUBDOMAIN_ROLLOUT.md`, `admin/lib/feeds.js`. **Refreshed
  `CLAUDE.md`** for the JSON-rendered architecture (rendering, design
  system, feeds, tombstones, page rules, "edit JSON then render").
  **Next**: see tick 19.
- **2026-09-16 · tick 19 (P5.5b)** — `admin/admin.css` extended for the
  second markup family (`/podcast-rss/`, `/links/`, `/search/`:
  Fluida-imitating `#access` nav, `#header-image-main img`, `#content`,
  `.page-title`, `.notice-box`, `.tabs`, stats panels, tables) plus the
  hard-coded light-blue panels in `/links/` and `/rss-creator/`. Verified
  by contact sheet in dark mode: no coffee headers left, panels and
  alerts on tokens in all 13 tools.
  **Next**: see tick 20.
- **2026-09-16 · tick 20 (P5.6)** — `/search/` rebuilt as a site page:
  hero with the search form and filters, results and pagination styled
  on the tokens, top categories/tags as a "browse" section, rail from
  the partial (`render-shell.js` now fills `LIC:RAIL` and covers
  `search/`). Engine untouched except: skips tombstoned posts, accepts
  `?q=`. Verified live query in the browser (28 results, highlights,
  no console errors).
  **Next**: see tick 21.
- **2026-09-16 · tick 21 (tool audit)** — Ben decided: retire `/menus/`
  and `/rss-creator/` (superseded by Render Site and `render-feeds.js`);
  port `/update/` to JSON. Both retired tools are now redirects to
  `/admin/regenerate/`, removed from the dashboard, admin bar and
  `CLAUDE.md`. 11 tools remain.
  **Next**: see tick 22.
- **2026-09-16 · tick 22 (P5.7)** — `/update/` ported to JSON: scope is
  all posts / one year / static pages; records are `{url, shard,
  content}` from the shards (tombstones excluded); raw-text rules run
  on the content string, DOM rules on the fragment wrapped in a
  document and unwrapped after; changed records fold back into their
  shard, and the existing IndexedDB → blob → tree commit machinery
  commits the shard files; `render-site.yml` is dispatched on success.
  Smoke-tested in the browser: 2026 scan → 15/17 records → one pending
  `database/posts/2026.json` (valid, 15 records stamped). Rules UI,
  preview and resume are untouched.
  **Next**: see tick 23.
- **2026-09-16 · tick 23 (`/new/` simplify)** — AST-based dead-code
  pass (`scripts/dev-deadcode.mjs`, acorn in a scratch dir, dev-only):
  removed 23 unreferenced functions (archive/RSS/taxonomy/manifest/
  search generators, Fluida article builders) plus `generatePostHtml`,
  `renderPostFromTemplate`, `siteComponents`, `pendingRssWorkflow`.
  3,570 → 2,245 lines. Tool loads with no console errors; all live
  entry points present.
  **Next**: see tick 24.
- **2026-09-16 · tick 24 (podcast + links audit)** — Both already read
  the JSON shards (the podcast tool scans `post.content` for PowerPress
  embeds and writes `feed/podcast/feed.xml` directly — correct, that
  feed is its own artifact). Only gap: tombstones. `/podcast-rss/`,
  `/links/` and the shared `admin/lib/database.js` (`isLive`,
  `fetchAllPosts`) now skip removed posts. All 11 tools are on the JSON
  pipeline; P5 is complete.
  **Next**: see tick 25.
- **2026-09-16 · tick 25 (simplify scripts/templates)** —
  `templates/partials/head.html` (icons, fonts, stylesheets) replaces
  the block duplicated in the four page templates via `{{head_common}}`;
  `NON_PUBLIC_DIRS` in `shell.js` replaces the two copies in
  `generate-sitemap.js`/`check-permalinks.js`; `signalTerms()` replaces
  the hand-written noise filters in the post renderer. Posts render
  byte-identical; archives/pages gained the `apple-touch-icon` line
  (4,997 files) — the only diff.
  **Next**: see tick 26.
- **2026-09-16 · tick 26 (decisions + comment recovery)** — Ben
  answered A-6 (redirect all to `/`), B-5 (homepage sections), C-3
  (re-point images at render), and corrected C-1: comments were
  hard-coded in the HTML. Verified in git: 1,079 posts had threads at
  the initial commit; stripped by the first M4 regen. Recovered 7,132
  comments on 1,043 posts into the JSON (`scripts/recover-comments.js`),
  rendered under posts (`{{comments}}`, threaded, read-only, JSON-LD
  `commentCount`), all posts regenerated, permalink check OK.
  **Next**: see tick 27.
- **2026-09-16 · tick 27 (A-6 + C-3)** — A-6: 9 empty WordPress shells
  (`/events/*`, three tutorial pages, the Google Talk test) are now
  redirects to `/` via `page-rules.json` (20 redirects, 10 noindex).
  C-3: `selfHostImages()` in `shell.js` re-points Jetpack-CDN
  references to *own* uploads at their self-hosted path when the file
  exists — applied in post pages, Markdown twins, comments, static
  pages and both feeds. 458 of 468 distinct paths re-pointed; the 10
  with no local file (URL-encoded `+` names from a 2015 import) and all
  third-party images proxied via the CDN (Zemanta, Skitch, S3, Flickr)
  stay on the CDN. 267 posts changed. Permalink check OK.
  **Next**: see tick 28.
- **2026-09-16 · tick 28 (B-5 + missing parent categories)** — Found
  that 9 category URLs (`/category/videos/`, `/category/recs/`,
  `/category/blogging-projects/`, `/category/tutorials/` and five
  children) had no `taxonomies.json` entry, so they were serving as
  homepage aliases. Added them (`hierarchical: true`, names from the
  old menu), taught `recompute-database-stats.js` to keep parents and
  count their subtree (Video Posts 74, Recommendations 215, Blogging
  Projects 521); the archive renderer already includes descendants, so
  they are real pages now (+73 category pages). Homepage gained
  **Watch** (latest video posts) and **Recommendations** (latest + the
  sub-category chips). Permalink list re-snapshotted; sitemap rebuilt.
  **Next**: see tick 29.
- **2026-09-16 · tick 29 (C-8, C-10, C-11, D-3 — all approved)** —
  C-10: 12 Technorati pseudo-tags removed from the taxonomy and 15 post
  tag entries. C-8: the five odd tag slugs were those same Technorati
  entries; `Typewriter` → `typewriter` (canonical page at the lowercase
  URL, `/category/Typewriter/` kept as an alias with canonical). C-11:
  4 dead plugin `<img>` tags stripped from 4 post bodies (approved
  content edit; text untouched). D-3: homepage "Start here" now renders
  the links found in `/important-posts/` (5 resolve to live posts;
  the rest of that list point at pages/external URLs). Rail Topics now
  include the restored parent categories. Everything re-rendered,
  permalink list 8,771, sitemap 8,741, check OK.
  **Next**: see tick 30.
- **2026-09-16 · tick 30 (final review)** — Lighthouse (desktop) on the
  homepage, a post, a category page and a portfolio page: initial
  findings were list-date contrast (`--color-light`), the white-on-teal
  primary button, the rail's `<h3>` skipping a level, undecorated
  in-text links and a badge color on the portfolio, and a `favicon.ico`
  404. Fixed at the token/partial level (`--btn-bg/--btn-fg`, darker
  `--color-light` in both modes, rail `<h2>`, underlined text links,
  `favicon.ico` + `apple-touch-icon.png`). Result: **all four pages
  100 / 100 / 100 on accessibility, best practices, SEO; perf 99–100.**
  Wrote `scripts/README.md`; refreshed SCRATCHPAD "Current State".
  **Program complete.** Remaining items are optional (SCRATCHPAD).
- **2026-09-16 · tick 31 (C-12, post-completion check)** — Live-site
  check found `/meet/` had never received `site.css` (tick-15 edit did
  not persist) — fixed. Also found **Jetpack chrome inside the JSON
  content of 3,629 posts** (empty share bar, "Like or Reblog" wrapper
  pointing at widgets.wp.com, empty related-posts div — captured by the
  M4 backfill). Ben approved stripping them: 7,271 share blocks and
  3,627 empty related divs removed, no other bytes changed; two posts
  whose related div wraps a PowerPress player were left intact. Three
  title-only posts (empty body in the original export) now render
  instead of being skipped. `feed/full.xml` 10.8 → 8.8 MB. Zero
  `widgets.wp.com` references remain anywhere rendered.
  **Next**: see Program 2.

---

## 7. Program 2 — LiC Admin (Decision 015, approved 2026-09-16)

One admin application on the JSON model; phases A0–A5 in
`DECISIONS.md`. Same tick discipline as Program 1. Status lines are
appended here as ticks complete.

- **2026-09-16 · A0 done** — `database/schema.json` (post/page/term/
  comment + `status`, `removed`, `bluesky`), `scripts/validate-database.js`
  (zero deps; gate in `render-site.yml` before rendering). Running it
  surfaced and fixed: C-0 (3,639 absolute post URLs → site-relative),
  stale `count` in 12 shards, and 8 comments with WordPress's zero
  date (now `date: null`, renderer omits the timestamp). Database
  validates with 0 errors / 0 warnings. `scripts/lib/core.js` (192
  lines, no Node imports — runs in the browser) split out of
  `shell.js` (Node adapter, re-exports core); renders byte-identical.
- **2026-09-16 · A1 done** — `admin/app/` shell: hash router + view
  registry (`app.js`), `app.css` on the admin tokens, **Render** view
  (dispatch `render-site.yml` with scope/year/url/dry-run; recent runs
  with status, duration, links; live step progress for a running job,
  polled via the Actions API) and **Settings** view (fine-grained token
  guidance, repo/branch/committer, remember-toggle, Bluesky handle +
  app password for A4, "Test connection" showing access level + rate
  limit). Built on `admin/lib/` — added `listWorkflowRuns`,
  `getRunJobs`, `getRateLimit`, Bluesky settings fields — rather than a
  new client. Posts/Pages/Terms/Media are placeholders linking to the
  legacy tools until A2. Admin bar links to the app. No console errors.
- **2026-09-16 · A1.5 (security, Ben's request)** — `admin/lib/vault.js`
  encrypted token vault (AES-GCM, PBKDF2 310k), wired into the app
  (token resolution: unlocked vault → legacy plaintext), Lock/Unlock in
  the app bar, Settings stores token+passphrase encrypted, "Forget
  token". Round-trip tested in the browser. Decision 016 recorded:
  GitHub App sign-in via a Cloudflare Worker is next (A1.6), created
  through Chrome per Ben's authorization.
- **2026-09-16 · A1.6 code done, creation pending Ben's 2FA** —
  `workers/github-auth/worker.js` (+ README), `admin/lib/oauth.js`
  (redirect flow with state check, sessionStorage session, silent
  refresh), `CONFIG.auth` slots, token resolution order sign-in → vault
  → plaintext, "Sign in with GitHub" in Settings (shows "not configured"
  until the App exists). Creating the App hit GitHub's sudo-mode 2FA
  prompt, which only Ben can approve.
- **2026-09-16 · A1.6 progress** — GitHub App **created**
  (`learning-is-change-admin`, Client ID `Iv23liDVNY6QG2siOarv`;
  callbacks for the site and localhost, webhook off, Contents +
  Actions read/write, Metadata read, expiring tokens, this account
  only). Cloudflare dashboard needs Ben's sign-in — blocked there.
- **2026-09-16 · A2.1 done** — `admin/app/store.js` (manifest,
  taxonomies, pages, parallel shard loading with ETag cache,
  `posts()`/`post(url)`, `savePost`/`savePage` via Git Data commits
  with canonical terms) and the **Posts** view (search over title/URL/
  body, year/category/status filters, 50-per-page, edit links to
  `#/posts/edit/<url>`). Verified: 3,651 posts, filters correct.
- **2026-09-16 · A2.2 done** — post editor at `#/posts/edit/<url>`:
  title, date, status, category/tag pickers (shared `admin/lib/pickers.js`),
  body (shared `RichEditor`, Visual/HTML tabs), excerpt; **exact
  preview** in a sandboxed iframe rendered by `renderPostPage()` — the
  post-page assembly moved from `regenerate-posts.js` into
  `scripts/lib/core.js` so Node and the browser run the same function
  (renders verified byte-identical); Save = `store.savePost` (Git Data
  commit) + optional `render-site.yml` dispatch for that URL. Verified
  live preview updates (title, JSON-LD, self-hosted image) with no
  console errors. Save not exercised (needs a token).
- **2026-09-16 · A2.3 done** — **Pages** view (list with routing
  status from `page-rules.json`; editor with exact preview via
  `renderStaticPage()`, moved into `core.js` from `render-pages.js`,
  byte-identical) and **Terms** view (categories/tags with counts and
  parent flags; rename display name → taxonomies + every post's term
  entries in one commit + render). No console errors. Queue: A-7 a
  MailPoet plugin page at `/__qs/6b00bc294368/` sits in `pages.json` —
  retire → redirect?
- **2026-09-16 · A2.4 done** — **Media** view + `admin/app/media.js`:
  drag/drop or pick images; decoded with `createImageBitmap`, resized
  to 1600w + 800w on an `OffscreenCanvas`, encoded WebP (JPEG fallback),
  optional original kept; committed to `wp-content/uploads/YYYY/MM/`
  via Git Data; a responsive `<figure><img srcset …>` snippet to paste.
  Verified: 652 KB JPEG → 335 KB + 138 KB WebP in ~0.4 s, no console
  errors. All six views exist; only Bluesky (A4) and drafts/scheduling
  (A3) remain of the v1 scope, plus the auth hand-off.
- **2026-09-16 · A3 done** — drafts + scheduled publishing.
  `isPublished()` in `shell.js` (not removed, not `status: draft`, not
  future-dated in UTC) drives every renderer; hidden posts whose URL is
  protected render as redirect pages, never-shipped ones get no file;
  `check-permalinks.js` exempts hidden GUIDs. `render-site.yml` gains a
  daily `schedule` (06:17 UTC) that publishes due posts and refreshes
  "on this day"; inputs default to a full apply on scheduled runs.
  Posts view: Scheduled filter + status dots; editor shows a
  Draft/Scheduled/Published line. Simulated draft + scheduled + never-
  shipped posts: 2 redirects, 1 no-file, permalink check OK; reverted.
- **2026-09-16 · A4 done** — Bluesky. `admin/lib/bluesky.js`
  (createSession with app password against bsky.social, `crossPost` with
  a link facet + external-embed card, grapheme-safe clipping, public
  `getThread`). Editor: "Post to Bluesky" (text prefilled with title +
  URL) → saves `bluesky: { uri, cid, url, posted_at }` on the record and
  dispatches a render. Renderer: `regenerate-posts.js` prefetches the
  thread for every cross-posted post (public API, no auth; `--no-bluesky`
  to skip) and `renderBlueskyThread()` in `core.js` renders replies as a
  read-only nested list under the post ("N replies on Bluesky" + a
  reply link); the recovered WordPress threads stay as the archived
  section. Verified against a real thread from Ben's account (4 replies,
  nested). Templates byte-identical when no cross-post exists.
  **v1 scope of Decision 015 is complete except the GitHub-App sign-in
  hand-off (Cloudflare) and A5 (retiring the legacy tools).**
- **2026-09-16 · A1.6 progress** — GitHub App **installed** on
  `bhwilkoff/LearningIsChange` only (installation 162330000). Client ID
  recorded in `CONFIG.auth`; sign-in stays disabled until `worker` is set.
- **2026-09-17 · A1.6 Worker deployed** — Ben signed in to Cloudflare;
  Worker `lic-github-auth` created from the Hello-World template and its
  source replaced with `workers/github-auth/worker.js` via the dashboard
  editor (pasted from the clipboard, 0 lint errors). Variables:
  `GITHUB_CLIENT_ID`, `ALLOWED_ORIGINS=https://learningischange.com,
  http://127.0.0.1:8765` (plain), `GITHUB_CLIENT_SECRET` (encrypted
  secret; generated on the App page, moved clipboard → Cloudflare,
  clipboard cleared). Verified from the shell: `GET /` → 404 with CORS
  headers; `POST /token {}` from the site origin → `{"error":"code
  required"}`. `CONFIG.auth.worker` set; the Settings view now shows
  "Sign in with GitHub" and the redirect to GitHub's consent screen
  works (state + `redirect_uri=http://127.0.0.1:8765/admin/app/`).
  GitHub disables **Authorize** while the tab is hidden, so the final
  click is Ben's.
- **2026-09-17 · A1.6 done — sign-in verified end to end.** From
  `https://learningischange.com/admin/app/#/settings`: Sign in with
  GitHub → consent screen (Ben clicked Authorize) → redirect with
  `code`+`state` → Worker `/token` exchange → `ghu_` user-to-server
  token (8 h) + refresh token (6 months) in sessionStorage, code scrubbed
  from the URL. Settings shows "✓ Signed in with GitHub … refreshes
  automatically"; Test connection: `bhwilkoff/LearningIsChange (write
  access) · rate limit 5000/5000`. No PAT involved. **Decision 016 is
  fully delivered**; the vault/PAT path remains as the fallback.
- **2026-09-17 · Content Review Queue cleared** — Ben answered the
  three open items: A-7 MailPoet shells → redirect to `/`
  (`page-rules.json`, 2 pages re-rendered as redirects, sitemap
  regenerated); B-4 footer stays GitHub / LinkedIn / Bluesky; C-0
  `pages.json` URLs normalized to site-relative (72 pages; every
  consumer already stripped the origin and `mutate.js` writes relative).
  Stale entries ticked: A-4 (retired under D-2), C-2 (og:url absolute),
  C-9 (term pages rendered). Verified: validate OK, `render-pages` dry
  run 0 changes, `render-archives` unchanged relative to before, permalink
  gate OK (8,771 URLs, 3,878 GUIDs). **§5 has no open items.**
- **2026-09-17 · Sign-in gate** — Ben: "I don't see the requirement to
  login via GitHub on any of the admin pages." True: auth only applied
  at write time. Now LiC Admin renders a sign-in gate (Sign in with
  GitHub / Unlock with passphrase / paste a token in Settings) until a
  credential exists (`ctx.authed()`: refreshed OAuth session, unlocked
  vault, or saved token); nav is hidden while signed out; a **Sign out**
  button drops the session, locks the vault and forgets a remembered
  token. `admin/admin-bar.js` gates the dashboard and all nine legacy
  tools the same way (replaces the page with a sign-in card that hands
  off to `/admin/app/?next=<tool>`; the app stashes `next` across the
  GitHub round-trip and returns). `/search/` is public and untouched.
  Verified locally: `/new/` → gate → LiC Admin → GitHub (no consent
  screen on re-auth) → Worker → back on `/new/`; Sign out → gate.
  Client-side gate on a static host — GitHub rejecting writes without a
  token remains the real enforcement; the JSON it reads is public anyway.
- **2026-09-17 · Media library** — Ben: "Is there any way that all of
  the media being stored by the repository can be displayed on the media
  page so that I can see what media is being used where on the site?"
  `scripts/index-media.js` walks `wp-content/uploads/` (1,030 files,
  1.3 GB; 1,020 originals once resize variants fold in), reads image
  dimensions from file headers, and scans post/page bodies, the podcast
  feed and the hand-written shell for references → `database/media.json`
  (460 KB; runs in `render-site.yml` after stats). Result: 679 used,
  341 unreferenced (254 of them a 2016 batch), 142 referenced-but-missing
  (2007 `.doc` attachments, 2014 `.m4a` episodes that never left
  WordPress — listed with their referring posts). Media view gains a
  Library: stat chips (used / unreferenced / broken / by kind), search,
  kind/year/usage filters, sort (newest, largest, most used), 48-per-page
  grid with thumbnails (smallest variant when one exists), "Used in N"
  expanding to post/page/podcast referrers with edit + view links, Copy
  URL. Nothing deletes. Also: hash router now ignores `?query`
  (`#/media?use=missing`), and the tag/category pickers
  (`admin/lib/pickers.js`) lost their hard-coded light colours — chips,
  input, and suggestions are token-based and follow dark/light (Ben).
- **2026-09-17 · Media recovered from backup (Decision 017)** — Ben
  pointed at his backup drive; the July 2016 site tarball (truncated)
  held 41 of the 142 broken references and the loose backups one more.
  Restored the 22 a browser can use: 16 podcast episodes (2014 `.m4a`),
  an `.m4v`, an `.flv`, two images, a text file, `2007/08/top-5.doc`
  (+190 MB). Skipped 20 Flash `.swf` screencasts. Broken references
  142 → 120; the rest exist in no backup. Library summary now 1,052
  files / 700 used.
- **2026-09-17 · Duplicate uploads consolidated (E-1)** — see queue
  §E. Also fixed a determinism bug found on the way: comment and
  Bluesky-reply dates were formatted in the machine's local timezone, so
  the daily UTC render on Actions and a local Mountain-time render
  disagreed on ~400 posts (a day off around midnight UTC). Both
  `toLocaleDateString` calls in `core.js` now pin `timeZone: 'UTC'`;
  local dry run against the committed HTML is back to zero drift.
  Derivative image sizes checked per Ben's question: only 11 WordPress
  resize variants survive in the repo (912 KB), all referenced directly
  and 3 without an original — nothing to reclaim.
- **2026-09-17 · Ben's first post through the new stack, and A5** — Ben
  published "If you give a man a movement" and hit three things: (1) the
  homepage showed no image for it — listings only gave thumbnails to
  image-only posts; now any post whose lead image is a self-hosted
  ≥400×300 file per `media.json` gets one (217 older posts gain thumbs;
  `thumbImage()` in core.js prefers the smallest srcset candidate;
  `index-media.js` now runs before archives). (2) His GitHub sign-in
  "didn't stick" — because LiC Admin's **New post** button still opened
  the legacy `/new/`, which only knows its own token. The app now has its
  own create flow (`#/posts/new`: slug from title, URL preview, duplicate
  check, `savePost` unshift verified with a mocked commit), **Insert
  image…** in the editor (WebP 1600/800 + srcset committed via the Media
  pipeline), **Remove/Restore post** (tombstone) in the editor, silent
  OAuth refresh before a save can fail, and the hash route survives the
  sign-in round-trip. (3) No drafts/autosave — every edit is now
  autosaved to localStorage per URL (600 ms debounce) and offered back
  with a Discard button on return; Save clears it; Draft status already
  existed. Also: the post's 5.3 MB JPEG re-encoded to the 1600/800 WebP
  pair (439 + 136 KB) and the record repointed; the stale shard `count`
  from `/new/` fixed. **A5 done**: `/admin/ /new/ /edit/ /remove/
  /update/ /links/ /admin/regenerate/ /admin/dedup/
  /admin/db-maintenance/` are redirects into LiC Admin; their workflows
  (`dedup-execute.yml`, `database-maintenance.yml`) removed;
  `/podcast-rss/` stays until the podcast feed renders from JSON.
- **Next**: port the podcast feed to the renderer (episodes = posts with
  an audio enclosure; keep GUIDs) and retire `/podcast-rss/`; then
  Content Review Queue §E (E-2 mismatched audio, E-3 unreferenced
  uploads, E-4 broken references) as Ben decides.
