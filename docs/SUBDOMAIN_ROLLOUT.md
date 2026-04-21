# Subdomain Rollout Playbook

How to apply the Learning is Change admin toolkit to another subdomain
repo (`BothAndPodcast`, `Masculinity-Detox`, `WhitfordWest-Family`).

Each subdomain was part of the same WordPress multisite and now lives
as its own static Pages repo. They share the Fluida theme, so most of
the tooling ports with a one-file config change.

## What to copy

From this repo, the portable pieces are:

```
admin/lib/*              ← shared ES modules; site-agnostic
admin/dedup/             ← dedup review tool + scan.js
admin/regenerate/        ← fragment editor
admin/db-maintenance/    ← stats recompute
scripts/                 ← backfill, dedup, marker, regenerate scripts
.github/workflows/       ← dedup-execute, regenerate-fragments,
                            regenerate-posts, database-maintenance,
                            update-rss, remove-from-rss
templates/post.html      ← re-capture per-subdomain (see below)
templates/fragments/     ← re-capture per-subdomain (see below)
```

Do NOT copy:
- `CLAUDE.md`, `SCRATCHPAD.md`, `DECISIONS.md` — project-specific memory
- `/new/`, `/edit/`, `/update/`, `/remove/`, etc. — each subdomain's
  content is different; tooling should be re-captured, not copied
- `database/` — each subdomain has its own post/page/taxonomy data
- Post HTML files — each subdomain has its own posts

## Configuration

One file per subdomain: `admin/lib/config.js`. Edit these fields:

```js
export const CONFIG = {
  repo: {
    owner: 'bhwilkoff',
    name: 'BothAndPodcast',     // <-- change per subdomain
    branch: 'main',
  },
  site: {
    hostname: 'bothand.learningischange.com',  // <-- change
    base: 'https://bothand.learningischange.com',
  },
  // ...
};
```

Everything else (`admin/lib/github.js`, `slug.js`, `database.js`, etc.)
is site-agnostic.

## Step-by-step rollout for one subdomain

Replace `<SUB>` with the target subdomain repo name (e.g.,
`BothAndPodcast`).

### 1. Clone both repos

```sh
cd /tmp
gh repo clone bhwilkoff/LearningIsChange lic-source --  --depth=1 --single-branch
gh repo clone bhwilkoff/<SUB> <SUB>-target
```

### 2. Copy the portable pieces

```sh
cd <SUB>-target
for p in admin/lib admin/dedup admin/regenerate admin/db-maintenance scripts; do
  mkdir -p "$(dirname $p)"
  cp -R /tmp/lic-source/$p .
done
cp -R /tmp/lic-source/.github/workflows/dedup-execute.yml            .github/workflows/
cp -R /tmp/lic-source/.github/workflows/regenerate-fragments.yml     .github/workflows/
cp -R /tmp/lic-source/.github/workflows/regenerate-posts.yml         .github/workflows/
cp -R /tmp/lic-source/.github/workflows/database-maintenance.yml     .github/workflows/
```

### 3. Edit `admin/lib/config.js`

Set `repo.name` and `site.hostname` / `site.base` to match this subdomain.

### 4. Zone markers + fragment capture

On this subdomain:

```sh
node scripts/add-zone-markers.js --apply         # wraps all HTML pages with LIC:ZONE markers
node scripts/capture-fragments.js <canonical-page-path>
# e.g. node scripts/capture-fragments.js 2016/07/15/some-post/index.html
```

### 5. Post template capture

```sh
node scripts/capture-post-template.js <same-canonical-path>
```

### 6. Backfill post content into JSON

If this subdomain has `database/posts/YYYY.json`:

```sh
node scripts/backfill-posts-content.js --apply
```

If it doesn't have a database, skip this — the regenerator won't run
until a JSON index exists.

### 7. Commit + push

```sh
git add -A
git commit -m "Adopt LearningIsChange admin toolkit"
git push
```

### 8. Verify in the browser

- `https://<sub>.example/admin/` — dashboard loads
- `https://<sub>.example/admin/dedup/` — tool loads, shows scan manifest
- `https://<sub>.example/admin/regenerate/` — fragments editor loads
- `https://<sub>.example/admin/db-maintenance/` — recompute tool loads

If fragments don't render in the regenerate tool, check that
`templates/fragments/*.html` were committed.

## Re-use vs fork

The shared `admin/lib/*` modules are designed so all subdomain repos
stay in lockstep on the plumbing. When you fix a bug in
`admin/lib/github.js` here, you can pull-request the same change into
each subdomain repo (or run `cp` again).

If a subdomain needs custom behavior, fork the specific module there
(e.g., `admin/lib/feeds.js` overridden to match that site's RSS schema).
Most won't need this.

## What's not included

The M4 post regenerator (`templates/post.html` + `regenerate-posts.js`)
assumes the site uses the Fluida theme with `<div class="entry-content"
itemprop="articleBody">` as the post body wrapper. Each subdomain was
migrated from the same multisite so this holds today. If a subdomain
ever gets re-themed, the template capture + regenerator need to be
re-run against the new structure.

The /new/ and /edit/ tools are NOT in the portable set because they
generate tool-specific HTML (including site-specific masthead/sidebar
snapshots). A full port of those tools to a subdomain would require
re-capturing those snapshots and re-testing the publish flow there.

## History rewrite note

If a subdomain ever does a bulk dedup (like we did here), note that a
`.git filter-repo` rewrite of that repo's history may fail on HTTPS
push for large rewrites — GitHub's HTTP endpoint returns 500 for
multi-GB pushes. Use SSH if needed (`git remote set-url origin
git@github.com:bhwilkoff/<SUB>.git`). We hit this on the LearningIsChange
repo and backed off the rewrite; working tree deletions landed fine.
