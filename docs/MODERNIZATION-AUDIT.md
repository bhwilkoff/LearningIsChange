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

The archive holds **no comment threads**. `comment_count` is 0 in
`pages.json`, `feed/full.xml` has no `<wp:comment>` elements, and
only 2 of 5,657 year-dir pages contain comment markup. Comments were
lost upstream of this repo (or never exported). *Consequence*: the
CLAUDE.md rule about preserving comment threads has nothing to
protect; the Wayback Machine is the only possible recovery path
(→ queue item C-1).

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
| Post pages (3,651) | 🟨 | New `templates/post.html` on portfolio system; fragments composed at render; JSON-LD `BlogPosting`; related posts; Markdown twin |
| Homepage + `/page/N/` (389) | 🟨 | JSON-rendered; "on this day"; latest; portfolio cross-link; consider capping pagination at ~40 pages + sitemap covering the rest |
| Year / month / day archives (2,006) | 🟨 | JSON-rendered; `/YYYY/` becomes year-in-review; keep month/day URLs |
| Category / tag / author (1,359) | 🟨 | JSON-rendered `CollectionPage`; series treatment for project categories |
| Static pages (65) | 🟨 | Rendered from `pages.json` through a `page.html` template; several are WordPress-era placeholders (→ queue) |
| Portfolio (`/portfolio/*`) | 🟩 | Reference design; minor: shared nav should come from one fragment |
| `/support.html`, `/meet/` | 🟩 | Already on the portfolio system |
| Feeds (`feed/index.xml`, `full.xml`, podcast) | 🟨 | Render from JSON; keep GUIDs; drop the patch-in-place workflows |
| Search (`/search/`) | 🟨 | Keep engine; reskin on the portfolio system |
| Masthead / sidebar / colophon / footer fragments | 🟨 | Replaced by new shell partials; the fragment mechanism stays |
| `wp-includes/`, `wp-content/plugins/`, `wp-content/themes/` | ⛔ | 52 MB of runtime nobody executes once templates change; delete after conversion (needs DECISIONS entry) |
| `wp-content/uploads/` (1.3 GB) | ⬜ | Stays (media); size workstream is separate (SCRATCHPAD M2) |
| WordPress stub routes (`/login/`, `/register/`, `/lostpassword/`, `/resetpass/`, `/logout/`, `/wp-json/…` links) | ⛔ | Should 404 or redirect; audit next tick |
| Admin tools (10) | ⬜ | Each becomes "edit JSON → regenerate"; audit per-tool once renderers exist |
| `robots.txt`, `sitemap.xml` | 🟩 | Added 2026-09-16 (`scripts/generate-sitemap.js`) |
| `llms.txt` | ⬜ | Optional; write after the new homepage exists |

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
- A-4 `/services/contact/` (nav "Contact") — verify it isn't also a
  shortcode shell.
- ✅ A-5 test pages — keep as-is (Ben).

### B. Navigation & identity
- ✅ B-1 One unified nav; blog-only items move to the blog landing page.
- ✅ B-2 Tagline kept verbatim.
- ✅ B-3 Header image dropped (typographic header).
- B-4 Footer social links: blog has Facebook + Twitter; portfolio has
  GitHub / LinkedIn / Bluesky. Twitter → archive link?

### C. Archive fidelity
- C-0 Data shape: `posts/YYYY.json` stores `url` as absolute on 3,639
  posts and relative on 12 (the ones written by `/new/`). Normalize
  to relative in a maintenance pass? (Renderers must tolerate both
  until then; `generate-sitemap.js` already does.)
- ⚠️ C-4 **Mojibake — corrected scope: 2,587 posts (71%), not 33.**
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
- C-9 **1,153 of 1,403 terms have no archive page** (WordPress exported
  only 432 of 1,365 tag pages and skipped 3 categories), so most tag
  links in post footers are 404s today. P2's renderer generates every
  term page from JSON; no permalink is lost (they never existed).
- C-8 `/category/Typewriter/` — capitalized slug created by `/new/`
  (all other terms are lowercase). The URL is live and protected; when
  the archive renderer lands, emit `/category/typewriter/` as canonical
  and keep `/category/Typewriter/` as a redirect. Same for 5 tags
  (`VSS2007`, `Sustainability`, `Reframability`, `Startup`,
  `Learning%20Twitter%20Scalability`).
- ✅ **Done tick 6** C-6 `taxonomies.json` display names were slugified on export
  (`C4c15`, `Im Learning`, `Askbenw`, `Lifewidelearning16`); the old
  menu had the real names (`#C4C15`, `What I'm Learning`, `#AskBenW`).
  Restore display names from the menu fragment where they exist?
- C-1 Comments are gone from the whole archive. Attempt Wayback
  Machine recovery for high-traffic posts? (Effort: high; value:
  historical.)
- C-2 `og:url` is `/` on every post — will be fixed in P0, listed
  here for the record.
- C-3 Posts embedding `i0.wp.com` (Jetpack CDN) image URLs — Decision
  009 relies on this CDN; confirm still acceptable or re-point to
  `/wp-content/uploads/`.

### D. Content that may deserve an update (not rewrites — Ben decides)
- ✅ D-1 `/about/`, `/bio/` → redirect to `/portfolio/about/`.
- ✅ D-2 `/services/`, `/pd/` → retired (out of nav + sitemap, `noindex`, files kept).
- D-3 `/important-posts/` — a curated list; candidate for becoming
  the "start here" page in the new homepage.

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
  **Next**: if approved, apply C-4 (rewrite shards, regenerate 2,587
  posts, permalink check, commit); then P1: promote
  `site.css` to `/css/site.css`, write the real `templates/post.html`
  on the new shell (fragments become nav/rail/footer partials), extend
  `regenerate-posts.js` (related posts, prev/next, reading time,
  Markdown twin), regenerate, permalink check, commit.
