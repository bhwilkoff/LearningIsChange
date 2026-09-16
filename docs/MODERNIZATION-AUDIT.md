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
- A-4 `/services/contact/` (nav "Contact") — verify it isn't also a
  shortcode shell.
- ✅ A-5 test pages — keep as-is (Ben).

### B. Navigation & identity
- B-5 Old-menu items without a home yet: "Video Posts" (category
  `videos` + children), "Recommendations" (`recs` + children). The
  categories exist and render; should the homepage get a "Watch" /
  "Recommendations" section, or is the Topics rail enough?
- A-6 Empty WordPress shells now rendered noindex on the new shell:
  `/events/*` (5 pages, an events-plugin placeholder), `/jing-install-tutorial/`,
  `/nvu-install/`, `/nvu-linking-tutorial/` (video-embed pages whose
  embeds did not survive export), `/test-for-google-talk/`. Redirect to
  `/` like the other stubs, or keep as empty archive pages?
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
- C-9 **1,153 of 1,403 terms have no archive page** (WordPress exported
  only 432 of 1,365 tag pages and skipped 3 categories), so most tag
  links in post footers are 404s today. P2's renderer generates every
  term page from JSON; no permalink is lost (they never existed).
- C-11 Three posts embed WordPress plugin decoration images through the
  Jetpack CDN (`ckeditor…/spacer.gif`, `powerpress/play_video.png`,
  `black.png`); one 2009 post links a smilie GIF at a path that never
  existed. The plugin dirs are gone, so those images will 404 when the CDN
  refetches. Leave (they were decorative) or strip the `<img>` tags?
- C-10 Twelve "tags" in `taxonomies.json` are 2007 Technorati links
  (`http://technorati.com/tag/VSS2007` …). The renderer skips them;
  remove from the taxonomy and from the ~12 posts that carry them?
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
  **Next**: audit the remaining tools against the JSON pipeline —
  `/menus/` (edited Fluida menus; fold into Render Site's partial editor
  or retire with a redirect), `/update/` (Mass Updater: its find/replace
  over HTML now needs to target JSON content), `/rss-creator/`
  (superseded by `render-feeds.js` — retire or keep as a preview tool);
  then the `/new/` simplify pass. promote
  `site.css` to `/css/site.css`, write the real `templates/post.html`
  on the new shell (fragments become nav/rail/footer partials), extend
  `regenerate-posts.js` (related posts, prev/next, reading time,
  Markdown twin), regenerate, permalink check, commit.
