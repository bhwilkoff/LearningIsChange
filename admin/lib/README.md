# admin/lib — shared ES modules for admin tools

All admin tools (`/new/`, `/edit/`, `/update/`, `/remove/`,
`/archive-sync/`, `/rss-creator/`, `/podcast-rss/`, `/menus/`,
`/links/`, `/search/`, `/admin/dedup/`) should load their plumbing
from these modules instead of re-implementing it inline.

## Modules

| Module | Exports | Purpose |
|---|---|---|
| `config.js` | `CONFIG`, `photonUrl()` | Site-agnostic configuration. The subdomain repos adopt `admin/lib/` unchanged by editing only this file. |
| `auth.js` | `getSettings()`, `saveSettings()`, `clearSettings()`, `getGitHubCreds()` | Shared `licAdminSettings` localStorage; auto-migrates legacy `lic_admin_settings`. |
| `base64.js` | `encode()`, `decode()`, `bytesToBase64()`, `base64ToBytes()`, `fileToBase64()` | UTF-8 safe base64 with 32 KB chunking. |
| `slug.js` | `slugify()`, `formatDate()`, `postPath()`, `postUrl()`, `isoDate()`, `yearMonth()` | Post URL and date helpers. Matches the Post Generator's existing output exactly. |
| `database.js` | `fetchManifest()`, `fetchTaxonomies()`, `fetchAuthors()`, `fetchPages()`, `fetchPostsByYear()`, `fetchAllPosts()`, `fetchEverything()` | Read-only access to `/database/*.json` via the public Pages URL (avoids burning GitHub API rate limit). |
| `github.js` | `GitHubAPI` class | REST client with Bearer auth, retries, git data API, and `commitFiles()` batch commit. |

Planned (M1 continued):

| Module | Purpose |
|---|---|
| `mutate.js` | Null-safe mutators for posts/pages/taxonomies/authors/changelog. |
| `template.js` | Fetch page, find `LIC:<ZONE>` markers, replace fragment content. (Depends on M3 marker migration.) |
| `editor.js` | Native `contenteditable` wrapper with image resize modal. |
| `pickers.js` | Category and tag chip pickers. |
| `feeds.js` | RSS item builder for `feed/index.xml` + podcast feed. |
| `archives.js` | Regenerate month/year/category/tag/author archive pages from the post database. |

## Usage from a tool

```html
<script type="module">
  import { CONFIG } from '/admin/lib/config.js';
  import { getSettings, saveSettings, getGitHubCreds } from '/admin/lib/auth.js';
  import { GitHubAPI } from '/admin/lib/github.js';
  import { fetchTaxonomies, fetchPostsByYear } from '/admin/lib/database.js';
  import { slugify, postPath, formatDate } from '/admin/lib/slug.js';

  const api = new GitHubAPI(getGitHubCreds());
  // …
</script>
```

The `<script type="module">` form is required because these are ES
modules. `file://` origins can't load them (CORS) — run a local dev
server or access via GitHub Pages.

## Conventions

- **No default exports.** Named exports only. Consistent import syntax.
- **No build step.** Modules are written to be served as-is by Pages.
- **Site-agnosticism.** Paths, repo names, and branding come from
  `config.js`. A module that hard-codes `learningischange.com` belongs
  elsewhere.
- **Null-safe mutators.** Old posts have inconsistent shapes. Any
  function that writes to the JSON database must guard against
  missing fields and preserve unknown keys.
- **Idempotent reads.** Fetching the manifest or a post shard twice
  must return the same data (cache-busting via `?t=…` is fine; we
  don't rely on client-side caching).

## Migration status

- `admin/dedup/` — uses `config.js` + `github.js` directly. ✅
- `/new/` — pending migration (M1.1, highest priority).
- `/edit/` — pending migration (M1.2).
- `/update/` — pending migration (M1.3; biggest file, wait for lib maturity).
- Others — mechanical migration once the first three are done.
