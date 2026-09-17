# scripts/ — the site generator

`database/` is the source of truth; everything under a public URL is
derived by these scripts. No dependencies beyond Node ≥ 20.

| Script | Reads | Writes | Notes |
|---|---|---|---|
| `regenerate-posts.js` | `database/posts/*.json`, `templates/post.html`, `templates/partials/*` | `YYYY/MM/DD/slug/index.html` + `index.md` | Related posts, prev/next, reading time, comments, JSON-LD; tombstones → redirect pages. `--year=`, `--url=`, `--diff`, `--no-md` |
| `render-archives.js` | posts, `taxonomies.json`, `permalinks.json` | `/`, `/page/N/`, date/category/tag/author pages, `database/on-this-day.json` | Every protected archive URL the data no longer fills becomes a noindex alias of the nearest real page |
| `render-pages.js` | `pages.json`, `page-rules.json` | static pages, redirect pages, `/all-posts/` | Rules: `redirects`, `noindex` |
| `render-feeds.js` | posts, `database/podcast.json` | `feed/index.xml`, `feed/full.xml`, `feed/podcast/feed.xml` | Permalink GUIDs; podcast episodes = posts with a `podcast` field (GUID = post URL, enclosure length from disk) |
| `render-shell.js` | `templates/partials/*` | nav/rail/footer inside `portfolio/*`, `support.html`, `meet/`, `search/` | Fills `LIC:NAV/RAIL/FOOTER` markers in hand-authored pages |
| `recompute-database-stats.js` | posts | `manifest.json`, `taxonomies.json`, `search.json` | Keeps hierarchical parent categories |
| `check-permalinks.js` | tree, feeds, `database/permalinks.json` | (check) / `--snapshot` grows the list | The guarantee: exit 1 if any URL ever shipped stops resolving or a `full.xml` GUID disappears (tombstones exempt) |
| `generate-sitemap.js` | tree, `page-rules.json` | `sitemap.xml` | Excludes tooling, redirects, noindex |
| `recover-comments.js` | git (`582b036dd3`) | `comments[]` on post entries | One-off; kept because it documents where comments came from |
| `make-meet-qr.py` | `CONTACT` in the script | `meet/*.vcf`, `meet/qr-*.svg` | `pip install segno` |
| `dev-deadcode.mjs` | an admin tool | (report / `--apply`) | Dev-only; needs acorn in a scratch dir |
| `backfill-posts-content.js`, `dedup-date-archives.js`, `prune-archive-listings.js` | — | — | Historical (M3/M4 migration); safe to leave |
| `index-media.js` | `wp-content/uploads/**`, posts, pages, `feed/podcast/feed.xml`, shell files | `database/media.json` | Every upload with size, image dimensions and *where it is used* (post/page/podcast/site); resize variants fold into the original; referenced-but-missing paths listed. Powers the Media library in LiC Admin. `--apply` |
| `ocr-transcripts.js` | image-only posts, `wp-content/uploads/**` | `transcript` on the post record | OCR for typewritten pages: Apple Vision on macOS (`scripts/ocr/vision-ocr.swift`), tesseract on the Actions runner (automatic for any new image-only post); paragraphs from line geometry; `transcript_source: edited` is never overwritten. `--apply`, `--url=`, `--force`, `--engine=` |

## The whole pipeline

```
node scripts/regenerate-posts.js --apply
node scripts/render-archives.js --apply
node scripts/render-pages.js --apply
node scripts/render-feeds.js --apply
node scripts/render-shell.js --apply
node scripts/recompute-database-stats.js --apply
node scripts/check-permalinks.js --snapshot
node scripts/generate-sitemap.js --apply
node scripts/check-permalinks.js          # must print OK before committing
```

That is exactly what `.github/workflows/render-site.yml` runs (≈10 s).
The admin tools write JSON and dispatch that workflow; they never write
HTML.

## Templates

`templates/post.html`, `archive.html`, `home.html`, `page.html`,
`redirect.html` use `{{placeholders}}` filled by `lib/shell.js`'s
`fill()`. `{{content}}` is always filled last so a body containing
`{{…}}` is never expanded. Shared pieces live in `templates/partials/`
(`head`, `nav`, `rail`, `footer`). Design tokens: `css/site.css` on top
of `portfolio/css/style.css`; admin tools: `admin/admin.css`.
