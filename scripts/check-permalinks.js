#!/usr/bin/env node
// Permalink guarantee (Decision 014). A committed list of every public
// URL and every feed GUID is the contract; nothing may regenerate in a
// way that loses one of them.
//
//   node scripts/check-permalinks.js              # check: exit 1 if any protected URL/GUID is gone
//   node scripts/check-permalinks.js --snapshot   # grow the list from the current tree + feeds
//   node scripts/check-permalinks.js --snapshot --allow-removals  # rebuild without the union (rare; needs a DECISIONS entry)
//
// The list only grows on --snapshot (union with the previous list), so
// a URL that ever shipped stays protected. Run `check` before every
// commit of a regeneration; the GitHub Actions do the same.
//
// A "retired" page satisfies the check as long as its index.html still
// exists (it becomes a redirect page — never deleted).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..');
const SITE = 'https://learningischange.com';
const LIST = path.join(REPO_ROOT, 'database', 'permalinks.json');
const FEEDS = ['feed/index.xml', 'feed/full.xml', 'feed/podcast/feed.xml'];

const args = process.argv.slice(2);
const SNAPSHOT = args.includes('--snapshot');
const ALLOW_REMOVALS = args.includes('--allow-removals');

// Same exclusions as generate-sitemap.js: tooling, data, WordPress runtime.
const SKIP_DIRS = new Set([
  '.git', 'node_modules', 'docs', 'templates', 'scripts', 'database',
  'admin', 'new', 'edit', 'update', 'remove', 'archive-sync',
  'rss-creator', 'podcast-rss', 'menus', 'links', 'database-generator',
  'wp-admin', 'wp-includes', 'wp-content', '__qs',
]);

function* walk(dir, rel = '') {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (e.name.startsWith('.')) continue;
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) {
      if (!rel && SKIP_DIRS.has(e.name)) continue;
      yield* walk(path.join(dir, e.name), r);
    } else if (e.isFile() && (e.name === 'index.html' || (!rel && e.name.endsWith('.html')))) {
      yield e.name === 'index.html' ? (rel ? `/${rel}/` : '/') : `/${r}`;
    }
  }
}

function feedGuids() {
  const out = {};
  for (const f of FEEDS) {
    const p = path.join(REPO_ROOT, f);
    if (!fs.existsSync(p)) continue;
    const xml = fs.readFileSync(p, 'utf8');
    out[f] = [...xml.matchAll(/<guid[^>]*>([^<]+)<\/guid>/g)].map((m) => m[1].trim()).sort();
  }
  return out;
}

function urlToFile(u) {
  const rel = decodeURI(u).replace(/^\//, '');
  return u.endsWith('/') ? path.join(REPO_ROOT, rel, 'index.html') : path.join(REPO_ROOT, rel);
}

function load() {
  if (!fs.existsSync(LIST)) return { urls: [], guids: {} };
  return JSON.parse(fs.readFileSync(LIST, 'utf8'));
}

if (SNAPSHOT) {
  const prev = ALLOW_REMOVALS ? { urls: [], guids: {} } : load();
  const urls = [...new Set([...prev.urls, ...walk(REPO_ROOT)])].sort();
  const guids = feedGuids();
  for (const [f, list] of Object.entries(prev.guids || {})) {
    guids[f] = [...new Set([...(guids[f] || []), ...list])].sort();
  }
  const data = { generated: new Date().toISOString().slice(0, 10), site: SITE, urls, guids };
  fs.writeFileSync(LIST, JSON.stringify(data, null, 1) + '\n');
  const g = Object.values(guids).reduce((n, l) => n + l.length, 0);
  console.log(`SNAPSHOT — ${urls.length} URLs (+${urls.length - prev.urls.length}), ${g} feed GUIDs → database/permalinks.json`);
  process.exit(0);
}

// ---- check ----
const list = load();
if (!list.urls.length) { console.error('No database/permalinks.json — run with --snapshot first.'); process.exit(2); }

const missingUrls = list.urls.filter((u) => !fs.existsSync(urlToFile(u)));
const now = feedGuids();
const missingGuids = [];
// feed/index.xml is a rolling window (newest N), so its GUIDs are not retained —
// instead every GUID it carries must be a real, retained item of full.xml.
const ROLLING = new Set(['feed/index.xml']);
// Posts removed via /remove/ are tombstones in their shard: the URL must still
// resolve (redirect page), but their feed GUID is allowed to disappear.
const tombstoned = new Set();
{
  const dir = path.join(REPO_ROOT, 'database', 'posts');
  for (const f of fs.readdirSync(dir).filter((n) => /^\d{4}\.json$/.test(n))) {
    for (const p of JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')).posts || []) {
      if (p.removed && p.url) tombstoned.add(SITE + String(p.url).replace(/^https?:\/\/[^/]+/, '').replace(/\/?$/, '/'));
    }
  }
}
const fullSet = new Set(now['feed/full.xml'] || []);
for (const [f, guids] of Object.entries(list.guids || {})) {
  if (ROLLING.has(f)) continue;
  const have = new Set(now[f] || []);
  for (const g of guids) if (!have.has(g) && !tombstoned.has(g)) missingGuids.push(`${f}: ${g}`);
}
for (const f of ROLLING) for (const g of now[f] || []) if (!fullSet.has(g)) missingGuids.push(`${f}: ${g} (not in full.xml)`);

const ok = missingUrls.length === 0 && missingGuids.length === 0;
console.log(`${ok ? 'OK' : 'FAIL'} — ${list.urls.length} protected URLs, ${Object.values(list.guids || {}).reduce((n, l) => n + l.length, 0)} feed GUIDs checked`);
if (missingUrls.length) { console.error(`\n${missingUrls.length} URL(s) no longer resolve:`); missingUrls.slice(0, 50).forEach((u) => console.error('  ' + u)); if (missingUrls.length > 50) console.error(`  … +${missingUrls.length - 50} more`); }
if (missingGuids.length) { console.error(`\n${missingGuids.length} feed GUID(s) missing:`); missingGuids.slice(0, 50).forEach((g) => console.error('  ' + g)); }
process.exit(ok ? 0 : 1);
