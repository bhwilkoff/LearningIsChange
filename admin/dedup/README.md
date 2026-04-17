# admin/dedup — media dedup review

Find orphaned, duplicate, and broken-reference media across the repo.
Review every candidate in the browser. Export a decisions manifest that
tells the executor (committed separately, not yet wired up) what to
delete.

## Quick workflow

1. **Regenerate the manifest** (whenever the repo has changed):
   ```sh
   node admin/dedup/scan.js
   ```
   This walks `wp-content/uploads/` and every HTML/XML/JSON/CSS/JS/MD
   file in the repo, and writes `admin/dedup/data/manifest.json`.

2. **Review in the browser**:
   - Local: open `admin/dedup/index.html` in a browser. If it fails to
     load `manifest.json` under `file://`, run a dev server from the
     repo root (e.g. `npx serve .`) and visit
     `http://localhost:3000/admin/dedup/`.
   - Published: once committed, available at
     `https://learningischange.com/admin/dedup/`.

3. **Make decisions**:
   - **Variants** (≈13,640 items): default is *delete*. Jetpack CDN
     regenerates every size variant on the fly from the original, so
     these are safe to remove.
   - **Orphan images** (≈468 items): default is *pending* — review
     each thumbnail, mark keep or delete.
   - **Audio / video** (≈24 items): default is *keep*. Ben recently
     uploaded these to old directories for eventual post embedding.
   - **Broken refs** (≈67 items): references in HTML/XML that point
     to non-existent files. Either restore the missing media or edit
     the ref.
   - **Duplicate clusters** (≈2,381 items): for each cluster of
     byte-identical files, pick one canonical copy (the referenced
     one, shown with ★) and mark the rest delete.

4. **Export decisions**: top-right <kbd>Export decisions</kbd> downloads
   `decisions-YYYY-MM-DD.json`. Import it later to resume, or hand to
   the executor.

5. **Execute** from the Summary tab:
   - Dry run first — commits `admin/dedup/data/decisions.json` and
     runs the workflow in preview mode (prints paths, doesn't delete).
     Open the Actions tab to see the plan.
   - Execute for real — same flow with `dry_run=false`. Confirms by
     requiring you to type <code>DELETE N FILES</code>. Workflow
     deletes, commits, pushes server-side.

## The executor workflow

Dispatched workflow: [`.github/workflows/dedup-execute.yml`](../../.github/workflows/dedup-execute.yml).

Inputs:
- `dry_run` — `'true'` or `'false'`. Dry run never modifies anything.
- `confirm_count` — must match the number of `"delete"` entries in
  `admin/dedup/data/decisions.json` (safety interlock: re-export if
  you've edited decisions since the last commit).

Safety gates inside the workflow:
- Every path must begin with `wp-content/uploads/`.
- No `..` path-traversal segments; no leading `/`.
- Max 20,000 deletions per run. Split the work into multiple
  committed+dispatched rounds if you need more.

The workflow does a `git add -A` + single commit + push. Commit
message: <code>dedup: delete N orphan media files (M.M MB)</code>.

## Required GitHub PAT scopes

The tool uses the PAT stored under `licAdminSettings` (same key as the
other admin tools). Scopes needed:
- `repo` — for the contents API (committing `decisions.json`)
- `workflow` — for dispatching `dedup-execute.yml`

## Resuming after a batch

After a successful run, re-run `node admin/dedup/scan.js` locally to
refresh `data/manifest.json`, commit it, then come back to the tool.
The old `decisions.json` is still on `main` — clear old entries via
the tool's <em>Clear decisions in class</em> buttons, or delete
`data/decisions.json` manually before your next round.

## Files in this directory

| Path | Purpose |
|---|---|
| `scan.js` | Node script that produces `data/manifest.json` |
| `index.html` | Browser review UI (ES modules; depends on `../lib/`) |
| `data/manifest.json` | Scan output — committed so the UI loads via Pages |
| `README.md` | This file |

## Design notes

- Decisions are stored in `localStorage` under `licDedupDecisions`.
  Keys are the relative path from the repo root; values are `keep`,
  `delete`, or absent (means "use class default").
- The GitHub PAT shares the `licAdminSettings` localStorage key used
  by the other admin tools — you only enter the token once.
- The scan regex matches any `wp-content/uploads/…` path inside any
  text file, including Jetpack CDN URLs (`i0.wp.com/...`) and Blubrry
  podcast URLs (`media.blubrry.com/.../wp-content/uploads/...`) — the
  regex starts matching at `wp-content/` regardless of prefix.
- `admin/lib/config.js` and `admin/lib/github.js` are site-agnostic;
  the subdomain repos can adopt them by editing only `config.js`.
